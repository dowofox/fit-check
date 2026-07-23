import type { ClothesAnalysis } from "@/utils/clothesAnalysis";
import {
  getClosetItemAnalysisImageUris,
  getClosetItemAnalysisUpdateAvailability,
  getClosetItemLocalAnalysisUpdate,
  mergeClosetItemAnalysisUpdate,
} from "@/utils/closetAnalysisRefresh";
import type {
  ClosetItem,
  ClosetItemsLoadResult,
  UpdateClosetItemFromLatestResult,
} from "@/utils/storage";

export const CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY =
  "naes_closet_analysis_refresh_job";

export type ClosetAnalysisRefreshJobStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_errors"
  | "cancelled"
  | "failed";

export type ClosetAnalysisRefreshJob = {
  jobId: string;
  status: ClosetAnalysisRefreshJobStatus;
  targetItemIds: string[];
  pendingItemIds: string[];
  completedItemIds: string[];
  failedItemIds: string[];
  skippedItemIds: string[];
  currentItemId?: string;
  total: number;
  processed: number;
  updated: number;
  unchanged: number;
  failed: number;
  skipped: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type ClosetAnalysisRefreshSnapshot = {
  hydrated: boolean;
  job: ClosetAnalysisRefreshJob | null;
};

export type ClosetAnalysisRefreshJobStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type ClosetAnalysisRefreshManagerDependencies = {
  jobStorage: ClosetAnalysisRefreshJobStorage;
  loadClosetItems: () => Promise<ClosetItemsLoadResult>;
  updateItemFromLatest: (
    id: string,
    getChanges: (item: ClosetItem) => Partial<ClosetItem> | null
  ) => Promise<UpdateClosetItemFromLatestResult>;
  requestPhotoAnalysis: (
    imageUri: string,
    item: ClosetItem,
    signal: AbortSignal
  ) => Promise<ClothesAnalysis>;
  isRecoverableImageError: (error: unknown) => boolean;
  now?: () => string;
  createJobId?: () => string;
};

type ItemProcessResult = "updated" | "unchanged" | "failed" | "skipped";

const JOB_STATUSES = new Set<ClosetAnalysisRefreshJobStatus>([
  "idle",
  "running",
  "paused",
  "completed",
  "completed_with_errors",
  "cancelled",
  "failed",
]);

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim())
      )
    )
  );
}

function isFiniteNonNegative(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

export function parseClosetAnalysisRefreshJob(
  rawValue: string | null
): ClosetAnalysisRefreshJob | null {
  if (!rawValue) return null;

  try {
    const value = JSON.parse(rawValue) as Record<string, unknown>;
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.jobId !== "string" ||
      !value.jobId ||
      typeof value.status !== "string" ||
      !JOB_STATUSES.has(value.status as ClosetAnalysisRefreshJobStatus) ||
      typeof value.startedAt !== "string" ||
      typeof value.updatedAt !== "string"
    ) {
      return null;
    }

    const targetItemIds = uniqueIds(value.targetItemIds);
    const pendingItemIds = uniqueIds(value.pendingItemIds);
    const completedItemIds = uniqueIds(value.completedItemIds);
    const failedItemIds = uniqueIds(value.failedItemIds);
    const skippedItemIds = uniqueIds(value.skippedItemIds);
    const counters = [
      value.total,
      value.processed,
      value.updated,
      value.unchanged,
      value.failed,
      value.skipped,
    ];
    if (!counters.every(isFiniteNonNegative)) return null;

    return {
      jobId: value.jobId,
      status: value.status as ClosetAnalysisRefreshJobStatus,
      targetItemIds,
      pendingItemIds,
      completedItemIds,
      failedItemIds,
      skippedItemIds,
      currentItemId:
        typeof value.currentItemId === "string" && value.currentItemId
          ? value.currentItemId
          : undefined,
      total: value.total as number,
      processed: value.processed as number,
      updated: value.updated as number,
      unchanged: value.unchanged as number,
      failed: value.failed as number,
      skipped: value.skipped as number,
      startedAt: value.startedAt,
      updatedAt: value.updatedAt,
      completedAt:
        typeof value.completedAt === "string"
          ? value.completedAt
          : undefined,
    };
  } catch {
    return null;
  }
}

function isAbortError(error: unknown) {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError")
  );
}

