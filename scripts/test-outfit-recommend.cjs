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
  getShoeRecommendationsForOutfit,
  getOutfitRecommendationResult,
  getOutfitRecommendations,
  MIN_DISPLAY_RECOMMENDATION_SCORE,
} = require("../utils/outfitRecommend.ts");
const {
  estimateOutfitCombinationCount,
  LARGE_WARDROBE_CANDIDATE_LIMITS,
  limitOutfitCandidatePool,
  MAX_OUTFIT_COMBINATION_BUDGET,
} = require("../utils/outfitCandidateBudget.ts");
const {
  getOutfitRecommendationEmptyContent,
} = require("../utils/outfitRecommendationEmptyState.ts");
const {
  applyOutfitSituationRanking,
} = require("../utils/outfitSituation.ts");
const { getResolvedItemMaterial } = require("../utils/productClassification.ts");
const {
  getDetailMaterialAdjustment,
} = require("../utils/outfitDetailMaterial.ts");
const {
  getSavedOutfitUsageCount,
  matchSavedOutfitsWithCloset,
} = require("../utils/savedOutfitIntegrity.ts");
const {
  getRecommendationDataKey,
  getSavedOutfitItemIds,
  shouldUseRecommendationWeather,
  toRecommendationInputItems,
} = require("../utils/recommendationInput.ts");
const { getRecommendedShoppingItems } = require("../utils/shoppingRecommend.ts");

const createdAt = "2026-07-01T00:00:00.000Z";

test("날씨 추천은 홈에서 이어진 경로에만 적용한다", () => {
  assert.equal(shouldUseRecommendationWeather("home"), true);
  assert.equal(shouldUseRecommendationWeather(undefined), false);
  assert.equal(shouldUseRecommendationWeather("outfit"), false);
});

test("상황 적합성은 추천 순서만 바꾸고 품질 점수와 등급은 유지한다", () => {
  const alternative = {
    id: "alternative",
    title: "캐주얼 대체 코디",
    tags: ["캐주얼"],
    reasons: [],
    items: [{ category: "상의", styleTags: ["캐주얼"] }],
    score: 70,
    grade: "B",
  };
  const recommendation = {
    id: "base",
    title: "캐주얼 데일리 코디",
    tags: ["캐주얼", "데일리"],
    reasons: [],
    items: [{ category: "상의", styleTags: ["캐주얼", "데일리"] }],
    score: 72,
    grade: "B",
    alternatives: [alternative],
    alternativeCount: 1,
  };

  const [ranked] = applyOutfitSituationRanking([recommendation], {
    id: "daily",
    label: "데일리",
    keywords: ["캐주얼", "데일리"],
    reason: "데일리 상황에 맞는 조합이에요.",
  });

  assert.equal(ranked.score, 72);
  assert.equal(ranked.grade, "B");
  assert.equal(ranked.alternatives[0].score, 70);
  assert.equal(ranked.alternatives[0].grade, "B");
  assert.equal(ranked.alternativeCount, 1);
  assert.equal(ranked.reasons[0], "데일리 상황에 맞는 조합이에요.");
});

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

function recommendationItemKey(recommendation) {
  return recommendation.items.map((item) => item.id).sort().join("|");
}

test("같은 옷장은 저장 순서가 달라도 동일한 추천 순서를 만든다", () => {
  const wardrobe = createWardrobe();
  const forwardResult = getOutfitRecommendationResult(wardrobe, null, "여름");
  const reversedResult = getOutfitRecommendationResult(
    [...wardrobe].reverse(),
    null,
    "여름"
  );

  assert.deepEqual(
    forwardResult.recommendations.map(recommendationItemKey),
    reversedResult.recommendations.map(recommendationItemKey)
  );
});

