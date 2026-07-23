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
  getClosetItems,
  getClosetRecommendationIndex,
  getRecommendationRevisionState,
  getSavedOutfits,
  saveClosetItem,
  saveOutfit,
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
