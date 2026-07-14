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
const {
  getOutfitRecommendationEmptyContent,
} = require("../utils/outfitRecommendationEmptyState.ts");
const { getResolvedItemMaterial } = require("../utils/productClassification.ts");
const {
  getSavedOutfitUsageCount,
  matchSavedOutfitsWithCloset,
} = require("../utils/savedOutfitIntegrity.ts");
const {
  getRecommendationDataKey,
  getSavedOutfitItemIds,
  toRecommendationInputItems,
} = require("../utils/recommendationInput.ts");

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
  assert.equal(homeResult.emptyReason, recommendationScreenResult.emptyReason);
  assert.deepEqual(
    getOutfitRecommendationEmptyContent(homeResult, wardrobe),
    getOutfitRecommendationEmptyContent(recommendationScreenResult, wardrobe)
  );
});

test("필수 카테고리 부족은 홈과 추천 화면에서 같은 빈 상태 안내를 사용한다", () => {
  const wardrobe = createWardrobe().filter((item) => item.category !== "상의");
  const result = getOutfitRecommendationResult(wardrobe, null, "여름");
  const content = getOutfitRecommendationEmptyContent(result, wardrobe);

  assert.equal(result.emptyReason, "missing_core_category");
  assert.deepEqual(result.missingCategories, ["상의"]);
  assert.equal(content.title, "추천에 필요한 옷이 부족해요");
  assert.match(content.text, /상의를 추가/);
});

test("추천 가능한 조합을 모두 저장하면 낮은 품질 조합 대신 저장 소진 상태를 사용한다", () => {
  const wardrobe = [
    createItem("saved-top", "상의"),
    createItem("saved-bottom", "하의"),
    createItem("saved-shoes", "신발"),
  ];
  const initialResult = getOutfitRecommendationResult(wardrobe, null, "여름");

  assert.ok(initialResult.recommendations.length > 0);
  const savedItemIds = initialResult.recommendations.map((recommendation) =>
    recommendation.items.map((item) => item.id)
  );
  const result = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    savedItemIds
  );
  const content = getOutfitRecommendationEmptyContent(result, wardrobe);

  assert.equal(result.recommendations.length, 0);
  assert.equal(result.emptyReason, "saved_combinations_exhausted");
  assert.equal(content.title, "새로운 추천 조합이 없어요");
});

