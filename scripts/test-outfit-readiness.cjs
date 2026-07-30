const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

Module._load = function loadWithMocks(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      __esModule: true,
      default: {
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
        multiGet: async () => [],
        multiSet: async () => undefined,
        multiRemove: async () => undefined,
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

Module._resolveFilename = function resolveProjectAlias(
  request,
  parent,
  isMain,
  options
) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(
    this,
    resolvedRequest,
    parent,
    isMain,
    options
  );
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = require("node:fs").readFileSync(filename, "utf8");
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
  getCurrentSeasonForReadiness,
  getOutfitRecommendationReadiness,
  getOutfitRecommendationReadinessContent,
} = require("../utils/outfitRecommendationReadiness.ts");

function makeItem(id, category, overrides = {}) {
  return {
    id,
    imageUri: `https://example.com/${id}.jpg`,
    category,
    detailCategory:
      category === "상의"
        ? "셔츠"
        : category === "하의"
          ? "슬랙스"
          : category,
    color: "네이비",
    seasons: ["사계절"],
    season: "사계절",
    seasonNeedsReview: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeReadyCloset() {
  return [
    makeItem("top-1", "상의"),
    makeItem("top-2", "상의"),
    makeItem("top-3", "상의"),
    makeItem("bottom-1", "하의"),
    makeItem("bottom-2", "하의"),
    makeItem("bottom-3", "하의"),
  ];
}

test("상의·하의·핵심 조합 최소 기준을 구분한다", () => {
  const result = getOutfitRecommendationReadiness([
    makeItem("top-1", "상의"),
    makeItem("bottom-1", "하의"),
    makeItem("bottom-2", "하의"),
  ]);

  assert.equal(result.ready, false);
  assert.equal(result.reason, "not_enough_tops");
  assert.deepEqual(result.counts, {
    tops: 1,
    bottoms: 2,
    shoes: 0,
    outers: 0,
    coreCombinations: 2,
  });
  assert.equal(result.missing.tops, 2);
  assert.equal(result.missing.bottoms, 1);
  assert.equal(result.missing.coreCombinations, 4);
});

test("신발과 아우터 권장 수는 준비 완료를 막지 않는다", () => {
  const result = getOutfitRecommendationReadiness(makeReadyCloset());

  assert.equal(result.ready, true);
  assert.equal(result.reason, "ready");
  assert.equal(result.counts.shoes, 0);
  assert.equal(result.counts.outers, 0);
});

test("보관 중이거나 검토가 필요한 옷은 준비 수에서 제외한다", () => {
  const result = getOutfitRecommendationReadiness([
    ...makeReadyCloset(),
    makeItem("archived-top", "상의", { isArchived: true }),
    makeItem("review-top", "상의", {
      color: "색상 확인 필요",
    }),
    makeItem("review-bottom", "하의", {
      seasonNeedsReview: true,
    }),
  ]);

  assert.equal(result.ready, true);
  assert.equal(result.counts.tops, 3);
  assert.equal(result.counts.bottoms, 3);
  assert.equal(result.counts.coreCombinations, 9);
});

test("전체 옷장은 충분하지만 현재 계절 후보가 적으면 별도 상태를 반환한다", () => {
  const closet = makeReadyCloset().map((item, index) => ({
    ...item,
    seasons:
      item.category === "상의" && index > 0 ? ["여름"] : ["겨울"],
    season:
      item.category === "상의" && index > 0 ? "여름" : "겨울",
  }));
  const result = getOutfitRecommendationReadiness(closet, "겨울");

  assert.equal(result.ready, false);
  assert.equal(result.reason, "not_enough_season_items");
  assert.equal(result.counts.tops, 3);
  assert.equal(result.currentConditionCounts.tops, 1);
});

test("명확한 고온 부적합 옷은 현재 조건 후보에서 제외한다", () => {
  const closet = makeReadyCloset();
  closet[0] = makeItem("top-1", "상의", {
    detailCategory: "패딩 셔츠",
    seasons: ["사계절"],
    season: "사계절",
  });

  const result = getOutfitRecommendationReadiness(closet, "여름", {
    temperature: 28,
    condition: "맑음",
  });

  assert.equal(result.ready, false);
  assert.equal(result.reason, "not_enough_season_items");
  assert.equal(result.currentConditionCounts.tops, 2);
  assert.equal(result.currentConditionCounts.coreCombinations, 6);
});

test("추천 준비 문구는 부족 원인에 맞는 다음 행동을 안내한다", () => {
  const missingCore = getOutfitRecommendationReadiness([
    makeItem("top-1", "상의"),
    makeItem("bottom-1", "하의"),
  ], "여름");
  const missingCoreContent =
    getOutfitRecommendationReadinessContent(missingCore);

  assert.equal(missingCoreContent.title, "추천 준비까지 조금 남았어요");
  assert.match(missingCoreContent.text, /상의 2벌/);
  assert.match(missingCoreContent.text, /하의 2벌/);
  assert.equal(missingCoreContent.primaryActionLabel, "필요한 옷 추가하기");

  const seasonal = makeReadyCloset().map((item) => ({
    ...item,
    seasons: item.id.endsWith("1") ? ["여름"] : ["겨울"],
    season: item.id.endsWith("1") ? "여름" : "겨울",
  }));
  const seasonalContent = getOutfitRecommendationReadinessContent(
    getOutfitRecommendationReadiness(seasonal, "여름")
  );

  assert.equal(seasonalContent.title, "지금 계절에 맞는 옷이 조금 부족해요");
  assert.equal(seasonalContent.primaryActionLabel, "계절 옷 추가하기");
});

test("추천 준비의 기본 계절 계산은 월 경계를 따른다", () => {
  assert.equal(getCurrentSeasonForReadiness(new Date(2026, 2, 1)), "봄");
  assert.equal(getCurrentSeasonForReadiness(new Date(2026, 5, 1)), "여름");
  assert.equal(getCurrentSeasonForReadiness(new Date(2026, 8, 1)), "가을");
  assert.equal(getCurrentSeasonForReadiness(new Date(2026, 11, 1)), "겨울");
});