test("대규모 옷장 후보 제한은 예상 조합을 예산 아래로 낮춘다", () => {
  const originalCount = estimateOutfitCombinationCount({
    topCount: 10,
    bottomCount: 10,
    shoeCount: 10,
    outerCount: 10,
    accessoryCount: 6,
  });
  const limitedCount = estimateOutfitCombinationCount({
    topCount: LARGE_WARDROBE_CANDIDATE_LIMITS.tops,
    bottomCount: LARGE_WARDROBE_CANDIDATE_LIMITS.bottoms,
    shoeCount: LARGE_WARDROBE_CANDIDATE_LIMITS.shoes,
    outerCount: LARGE_WARDROBE_CANDIDATE_LIMITS.outers,
    accessoryCount: LARGE_WARDROBE_CANDIDATE_LIMITS.accessories,
  });

  assert.ok(originalCount > MAX_OUTFIT_COMBINATION_BUDGET);
  assert.ok(limitedCount <= MAX_OUTFIT_COMBINATION_BUDGET);
});

test("대규모 후보 풀은 사용자 선호와 종류·색상 다양성을 함께 보존한다", () => {
  const candidates = [
    createItem("plain-white-less", "상의", { recommendationPreference: "less" }),
    createItem("plain-white-prefer", "상의", { recommendationPreference: "prefer" }),
    createItem("knit-black", "상의", {
      detailCategory: "반팔 니트",
      color: "블랙",
    }),
    createItem("shirt-blue", "상의", {
      detailCategory: "린넨 셔츠",
      color: "블루",
    }),
    createItem("plain-white", "상의"),
  ];
  const selected = limitOutfitCandidatePool(candidates, 3);

  assert.equal(selected.length, 3);
  assert.ok(selected.some((item) => item.id === "plain-white-prefer"));
  assert.deepEqual(
    new Set(selected.map((item) => `${item.detailCategory}|${item.color}`)).size,
    3
  );
});

test("예산 이하 후보 풀은 기존 배열과 순서를 그대로 사용한다", () => {
  const candidates = [createItem("first", "상의"), createItem("second", "상의")];
  assert.equal(limitOutfitCandidatePool(candidates, 3), candidates);
});

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

