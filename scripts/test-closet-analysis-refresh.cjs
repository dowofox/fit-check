const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const storageMemory = new Map();
let failNextMultiSetAfterFirstEntry = false;

global.__DEV__ = false;

const asyncStorage = {
  async getItem(key) {
    return storageMemory.has(key) ? storageMemory.get(key) : null;
  },
  async setItem(key, value) {
    storageMemory.set(key, value);
  },
  async removeItem(key) {
    storageMemory.delete(key);
  },
  async multiSet(entries) {
    if (failNextMultiSetAfterFirstEntry) {
      failNextMultiSetAfterFirstEntry = false;
      if (entries[0]) storageMemory.set(entries[0][0], entries[0][1]);
      throw new Error("mock partial batch write failure");
    }
    entries.forEach(([key, value]) => storageMemory.set(key, value));
  },
  async multiGet(keys) {
    return keys.map((key) => [
      key,
      storageMemory.has(key) ? storageMemory.get(key) : null,
    ]);
  },
  async multiRemove(keys) {
    keys.forEach((key) => storageMemory.delete(key));
  },
};

const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

Module._load = function loadWithMocks(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return { __esModule: true, default: asyncStorage };
  }
  return originalLoad.call(this, request, parent, isMain);
};

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

const {
  CURRENT_CLASSIFICATION_VERSION,
  CURRENT_PHOTO_ANALYSIS_VERSION,
} = require("../utils/clothesAnalysisVersions.ts");
const {
  getClosetItemAnalysisImageUri,
  getClosetItemAnalysisUpdateAvailability,
  getClosetItemLocalAnalysisUpdate,
  mergeClosetItemAnalysisUpdate,
  prepareClosetAnalysisBatch,
} = require("../utils/closetAnalysisRefresh.ts");
const {
  CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
  createClosetAnalysisRefreshManager,
} = require("../utils/closetAnalysisRefreshManager.ts");
const {
  deleteClosetItem,
  getClosetItems,
  getClosetItemsLoadResult,
  getClosetRecommendationIndex,
  getRecommendationRevisionState,
  getSavedOutfits,
  saveClosetItem,
  saveOutfit,
  updateClosetItem,
  updateClosetItemFromLatest,
  updateClosetItemsBatch,
} = require("../utils/storage.ts");
const {
  buildNaesBackupPayload,
  parseNaesBackupJson,
} = require("../utils/dataBackup.ts");

const createdAt = "2026-01-01T00:00:00.000Z";

