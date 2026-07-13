const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

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
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(result.outputText, filename);
};

const {
  getOutfitRecommendationResult,
  MIN_DISPLAY_RECOMMENDATION_SCORE,
} = require("../utils/outfitRecommend.ts");
const { getResolvedItemMaterial } = require("../utils/productClassification.ts");

const createdAt = "2026-07-01T00:00:00.000Z";

function createItem(id, category, overrides = {}) {
  const defaultsByCategory = {
    상의: {
      subCategory: "티셔츠",
      detailCategory: "반팔 티셔츠",
      color: "화이트",
      garmentProfile: {
        silhouette: "regular",
        volume: 4,
        visualWeight: 3,
        lengthBalance: "regular",
        fitIntent: "trueToSize",
        pointLevel: 2,
        structure: "soft",
        drape: "medium",
      },
    },
    하의: {
      subCategory: "팬츠",
      detailCategory: "스트레이트 데님 팬츠",
      color: "데님",
      garmentProfile: {
        silhouette: "regular",
        volume: 5,
        visualWeight: 4,
        lengthBalance: "regular",
        fitIntent: "relaxed",
        pointLevel: 2,
        structure: "normal",
        drape: "medium",
      },
    },
    신발: {
      subCategory: "스니커즈",
      detailCategory: "화이트 스니커즈",
      color: "화이트",
      garmentProfile: {
        silhouette: "regular",
        volume: 3,
        visualWeight: 3,
        lengthBalance: "regular",
        fitIntent: "trueToSize",
        pointLevel: 2,
        structure: "normal",
        drape: "low",
      },
    },
    아우터: {
      subCategory: "가디건",
      detailCategory: "얇은 가디건",
      color: "네이비",
      garmentProfile: {
        silhouette: "regular",
        volume: 4,
        visualWeight: 4,
        lengthBalance: "regular",
        fitIntent: "relaxed",
        pointLevel: 2,
        structure: "soft",
        drape: "medium",
      },
    },
    액세서리: {
      subCategory: "모자",
      detailCategory: "볼캡",
      color: "블랙",
      garmentProfile: {
        silhouette: "regular",
        volume: 2,
        visualWeight: 2,
        lengthBalance: "regular",
        fitIntent: "trueToSize",
        pointLevel: 2,
        structure: "normal",
        drape: "low",
      },
    },
  };

  return {
    id,
    imageUri: `file:///${id}.png`,
    category,
    style: "캐주얼",
    styleTags: ["캐주얼", "데일리"],
    seasons: ["여름"],
    season: "여름",
    fit: "레귤러",
    size: "M",
    material: "면",
    pattern: "무지",
    graphicDetected: false,
    graphicSize: "없음",
    createdAt,
    ...defaultsByCategory[category],
    ...overrides,
  };
}

function createWardrobe() {
  return [
    createItem("top-white", "상의"),
    createItem("top-black", "상의", { color: "블랙" }),
    createItem("bottom-denim", "하의"),
    createItem("bottom-navy", "하의", {
      color: "네이비",
      detailCategory: "와이드 슬랙스",
      material: "폴리에스터",
    }),
    createItem("shoes-white", "신발"),
    createItem("shoes-black", "신발", { color: "블랙" }),
    createItem("outer-cardigan", "아우터"),
    createItem("accessory-cap", "액세서리"),
  ];
}

function itemKey(recommendation) {
  return recommendation.items.map((item) => item.id).sort().join("|");
}

function coreKey(recommendation) {
  return ["상의", "하의", "신발"]
    .map((category) => recommendation.items.find((item) => item.category === category)?.id || "none")
    .join("|");
}

function recommendationKeys(result) {
  return result.recommendations.map(itemKey);
}

const summerWeather = {
  temperature: 27,
  condition: "맑음",
  rainChance: 10,
};

test("같은 입력과 날씨는 홈과 추천 화면에 같은 순서의 결과를 만든다", () => {
  const wardrobe = createWardrobe();
  const homeResult = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    { weather: summerWeather }
  );
  const recommendationScreenResult = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    { weather: summerWeather }
  );

  assert.deepEqual(recommendationKeys(homeResult), recommendationKeys(recommendationScreenResult));
});

test("현재 계절과 맞지 않는 아이템은 충분한 계절 후보가 있을 때 제외된다", () => {
  const winterTop = createItem("top-winter", "상의", {
    detailCategory: "울 니트",
    material: "울",
    seasons: ["겨울"],
    season: "겨울",
  });
  const result = getOutfitRecommendationResult([...createWardrobe(), winterTop], null, "여름");

  assert.ok(result.recommendations.length > 0);
  result.recommendations.forEach((recommendation) => {
    assert.equal(recommendation.items.some((item) => item.id === winterTop.id), false);
  });
});

test("기본 추천과 다른 버전은 모두 공통 최소 노출 점수를 통과한다", () => {
  const result = getOutfitRecommendationResult(createWardrobe(), null, "여름");

  assert.ok(result.recommendations.length > 0);
  result.recommendations.forEach((recommendation) => {
    assert.ok(recommendation.score >= MIN_DISPLAY_RECOMMENDATION_SCORE);
    recommendation.alternatives?.forEach((alternative) => {
      assert.ok(alternative.score >= MIN_DISPLAY_RECOMMENDATION_SCORE);
    });
  });
});

test("다른 버전은 기본 추천과 핵심 조합이 다르고 서로 완전히 중복되지 않는다", () => {
  const result = getOutfitRecommendationResult(createWardrobe(), null, "여름");

  result.recommendations.forEach((recommendation) => {
    const alternatives = recommendation.alternatives || [];
    const alternativeItemKeys = alternatives.map(itemKey);

    assert.equal(recommendation.alternativeCount, alternatives.length);
    assert.equal(new Set(alternativeItemKeys).size, alternativeItemKeys.length);
    alternatives.forEach((alternative) => {
      assert.notEqual(itemKey(alternative), itemKey(recommendation));
      assert.notEqual(coreKey(alternative), coreKey(recommendation));
    });
  });
});

test("저장한 전체 아이템 조합은 새 추천과 다른 버전에서 제외된다", () => {
  const wardrobe = createWardrobe();
  const initialResult = getOutfitRecommendationResult(wardrobe, null, "여름");

  assert.ok(initialResult.recommendations.length > 0);
  const savedItemIds = initialResult.recommendations[0].items.map((item) => item.id);
  const savedKey = [...savedItemIds].sort().join("|");
  const nextResult = getOutfitRecommendationResult(wardrobe, null, "여름", [savedItemIds]);

  nextResult.recommendations.forEach((recommendation) => {
    assert.notEqual(itemKey(recommendation), savedKey);
    recommendation.alternatives?.forEach((alternative) => {
      assert.notEqual(itemKey(alternative), savedKey);
    });
  });
});

test("사용자가 수정한 소재는 공식 상품 소재보다 우선한다", () => {
  const item = createItem("top-material", "상의", {
    material: "린넨 혼방",
    confirmedProduct: {
      brand: "NAES",
      productName: "테스트 셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "면 100%",
        items: [{ name: "면", percentage: 100 }],
        source: "official",
      },
    },
    userEditedClassificationFields: ["material"],
  });

  assert.equal(getResolvedItemMaterial(item), "린넨 혼방");
});
