const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const storageMemory = new Map();
const storageReadCounts = new Map();

global.__DEV__ = false;

const asyncStorage = {
  async getItem(key) {
    storageReadCounts.set(key, (storageReadCounts.get(key) || 0) + 1);
    return storageMemory.has(key) ? storageMemory.get(key) : null;
  },
  async setItem(key, value) {
    storageMemory.set(key, value);
  },
  async multiSet(entries) {
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
  deleteClosetItem,
  getClosetRecommendationIndex,
  getRecommendationRevisionState,
  saveClosetItem,
  saveOutfit,
  saveUserProfile,
  updateClosetItem,
} = require("../utils/storage.ts");

const CLOSET_KEY = "naes_closet";

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

  await saveOutfit(createSavedOutfit("worn-1", [item.id]), true);
  const afterWearHistory = await getRecommendationRevisionState();
  assert.equal(afterWearHistory.closetRevision, 3);
  assert.equal(afterWearHistory.savedOutfitRevision, 2);
  assert.equal(
    (await getClosetRecommendationIndex()).index.recommendationItems[0].wearCount,
    1
  );

  await deleteClosetItem(item.id);
  const afterDelete = await getRecommendationRevisionState();
  assert.equal(afterDelete.closetRevision, 4);
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