test("날씨 보정 뒤에도 기준 미달 조합은 홈 추천으로 복원하지 않는다", () => {
  const wardrobe = [
    createItem("hot-weather-winter-top", "상의", {
      detailCategory: "울 니트",
      material: "울",
      seasons: ["겨울"],
      season: "겨울",
    }),
    createItem("hot-weather-winter-bottom", "하의", {
      detailCategory: "기모 팬츠",
      material: "기모",
      seasons: ["겨울"],
      season: "겨울",
    }),
  ];
  const result = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    {
      weather: {
        temperature: 32,
        condition: "맑음",
        rainChance: 0,
      },
    }
  );
  const content = getOutfitRecommendationEmptyContent(result, wardrobe);

  assert.equal(result.recommendations.length, 0);
  assert.equal(result.emptyReason, "below_quality_threshold");
  assert.equal(content.title, "추천할 만한 조합이 아직 부족해요");
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

test("사용자가 겨울로 확정한 옷은 여름 fallback 후보로 복원하지 않는다", () => {
  const userWinterTop = createItem("user-winter-top", "상의", {
    detailCategory: "겨울용 상의",
    seasons: ["겨울"],
    season: "겨울",
    seasonSource: "user",
    seasonNeedsReview: false,
    userEditedClassificationFields: ["season"],
  });
  const wardrobe = [
    userWinterTop,
    ...createWardrobe().filter((item) => item.category !== "상의"),
  ];
  const result = getOutfitRecommendationResult(wardrobe, null, "여름", [], {
    weather: summerWeather,
  });

  assert.equal(result.recommendations.length, 0);
  assert.equal(result.hasAnyRecommendation, false);
});

test("사용자 확정 다계절과 사계절을 현재 계절에 맞게 적용한다", () => {
  const baseItems = createWardrobe().filter((item) => item.category !== "상의");
  const transitionalTop = createItem("user-transitional-top", "상의", {
    seasons: ["봄", "가을"],
    season: "봄, 가을",
    seasonSource: "user",
    seasonNeedsReview: false,
    userEditedClassificationFields: ["season"],
  });
  const allSeasonTop = createItem("user-all-season-top", "상의", {
    seasons: ["사계절"],
    season: "사계절",
    seasonSource: "user",
    seasonNeedsReview: false,
    userEditedClassificationFields: ["season"],
  });

  assert.equal(
    getOutfitRecommendationResult([transitionalTop, ...baseItems], null, "여름")
      .hasAnyRecommendation,
    false
  );
  assert.equal(
    getOutfitRecommendationResult([allSeasonTop, ...baseItems], null, "여름")
      .recommendations.length > 0,
    true
  );
});

test("사용자 여름 확정값과 경량 계절 메타데이터를 그대로 보존한다", () => {
  const userSummerTop = createItem("user-summer-top", "상의", {
    seasons: ["여름"],
    season: "여름",
    seasonSource: "user",
    seasonNeedsReview: false,
    userEditedClassificationFields: ["season"],
  });
  const lightweightItem = toRecommendationInputItems([userSummerTop])[0];

  assert.deepEqual(lightweightItem.seasons, userSummerTop.seasons);
  assert.equal(lightweightItem.seasonSource, userSummerTop.seasonSource);
  assert.equal(lightweightItem.seasonNeedsReview, userSummerTop.seasonNeedsReview);
  assert.deepEqual(lightweightItem.userEditedClassificationFields, ["season"]);
  const summerDataKey = getRecommendationDataKey([lightweightItem], null);
  const winterDataKey = getRecommendationDataKey(
    [
      {
        ...lightweightItem,
        season: "겨울",
        seasons: ["겨울"],
      },
    ],
    null
  );
  assert.notEqual(summerDataKey, winterDataKey);
  assert.equal(
    getOutfitRecommendationResult(
      [lightweightItem, ...createWardrobe().filter((item) => item.category !== "상의")],
      null,
      "여름"
    ).recommendations.length > 0,
    true
  );
});

test("미확정 기모 팬츠는 고온 날씨 후보에서 제외한다", () => {
  const brushedPants = createItem("unconfirmed-brushed-pants", "하의", {
    detailCategory: "기모 와이드 팬츠",
    material: "기모 안감",
    seasons: [],
    season: "",
    seasonSource: "photo_ai",
    seasonNeedsReview: true,
  });
  const wardrobe = [
    ...createWardrobe().filter((item) => item.category !== "하의"),
    brushedPants,
  ];
  const result = getOutfitRecommendationResult(wardrobe, null, "여름", [], {
    weather: { temperature: 28, condition: "맑음", rainChance: 0 },
  });

  result.recommendations.forEach((recommendation) => {
    assert.equal(
      recommendation.items.some((item) => item.id === brushedPants.id),
      false
    );
  });
  assert.equal(result.hasAnyRecommendation, false);
});

test("보온 키워드의 일부가 포함된 여름 상의를 고온 방한복으로 오인하지 않는다", () => {
  const ambiguousSummerTops = [
    createItem("downtown-top", "상의", {
      detailCategory: "다운타운 그래픽 반팔 티셔츠",
      seasons: [],
      season: "",
      seasonSource: "photo_ai",
      seasonNeedsReview: true,
    }),
    createItem("kimono-top", "상의", {
      detailCategory: "기모노 반팔 블라우스",
      seasons: [],
      season: "",
      seasonSource: "photo_ai",
      seasonNeedsReview: true,
    }),
    createItem("wool-blend-top", "상의", {
      detailCategory: "울 혼방 반팔 티셔츠",
      material: "면 95%, 울 5%",
      seasons: [],
      season: "",
      seasonSource: "photo_ai",
      seasonNeedsReview: true,
    }),
  ];
  const baseItems = createWardrobe().filter((item) => item.category !== "상의");

  ambiguousSummerTops.forEach((top) => {
    const result = getOutfitRecommendationResult([top, ...baseItems], null, "여름", [], {
      weather: { temperature: 28, condition: "맑음", rainChance: 0 },
    });

    assert.equal(result.recommendations.length > 0, true, top.detailCategory);
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

test("의도한 착용감보다 큰 실측 핏은 코디 경고에 반영한다", () => {
  const top = createItem("oversized-top", "상의", {
    detailCategory: "반팔 티셔츠",
    intendedFit: "딱 맞게",
    size: "L",
    confirmedProduct: {
      brand: "NAES",
      productName: "오버사이즈 반팔 티셔츠",
      confirmedAt: createdAt,
      productSizeGuide: {
        unit: "cm",
        sizes: [
          { size: "L", totalLength: 75, shoulder: 54, chest: 62, sleeve: 25 },
        ],
      },
    },
  });
  const bottom = createItem("regular-bottom", "하의", {
    size: "M",
    confirmedProduct: {
      brand: "NAES",
      productName: "레귤러 데님 팬츠",
      confirmedAt: createdAt,
      productSizeGuide: {
        unit: "cm",
        sizes: [
          { size: "M", totalLength: 103, waist: 41, hip: 52, thigh: 32 },
        ],
      },
    },
  });
  const shoes = createItem("fit-test-shoes", "신발");
  const profile = {
    height: "175",
    topSize: "M",
    bottomSize: "32",
    shoulderWidth: "45",
    chestCircumference: "100",
    waistCircumference: "82",
    hipCircumference: "100",
    thighCircumference: "60",
    inseam: "80",
  };
  const result = getOutfitRecommendationResult(
    [top, bottom, shoes],
    profile,
    "여름"
  );

  assert.ok(result.recommendations.length > 0);
  assert.ok(
    result.recommendations[0].warnings.some((warning) =>
      warning.includes("원하는 핏보다 클 수 있어요")
    )
  );
});

test("경량 추천 입력은 선택 사이즈의 실측 행만 보존한다", () => {
  const top = createItem("measured-top", "상의", {
    size: "L",
    confirmedProduct: {
      brand: "NAES",
      productName: "실측 셔츠",
      confirmedAt: createdAt,
      productSizeGuide: {
        unit: "cm",
        sizes: [
          { size: "M", totalLength: 68, shoulder: 46, chest: 54 },
          { size: "L", totalLength: 71 },
          { size: "L", totalLength: 71, shoulder: 48, chest: 57 },
          { size: "XL", totalLength: 74, shoulder: 50, chest: 60 },
        ],
      },
    },
  });
  const bottom = createItem("measured-bottom", "하의", {
    size: "M",
    confirmedProduct: {
      brand: "NAES",
      productName: "실측 데님 팬츠",
      confirmedAt: createdAt,
      productSizeGuide: {
        unit: "cm",
        sizes: [
          { size: "M", totalLength: 103, waist: 41, hip: 52, thigh: 32 },
          { size: "L", totalLength: 106, waist: 43, hip: 54, thigh: 34 },
        ],
      },
    },
  });
  const recommendationItems = toRecommendationInputItems([
    top,
    bottom,
    createItem("measured-shoes", "신발"),
  ]);

  assert.deepEqual(
    recommendationItems[0].confirmedProduct.productSizeGuide.sizes.map(
      (measurement) => measurement.size
    ),
    ["L"]
  );
  assert.equal(
    recommendationItems[0].confirmedProduct.productSizeGuide.sizes[0].chest,
    57
  );
  assert.deepEqual(
    recommendationItems[1].confirmedProduct.productSizeGuide.sizes.map(
      (measurement) => measurement.size
    ),
    ["M"]
  );

  const result = getOutfitRecommendationResult(
    recommendationItems,
    null,
    "여름"
  );
  assert.ok(result.recommendations.length > 0);
  assert.ok(
    result.recommendations[0].reasons.some((reason) =>
      reason.includes("상품 실측을 기준으로")
    )
  );
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

test("저장 코디는 삭제된 옷 ID를 누락 상태로 구분한다", () => {
  const wardrobe = createWardrobe();
  const savedOutfit = {
    id: "saved-outfit",
    itemIds: [wardrobe[0].id, "deleted-item", wardrobe[1].id],
    score: 80,
    grade: "B",
    reasons: [],
    warnings: [],
    createdAt,
  };

  const [matchedOutfit] = matchSavedOutfitsWithCloset([savedOutfit], wardrobe);

  assert.deepEqual(
    matchedOutfit.items.map((item) => item.id),
    [wardrobe[0].id, wardrobe[1].id]
  );
  assert.deepEqual(matchedOutfit.missingItemIds, ["deleted-item"]);
});

test("새 추천 제외에는 현재 옷장에 모든 아이템이 남은 저장 코디만 사용한다", () => {
  const wardrobe = createWardrobe();
  const completeIds = [wardrobe[0].id, wardrobe[1].id];
  const savedOutfits = [
    {
      id: "complete",
      itemIds: completeIds,
      score: 80,
      grade: "B",
      reasons: [],
      warnings: [],
      createdAt,
    },
    {
      id: "stale",
      itemIds: [wardrobe[0].id, "deleted-item"],
      score: 80,
      grade: "B",
      reasons: [],
      warnings: [],
      createdAt,
    },
    {
      id: "empty",
      itemIds: [],
      score: 80,
      grade: "B",
      reasons: [],
      warnings: [],
      createdAt,
    },
  ];

  assert.deepEqual(getSavedOutfitItemIds(savedOutfits, wardrobe), [completeIds]);
});

test("옷 삭제 전 해당 아이템을 사용하는 저장 코디 수를 계산한다", () => {
  const savedOutfits = [
    { id: "one", itemIds: ["top", "bottom"] },
    { id: "two", itemIds: ["top", "shoes"] },
    { id: "three", itemIds: ["outer", "bottom"] },
  ];

  assert.equal(getSavedOutfitUsageCount(savedOutfits, "top"), 2);
  assert.equal(getSavedOutfitUsageCount(savedOutfits, "missing"), 0);
});