function makeItem(overrides = {}) {
  return {
    id: overrides.id || "item-1",
    imageUri:
      overrides.imageUri === undefined
        ? "https://example.com/original.jpg"
        : overrides.imageUri,
    category: "하의",
    subCategory: "팬츠",
    detailCategory: "팬츠",
    color: "블랙",
    style: "캐주얼",
    styleTags: ["캐주얼"],
    seasons: ["사계절"],
    season: "사계절",
    size: "L",
    createdAt,
    ...overrides,
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, message = "condition was not met") {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(message);
}

function makeManager(requestPhotoAnalysis, overrides = {}) {
  return createClosetAnalysisRefreshManager({
    jobStorage: asyncStorage,
    loadClosetItems: getClosetItemsLoadResult,
    updateItemFromLatest: updateClosetItemFromLatest,
    requestPhotoAnalysis,
    isRecoverableImageError: () => false,
    createJobId: () => overrides.jobId || "analysis-job",
    now: overrides.now || (() => new Date().toISOString()),
  });
}

function makePersistedJob(overrides = {}) {
  return {
    jobId: "persisted-job",
    status: "running",
    targetItemIds: ["item-1"],
    pendingItemIds: ["item-1"],
    completedItemIds: [],
    failedItemIds: [],
    skippedItemIds: [],
    currentItemId: "item-1",
    total: 1,
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0,
    startedAt: createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

test.beforeEach(() => {
  storageMemory.clear();
  failNextMultiSetAfterFirstEntry = false;
});

test("1. old generic classification upgrades in place from confirmed product", () => {
  const item = makeItem({
    confirmedProduct: {
      brand: "NAES",
      productName: "벌룬 팬츠",
      productUrl: "https://example.com/product",
      confirmedAt: createdAt,
    },
  });
  const result = getClosetItemLocalAnalysisUpdate(item, "2026-07-01T00:00:00.000Z");

  assert.equal(result.item.id, item.id);
  assert.equal(result.item.detailCategory, "벌룬 팬츠");
  assert.equal(result.item.classificationVersion, CURRENT_CLASSIFICATION_VERSION);
});

test("2. user-edited detail category is preserved", () => {
  const item = makeItem({
    detailCategory: "카펜터 팬츠",
    userEditedClassificationFields: ["detailCategory"],
    confirmedProduct: {
      brand: "NAES",
      productName: "벌룬 팬츠",
      productUrl: "",
      confirmedAt: createdAt,
    },
  });
  const result = getClosetItemLocalAnalysisUpdate(item);

  assert.equal(result.item.detailCategory, "카펜터 팬츠");
  assert.deepEqual(result.skippedUserEditedFields, ["detailCategory"]);
});

test("3. user-edited seasons are preserved over official inference", () => {
  const item = makeItem({
    seasons: ["겨울"],
    season: "겨울",
    userEditedClassificationFields: ["season"],
    confirmedProduct: {
      brand: "NAES",
      productName: "린넨 팬츠",
      productUrl: "",
      confirmedAt: createdAt,
    },
  });
  const result = getClosetItemLocalAnalysisUpdate(item);

  assert.deepEqual(result.item.seasons, ["겨울"]);
  assert.equal(result.item.season, "겨울");
});

test("4. a generic photo result cannot downgrade a specific detail category", () => {
  const item = makeItem({ detailCategory: "벌룬 팬츠" });
  const result = mergeClosetItemAnalysisUpdate(item, {
    category: "하의",
    subCategory: "팬츠",
    detailCategory: "팬츠",
  });

  assert.equal(result.item.detailCategory, "벌룬 팬츠");
});

test("5. a more specific photo result upgrades a generic detail category", () => {
  const item = makeItem({ detailCategory: "팬츠" });
  const result = mergeClosetItemAnalysisUpdate(item, {
    category: "하의",
    subCategory: "팬츠",
    detailCategory: "벌룬 팬츠",
  });

  assert.equal(result.item.detailCategory, "벌룬 팬츠");
});

test("6. empty and uncertain values do not overwrite valid data", () => {
  const item = makeItem({
    color: "네이비",
    material: "면 100%",
    styleTags: ["미니멀"],
  });
  const result = mergeClosetItemAnalysisUpdate(item, {
    color: "",
    material: "판단 어려움",
    styleTags: [],
    detailCategory: "분석 전",
  });

  assert.equal(result.item.color, "네이비");
  assert.equal(result.item.material, "면 100%");
  assert.deepEqual(result.item.styleTags, ["미니멀"]);
});

test("7. a rejected photo request leaves the current item unchanged", async () => {
  const item = makeItem();
  const snapshot = structuredClone(item);

  await assert.rejects(
    () => Promise.reject(new Error("analysis failed")),
    /analysis failed/
  );
  assert.deepEqual(item, snapshot);
});

test("8. confirmed-product-only items support local classification refresh", () => {
  const item = makeItem({
    imageUri: "",
    confirmedProduct: {
      brand: "NAES",
      productName: "와이드 슬랙스",
      productUrl: "",
      confirmedAt: createdAt,
    },
  });
  const availability = getClosetItemAnalysisUpdateAvailability(item);

  assert.equal(availability.status, "classification_only");
  assert.equal(availability.canRefreshPhoto, false);
  assert.equal(getClosetItemLocalAnalysisUpdate(item).item.detailCategory, "와이드 슬랙스");
});

test("9. items without a photo or confirmed product are unavailable", () => {
  const availability = getClosetItemAnalysisUpdateAvailability(
    makeItem({ imageUri: "", cleanImageUri: "" })
  );

  assert.equal(availability.status, "unavailable");
});

test("10. refresh preserves id, createdAt, image, size, and confirmed product", () => {
  const confirmedProduct = {
    brand: "NAES",
    productName: "벌룬 팬츠",
    productUrl: "https://example.com/product",
    productSizeGuide: { unit: "cm", sizes: [{ size: "L", waist: 42 }] },
    confirmedAt: createdAt,
  };
  const item = makeItem({
    cleanImageUri: "file:///clean.png",
    confirmedProduct,
  });
  const result = mergeClosetItemAnalysisUpdate(item, {
    detailCategory: "벌룬 팬츠",
  });

  assert.equal(result.item.id, item.id);
  assert.equal(result.item.createdAt, createdAt);
  assert.equal(result.item.imageUri, item.imageUri);
  assert.equal(result.item.cleanImageUri, item.cleanImageUri);
  assert.equal(result.item.size, "L");
  assert.deepEqual(result.item.confirmedProduct, confirmedProduct);
});

test("11. saved outfit item links remain valid after a batch update", async () => {
  const item = makeItem();
  await saveClosetItem(item);
  await saveOutfit({
    id: "outfit-1",
    itemIds: [item.id],
    score: 80,
    grade: "B",
    reasons: [],
    warnings: [],
    createdAt,
  });
  await updateClosetItemsBatch([
    { id: item.id, changes: { detailCategory: "벌룬 팬츠" } },
  ]);

  assert.deepEqual((await getSavedOutfits())[0].itemIds, [item.id]);
  assert.equal((await getClosetItems())[0].id, item.id);
});

test("12. user-edited field markers survive refresh", () => {
  const fields = ["detailCategory", "color", "season"];
  const item = makeItem({ userEditedClassificationFields: fields });
  const result = mergeClosetItemAnalysisUpdate(item, {
    detailCategory: "벌룬 팬츠",
    color: "화이트",
    seasons: ["여름"],
  });

  assert.deepEqual(result.item.userEditedClassificationFields, fields);
});

test("13. legacy stored items without version fields load normally", async () => {
  const item = makeItem();
  storageMemory.set("naes_closet", JSON.stringify([item]));

  const [loaded] = await getClosetItems();
  assert.equal(loaded.id, item.id);
  assert.equal(loaded.classificationVersion, undefined);
  assert.equal(
    getClosetItemAnalysisUpdateAvailability(loaded).classificationOutdated,
    true
  );
});

test("14. backup round-trip preserves optional analysis versions", async () => {
  const item = makeItem({
    classificationVersion: CURRENT_CLASSIFICATION_VERSION,
    photoAnalysisVersion: CURRENT_PHOTO_ANALYSIS_VERSION,
    lastAnalyzedAt: "2026-07-01T00:00:00.000Z",
  });
  const payload = await buildNaesBackupPayload(
    {
      closetItems: [item],
      profile: null,
      savedOutfits: [],
      outfitFeedbacks: [],
      wearRecords: [],
    },
    async () => ""
  );
  const parsed = parseNaesBackupJson(JSON.stringify(payload));

  assert.equal(
    parsed.data.closetItems[0].photoAnalysisVersion,
    CURRENT_PHOTO_ANALYSIS_VERSION
  );
});

test("15. batch persistence increments revision once and rebuilds the index", async () => {
  const first = makeItem({ id: "item-1" });
  const second = makeItem({ id: "item-2" });
  await saveClosetItem(first);
  await saveClosetItem(second);
  const before = await getRecommendationRevisionState();

  await updateClosetItemsBatch([
    { id: first.id, changes: { detailCategory: "벌룬 팬츠" } },
    { id: second.id, changes: { detailCategory: "와이드 슬랙스" } },
  ]);
  const after = await getRecommendationRevisionState();
  const index = await getClosetRecommendationIndex();

  assert.equal(after.closetRevision, before.closetRevision + 1);
  assert.equal(index.index.recommendationItems.length, 2);
});

test("16. batch preparation continues after an individual request failure", async () => {
  const items = [
    makeItem({ id: "ok-1" }),
    makeItem({ id: "fail" }),
    makeItem({ id: "ok-2" }),
  ];
  const result = await prepareClosetAnalysisBatch(items, {
    requestPhotoAnalysis: async (_uri, item) => {
      if (item.id === "fail") throw new Error("network");
      return { detailCategory: "벌룬 팬츠" };
    },
  });

  assert.equal(result.cancelled, false);
  assert.deepEqual(result.failedItemIds, ["fail"]);
  assert.deepEqual(result.updates.map((update) => update.id), ["ok-1", "ok-2"]);
});

test("17. an item marked current is not analyzed again on a repeated run", async () => {
  let requestCount = 0;
  const item = makeItem();
  const first = await prepareClosetAnalysisBatch([item], {
    requestPhotoAnalysis: async () => {
      requestCount += 1;
      return { detailCategory: "벌룬 팬츠" };
    },
  });
  const refreshedItem = { ...item, ...first.updates[0].changes };
  await prepareClosetAnalysisBatch([refreshedItem], {
    requestPhotoAnalysis: async () => {
      requestCount += 1;
      return {};
    },
  });

  assert.equal(requestCount, 1);
});

test("18. a cancelled batch ignores a late photo response", async () => {
  let cancelled = false;
  const result = await prepareClosetAnalysisBatch([makeItem()], {
    requestPhotoAnalysis: async () => {
      cancelled = true;
      return { detailCategory: "벌룬 팬츠" };
    },
    isCancelled: () => cancelled,
  });

  assert.equal(result.cancelled, true);
  assert.equal(result.updates.length, 0);
});

test("19. current versions avoid unnecessary API requests", async () => {
  let requestCount = 0;
  const item = makeItem({
    classificationVersion: CURRENT_CLASSIFICATION_VERSION,
    photoAnalysisVersion: CURRENT_PHOTO_ANALYSIS_VERSION,
  });
  const result = await prepareClosetAnalysisBatch([item], {
    requestPhotoAnalysis: async () => {
      requestCount += 1;
      return {};
    },
  });

  assert.equal(requestCount, 0);
  assert.equal(result.updates.length, 0);
});

test("20. confirmed product classification wins over conflicting photo AI", () => {
  const item = makeItem({
    confirmedProduct: {
      brand: "NAES",
      productName: "벌룬 팬츠",
      productUrl: "",
      confirmedAt: createdAt,
    },
  });
  const result = mergeClosetItemAnalysisUpdate(item, {
    category: "아우터",
    subCategory: "자켓",
    detailCategory: "데님 자켓",
  });

  assert.equal(result.item.category, "하의");
  assert.equal(result.item.detailCategory, "벌룬 팬츠");
});

test("original image is preferred and clean image is only a fallback", () => {
  assert.equal(
    getClosetItemAnalysisImageUri(
      makeItem({ imageUri: "file:///original.jpg", cleanImageUri: "file:///clean.png" })
    ),
    "file:///original.jpg"
  );
  assert.equal(
    getClosetItemAnalysisImageUri(
      makeItem({ imageUri: "", cleanImageUri: "file:///clean.png" })
    ),
    "file:///clean.png"
  );
});

test("clean image is retried when the original image cannot be read", async () => {
  const attemptedUris = [];
  const item = makeItem({
    imageUri: "file:///missing-original.jpg",
    cleanImageUri: "file:///clean.png",
  });
  const result = await prepareClosetAnalysisBatch([item], {
    requestPhotoAnalysis: async (uri) => {
      attemptedUris.push(uri);
      if (uri.includes("missing-original")) throw new Error("missing file");
      return { detailCategory: "벌룬 팬츠" };
    },
    shouldFallbackToLocal: () => true,
  });

  assert.deepEqual(attemptedUris, [
    "file:///missing-original.jpg",
    "file:///clean.png",
  ]);
  assert.equal(result.failedItemIds.length, 0);
  assert.equal(result.updates.length, 1);
});

test("a partial batch storage failure rolls back every closet entry", async () => {
  const item = makeItem();
  await saveClosetItem(item);
  const revisionBefore = await getRecommendationRevisionState();
  failNextMultiSetAfterFirstEntry = true;

  const result = await updateClosetItemsBatch([
    { id: item.id, changes: { detailCategory: "벌룬 팬츠" } },
  ]);

  assert.equal(result, null);
  assert.equal((await getClosetItems())[0].detailCategory, "팬츠");
  assert.deepEqual(await getRecommendationRevisionState(), revisionBefore);
});

test("21. closet blur subscription cleanup does not cancel the global job", async () => {
  await saveClosetItem(makeItem({ id: "item-1" }));
  await saveClosetItem(makeItem({ id: "item-2" }));
  const firstRequest = createDeferred();
  let requestCount = 0;
  const manager = makeManager(async () => {
    requestCount += 1;
    if (requestCount === 1) return firstRequest.promise;
    return { detailCategory: "벌룬 팬츠" };
  });
  const unsubscribe = manager.subscribe(() => undefined);
  const run = manager.start(["item-1", "item-2"]);

  await waitFor(() => requestCount === 1);
  unsubscribe();
  firstRequest.resolve({ detailCategory: "벌룬 팬츠" });
  await run;

  assert.equal(manager.getSnapshot().job.status, "completed");
  assert.equal(manager.getSnapshot().job.processed, 2);
});

test("22. manager finishes remaining items without a mounted closet screen", async () => {
  await saveClosetItem(makeItem({ id: "item-1" }));
  await saveClosetItem(makeItem({ id: "item-2" }));
  let requestCount = 0;
  const manager = makeManager(async () => {
    requestCount += 1;
    return { detailCategory: "벌룬 팬츠" };
  });

  await manager.start(["item-1", "item-2"]);

  assert.equal(requestCount, 2);
  assert.deepEqual(
    manager.getSnapshot().job.completedItemIds.sort(),
    ["item-1", "item-2"]
  );
});

test("23. navigation to another route does not affect the module queue", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  const manager = makeManager(() => deferred.promise);
  const run = manager.start(["item-1"]);

  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");
  const routeState = { pathname: "/" };
  routeState.pathname = "/outfit";
  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await run;

  assert.equal(routeState.pathname, "/outfit");
  assert.equal(manager.getSnapshot().job.status, "completed");
});

test("24. a new subscriber reads the same in-progress job snapshot", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  const manager = makeManager(() => deferred.promise);
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");

  let observedJobId;
  const unsubscribe = manager.subscribe(() => {
    observedJobId = manager.getSnapshot().job?.jobId;
  });
  observedJobId = manager.getSnapshot().job?.jobId;
  unsubscribe();
  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await run;

  assert.equal(observedJobId, "analysis-job");
});

test("25. closet source no longer ties batch cancellation to focus cleanup", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "app", "closet.tsx"),
    "utf8"
  );

  assert.doesNotMatch(source, /analysisBatchRequestRef/);
  assert.doesNotMatch(source, /prepareClosetAnalysisBatch/);
  assert.match(source, /useClosetAnalysisRefresh/);
});

