import { toRecommendationInputItems } from "@/utils/recommendationInput";
import type { ClosetItem } from "@/utils/storage";

export const CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY =
  "naes_closet_recommendation_index";
export const RECOMMENDATION_REVISIONS_STORAGE_KEY =
  "naes_recommendation_revisions";
export const HOME_RECOMMENDATION_CACHE_STORAGE_KEY =
  "naes_home_recommendation_cache";
// Bump this when the recommendation input shape or normalization rules change.
export const CLOSET_RECOMMENDATION_INDEX_VERSION = 1;
export const RECOMMENDATION_REVISIONS_VERSION = 1;

export type RecommendationRevisionState = {
  version: number;
  closetRevision: number;
  profileRevision: number;
  savedOutfitRevision: number;
  feedbackRevision: number;
};

export type RecommendationRevisionField =
  | "closetRevision"
  | "profileRevision"
  | "savedOutfitRevision"
  | "feedbackRevision";

export type RecommendationRevisionReadResult = {
  state: RecommendationRevisionState;
  status: "valid" | "missing" | "invalid";
};

export type ClosetRecommendationIndex = {
  version: number;
  closetRevision: number;
  recommendationItems: ClosetItem[];
  categoryCounts: Record<string, number>;
  generatedAt: string;
};

export type ClosetRecommendationIndexReadResult = {
  index?: ClosetRecommendationIndex;
  status: "valid" | "missing" | "invalid" | "version_mismatch" | "stale";
};

export function createDefaultRecommendationRevisionState(): RecommendationRevisionState {
  return {
    version: RECOMMENDATION_REVISIONS_VERSION,
    closetRevision: 0,
    profileRevision: 0,
    savedOutfitRevision: 0,
    feedbackRevision: 0,
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseRecommendationRevisionState(
  rawValue: string | null
): RecommendationRevisionReadResult {
  if (!rawValue) {
    return {
      state: createDefaultRecommendationRevisionState(),
      status: "missing",
    };
  }

  try {
    const value = JSON.parse(rawValue) as Partial<RecommendationRevisionState>;
    const isValid =
      value.version === RECOMMENDATION_REVISIONS_VERSION &&
      isNonNegativeInteger(value.closetRevision) &&
      isNonNegativeInteger(value.profileRevision) &&
      isNonNegativeInteger(value.savedOutfitRevision) &&
      (value.feedbackRevision === undefined ||
        isNonNegativeInteger(value.feedbackRevision));

    if (!isValid) {
      return {
        state: createDefaultRecommendationRevisionState(),
        status: "invalid",
      };
    }

    return {
      state: {
        ...(value as RecommendationRevisionState),
        feedbackRevision: value.feedbackRevision ?? 0,
      },
      status: "valid",
    };
  } catch {
    return {
      state: createDefaultRecommendationRevisionState(),
      status: "invalid",
    };
  }
}

export function incrementRecommendationRevisions(
  current: RecommendationRevisionState,
  fields: RecommendationRevisionField[]
) {
  const next = { ...current, version: RECOMMENDATION_REVISIONS_VERSION };

  new Set(fields).forEach((field) => {
    next[field] += 1;
  });

  return next;
}

export function getRecommendationRevisionKey(
  revisions: RecommendationRevisionState
) {
  return [
    `v${RECOMMENDATION_REVISIONS_VERSION}`,
    `c${revisions.closetRevision}`,
    `p${revisions.profileRevision}`,
    `s${revisions.savedOutfitRevision}`,
    `f${revisions.feedbackRevision}`,
  ].join("|");
}

export function isHomeRecommendationCacheKeyForRevision(
  cacheKey: string | undefined,
  revisionKey: string
) {
  return cacheKey === revisionKey || cacheKey?.startsWith(`${revisionKey}|`) === true;
}

function getCategoryCounts(items: ClosetItem[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const category = item.category?.trim() || "기타";
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
}

export function buildClosetRecommendationIndex(
  items: ClosetItem[],
  closetRevision: number,
  generatedAt = new Date().toISOString()
): ClosetRecommendationIndex {
  return {
    version: CLOSET_RECOMMENDATION_INDEX_VERSION,
    closetRevision,
    recommendationItems: toRecommendationInputItems(items),
    categoryCounts: getCategoryCounts(items),
    generatedAt,
  };
}

function isValidRecommendationItem(value: unknown): value is ClosetItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ClosetItem>;

  return (
    typeof item.id === "string" &&
    typeof item.category === "string" &&
    typeof item.imageUri === "string" &&
    typeof item.createdAt === "string"
  );
}

function isValidCategoryCounts(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.values(value).every(isNonNegativeInteger);
}

export function parseClosetRecommendationIndex(
  rawValue: string | null,
  expectedClosetRevision: number
): ClosetRecommendationIndexReadResult {
  if (!rawValue) return { status: "missing" };

  try {
    const value = JSON.parse(rawValue) as Partial<ClosetRecommendationIndex>;

    if (value.version !== CLOSET_RECOMMENDATION_INDEX_VERSION) {
      return { status: "version_mismatch" };
    }

    if (value.closetRevision !== expectedClosetRevision) {
      return { status: "stale" };
    }

    if (
      !Array.isArray(value.recommendationItems) ||
      !value.recommendationItems.every(isValidRecommendationItem) ||
      !isValidCategoryCounts(value.categoryCounts) ||
      typeof value.generatedAt !== "string"
    ) {
      return { status: "invalid" };
    }

    return {
      index: value as ClosetRecommendationIndex,
      status: "valid",
    };
  } catch {
    return { status: "invalid" };
  }
}