function createDefaultJobId() {
  return `closet-analysis-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export class ClosetAnalysisRefreshManager {
  private snapshot: ClosetAnalysisRefreshSnapshot = {
    hydrated: false,
    job: null,
  };

  private readonly listeners = new Set<() => void>();
  private activePromise: Promise<void> | null = null;
  private startPromise: Promise<void> | null = null;
  private hydratePromise: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  private activeAbortController: AbortController | null = null;
  private generation = 0;

  constructor(
    private readonly dependencies: ClosetAnalysisRefreshManagerDependencies
  ) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private replaceSnapshot(
    job: ClosetAnalysisRefreshJob | null,
    hydrated = this.snapshot.hydrated
  ) {
    this.snapshot = { hydrated, job };
    this.emit();
  }

  private getNow() {
    return this.dependencies.now?.() || new Date().toISOString();
  }

  private queuePersist(job: ClosetAnalysisRefreshJob | null) {
    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(async () => {
        if (job) {
          await this.dependencies.jobStorage.setItem(
            CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
            JSON.stringify(job)
          );
        } else {
          await this.dependencies.jobStorage.removeItem(
            CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY
          );
        }
      })
      .catch((error) => {
        console.error("옷장 분석 작업 상태 저장 실패:", error);
      });
    return this.persistQueue;
  }

  private async setJob(job: ClosetAnalysisRefreshJob | null) {
    this.replaceSnapshot(job, true);
    await this.queuePersist(job);
  }

  async hydrate() {
    if (this.snapshot.hydrated) return;
    if (this.hydratePromise) return this.hydratePromise;

    const hydratePromise = (async () => {
      try {
        const rawValue = await this.dependencies.jobStorage.getItem(
          CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY
        );
        const parsedJob = parseClosetAnalysisRefreshJob(rawValue);

        if (!parsedJob) {
          if (rawValue !== null) {
            await this.dependencies.jobStorage.removeItem(
              CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY
            );
          }
          this.replaceSnapshot(null, true);
          return;
        }

        if (parsedJob.status === "running") {
          const pendingItemIds = parsedJob.currentItemId
            ? uniqueIds([
                parsedJob.currentItemId,
                ...parsedJob.pendingItemIds,
              ])
            : parsedJob.pendingItemIds;
          const pausedJob = {
            ...parsedJob,
            status: "paused" as const,
            pendingItemIds,
            currentItemId: undefined,
            updatedAt: this.getNow(),
          };
          this.replaceSnapshot(pausedJob, true);
          await this.queuePersist(pausedJob);
          return;
        }

        this.replaceSnapshot(parsedJob, true);
      } catch (error) {
        console.error("옷장 분석 작업 상태 복구 실패:", error);
        this.replaceSnapshot(null, true);
      }
    })().finally(() => {
      if (this.hydratePromise === hydratePromise) {
        this.hydratePromise = null;
      }
    });

    this.hydratePromise = hydratePromise;
    return hydratePromise;
  }

  start(targetItemIds?: string[]) {
    if (this.activePromise) return this.activePromise;
    if (this.startPromise) return this.startPromise;

    const startPromise = this.prepareAndStart(targetItemIds).finally(() => {
      if (this.startPromise === startPromise) this.startPromise = null;
    });
    this.startPromise = startPromise;
    return startPromise;
  }

  private async prepareAndStart(targetItemIds?: string[]) {
    await this.hydrate();
    if (this.activePromise) return this.activePromise;

    const currentJob = this.snapshot.job;
    if (
      currentJob &&
      (currentJob.status === "running" || currentJob.status === "paused") &&
      currentJob.pendingItemIds.length > 0
    ) {
      return this.runCurrentJob();
    }

    const closetLoad = await this.dependencies.loadClosetItems();
    if (closetLoad.status === "failed") {
      const now = this.getNow();
      await this.setJob({
        jobId: this.dependencies.createJobId?.() || createDefaultJobId(),
        status: "failed",
        targetItemIds: [],
        pendingItemIds: [],
        completedItemIds: [],
        failedItemIds: [],
        skippedItemIds: [],
        total: 0,
        processed: 0,
        updated: 0,
        unchanged: 0,
        failed: 0,
        skipped: 0,
        startedAt: now,
        updatedAt: now,
        completedAt: now,
      });
      return;
    }

    const requestedIds = targetItemIds ? uniqueIds(targetItemIds) : null;
    const closetById = new Map(
      closetLoad.items.map((item) => [item.id, item])
    );
    const orderedItems = requestedIds
      ? requestedIds.flatMap((id) => {
          const item = closetById.get(id);
          return item ? [item] : [];
        })
      : closetLoad.items;
    const candidates = orderedItems.filter((item) => {
      const status = getClosetItemAnalysisUpdateAvailability(item).status;
      return (
        status === "photo_and_classification" ||
        status === "classification_only"
      );
    });
    const ids = candidates.map((item) => item.id);
    const now = this.getNow();
    const job: ClosetAnalysisRefreshJob = {
      jobId: this.dependencies.createJobId?.() || createDefaultJobId(),
      status: ids.length > 0 ? "running" : "completed",
      targetItemIds: ids,
      pendingItemIds: ids,
      completedItemIds: [],
      failedItemIds: [],
      skippedItemIds: [],
      total: ids.length,
      processed: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      skipped: 0,
      startedAt: now,
      updatedAt: now,
      completedAt: ids.length > 0 ? undefined : now,
    };
    await this.setJob(job);
    if (ids.length > 0) return this.runCurrentJob();
  }

  resume() {
    if (this.activePromise) return this.activePromise;
    if (this.startPromise) return this.startPromise;

    const startPromise = (async () => {
      await this.hydrate();
      const job = this.snapshot.job;
      if (
        !job ||
        !["paused", "cancelled", "running"].includes(job.status) ||
        job.pendingItemIds.length === 0
      ) {
        return;
      }
      await this.setJob({
        ...job,
        status: "running",
        currentItemId: undefined,
        updatedAt: this.getNow(),
        completedAt: undefined,
      });
      return this.runCurrentJob();
    })().finally(() => {
      if (this.startPromise === startPromise) this.startPromise = null;
    });
    this.startPromise = startPromise;
    return startPromise;
  }

  async resumeInterrupted() {
    await this.hydrate();
    const job = this.snapshot.job;
    if (
      job &&
      (job.status === "paused" || job.status === "running") &&
      job.pendingItemIds.length > 0
    ) {
      return this.resume();
    }
  }

  retryFailed() {
    const failedIds = this.snapshot.job?.failedItemIds || [];
    if (failedIds.length === 0) return Promise.resolve();
    return this.start(failedIds);
  }

  async cancel() {
    await this.hydrate();
    const job = this.snapshot.job;
    if (
      !job ||
      (job.status !== "running" && job.status !== "paused")
    ) {
      return;
    }

    const activePromise = this.activePromise;
    this.generation += 1;
    this.activeAbortController?.abort();
    const pendingItemIds = job.currentItemId
      ? uniqueIds([job.currentItemId, ...job.pendingItemIds])
      : job.pendingItemIds;
    await this.setJob({
      ...job,
      status: "cancelled",
      pendingItemIds,
      currentItemId: undefined,
      updatedAt: this.getNow(),
    });
    await activePromise;
  }

  async clearResult() {
    await this.hydrate();
    const status = this.snapshot.job?.status;
    if (status === "running" || status === "paused") return;
    await this.setJob(null);
  }

  private runCurrentJob() {
    if (this.activePromise) return this.activePromise;

    const generation = this.generation + 1;
    this.generation = generation;
    const promise = this.executeCurrentJob(generation).finally(() => {
      if (this.activePromise === promise) {
        this.activePromise = null;
        this.activeAbortController = null;
      }
    });
    this.activePromise = promise;
    return promise;
  }

  private isGenerationActive(generation: number) {
    return (
      generation === this.generation &&
      this.snapshot.job?.status === "running"
    );
  }

  private async executeCurrentJob(generation: number) {
    while (this.isGenerationActive(generation)) {
      const job = this.snapshot.job;
      const itemId = job?.pendingItemIds[0];
      if (!job || !itemId) break;

      await this.setJob({
        ...job,
        currentItemId: itemId,
        updatedAt: this.getNow(),
      });
      if (!this.isGenerationActive(generation)) break;

      let outcome: ItemProcessResult;
      try {
        outcome = await this.processItem(itemId, generation);
      } catch (error) {
        if (!this.isGenerationActive(generation) || isAbortError(error)) {
          break;
        }
        console.error("옷장 개별 분석 최신화 실패:", {
          itemId,
          error,
        });
        outcome = "failed";
      }
      if (!this.isGenerationActive(generation)) break;

      const latestJob = this.snapshot.job;
      if (!latestJob || latestJob.jobId !== job.jobId) break;
      const pendingItemIds = latestJob.pendingItemIds.filter(
        (pendingId) => pendingId !== itemId
      );
      const completedItemIds =
        outcome === "updated" || outcome === "unchanged"
          ? uniqueIds([...latestJob.completedItemIds, itemId])
          : latestJob.completedItemIds;
      const failedItemIds =
        outcome === "failed"
          ? uniqueIds([...latestJob.failedItemIds, itemId])
          : latestJob.failedItemIds.filter((failedId) => failedId !== itemId);
      const skippedItemIds =
        outcome === "skipped"
          ? uniqueIds([...latestJob.skippedItemIds, itemId])
          : latestJob.skippedItemIds;
      await this.setJob({
        ...latestJob,
        pendingItemIds,
        completedItemIds,
        failedItemIds,
        skippedItemIds,
        currentItemId: undefined,
        processed: latestJob.processed + 1,
        updated: latestJob.updated + (outcome === "updated" ? 1 : 0),
        unchanged:
          latestJob.unchanged + (outcome === "unchanged" ? 1 : 0),
        failed: latestJob.failed + (outcome === "failed" ? 1 : 0),
        skipped: latestJob.skipped + (outcome === "skipped" ? 1 : 0),
        updatedAt: this.getNow(),
      });
    }

    if (!this.isGenerationActive(generation)) return;
    const job = this.snapshot.job;
    if (!job || job.pendingItemIds.length > 0) return;

    const completedAt = this.getNow();
    await this.setJob({
      ...job,
      status:
        job.failedItemIds.length > 0
          ? "completed_with_errors"
          : "completed",
      currentItemId: undefined,
      updatedAt: completedAt,
      completedAt,
    });
  }

  private async processItem(
    itemId: string,
    generation: number
  ): Promise<ItemProcessResult> {
    const beforeLoad = await this.dependencies.loadClosetItems();
    if (beforeLoad.status === "failed") {
      throw new Error("Stored closet data could not be loaded");
    }
    const itemBeforeAnalysis = beforeLoad.items.find(
      (item) => item.id === itemId
    );
    if (!itemBeforeAnalysis) return "skipped";

    const availability =
      getClosetItemAnalysisUpdateAvailability(itemBeforeAnalysis);
    if (availability.status === "current") return "unchanged";
    if (availability.status === "unavailable") return "skipped";

    let analysis: ClothesAnalysis | undefined;
    let applyPhotoAnalysis = false;
    if (availability.canRefreshPhoto) {
      const controller = new AbortController();
      this.activeAbortController = controller;
      let lastImageError: unknown;

      try {
        for (const imageUri of getClosetItemAnalysisImageUris(
          itemBeforeAnalysis
        )) {
          try {
            analysis = await this.dependencies.requestPhotoAnalysis(
              imageUri,
              itemBeforeAnalysis,
              controller.signal
            );
            applyPhotoAnalysis = true;
            break;
          } catch (error) {
            if (
              controller.signal.aborted ||
              !this.isGenerationActive(generation)
            ) {
              throw error;
            }
            if (!this.dependencies.isRecoverableImageError(error)) {
              throw error;
            }
            lastImageError = error;
          }
        }
      } finally {
        if (this.activeAbortController === controller) {
          this.activeAbortController = null;
        }
      }

      if (!analysis && !availability.canRefreshClassification) {
        throw lastImageError || new Error("No usable analysis image");
      }
    }

    if (!this.isGenerationActive(generation)) {
      const abortError = new Error("The operation was aborted.");
      abortError.name = "AbortError";
      throw abortError;
    }

    let visibleChanges = 0;
    let savedFromItem: ClosetItem | undefined;
    let savedMergeResult:
      | ReturnType<typeof mergeClosetItemAnalysisUpdate>
      | undefined;
    const saveResult = await this.dependencies.updateItemFromLatest(
      itemId,
      (latestItem) => {
        if (!this.isGenerationActive(generation)) return null;
        const latestAvailability =
          getClosetItemAnalysisUpdateAvailability(latestItem);
        if (latestAvailability.status === "current") return null;

        const result = applyPhotoAnalysis
          ? mergeClosetItemAnalysisUpdate(latestItem, analysis, {
              applyClassification: true,
              applyPhotoAnalysis: true,
            })
          : getClosetItemLocalAnalysisUpdate(latestItem);
        savedFromItem = latestItem;
        savedMergeResult = result;
        visibleChanges = result.diffs.length;
        return result.changes;
      }
    );

    if (saveResult.status === "missing") return "skipped";
    if (saveResult.status === "failed") return "failed";
    if (saveResult.status === "unchanged") return "unchanged";
    if (__DEV__ && savedFromItem && savedMergeResult) {
      console.info("[closet-analysis-refresh]", {
        itemId,
        previousClassificationVersion:
          savedFromItem.classificationVersion || 0,
        nextClassificationVersion:
          saveResult.item.classificationVersion || 0,
        previousPhotoAnalysisVersion:
          savedFromItem.photoAnalysisVersion || 0,
        nextPhotoAnalysisVersion:
          saveResult.item.photoAnalysisVersion || 0,
        changedFields: savedMergeResult.diffs.map((diff) => diff.field),
        skippedUserEditedFields:
          savedMergeResult.skippedUserEditedFields,
        source: applyPhotoAnalysis
          ? "photo_and_classification"
          : "classification",
      });
    }
    return visibleChanges > 0 ? "updated" : "unchanged";
  }
}

export function createClosetAnalysisRefreshManager(
  dependencies: ClosetAnalysisRefreshManagerDependencies
) {
  return new ClosetAnalysisRefreshManager(dependencies);
}