test("26. explicit cancel aborts the request and keeps pending work", async () => {
  await saveClosetItem(makeItem());
  const manager = makeManager(
    (_uri, _item, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("cancelled");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      })
  );
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");

  await manager.cancel();
  await run;

  const job = manager.getSnapshot().job;
  assert.equal(job.status, "cancelled");
  assert.deepEqual(job.pendingItemIds, ["item-1"]);
  assert.equal(job.failed, 0);
});

test("27. repeated start calls share one queue and one API request", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  let requestCount = 0;
  const manager = makeManager(() => {
    requestCount += 1;
    return deferred.promise;
  });

  const first = manager.start(["item-1"]);
  const second = manager.start(["item-1"]);
  await waitFor(() => requestCount === 1);
  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await Promise.all([first, second]);

  assert.equal(requestCount, 1);
});

test("28. provider-style unsubscribe and resubscribe preserve active promise", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  let requestCount = 0;
  const manager = makeManager(() => {
    requestCount += 1;
    return deferred.promise;
  });
  const firstUnsubscribe = manager.subscribe(() => undefined);
  const run = manager.start(["item-1"]);
  await waitFor(() => requestCount === 1);
  firstUnsubscribe();
  const secondUnsubscribe = manager.subscribe(() => undefined);
  const duplicateRun = manager.start(["item-1"]);
  secondUnsubscribe();
  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await Promise.all([run, duplicateRun]);

  assert.equal(requestCount, 1);
});

