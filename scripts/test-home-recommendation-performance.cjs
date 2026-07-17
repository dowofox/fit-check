const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const storageMemory = new Map();
const storageReadCounts = new Map();
let failNextMultiSet = false;
let failNextGetItemKey = null;

global.__DEV__ = false;

const asyncStorage = {
  async getItem(key) {
    if (failNextGetItemKey === key) {
      failNextGetItemKey = null;
      throw new Error("mock getItem failure");
    }
    storageReadCounts.set(key, (storageReadCounts.get(key) || 0) + 1);
    return storageMemory.has(key) ? storageMemory.get(key) : null;
  },
  async setItem(key, value) {
    storageMemory.set(key, value);
  },
  async multiSet(entries) {
    if (failNextMultiSet) {
      failNextMultiSet = false;
      throw new Error("mock multiSet failure");
    }
    entries.forEach(([key, value]) => storageMemory.set(key, value));
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
  buildClosetRecommendationIndex,
  CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY,
  getRecommendationRevisionKey,
  isHomeRecommendationCacheKeyForRevision,
  parseClosetRecommendationIndex,
  RECOMMENDATION_REVISIONS_STORAGE_KEY,
} = require("../utils/homeRecommendationIndex.ts");
const {
  canReuseHomeDashboardData,
} = require("../utils/homeDashboardRefresh.ts");
const {
  areRecommendationWeathersEquivalent,
  createHomeRecommendationCacheEntry,
  getHomeRecommendationCacheSnapshot,
  HOME_RECOMMENDATION_CACHE_STORAGE_KEY,
  HOME_RECOMMENDATION_CACHE_VERSION,
  HOME_WEATHER_RECOMMENDATION_CACHE_MAX_AGE_MS,
  hydrateHomeRecommendationCacheEntry,
  saveHomeRecommendationCacheSnapshot,
} = require("../utils/homeRecommendationCache.ts");
const {
  deleteClosetItem,
  deleteSavedOutfit,
  deleteOutfitWearRecord,
  getClosetItems,
  getClosetItemsLoadResult,
  getClosetRecommendationIndex,
  getDisplayImageUris,
  getOutfitRecommendationFeedbacks,
  getOutfitRecommendationFeedbacksLoadResult,
  getOutfitWearRecords,
  getOutfitWearRecordsLoadResult,
  getRecommendationRevisionState,
  getSavedOutfits,
  getSavedOutfitsLoadResult,
  getUserProfile,
  getUserProfileLoadResult,
  recordSavedOutfitWear,
  saveClosetItem,
  saveOutfit,
  saveUserProfile,
  setOutfitRecommendationFeedback,
  updateClosetItem,
  updateSavedOutfit,
} = require("../utils/storage.ts");

const CLOSET_KEY = "naes_closet";
const PROFILE_KEY = "naes_profile";
const OUTFIT_FEEDBACK_KEY = "naes_outfit_recommendation_feedback";
const OUTFIT_WEAR_RECORDS_KEY = "naes_outfit_wear_records";
const SAVED_OUTFITS_KEY = "naes_saved_outfits";

function createClosetItem(id, overrides = {}) {
  return {
    id,
    imageUri: `https://example.com/${id}.jpg`,
    category: "상의",
    subCategory: "셔츠",
    detailCategory: "린넨 셔츠",
    color: "화이트",
    style: "미니멀",
    styleTags: ["미니멀", "데일리"],
    seasons: ["봄", "여름"],
    season: "봄, 여름",
    size: "XL",
    material: "린넨",
    description: "가볍고 여유 있는 실루엣의 셔츠",
    productCandidates: [
      {
        brand: "NAES",
        productName: "후보 상품",
        reason: "테스트 후보",
      },
    ],
    analysisWarnings: ["테스트용 긴 분석 경고"],
    confirmedProduct: {
      brand: "NAES",
      productName: "공식 린넨 셔츠",
      productImageUrl: `https://example.com/${id}-product.jpg`,
      productUrl: `https://example.com/products/${id}`,
      materialComposition: {
        summary: "린넨 60%, 면 40%",
        items: [
          { name: "린넨", percentage: 60 },
          { name: "면", percentage: 40 },
        ],
        source: "official",
      },
      productSizeGuide: {
        unit: "cm",
        sizes: [
          { size: "L", totalLength: 70, shoulder: 50, chest: 56, sleeve: 24 },
          { size: "XL", totalLength: 72, shoulder: 52, chest: 58, sleeve: 25 },
          { size: "2XL", totalLength: 74, shoulder: 54, chest: 60, sleeve: 26 },
        ],
      },
      confirmedAt: "2026-07-17T00:00:00.000Z",
    },
    createdAt: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

function createSavedOutfit(id, itemIds) {
  return {
    id,
    itemIds,
    score: 80,
    grade: "B",
    reasons: [],
    warnings: [],
    createdAt: "2026-07-17T00:00:00.000Z",
  };
}

test.beforeEach(() => {
  storageMemory.clear();
  storageReadCounts.clear();
  failNextMultiSet = false;
  failNextGetItemKey = null;
});

test("프로필 저장은 실제 저장 성공 여부를 반환한다", async () => {
  assert.equal(await saveUserProfile({ height: "175" }), true);
  assert.deepEqual(await getUserProfile(), { height: "175" });

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextMultiSet = true;
    assert.equal(await saveUserProfile({ height: "180" }), false);
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(await getUserProfile(), { height: "175" });
});

test("profile reads distinguish storage failures from an unregistered profile", async () => {
  await saveUserProfile({ height: "175" });

  const originalConsoleError = console.error;
  console.error = () => {};
  let failedResult;
  try {
    failNextGetItemKey = PROFILE_KEY;
    failedResult = await getUserProfileLoadResult();
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(failedResult, { status: "failed", profile: null });
  assert.deepEqual(await getUserProfileLoadResult(), {
    status: "loaded",
    profile: { height: "175" },
  });

  storageMemory.delete(PROFILE_KEY);
  assert.deepEqual(await getUserProfileLoadResult(), {
    status: "loaded",
    profile: null,
  });
});

test("concurrent feedback mutations preserve each outfit preference", async () => {
  await Promise.all([
    setOutfitRecommendationFeedback(["top-1", "bottom-1"], "like"),
    setOutfitRecommendationFeedback(["top-2", "bottom-2"], "less"),
  ]);

  const feedbacks = await getOutfitRecommendationFeedbacks();
  assert.equal(feedbacks.length, 2);
  assert.deepEqual(
    new Set(feedbacks.map((feedback) => feedback.itemIds.join("|"))),
    new Set(["bottom-1|top-1", "bottom-2|top-2"])
  );
});

test("feedback mutations preserve existing data when the source read fails", async () => {
  await setOutfitRecommendationFeedback(["top-1", "bottom-1"], "like");

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextGetItemKey = OUTFIT_FEEDBACK_KEY;
    assert.equal(
      await setOutfitRecommendationFeedback(["top-2", "bottom-2"], "less"),
      null
    );
  } finally {
    console.error = originalConsoleError;
  }

  const feedbacks = await getOutfitRecommendationFeedbacks();
  assert.equal(feedbacks.length, 1);
  assert.deepEqual(feedbacks[0].itemIds, ["bottom-1", "top-1"]);
  assert.equal(feedbacks[0].value, "like");
});

test("feedback reads distinguish storage failures from no feedback", async () => {
  await setOutfitRecommendationFeedback(["top-1", "bottom-1"], "like");

  const originalConsoleError = console.error;
  console.error = () => {};
  let failedResult;
  try {
    failNextGetItemKey = OUTFIT_FEEDBACK_KEY;
    failedResult = await getOutfitRecommendationFeedbacksLoadResult();
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(failedResult, { status: "failed", feedbacks: [] });
  assert.equal((await getOutfitRecommendationFeedbacks()).length, 1);

  storageMemory.delete(OUTFIT_FEEDBACK_KEY);
  assert.deepEqual(await getOutfitRecommendationFeedbacksLoadResult(), {
    status: "loaded",
    feedbacks: [],
  });
});

test("wear record mutations preserve history when the source read fails", async () => {
  const item = createClosetItem("wear-read-failure");
  const outfit = createSavedOutfit("wear-outfit", [item.id]);
  await saveClosetItem(item);
  const firstWear = await recordSavedOutfitWear(
    outfit,
    new Date(2026, 6, 17, 10, 0, 0)
  );
  assert.equal(firstWear.status, "recorded");

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextGetItemKey = OUTFIT_WEAR_RECORDS_KEY;
    assert.equal(
      (
        await recordSavedOutfitWear(
          outfit,
          new Date(2026, 6, 18, 10, 0, 0)
        )
      ).status,
      "failed"
    );

    failNextGetItemKey = OUTFIT_WEAR_RECORDS_KEY;
    assert.equal(
      (await deleteOutfitWearRecord(firstWear.records[0].id)).status,
      "failed"
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal((await getOutfitWearRecords()).length, 1);
  assert.equal((await getClosetItems())[0].wearCount, 1);
});

test("wear record reads distinguish storage failures from empty history", async () => {
  const item = createClosetItem("wear-load-result");
  const outfit = createSavedOutfit("wear-load-outfit", [item.id]);
  await saveClosetItem(item);
  await recordSavedOutfitWear(outfit, new Date(2026, 6, 17, 10, 0, 0));

  const originalConsoleError = console.error;
  console.error = () => {};
  let failedResult;
  try {
    failNextGetItemKey = OUTFIT_WEAR_RECORDS_KEY;
    failedResult = await getOutfitWearRecordsLoadResult();
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(failedResult, { status: "failed", records: [] });
  assert.equal((await getOutfitWearRecordsLoadResult()).records.length, 1);

  storageMemory.delete(OUTFIT_WEAR_RECORDS_KEY);
  assert.deepEqual(await getOutfitWearRecordsLoadResult(), {
    status: "loaded",
    records: [],
  });
});

test("저장 코디 변경 실패는 정상적인 빈 목록과 구분한다", async () => {
  const outfit = createSavedOutfit("saved-outfit", ["top-1", "bottom-1"]);
  await saveOutfit(outfit);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextMultiSet = true;
    assert.equal(await updateSavedOutfit(outfit.id, { name: "수정 이름" }), null);
    assert.equal((await getSavedOutfits())[0].name, undefined);

    failNextMultiSet = true;
    assert.equal(await deleteSavedOutfit(outfit.id), null);
    assert.equal((await getSavedOutfits()).length, 1);
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(await deleteSavedOutfit(outfit.id), []);
});

test("동시에 같은 코디를 저장해도 저장 경계에서 한 번만 기록한다", async () => {
  const firstOutfit = createSavedOutfit("concurrent-1", ["top-1", "bottom-1"]);
  const secondOutfit = createSavedOutfit("concurrent-2", ["bottom-1", "top-1"]);
  const results = await Promise.all([
    saveOutfit(firstOutfit),
    saveOutfit(secondOutfit),
  ]);

  assert.deepEqual(
    results.map((result) => result.status),
    ["saved", "duplicate"]
  );
  assert.equal((await getSavedOutfits()).length, 1);
});

test("saved outfit mutations preserve existing data when the source read fails", async () => {
  const outfit = createSavedOutfit("saved-read-failure", ["top-1", "bottom-1"]);
  await saveOutfit(outfit);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextGetItemKey = SAVED_OUTFITS_KEY;
    assert.equal(
      (await saveOutfit(createSavedOutfit("new-outfit", ["top-2", "bottom-2"]))).status,
      "failed"
    );

    failNextGetItemKey = SAVED_OUTFITS_KEY;
    assert.equal(await updateSavedOutfit(outfit.id, { name: "수정 이름" }), null);

    failNextGetItemKey = SAVED_OUTFITS_KEY;
    assert.equal(await deleteSavedOutfit(outfit.id), null);
  } finally {
    console.error = originalConsoleError;
  }

  const savedOutfits = await getSavedOutfits();
  assert.equal(savedOutfits.length, 1);
  assert.equal(savedOutfits[0].id, outfit.id);
  assert.equal(savedOutfits[0].name, undefined);
});

test("saved outfit reads distinguish storage failures from an empty list", async () => {
  const outfit = createSavedOutfit("saved-outfit-load-result", ["top-1", "bottom-1"]);
  await saveOutfit(outfit);

  const originalConsoleError = console.error;
  console.error = () => {};
  let failedResult;
  try {
    failNextGetItemKey = SAVED_OUTFITS_KEY;
    failedResult = await getSavedOutfitsLoadResult();
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(failedResult, { status: "failed", outfits: [] });
  assert.equal((await getSavedOutfits()).length, 1);

  storageMemory.delete(SAVED_OUTFITS_KEY);
  assert.deepEqual(await getSavedOutfitsLoadResult(), {
    status: "loaded",
    outfits: [],
  });
});

test("saved outfit mutations do not replace malformed stored data", async () => {
  const malformedSavedOutfits = "[not-valid-json";
  storageMemory.set(SAVED_OUTFITS_KEY, malformedSavedOutfits);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(await deleteSavedOutfit("missing-outfit"), null);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(storageMemory.get(SAVED_OUTFITS_KEY), malformedSavedOutfits);
});

test("옷 삭제 실패는 마지막 옷을 정상 삭제한 빈 목록과 구분한다", async () => {
  const item = createClosetItem("delete-closet-item");
  await saveClosetItem(item);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextMultiSet = true;
    assert.equal(await deleteClosetItem(item.id), null);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal((await getClosetItems()).length, 1);
  assert.deepEqual(await deleteClosetItem(item.id), []);
});

test("프로필을 읽지 못하면 기준 옷 삭제를 중단한다", async () => {
  const item = createClosetItem("reference-delete-item");
  await saveClosetItem(item);
  await saveUserProfile({
    height: "175",
    referenceClothing: { topItemId: item.id },
  });

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextGetItemKey = PROFILE_KEY;
    assert.equal(await deleteClosetItem(item.id), null);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal((await getClosetItems()).some((closetItem) => closetItem.id === item.id), true);
  assert.equal((await getUserProfile()).referenceClothing.topItemId, item.id);
});

test("closet mutations preserve existing data when the source read fails", async () => {
  const item = createClosetItem("closet-read-failure");
  await saveClosetItem(item);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextGetItemKey = CLOSET_KEY;
    assert.deepEqual(await updateClosetItem(item.id, { color: "블랙" }), []);

    failNextGetItemKey = CLOSET_KEY;
    assert.equal(await deleteClosetItem(item.id), null);

    failNextGetItemKey = CLOSET_KEY;
    assert.deepEqual(await saveClosetItem(createClosetItem("new-item")), []);
  } finally {
    console.error = originalConsoleError;
  }

  const closet = await getClosetItems();
  assert.equal(closet.length, 1);
  assert.equal(closet[0].id, item.id);
  assert.equal(closet[0].color, item.color);
});

test("기준 옷의 카테고리 변경은 프로필 참조와 함께 저장한다", async () => {
  const item = createClosetItem("reference-category-change");
  await saveClosetItem(item);
  await saveUserProfile({
    height: "175",
    referenceClothing: { topItemId: item.id },
  });

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    failNextGetItemKey = PROFILE_KEY;
    assert.deepEqual(await updateClosetItem(item.id, { category: "하의" }), []);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal((await getClosetItems())[0].category, "상의");
  assert.equal((await getUserProfile()).referenceClothing.topItemId, item.id);

  const revisionsBeforeUpdate = await getRecommendationRevisionState();
  const updatedCloset = await updateClosetItem(item.id, { category: "하의" });
  const revisionsAfterUpdate = await getRecommendationRevisionState();

  assert.equal(updatedCloset[0].category, "하의");
  assert.deepEqual((await getUserProfile()).referenceClothing, {});
  assert.equal(
    revisionsAfterUpdate.closetRevision,
    revisionsBeforeUpdate.closetRevision + 1
  );
  assert.equal(
    revisionsAfterUpdate.profileRevision,
    revisionsBeforeUpdate.profileRevision + 1
  );
});

test("closet reads distinguish storage failures from an empty closet", async () => {
  const item = createClosetItem("closet-load-result");
  await saveClosetItem(item);

  const originalConsoleError = console.error;
  console.error = () => {};
  let failedResult;
  try {
    failNextGetItemKey = CLOSET_KEY;
    failedResult = await getClosetItemsLoadResult();
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(failedResult, { status: "failed", items: [] });
  assert.equal((await getClosetItems()).length, 1);

  storageMemory.delete(CLOSET_KEY);
  assert.deepEqual(await getClosetItemsLoadResult(), {
    status: "loaded",
    items: [],
  });
});

test("closet mutations do not replace malformed stored data with an empty list", async () => {
  const malformedCloset = "{not-valid-json";
  storageMemory.set(CLOSET_KEY, malformedCloset);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(
      await updateClosetItem("missing-item", { color: "블랙" }),
      []
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(storageMemory.get(CLOSET_KEY), malformedCloset);
});

test("concurrent closet mutations preserve every completed change", async () => {
  const firstItem = createClosetItem("concurrent-closet-1");
  const secondItem = createClosetItem("concurrent-closet-2");

  await Promise.all([saveClosetItem(firstItem), saveClosetItem(secondItem)]);

  let closet = await getClosetItems();
  assert.deepEqual(
    new Set(closet.map((item) => item.id)),
    new Set([firstItem.id, secondItem.id])
  );

  await Promise.all([
    updateClosetItem(firstItem.id, { color: "블랙" }),
    updateClosetItem(firstItem.id, { size: "L" }),
  ]);

  closet = await getClosetItems();
  const updatedItem = closet.find((item) => item.id === firstItem.id);
  assert.equal(updatedItem?.color, "블랙");
  assert.equal(updatedItem?.size, "L");
});

test("saving the same closet item id twice remains idempotent", async () => {
  const item = createClosetItem("duplicate-closet-id");

  const [firstResult, secondResult] = await Promise.all([
    saveClosetItem(item),
    saveClosetItem({ ...item, color: "블랙" }),
  ]);

  assert.equal(firstResult.length, 1);
  assert.equal(secondResult.length, 1);
  const closet = await getClosetItems();
  assert.equal(closet.length, 1);
  assert.equal(closet[0].id, item.id);
  assert.equal(closet[0].color, item.color);
});

test("대표 이미지 후보는 배경제거, 상품, 원본 순서로 중복 없이 유지한다", () => {
  const item = createClosetItem("image-fallback", {
    cleanImageUri: "file:///clean.png",
    imageUri: "file:///original.jpg",
    confirmedProduct: {
      productImageUrl: "https://example.com/product.jpg",
    },
  });

  assert.deepEqual(getDisplayImageUris(item), [
    "file:///clean.png",
    "https://example.com/product.jpg",
    "file:///original.jpg",
  ]);
  assert.deepEqual(
    getDisplayImageUris({
      ...item,
      cleanImageUri: "file:///original.jpg",
      confirmedProduct: { productImageUrl: "file:///original.jpg" },
    }),
    ["file:///original.jpg"]
  );
});

test("홈 재진입은 추천 revision이 같을 때만 메모리 데이터를 재사용한다", () => {
  const revisions = {
    version: 1,
    closetRevision: 4,
    profileRevision: 2,
    savedOutfitRevision: 3,
    feedbackRevision: 1,
  };
  const dataKey = getRecommendationRevisionKey(revisions);

  assert.equal(canReuseHomeDashboardData(dataKey, revisions), true);
  assert.equal(
    canReuseHomeDashboardData(dataKey, {
      ...revisions,
      closetRevision: revisions.closetRevision + 1,
    }),
    false
  );
  assert.equal(
    canReuseHomeDashboardData(dataKey, {
      ...revisions,
      feedbackRevision: revisions.feedbackRevision + 1,
    }),
    false
  );
  assert.equal(canReuseHomeDashboardData(undefined, revisions), false);
});

test("기존 옷장은 경량 인덱스를 한 번 생성한 뒤 전체 JSON을 다시 읽지 않는다", async () => {
  const legacyItem = createClosetItem("legacy-top");
  storageMemory.set(CLOSET_KEY, JSON.stringify([legacyItem]));

  const firstLoad = await getClosetRecommendationIndex();
  const closetReadsAfterFirstLoad = storageReadCounts.get(CLOSET_KEY) || 0;

  assert.equal(firstLoad.fullClosetParsed, true);
  assert.equal(firstLoad.index.recommendationItems.length, 1);
  assert.equal(firstLoad.index.categoryCounts["상의"], 1);
  assert.equal(
    firstLoad.index.recommendationItems[0].confirmedProduct.productSizeGuide.sizes.length,
    1
  );
  assert.equal(firstLoad.index.recommendationItems[0].productCandidates, undefined);
  assert.equal(firstLoad.index.recommendationItems[0].analysisWarnings, undefined);
  assert.equal(closetReadsAfterFirstLoad, 1);

  const secondLoad = await getClosetRecommendationIndex();

  assert.equal(secondLoad.source, "cache");
  assert.equal(secondLoad.fullClosetParsed, false);
  assert.equal(storageReadCounts.get(CLOSET_KEY), closetReadsAfterFirstLoad);
});

test("손상된 옷장 원본으로 빈 홈 추천 인덱스를 만들지 않는다", async () => {
  storageMemory.set(CLOSET_KEY, "{broken-json");

  await assert.rejects(
    () => getClosetRecommendationIndex(),
    /Stored closet data could not be loaded/
  );
  assert.equal(storageMemory.has(CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY), false);
});

test("옷장·프로필·저장 코디 변경은 각 revision과 추천 키를 갱신한다", async () => {
  const item = createClosetItem("revision-top");
  const initialRevisions = await getRecommendationRevisionState();
  const initialKey = getRecommendationRevisionKey(initialRevisions);

  await saveClosetItem(item);
  const afterClosetSave = await getRecommendationRevisionState();
  assert.equal(afterClosetSave.closetRevision, 1);
  assert.notEqual(getRecommendationRevisionKey(afterClosetSave), initialKey);

  await updateClosetItem(item.id, {
    season: "겨울",
    seasons: ["겨울"],
  });
  const afterSeasonUpdate = await getRecommendationRevisionState();
  assert.equal(afterSeasonUpdate.closetRevision, 2);
  assert.deepEqual(
    (await getClosetRecommendationIndex()).index.recommendationItems[0].seasons,
    ["겨울"]
  );

  await saveUserProfile({
    height: "175",
    referenceClothing: { topItemId: item.id },
  });
  const afterProfileSave = await getRecommendationRevisionState();
  assert.equal(afterProfileSave.profileRevision, 1);

  await saveOutfit(createSavedOutfit("saved-1", [item.id]));
  const afterOutfitSave = await getRecommendationRevisionState();
  assert.equal(afterOutfitSave.savedOutfitRevision, 1);

  await setOutfitRecommendationFeedback(["bottom-1", item.id], "like");
  const afterFeedbackSave = await getRecommendationRevisionState();
  const savedFeedbacks = await getOutfitRecommendationFeedbacks();
  assert.equal(afterFeedbackSave.feedbackRevision, 1);
  assert.equal(savedFeedbacks.length, 1);
  assert.deepEqual(savedFeedbacks[0].itemIds, ["bottom-1", item.id].sort());
  assert.equal(savedFeedbacks[0].value, "like");

  await setOutfitRecommendationFeedback([item.id, "bottom-1"], "less");
  const replacedFeedbacks = await getOutfitRecommendationFeedbacks();
  const afterFeedbackReplace = await getRecommendationRevisionState();
  assert.equal(afterFeedbackReplace.feedbackRevision, 2);
  assert.equal(replacedFeedbacks.length, 1);
  assert.equal(replacedFeedbacks[0].value, "less");

  await setOutfitRecommendationFeedback(["bottom-1", item.id], null);
  const afterFeedbackClear = await getRecommendationRevisionState();
  assert.equal(afterFeedbackClear.feedbackRevision, 3);
  assert.deepEqual(await getOutfitRecommendationFeedbacks(), []);

  const wornOutfit = createSavedOutfit("worn-1", [item.id]);
  const duplicateSaveResult = await saveOutfit(wornOutfit);
  const afterWornOutfitSave = await getRecommendationRevisionState();
  assert.equal(duplicateSaveResult.status, "duplicate");
  assert.equal(afterWornOutfitSave.closetRevision, 2);
  assert.equal(afterWornOutfitSave.savedOutfitRevision, 1);
  assert.equal(
    (await getClosetRecommendationIndex()).index.recommendationItems[0].wearCount,
    undefined
  );

  const wearResult = await recordSavedOutfitWear(
    wornOutfit,
    new Date(2026, 6, 17, 10, 0, 0)
  );
  const afterWearHistory = await getRecommendationRevisionState();
  assert.equal(wearResult.status, "recorded");
  assert.equal(afterWearHistory.closetRevision, 3);
  assert.equal(afterWearHistory.savedOutfitRevision, 1);
  assert.equal((await getOutfitWearRecords()).length, 1);
  assert.equal(
    (await getClosetRecommendationIndex()).index.recommendationItems[0].wearCount,
    1
  );

  const duplicateWearResult = await recordSavedOutfitWear(
    wornOutfit,
    new Date(2026, 6, 17, 20, 0, 0)
  );
  assert.equal(duplicateWearResult.status, "already_recorded");
  assert.equal((await getOutfitWearRecords()).length, 1);
  assert.equal(
    (await getClosetRecommendationIndex()).index.recommendationItems[0].wearCount,
    1
  );

  const secondWearDate = new Date(2026, 6, 18, 10, 0, 0);
  const secondWearResult = await recordSavedOutfitWear(wornOutfit, secondWearDate);
  assert.equal(secondWearResult.status, "recorded");
  assert.equal(
    (await getClosetItems()).find((closetItem) => closetItem.id === item.id)?.wearCount,
    2
  );

  const deleteLatestWearResult = await deleteOutfitWearRecord(
    secondWearResult.records[0].id
  );
  const itemAfterLatestWearDelete = (await getClosetItems()).find(
    (closetItem) => closetItem.id === item.id
  );
  assert.equal(deleteLatestWearResult.status, "deleted");
  assert.equal(itemAfterLatestWearDelete?.wearCount, 1);
  assert.equal(itemAfterLatestWearDelete?.lastWornAt, wearResult.records[0].wornAt);

  const deleteWearResult = await deleteOutfitWearRecord(wearResult.records[0].id);
  const afterWearDelete = await getRecommendationRevisionState();
  const itemAfterWearDelete = (await getClosetItems()).find(
    (closetItem) => closetItem.id === item.id
  );
  assert.equal(deleteWearResult.status, "deleted");
  assert.deepEqual(await getOutfitWearRecords(), []);
  assert.equal(afterWearDelete.closetRevision, 6);
  assert.equal(itemAfterWearDelete?.wearCount, 0);
  assert.equal(itemAfterWearDelete?.lastWornAt, undefined);

  await deleteClosetItem(item.id);
  const afterDelete = await getRecommendationRevisionState();
  assert.equal(afterDelete.closetRevision, 7);
  assert.equal(afterDelete.profileRevision, 2);
  assert.equal((await getClosetRecommendationIndex()).index.recommendationItems.length, 0);
});

test("손상되거나 오래된 인덱스는 사용하지 않는다", async () => {
  const item = createClosetItem("repair-top");
  storageMemory.set(CLOSET_KEY, JSON.stringify([item]));
  storageMemory.set(RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify({
    version: 1,
    closetRevision: 2,
    profileRevision: 0,
    savedOutfitRevision: 0,
  }));
  storageMemory.set(CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY, "{broken-json");

  const repaired = await getClosetRecommendationIndex();
  assert.equal(repaired.source, "rebuilt_invalid");
  assert.equal(repaired.index.closetRevision, 2);

  const staleIndex = buildClosetRecommendationIndex([item], 2, "2026-07-17T00:00:00.000Z");
  assert.equal(parseClosetRecommendationIndex(JSON.stringify(staleIndex), 3).status, "stale");
  assert.equal(
    parseClosetRecommendationIndex(
      JSON.stringify({ ...staleIndex, version: 99 }),
      2
    ).status,
    "version_mismatch"
  );
});

test("revision 키는 전체 추천 입력 직렬화보다 작고 동일 입력 캐시를 구분한다", () => {
  const items = Array.from({ length: 100 }, (_, index) =>
    createClosetItem(`item-${index}`, {
      category: index % 2 === 0 ? "상의" : "하의",
    })
  );
  const fullClosetJson = JSON.stringify(items);
  const index = buildClosetRecommendationIndex(
    items,
    7,
    "2026-07-17T00:00:00.000Z"
  );
  const indexJson = JSON.stringify(index);
  const revisions = {
    version: 1,
    closetRevision: 7,
    profileRevision: 3,
    savedOutfitRevision: 4,
    feedbackRevision: 5,
  };
  const revisionKey = getRecommendationRevisionKey(revisions);
  const previousDataKey = JSON.stringify({
    items: index.recommendationItems,
    profile: { height: "175", topSize: "L" },
    savedOutfitItemIds: [["item-0", "item-1"]],
  });

  assert.ok(indexJson.length < fullClosetJson.length);
  assert.ok(revisionKey.length < previousDataKey.length);
  assert.equal(
    isHomeRecommendationCacheKeyForRevision(
      `${revisionKey}|27|맑음|0`,
      revisionKey
    ),
    true
  );
  assert.equal(
    isHomeRecommendationCacheKeyForRevision(
      `${revisionKey}|27|맑음|0`,
      getRecommendationRevisionKey({ ...revisions, closetRevision: 8 })
    ),
    false
  );

  console.info("[home-performance-test] serialized characters", {
    itemCount: items.length,
    fullCloset: fullClosetJson.length,
    recommendationIndex: indexJson.length,
    previousRecommendationKey: previousDataKey.length,
    revisionKey: revisionKey.length,
  });
});

test("홈 추천 영구 캐시는 아이템 ID로 복원하고 stale·삭제 아이템 캐시를 거부한다", async () => {
  const items = [
    createClosetItem("cached-top"),
    createClosetItem("cached-bottom", {
      category: "하의",
      subCategory: "팬츠",
      detailCategory: "슬랙스",
    }),
  ];
  const revisions = {
    version: 1,
    closetRevision: 2,
    profileRevision: 1,
    savedOutfitRevision: 1,
    feedbackRevision: 0,
  };
  const revisionKey = getRecommendationRevisionKey(revisions);
  const weather = { temperature: 27, condition: "맑음", rainChance: 10 };
  const recommendation = {
    id: "cached-outfit",
    items,
    title: "캐시 코디",
    tags: ["데일리"],
    reasons: ["가벼운 날씨에 잘 맞아요."],
  };
  const weatherEntry = createHomeRecommendationCacheEntry(
    `${revisionKey}|27|맑음|10`,
    [recommendation],
    {},
    "오늘 27도 · 맑음 기준 추천",
    weather
  );

  await saveHomeRecommendationCacheSnapshot({
    version: HOME_RECOMMENDATION_CACHE_VERSION,
    weather: weatherEntry,
  });

  const storedJson = storageMemory.get(HOME_RECOMMENDATION_CACHE_STORAGE_KEY);
  const restoredSnapshot = await getHomeRecommendationCacheSnapshot();
  const hydrated = hydrateHomeRecommendationCacheEntry(
    restoredSnapshot?.weather,
    items,
    revisionKey
  );

  assert.ok(storedJson);
  assert.equal(storedJson.includes("productSizeGuide"), false);
  assert.equal(storedJson.includes("productImageUrl"), false);
  assert.deepEqual(
    hydrated?.recommendations[0].items.map((item) => item.id),
    ["cached-top", "cached-bottom"]
  );
  assert.equal(
    hydrateHomeRecommendationCacheEntry(
      restoredSnapshot?.weather,
      items,
      getRecommendationRevisionKey({ ...revisions, closetRevision: 3 })
    ),
    null
  );
  assert.equal(
    hydrateHomeRecommendationCacheEntry(
      restoredSnapshot?.weather,
      items.slice(0, 1),
      revisionKey
    ),
    null
  );
  assert.equal(
    hydrateHomeRecommendationCacheEntry(
      {
        ...weatherEntry,
        cachedAt:
          weatherEntry.cachedAt -
          HOME_WEATHER_RECOMMENDATION_CACHE_MAX_AGE_MS -
          1,
      },
      items,
      revisionKey,
      weatherEntry.cachedAt
    ),
    null
  );
  assert.ok(
    hydrateHomeRecommendationCacheEntry(
      createHomeRecommendationCacheEntry(
        revisionKey,
        [recommendation],
        {},
        null,
        null,
        weatherEntry.cachedAt - HOME_WEATHER_RECOMMENDATION_CACHE_MAX_AGE_MS - 1
      ),
      items,
      revisionKey,
      weatherEntry.cachedAt
    )
  );
});

test("의미가 같은 날씨는 홈 추천을 다시 계산하지 않아도 된다", () => {
  const cachedWeather = { temperature: 27, condition: "맑음", rainChance: 10 };

  assert.equal(
    areRecommendationWeathersEquivalent(cachedWeather, {
      temperature: 28.5,
      condition: "대체로 맑음",
      rainChance: 25,
    }),
    true
  );
  assert.equal(
    areRecommendationWeathersEquivalent(cachedWeather, {
      temperature: 29,
      condition: "맑음",
      rainChance: 10,
    }),
    false
  );
  assert.equal(
    areRecommendationWeathersEquivalent(cachedWeather, {
      temperature: 27,
      condition: "비",
      rainChance: 10,
    }),
    false
  );
  assert.equal(
    areRecommendationWeathersEquivalent(cachedWeather, {
      temperature: 27,
      condition: "맑음",
      rainChance: 30,
    }),
    false
  );
  assert.equal(
    areRecommendationWeathersEquivalent(cachedWeather, {
      condition: "맑음",
      rainChance: 10,
    }),
    false
  );
});