test("공식 충전재가 있는 옷은 고온 날씨 추천 후보에서 제외된다", () => {
  const filledTop = createItem("hot-weather-filled-top", "상의", {
    detailCategory: "퀼팅 베스트",
    confirmedProduct: {
      brand: "NAES",
      productName: "베이직 퀼팅 베스트",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "겉감: 나일론 100% / 충전재: 폴리에스터 100%",
        items: [
          { name: "나일론", percentage: 100, section: "outer" },
          { name: "폴리에스터", percentage: 100, section: "filling" },
        ],
        source: "official",
      },
    },
  });
  const bottom = createWardrobe().find((item) => item.category === "하의");
  const result = getOutfitRecommendationResult(
    [filledTop, bottom],
    null,
    "여름",
    [],
    {
      weather: {
        temperature: 30,
        condition: "맑음",
        rainChance: 0,
      },
    }
  );

  assert.equal(result.recommendations.length, 0);
  assert.equal(result.hasAnyRecommendation, false);
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

test("벌룬·배럴·커브드 하의를 와이드 실루엣으로 추천에 반영한다", () => {
  const top = createItem("regular-top-for-shaped-bottom", "상의");
  const shoes = createItem("shoes-for-shaped-bottom", "신발");
  const shapedBottomLabels = ["벌룬 팬츠", "배럴 팬츠", "커브드 팬츠"];

  shapedBottomLabels.forEach((detailCategory, index) => {
    const bottom = createItem(`shaped-bottom-${index}`, "하의", {
      detailCategory,
      garmentProfile: undefined,
    });
    const result = getOutfitRecommendationResult([top, bottom, shoes], null, "여름");
    const recommendation = result.recommendations[0];

    assert.ok(recommendation, detailCategory);
    assert.equal(
      recommendation.reasons.some((reason) =>
        reason.includes("하체에 여유가 있어 실루엣 대비가 안정적")
      ),
      true,
      detailCategory
    );
  });
});

test("배기·루즈 하의를 와이드 실루엣으로 추천 fallback에 반영한다", () => {
  const top = createItem("regular-top-for-basic-pants-fit", "상의");
  const shoes = createItem("shoes-for-basic-pants-fit", "신발");
  const wideBottomLabels = ["배기 팬츠", "루즈 팬츠"];

  wideBottomLabels.forEach((detailCategory, index) => {
    const bottom = createItem(`basic-wide-bottom-${index}`, "하의", {
      detailCategory,
      garmentProfile: undefined,
    });
    const result = getOutfitRecommendationResult([top, bottom, shoes], null, "여름");

    assert.equal(
      result.recommendations[0]?.reasons.some((reason) =>
        reason.includes("하체에 여유가 있어 실루엣 대비가 안정적")
      ),
      true,
      detailCategory
    );
  });
});

test("큐롯 하의를 와이드 실루엣으로 추천 fallback에 반영한다", () => {
  const top = createItem("regular-top-for-culottes", "상의");
  const bottom = createItem("culotte-bottom", "하의", {
    detailCategory: "큐롯 팬츠",
    garmentProfile: undefined,
  });
  const shoes = createItem("shoes-for-culottes", "신발");
  const result = getOutfitRecommendationResult([top, bottom, shoes], null, "여름");

  assert.equal(
    result.recommendations[0]?.reasons.some((reason) =>
      reason.includes("하체에 여유가 있어 실루엣 대비가 안정적")
    ),
    true
  );
});

test("셔켓·오버셔츠의 레이어링과 캐주얼 하의 궁합을 추천 이유에 반영한다", () => {
  const top = createItem("layering-t-shirt", "상의", {
    detailCategory: "반팔 티셔츠",
  });
  const bottom = createItem("casual-chino", "하의", {
    detailCategory: "치노 팬츠",
    material: "면",
    styleTags: ["캐주얼", "데일리"],
  });
  const shacket = createItem("layering-shacket", "아우터", {
    detailCategory: "데님 셔켓",
    material: "데님",
    styleTags: ["캐주얼", "워크웨어"],
  });
  const adjustment = getDetailMaterialAdjustment([top, bottom, shacket], "봄");

  assert.equal(adjustment.score >= 5, true);
  assert.equal(
    adjustment.reasons.includes(
      "셔츠형 아우터를 티셔츠 위에 가볍게 레이어링해 자연스러운 깊이가 생겨요."
    ),
    true
  );
  assert.equal(
    adjustment.reasons.includes(
      "셔츠형 아우터의 편안한 구조가 캐주얼 하의와 자연스럽게 이어져요."
    ),
    true
  );
});

test("일반 셔츠는 셔츠형 아우터 레이어링 규칙을 적용하지 않는다", () => {
  const shirt = createItem("regular-shirt", "상의", {
    detailCategory: "데님 셔츠",
  });
  const bottom = createItem("regular-shirt-bottom", "하의", {
    detailCategory: "치노 팬츠",
  });
  const adjustment = getDetailMaterialAdjustment([shirt, bottom], "봄");

  assert.equal(
    adjustment.reasons.some((reason) => reason.includes("셔츠형 아우터")),
    false
  );
});

test("치노 팬츠의 셔츠 궁합이 티셔츠 부분 문자열로 잘못 적용되지 않는다", () => {
  const tShirt = createItem("plain-t-shirt", "상의", {
    subCategory: "티셔츠",
    detailCategory: "반팔 티셔츠",
    styleTags: [],
  });
  const chino = createItem("plain-chino", "하의", {
    detailCategory: "치노 팬츠",
    styleTags: [],
  });
  const adjustment = getDetailMaterialAdjustment([tShirt, chino], "봄");

  assert.equal(
    adjustment.reasons.includes(
      "치노 팬츠의 단정한 캐주얼함이 셔츠·니트·로퍼와 잘 어울려요."
    ),
    false
  );
});

test("치노 팬츠의 셔츠 궁합은 독립된 셔츠 품목에 정상 적용된다", () => {
  const shirt = createItem("oxford-shirt", "상의", {
    subCategory: "셔츠",
    detailCategory: "옥스포드 셔츠",
    styleTags: [],
  });
  const chino = createItem("shirt-chino", "하의", {
    detailCategory: "치노 팬츠",
    styleTags: [],
  });
  const adjustment = getDetailMaterialAdjustment([shirt, chino], "봄");

  assert.equal(
    adjustment.reasons.includes(
      "치노 팬츠의 단정한 캐주얼함이 셔츠·니트·로퍼와 잘 어울려요."
    ),
    true
  );
});

test("티셔츠와 데님 하의의 실제 캐주얼 궁합을 명시적으로 반영한다", () => {
  const tShirt = createItem("casual-t-shirt", "상의", {
    detailCategory: "반팔 티셔츠",
    styleTags: [],
  });
  const denim = createItem("casual-denim", "하의", {
    detailCategory: "스트레이트 데님 팬츠",
    styleTags: [],
  });
  const adjustment = getDetailMaterialAdjustment([tShirt, denim], "여름");

  assert.equal(
    adjustment.reasons.includes(
      "티셔츠와 데님 하의가 자연스러운 캐주얼 흐름을 만들어요."
    ),
    true
  );
});

test("소량 울 혼방은 한여름 울 소재 감점을 적용하지 않는다", () => {
  const minorWoolTop = createItem("minor-wool-top", "상의", {
    detailCategory: "울 혼방 반팔 티셔츠",
    confirmedProduct: {
      brand: "NAES",
      productName: "울 혼방 반팔 티셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "면 95%, 울 5%",
        items: [
          { name: "면", percentage: 95 },
          { name: "울", percentage: 5 },
        ],
        source: "official",
      },
    },
  });
  const adjustment = getDetailMaterialAdjustment([minorWoolTop], "여름");

  assert.equal(
    adjustment.warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    false
  );
});