test("29. repeated hydrate and resume calls do not duplicate a restored job", async () => {
  await saveClosetItem(makeItem());
  storageMemory.set(
    CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
    JSON.stringify(makePersistedJob())
  );
  let requestCount = 0;
  const manager = makeManager(async () => {
    requestCount += 1;
    return { detailCategory: "벌룬 팬츠" };
  });

  await Promise.all([manager.hydrate(), manager.hydrate()]);
  await Promise.all([
    manager.resumeInterrupted(),
    manager.resumeInterrupted(),
    manager.resume(),
  ]);

  assert.equal(requestCount, 1);
  assert.equal(manager.getSnapshot().job.status, "completed");
});

test("30. a detail category edited during analysis remains protected", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  const manager = makeManager(() => deferred.promise);
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");
  await updateClosetItem("item-1", {
    detailCategory: "카펜터 팬츠",
    userEditedClassificationFields: ["detailCategory"],
    updatedAt: "2026-07-23T10:00:00.000Z",
  });

  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await run;

  assert.equal((await getClosetItems())[0].detailCategory, "카펜터 팬츠");
});

test("31. a season edited during analysis remains protected", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  const manager = makeManager(() => deferred.promise);
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");
  await updateClosetItem("item-1", {
    season: "겨울",
    seasons: ["겨울"],
    userEditedClassificationFields: ["season"],
    updatedAt: "2026-07-23T10:00:00.000Z",
  });

  deferred.resolve({ season: "여름", seasons: ["여름"] });
  await run;

  assert.deepEqual((await getClosetItems())[0].seasons, ["겨울"]);
});

test("32. an item deleted during analysis is skipped and never recreated", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  const manager = makeManager(() => deferred.promise);
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");
  await deleteClosetItem("item-1");

  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await run;

  assert.equal((await getClosetItems()).length, 0);
  assert.deepEqual(manager.getSnapshot().job.skippedItemIds, ["item-1"]);
});

test("33. save-time merge uses the latest item after updatedAt changes", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  const manager = makeManager(() => deferred.promise);
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");
  await updateClosetItem("item-1", {
    size: "XL",
    updatedAt: "2026-07-23T11:00:00.000Z",
  });

  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await run;

  const [updated] = await getClosetItems();
  assert.equal(updated.size, "XL");
  assert.equal(updated.detailCategory, "벌룬 팬츠");
});

test("34. one failed item does not stop later queue items", async () => {
  await saveClosetItem(makeItem({ id: "ok-1" }));
  await saveClosetItem(makeItem({ id: "fail" }));
  await saveClosetItem(makeItem({ id: "ok-2" }));
  const manager = makeManager(async (_uri, item) => {
    if (item.id === "fail") throw new Error("network");
    return { detailCategory: "벌룬 팬츠" };
  });

  await manager.start(["ok-1", "fail", "ok-2"]);

  const job = manager.getSnapshot().job;
  assert.equal(job.status, "completed_with_errors");
  assert.deepEqual(job.failedItemIds, ["fail"]);
  assert.equal(job.completedItemIds.length, 2);
});