test("구분자 없는 소량 울 혼방 문자열도 한여름 감점을 적용하지 않는다", () => {
  const minorWoolTop = createItem("minor-wool-no-separator", "상의", {
    detailCategory: "울 혼방 반팔 티셔츠",
    material: "면 95% 울 5%",
  });
  const adjustment = getDetailMaterialAdjustment([minorWoolTop], "여름");

  assert.equal(
    adjustment.warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    false
  );
});

test("울 비율이 충분한 혼방은 기존 계절 감점을 유지한다", () => {
  const woolBlendTop = createItem("wool-blend-top-40", "상의", {
    detailCategory: "울 혼방 티셔츠",
    confirmedProduct: {
      brand: "NAES",
      productName: "울 혼방 티셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "폴리에스터 60%, 울 40%",
        items: [
          { name: "폴리에스터", percentage: 60 },
          { name: "울", percentage: 40 },
        ],
        source: "official",
      },
    },
  });
  const adjustment = getDetailMaterialAdjustment([woolBlendTop], "여름");

  assert.equal(
    adjustment.warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    true
  );
});

test("알파카 비율이 충분한 혼방은 울 계열 계절 감점을 적용한다", () => {
  const alpacaBlendTop = createItem("alpaca-blend-top-40", "상의", {
    detailCategory: "알파카 혼방 반팔 티셔츠",
    confirmedProduct: {
      brand: "NAES",
      productName: "알파카 혼방 반팔 티셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "면 60%, 알파카 40%",
        items: [
          { name: "면", percentage: 60 },
          { name: "알파카", percentage: 40 },
        ],
        source: "official",
      },
    },
  });
  const adjustment = getDetailMaterialAdjustment([alpacaBlendTop], "여름");

  assert.equal(
    adjustment.warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    true
  );
});

test("배색 울은 한여름 울 소재 감점을 만들지 않는다", () => {
  const trimWoolTop = createItem("trim-wool-top", "상의", {
    detailCategory: "반팔 티셔츠",
    confirmedProduct: {
      brand: "NAES",
      productName: "베이직 반팔 티셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "겉감: 면 100% / 배색: 울 100%",
        items: [
          { name: "면", percentage: 100, section: "outer" },
          { name: "울", percentage: 100, section: "trim" },
        ],
        source: "official",
      },
    },
  });
  const adjustment = getDetailMaterialAdjustment([trimWoolTop], "여름");

  assert.equal(
    adjustment.warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    false
  );
});

test("공식 혼용률에 울이 없으면 과거 울 분류만으로 감점하지 않는다", () => {
  const correctedMaterialTop = createItem("official-cotton-top", "상의", {
    detailCategory: "울 혼방 반팔 티셔츠",
    confirmedProduct: {
      brand: "NAES",
      productName: "베이직 반팔 티셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "면 100%",
        items: [{ name: "면", percentage: 100 }],
        source: "official",
      },
    },
  });
  const adjustment = getDetailMaterialAdjustment([correctedMaterialTop], "여름");

  assert.equal(
    adjustment.warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    false
  );
});