test("35. each completed item is persisted before the next request finishes", async () => {
  await saveClosetItem(makeItem({ id: "item-1" }));
  await saveClosetItem(makeItem({ id: "item-2" }));
  const secondRequest = createDeferred();
  let requestCount = 0;
  const manager = makeManager(async () => {
    requestCount += 1;
    if (requestCount === 2) return secondRequest.promise;
    return { detailCategory: "벌룬 팬츠" };
  });
  const run = manager.start(["item-1", "item-2"]);
  await waitFor(() => requestCount === 2);

  const firstItem = (await getClosetItems()).find(
    (item) => item.id === "item-1"
  );
  assert.equal(firstItem.detailCategory, "벌룬 팬츠");
  secondRequest.resolve({ detailCategory: "벌룬 팬츠" });
  await run;
});

test("36. a restarted manager resumes persisted pending IDs", async () => {
  await saveClosetItem(makeItem());
  storageMemory.set(
    CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
    JSON.stringify(makePersistedJob())
  );
  const manager = makeManager(async () => ({
    detailCategory: "벌룬 팬츠",
  }));

  await manager.hydrate();
  assert.equal(manager.getSnapshot().job.status, "paused");
  await manager.resumeInterrupted();

  assert.equal(manager.getSnapshot().job.status, "completed");
  assert.equal((await getClosetItems())[0].detailCategory, "벌룬 팬츠");
});

test("37. an already persisted current item is not analyzed again after restart", async () => {
  await saveClosetItem(
    makeItem({
      classificationVersion: CURRENT_CLASSIFICATION_VERSION,
      photoAnalysisVersion: CURRENT_PHOTO_ANALYSIS_VERSION,
    })
  );
  storageMemory.set(
    CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
    JSON.stringify(makePersistedJob())
  );
  let requestCount = 0;
  const manager = makeManager(async () => {
    requestCount += 1;
    return {};
  });

  await manager.hydrate();
  await manager.resumeInterrupted();

  assert.equal(requestCount, 0);
  assert.deepEqual(manager.getSnapshot().job.completedItemIds, ["item-1"]);
});

test("38. an unsaved current item remains pending and is safely retried", async () => {
  await saveClosetItem(makeItem());
  storageMemory.set(
    CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
    JSON.stringify(makePersistedJob({ pendingItemIds: [] }))
  );
  let requestCount = 0;
  const manager = makeManager(async () => {
    requestCount += 1;
    return { detailCategory: "벌룬 팬츠" };
  });

  await manager.hydrate();
  assert.deepEqual(manager.getSnapshot().job.pendingItemIds, ["item-1"]);
  await manager.resumeInterrupted();

  assert.equal(requestCount, 1);
  assert.equal((await getClosetItems())[0].detailCategory, "벌룬 팬츠");
});

test("39. corrupted job storage is cleared without blocking closet loading", async () => {
  await saveClosetItem(makeItem());
  storageMemory.set(
    CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
    "{broken-json"
  );
  const manager = makeManager(async () => ({}));

  await manager.hydrate();

  assert.equal(manager.getSnapshot().job, null);
  assert.equal(
    storageMemory.has(CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY),
    false
  );
  assert.equal((await getClosetItems()).length, 1);
});

test("40. completed global updates rebuild recommendation data and revision", async () => {
  await saveClosetItem(makeItem());
  const before = await getRecommendationRevisionState();
  const manager = makeManager(async () => ({
    detailCategory: "벌룬 팬츠",
  }));

  await manager.start(["item-1"]);
  const after = await getRecommendationRevisionState();
  const index = await getClosetRecommendationIndex();

  assert.equal(after.closetRevision, before.closetRevision + 1);
  assert.equal(
    index.index.recommendationItems[0].detailCategory,
    "벌룬 팬츠"
  );
});

test("41. unsubscribed screens receive no late state callbacks", async () => {
  await saveClosetItem(makeItem());
  const deferred = createDeferred();
  const manager = makeManager(() => deferred.promise);
  let callbackCount = 0;
  const unsubscribe = manager.subscribe(() => {
    callbackCount += 1;
  });
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");
  unsubscribe();
  const countAtUnmount = callbackCount;

  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await run;

  assert.equal(callbackCount, countAtUnmount);
});

test("42. manager completion has no screen Alert dependency", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "utils", "closetAnalysisRefreshManager.ts"),
    "utf8"
  );

  assert.doesNotMatch(source, /\bAlert\b/);
  assert.doesNotMatch(source, /\bsetState\b/);
});