test("니트 품목은 울 함량이 낮아도 조직 특성의 여름 감점을 유지한다", () => {
  const knitTop = createItem("minor-wool-knit", "상의", {
    detailCategory: "반팔 니트",
    material: "면 95%, 울 5%",
  });
  const adjustment = getDetailMaterialAdjustment([knitTop], "여름");

  assert.equal(
    adjustment.warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    true
  );
});

test("소량 린넨 혼방은 계절 소재 가점과 경고를 적용하지 않는다", () => {
  const minorLinenTop = createItem("minor-linen-top", "상의", {
    detailCategory: "린넨 혼방 셔츠",
    confirmedProduct: {
      brand: "NAES",
      productName: "린넨 혼방 셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "면 95%, 린넨 5%",
        items: [
          { name: "면", percentage: 95 },
          { name: "린넨", percentage: 5 },
        ],
        source: "official",
      },
    },
  });
  const summerAdjustment = getDetailMaterialAdjustment([minorLinenTop], "여름");
  const winterAdjustment = getDetailMaterialAdjustment([minorLinenTop], "겨울");

  assert.equal(summerAdjustment.score, 0);
  assert.equal(
    winterAdjustment.warnings.includes(
      "린넨 소재가 포함되어 겨울에는 보온감이 부족할 수 있어요."
    ),
    false
  );
});

test("린넨 비율이 충분한 혼방은 기존 계절 소재 보정을 유지한다", () => {
  const linenBlendTop = createItem("linen-blend-top-40", "상의", {
    detailCategory: "린넨 혼방 셔츠",
    confirmedProduct: {
      brand: "NAES",
      productName: "린넨 혼방 셔츠",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "면 60%, 린넨 40%",
        items: [
          { name: "면", percentage: 60 },
          { name: "린넨", percentage: 40 },
        ],
        source: "official",
      },
    },
  });
  const summerAdjustment = getDetailMaterialAdjustment([linenBlendTop], "여름");
  const winterAdjustment = getDetailMaterialAdjustment([linenBlendTop], "겨울");

  assert.equal(summerAdjustment.score, 1);
  assert.equal(winterAdjustment.score, -3);
  assert.equal(
    winterAdjustment.warnings.includes(
      "린넨 소재가 포함되어 겨울에는 보온감이 부족할 수 있어요."
    ),
    true
  );
});