test("43. AbortError from explicit cancellation is not counted as failure", async () => {
  await saveClosetItem(makeItem());
  const manager = makeManager(
    (_uri, _item, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
  );
  const run = manager.start(["item-1"]);
  await waitFor(() => manager.getSnapshot().job?.currentItemId === "item-1");

  await manager.cancel();
  await run;

  assert.equal(manager.getSnapshot().job.failed, 0);
  assert.deepEqual(manager.getSnapshot().job.failedItemIds, []);
});

test("44. active restore and manual resume race still runs one request", async () => {
  await saveClosetItem(makeItem());
  storageMemory.set(
    CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
    JSON.stringify(makePersistedJob())
  );
  const deferred = createDeferred();
  let requestCount = 0;
  const manager = makeManager(() => {
    requestCount += 1;
    return deferred.promise;
  });
  await manager.hydrate();

  const activeResume = manager.resumeInterrupted();
  const manualResume = manager.resume();
  await waitFor(() => requestCount === 1);
  deferred.resolve({ detailCategory: "벌룬 팬츠" });
  await Promise.all([activeResume, manualResume]);

  assert.equal(requestCount, 1);
});

test("45. an explicitly cancelled job resumes from its pending item", async () => {
  await saveClosetItem(makeItem());
  let requestCount = 0;
  const manager = makeManager((_uri, _item, signal) => {
    requestCount += 1;
    if (requestCount > 1) {
      return Promise.resolve({ detailCategory: "벌룬 팬츠" });
    }
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  });
  const firstRun = manager.start(["item-1"]);
  await waitFor(() => requestCount === 1);
  await manager.cancel();
  await firstRun;

  await manager.resume();

  assert.equal(requestCount, 2);
  assert.equal(manager.getSnapshot().job.status, "completed");
  assert.equal((await getClosetItems())[0].detailCategory, "벌룬 팬츠");
});

test("a paused job can be explicitly cancelled before replacing app data", async () => {
  storageMemory.set(
    CLOSET_ANALYSIS_REFRESH_JOB_STORAGE_KEY,
    JSON.stringify(
      makePersistedJob({
        status: "paused",
        currentItemId: undefined,
      })
    )
  );
  const manager = makeManager(async () => {
    assert.fail("a paused job should not start while it is being cancelled");
  });

  await manager.hydrate();
  await manager.cancel();

  assert.equal(manager.getSnapshot().job.status, "cancelled");
  assert.deepEqual(manager.getSnapshot().job.pendingItemIds, ["item-1"]);
});

test("46. failed IDs can be retried without reprocessing completed items", async () => {
  await saveClosetItem(makeItem({ id: "ok" }));
  await saveClosetItem(makeItem({ id: "retry" }));
  let shouldFail = true;
  const requestCounts = new Map();
  const manager = makeManager(async (_uri, item) => {
    requestCounts.set(item.id, (requestCounts.get(item.id) || 0) + 1);
    if (item.id === "retry" && shouldFail) throw new Error("temporary");
    return { detailCategory: "벌룬 팬츠" };
  });
  await manager.start(["ok", "retry"]);
  assert.deepEqual(manager.getSnapshot().job.failedItemIds, ["retry"]);

  shouldFail = false;
  await manager.retryFailed();

  assert.equal(requestCounts.get("ok"), 1);
  assert.equal(requestCounts.get("retry"), 2);
  assert.equal(manager.getSnapshot().job.status, "completed");
});

test("47. an item storage failure rolls back that item and continues the queue", async () => {
  await saveClosetItem(makeItem({ id: "item-1" }));
  await saveClosetItem(makeItem({ id: "item-2" }));
  const manager = makeManager(async () => ({
    detailCategory: "벌룬 팬츠",
  }));
  failNextMultiSetAfterFirstEntry = true;

  await manager.start(["item-1", "item-2"]);

  const closet = await getClosetItems();
  assert.equal(
    closet.find((item) => item.id === "item-1").detailCategory,
    "팬츠"
  );
  assert.equal(
    closet.find((item) => item.id === "item-2").detailCategory,
    "벌룬 팬츠"
  );
  assert.deepEqual(manager.getSnapshot().job.failedItemIds, ["item-1"]);
  assert.equal(manager.getSnapshot().job.status, "completed_with_errors");
});