test("혼용률이 없는 린넨 품목은 기존 계절 소재 보정을 유지한다", () => {
  const linenTop = createItem("unquantified-linen-top", "상의", {
    detailCategory: "린넨 셔츠",
    material: "린넨",
  });
  const adjustment = getDetailMaterialAdjustment([linenTop], "여름");

  assert.equal(adjustment.score >= 1, true);
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

test("다른 버전은 화면의 대표 추천이나 다른 카드의 대체 조합을 반복하지 않는다", () => {
  const recommendations = getOutfitRecommendations(createWardrobe(), null, "여름");
  const mainItemKeys = new Set(recommendations.map(itemKey));
  const alternativeItemKeys = recommendations.flatMap((recommendation) =>
    (recommendation.alternatives || []).map(itemKey)
  );

  alternativeItemKeys.forEach((alternativeItemKey) => {
    assert.equal(mainItemKeys.has(alternativeItemKey), false);
  });
  assert.equal(new Set(alternativeItemKeys).size, alternativeItemKeys.length);
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

test("현실적인 여름 옷장에서 계절·날씨·저장 제외와 핵심 다양성을 함께 유지한다", () => {
  const winterTop = createItem("scenario-winter-top", "상의", {
    detailCategory: "울 터틀넥 니트",
    material: "울",
    seasons: ["겨울"],
    season: "겨울",
    seasonSource: "user",
    seasonNeedsReview: false,
    userEditedClassificationFields: ["season"],
  });
  const archivedBottom = createItem("scenario-archived-bottom", "하의", {
    detailCategory: "보관 중인 카고 팬츠",
    isArchived: true,
  });
  const wardrobe = [
    ...createWardrobe(),
    createItem("scenario-blue-top", "상의", {
      detailCategory: "블루 반팔 셔츠",
      color: "블루",
      styleTags: ["미니멀", "데일리"],
    }),
    winterTop,
    archivedBottom,
  ];
  const weather = {
    temperature: 29,
    condition: "비",
    rainChance: 80,
  };
  const initialResult = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    { weather }
  );

  assert.ok(initialResult.recommendations.length >= 2);

  const savedItemIds = initialResult.recommendations[0].items.map((item) => item.id);
  const savedKey = [...savedItemIds].sort().join("|");
  const nextResult = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [savedItemIds],
    { weather }
  );
  const allVisibleRecommendations = nextResult.recommendations.flatMap(
    (recommendation) => [recommendation, ...(recommendation.alternatives || [])]
  );

  assert.ok(nextResult.recommendations.length > 0);
  assert.equal(
    new Set(nextResult.recommendations.map(coreKey)).size,
    nextResult.recommendations.length
  );
  assert.ok(
    allVisibleRecommendations.every(
      (recommendation) => recommendation.score >= MIN_DISPLAY_RECOMMENDATION_SCORE
    )
  );
  assert.ok(
    allVisibleRecommendations.every(
      (recommendation) => itemKey(recommendation) !== savedKey
    )
  );
  assert.ok(
    allVisibleRecommendations.every((recommendation) =>
      recommendation.items.every(
        (item) =>
          item.id !== winterTop.id &&
          item.id !== archivedBottom.id
      )
    )
  );

  const topUsage = new Map();
  nextResult.recommendations.forEach((recommendation) => {
    const topId = recommendation.items.find((item) => item.category === "상의")?.id;
    topUsage.set(topId, (topUsage.get(topId) || 0) + 1);
  });
  assert.ok([...topUsage.values()].every((count) => count <= 2));
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
  const [lightweightItem] = toRecommendationInputItems([item]);
  assert.equal(lightweightItem.material, "린넨 혼방");
  assert.deepEqual(lightweightItem.userEditedClassificationFields, ["material"]);
  assert.equal(getResolvedItemMaterial(lightweightItem), "린넨 혼방");
});

test("사용자 수정이 없으면 경량 추천 입력도 공식 상품 소재를 우선한다", () => {
  const item = createItem("official-material-top", "상의", {
    material: "면",
    confirmedProduct: {
      brand: "NAES",
      productName: "테스트 니트",
      confirmedAt: createdAt,
      materialComposition: {
        summary: "울 80%, 나일론 20%",
        items: [
          { name: "울", percentage: 80 },
          { name: "나일론", percentage: 20 },
        ],
        source: "official",
      },
    },
  });

  const [lightweightItem] = toRecommendationInputItems([item]);
  assert.equal(lightweightItem.material, "울 80%, 나일론 20%");
  assert.equal(getResolvedItemMaterial(lightweightItem), "울 80%, 나일론 20%");
});

test("요약이 없는 공식 혼용률도 경량 추천 입력과 계절 보정에 보존한다", () => {
  const createItemsOnlyTop = (id, items) =>
    createItem(id, "상의", {
      detailCategory: "반팔 티셔츠",
      material: "울",
      confirmedProduct: {
        brand: "NAES",
        productName: "베이직 반팔 티셔츠",
        confirmedAt: createdAt,
        materialComposition: {
          items,
          source: "official",
        },
      },
    });
  const minorWoolTop = createItemsOnlyTop("items-only-minor-wool", [
    { name: "면", percentage: 95 },
    { name: "울", percentage: 5 },
  ]);
  const substantialWoolTop = createItemsOnlyTop("items-only-substantial-wool", [
    { name: "폴리에스터", percentage: 60 },
    { name: "울", percentage: 40 },
  ]);
  const [lightweightMinorWool, lightweightSubstantialWool] =
    toRecommendationInputItems([minorWoolTop, substantialWoolTop]);

  assert.equal(lightweightMinorWool.material, "면");
  assert.deepEqual(lightweightMinorWool.confirmedProduct.materialComposition.items, [
    { name: "면", percentage: 95 },
    { name: "울", percentage: 5 },
  ]);
  assert.equal(
    getDetailMaterialAdjustment([lightweightMinorWool], "여름").warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    false
  );
  assert.equal(
    getDetailMaterialAdjustment([lightweightSubstantialWool], "여름").warnings.includes(
      "니트·울 소재는 한여름에 덥고 무겁게 느껴질 수 있어요."
    ),
    true
  );
});

test("코디 피드백은 품질 점수를 바꾸지 않고 같은 조합의 추천 순서에만 반영한다", () => {
  const wardrobe = createWardrobe();
  const baseline = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름"
  ).recommendations;
  const target = baseline[0];
  const targetKey = itemKey(target);
  const feedbackBase = {
    itemIds: target.items.map((item) => item.id),
    updatedAt: "2026-07-17T12:00:00.000Z",
  };
  const liked = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    { feedbacks: [{ ...feedbackBase, value: "like" }] }
  ).recommendations;

  assert.equal(itemKey(liked[0]), targetKey);
  assert.equal(liked[0].feedbackPreference, "like");
  assert.equal(liked[0].score, target.score);
  assert.equal(liked[0].grade, target.grade);

  const lessPreferred = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    { feedbacks: [{ ...feedbackBase, value: "less" }] }
  ).recommendations;

  assert.notEqual(itemKey(lessPreferred[0]), targetKey);
  const markedRecommendations = lessPreferred.flatMap((recommendation) => [
    recommendation,
    ...(recommendation.alternatives || []),
  ]).filter((recommendation) => recommendation.feedbackPreference === "less");

  assert.ok(markedRecommendations.every((recommendation) => itemKey(recommendation) === targetKey));
  assert.ok(markedRecommendations.every((recommendation) => recommendation.score === target.score));
});

test("같은 아이템에 일관된 피드백이 두 번 쌓일 때만 다른 조합 순위를 보수적으로 조정한다", () => {
  const wardrobe = createWardrobe();
  const baseline = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름"
  ).recommendations;
  const uniqueRecommendations = Array.from(
    new Map(
      baseline
        .flatMap((recommendation) => [
          recommendation,
          ...(recommendation.alternatives || []),
        ])
        .map((recommendation) => [itemKey(recommendation), recommendation])
    ).values()
  );
  const sharedItemId = wardrobe
    .map((item) => item.id)
    .find(
      (itemId) =>
        uniqueRecommendations.filter((recommendation) =>
          recommendation.items.some((item) => item.id === itemId)
        ).length >= 3
    );
  assert.ok(sharedItemId);

  const recommendationsWithSharedItem = uniqueRecommendations.filter((recommendation) =>
    recommendation.items.some((item) => item.id === sharedItemId)
  );

  assert.ok(recommendationsWithSharedItem.length >= 3);

  const [firstFeedbackTarget, secondFeedbackTarget, trendTarget] =
    recommendationsWithSharedItem;
  const createFeedback = (recommendation, value, updatedAt) => ({
    itemIds: recommendation.items.map((item) => item.id),
    value,
    updatedAt,
  });
  const singleFeedbackResult = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    {
      feedbacks: [
        createFeedback(firstFeedbackTarget, "like", "2026-07-17T12:00:00.000Z"),
      ],
    }
  ).recommendations;
  const findRecommendation = (recommendations, target) =>
    recommendations
      .flatMap((recommendation) => [
        recommendation,
        ...(recommendation.alternatives || []),
      ])
      .find((recommendation) => itemKey(recommendation) === itemKey(target));

  assert.equal(
    findRecommendation(singleFeedbackResult, trendTarget)?.feedbackTrendAdjustment || 0,
    0
  );

  const likedTrendResult = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    {
      feedbacks: [
        createFeedback(firstFeedbackTarget, "like", "2026-07-17T12:00:00.000Z"),
        createFeedback(secondFeedbackTarget, "like", "2026-07-17T12:01:00.000Z"),
      ],
    }
  ).recommendations;
  const exactFeedbackKeys = new Set([
    itemKey(firstFeedbackTarget),
    itemKey(secondFeedbackTarget),
  ]);
  const likedSharedItemRecommendations = likedTrendResult
    .flatMap((recommendation) => [
      recommendation,
      ...(recommendation.alternatives || []),
    ])
    .filter(
      (recommendation) =>
        !exactFeedbackKeys.has(itemKey(recommendation)) &&
        recommendation.items.some((item) => item.id === sharedItemId)
    );

  assert.ok(likedSharedItemRecommendations.length > 0);
  assert.ok(
    likedSharedItemRecommendations.every(
      (recommendation) => recommendation.feedbackTrendAdjustment > 0
    )
  );

  const lessTrendResult = getOutfitRecommendationResult(
    wardrobe,
    null,
    "여름",
    [],
    {
      feedbacks: [
        createFeedback(firstFeedbackTarget, "less", "2026-07-17T12:00:00.000Z"),
        createFeedback(secondFeedbackTarget, "less", "2026-07-17T12:01:00.000Z"),
      ],
    }
  ).recommendations;
  const nonExactSharedItemRecommendations = lessTrendResult
    .flatMap((recommendation) => [
      recommendation,
      ...(recommendation.alternatives || []),
    ])
    .filter(
      (recommendation) =>
        !exactFeedbackKeys.has(itemKey(recommendation)) &&
        recommendation.items.some((item) => item.id === sharedItemId)
    );

  assert.ok(
    nonExactSharedItemRecommendations.length === 0 ||
      nonExactSharedItemRecommendations.every(
        (recommendation) => recommendation.feedbackTrendAdjustment < 0
      )
  );
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

test("보관 중인 옷은 옷장 데이터에 남아도 새 추천 입력에서는 제외한다", () => {
  const wardrobe = createWardrobe();
  const archivedTop = { ...wardrobe[0], isArchived: true };
  const closetWithArchivedTop = [archivedTop, ...wardrobe.slice(1)];
  const recommendationInputs = toRecommendationInputItems(closetWithArchivedTop);

  assert.equal(
    recommendationInputs.some((item) => item.id === archivedTop.id),
    false
  );

  const directResult = getOutfitRecommendationResult(
    closetWithArchivedTop,
    null,
    "여름"
  );

  assert.ok(
    directResult.recommendations.every((recommendation) =>
      recommendation.items.every((item) => item.id !== archivedTop.id)
    )
  );

  const directRecommendations = getOutfitRecommendations(
    closetWithArchivedTop,
    null,
    "여름"
  );

  assert.ok(
    directRecommendations.every((recommendation) =>
      recommendation.items.every((item) => item.id !== archivedTop.id)
    )
  );
});

test("보관 중인 신발은 새 신발 후보에서 제외하되 저장 코디의 현재 신발은 유지한다", () => {
  const wardrobe = createWardrobe();
  const currentShoe = { ...wardrobe.find((item) => item.category === "신발"), isArchived: true };
  const otherArchivedShoe = createItem("archived-shoe", "신발", {
    isArchived: true,
  });
  const outfitItems = [
    wardrobe.find((item) => item.category === "상의"),
    wardrobe.find((item) => item.category === "하의"),
    currentShoe,
  ].filter(Boolean);
  const shoeResult = getShoeRecommendationsForOutfit(
    outfitItems,
    [...wardrobe.filter((item) => item.id !== currentShoe.id), currentShoe, otherArchivedShoe],
    "여름"
  );

  assert.ok(shoeResult.currentShoes.some((result) => result.shoe.id === currentShoe.id));
  assert.equal(
    shoeResult.recommendations.some((result) => result.shoe.id === otherArchivedShoe.id),
    false
  );
});

test("보관 중인 옷은 부족한 아이템 추천의 보유 수에서도 제외한다", () => {
  const activeTop = createItem("active-top", "상의");
  const archivedBottom = createItem("archived-bottom", "하의", {
    isArchived: true,
  });
  const shoppingRecommendations = getRecommendedShoppingItems([
    activeTop,
    archivedBottom,
  ]);

  assert.ok(
    shoppingRecommendations.some(
      (recommendation) => recommendation.title === "첫 데일리 하의"
    )
  );
});
