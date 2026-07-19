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
  canonicalizeSize,
  getFitSuitability,
  getMeasurementComparison,
  getRecommendedProductSize,
  getSizeRecommendationMissingInfo,
  hasSelectedClosetSize,
  normalizeClosetItemSize,
  normalizeSize,
  resolveClosetSizeAfterMeasurementSave,
} = require("../utils/sizeMatch.ts");
const {
  buildProductSizeMeasurement,
  doesProductSizeRowMatch,
  getProductSizeNumericRange,
  getValidProductSizeRows,
  normalizeProductSizeForCompare,
  removeProductSizeMeasurement,
  upsertProductSizeMeasurement,
} = require("../utils/productSizeMeasurements.ts");
const {
  countValidProfileMeasurements,
  validateProfileMeasurementInputs,
} = require("../utils/profileMeasurements.ts");
const { pruneReferenceClothing } = require("../utils/storage.ts");

const createdAt = "2026-07-01T00:00:00.000Z";

test("missing size labels are not persisted as real closet sizes", () => {
  assert.equal(normalizeClosetItemSize(undefined), undefined);
  assert.equal(normalizeClosetItemSize(""), undefined);
  assert.equal(normalizeClosetItemSize("사이즈 미입력"), undefined);
  assert.equal(hasSelectedClosetSize("사이즈 미입력"), false);
  assert.equal(normalizeClosetItemSize(" xl "), "XL");
  assert.equal(hasSelectedClosetSize("XL"), true);
});

test("첫 실측 입력은 빈 현재 사이즈만 채우고 기존 선택은 유지한다", () => {
  assert.equal(resolveClosetSizeAfterMeasurementSave(undefined, "XL"), "XL");
  assert.equal(
    resolveClosetSizeAfterMeasurementSave("사이즈 미입력", "2XL"),
    "XXL"
  );
  assert.equal(resolveClosetSizeAfterMeasurementSave("L", "XL"), "L");
});

test("FREE 사이즈의 쇼핑몰 별칭을 같은 라벨로 비교한다", () => {
  [
    "FREE",
    "FREE SIZE",
    "프리",
    "프리 사이즈",
    "프리사이즈",
    "ONE SIZE",
    "원 사이즈",
    "원사이즈",
    "ONE-SIZE",
    "ONE SIZE FITS ALL",
    "ONE-SIZE-FITS-ALL",
    "O/S",
    "OS",
    "OSFA",
    "FREE SIZE 44~66",
    "ONE SIZE (44~66)",
    "ONE SIZE FITS ALL (44~66)",
    "O/S(44-66)",
    "OSFA(44-66)",
  ].forEach((size) => {
    assert.equal(normalizeSize(size), "FREE");
    assert.equal(normalizeProductSizeForCompare(size), "FREE");
  });

  const measurement = buildProductSizeMeasurement({
    size: "ONE-SIZE(44~66)",
    totalLength: "68",
    shoulder: "",
    chest: "55",
    sleeve: "",
    waist: "",
    hip: "",
    thigh: "",
    rise: "",
    hem: "",
    footLength: "",
  });

  assert.equal(measurement?.size, "FREE");
  assert.equal(measurement?.displaySize, "ONE-SIZE(44~66)");
  assert.deepEqual(measurement?.numericRange, { min: 44, max: 66 });
  assert.equal(doesProductSizeRowMatch(measurement, "FREE SIZE"), true);
});

test("영문 장문 사이즈를 표준 문자 라벨로 비교한다", () => {
  const aliases = {
    "EXTRA SMALL": "XS",
    SMALL: "S",
    MEDIUM: "M",
    LARGE: "L",
    "X-LARGE": "XL",
    "EXTRA LARGE": "XL",
    "XX-LARGE": "XXL",
    "DOUBLE EXTRA LARGE": "XXL",
    "TRIPLE EXTRA LARGE": "XXXL",
  };

  Object.entries(aliases).forEach(([size, expected]) => {
    assert.equal(normalizeSize(size), expected);
    assert.equal(normalizeProductSizeForCompare(size), expected);
  });

  const measurement = buildProductSizeMeasurement({
    size: "X-LARGE",
    totalLength: "70",
    shoulder: "50",
    chest: "58",
    sleeve: "60",
    waist: "",
    hip: "",
    thigh: "",
    rise: "",
    hem: "",
    footLength: "",
  });

  assert.equal(measurement?.size, "XL");
  assert.equal(measurement?.displaySize, "X-LARGE");
  assert.equal(doesProductSizeRowMatch(measurement, "XL"), true);

  const extendedMeasurement = buildProductSizeMeasurement({
    size: "EXTRA LARGE (33~34)",
    totalLength: "72",
    shoulder: "50",
    chest: "58",
    sleeve: "60",
    waist: "",
    hip: "",
    thigh: "",
    rise: "",
    hem: "",
    footLength: "",
  });

  assert.equal(extendedMeasurement?.size, "XL");
  assert.equal(extendedMeasurement?.displaySize, "EXTRA LARGE (33~34)");
  assert.deepEqual(extendedMeasurement?.numericRange, { min: 33, max: 34 });
  assert.equal(doesProductSizeRowMatch(extendedMeasurement, "XL"), true);
});

test("카테고리별 표준 사이즈는 실측이 없을 때만 같은 체계로 비교한다", () => {
  assert.deepEqual(canonicalizeSize("m", { category: "하의" }), {
    raw: "m",
    normalized: "M",
    canonical: "BOTTOM:32",
    system: "alpha",
    confidence: "medium",
  });
  assert.equal(
    canonicalizeSize("32 inch", { category: "하의" }).canonical,
    "BOTTOM:32"
  );
  assert.equal(canonicalizeSize("032", { category: "하의" }).canonical, "BOTTOM:32");
  assert.equal(canonicalizeSize("M", { category: "상의" }).canonical, "TOP:95");
  assert.equal(canonicalizeSize("95", { category: "상의" }).canonical, "TOP:95");
  assert.equal(canonicalizeSize("32", { category: "상의" }).canonical, undefined);

  const bottomItem = {
    ...createItem("nominal-bottom", "하의", []),
    size: "M",
    confirmedProduct: undefined,
  };
  const matchingBottomFit = getFitSuitability(bottomItem, { bottomSize: "32 inch" });
  assert.match(matchingBottomFit.description, /표기상 프로필 사이즈와 같아요/);

  const topItem = {
    ...createItem("nominal-top", "상의", []),
    size: "32",
    confirmedProduct: undefined,
  };
  const unrelatedTopFit = getFitSuitability(topItem, { topSize: "M" });
  assert.match(unrelatedTopFit.description, /표기 방식이 달라/);
});

function createItem(id, category, sizes, overrides = {}) {
  return {
    id,
    imageUri: "",
    category,
    subCategory: category === "하의" ? "팬츠" : "티셔츠",
    detailCategory: category === "하의" ? "와이드 팬츠" : "긴팔 티셔츠",
    color: "블랙",
    style: "미니멀",
    size: sizes[0]?.size || "",
    intendedFit: "딱 맞게",
    createdAt,
    confirmedProduct: {
      brand: "TEST",
      productName: `${category} 테스트 상품`,
      confirmedAt: createdAt,
      productSizeGuide: {
        unit: "cm",
        sizes,
      },
    },
    ...overrides,
  };
}

test("하의는 선호 총장과 신체 실측에 가까운 사이즈를 우선한다", () => {
  const item = createItem(
    "bottom",
    "하의",
    [
      { size: "M", totalLength: 100, waist: 38, hip: 49, thigh: 30 },
      { size: "L", totalLength: 104 },
      { size: "L", totalLength: 104, waist: 41, hip: 52, thigh: 33 },
      { size: "XL", totalLength: 108, waist: 44, hip: 55, thigh: 36 },
    ],
    { size: "L" }
  );
  const profile = {
    height: "175",
    bottomSize: "32",
    waistCircumference: "82",
    hipCircumference: "104",
    thighCircumference: "64",
    inseam: "78",
    preferredPantsTotalLength: 104,
  };

  const result = getRecommendedProductSize(item, profile);

  assert.equal(result.recommendedSize, "L");
  assert.equal(result.recommendedDisplaySize, "L");
  assert.equal(result.sizeRecommendations.length, 3);
  assert.equal(result.sizeRecommendations[0].rank, 1);
});

test("상의·아우터·하의의 추천 사이즈와 현재 사이즈 설명은 같은 실측 결론을 사용한다", () => {
  const upperProfile = {
    height: "175",
    topSize: "105",
    shoulderWidth: "47",
    chestCircumference: "100",
    armLength: "60",
  };
  const bottomProfile = {
    height: "175",
    bottomSize: "34",
    waistCircumference: "82",
    hipCircumference: "104",
    thighCircumference: "64",
    inseam: "78",
    preferredPantsTotalLength: 104,
  };
  const scenarios = [
    {
      item: createItem(
        "measured-top",
        "상의",
        [
          { size: "M", totalLength: 66, shoulder: 44, chest: 49, sleeve: 58 },
          { size: "L", totalLength: 69, shoulder: 47, chest: 53, sleeve: 60 },
          { size: "XL", totalLength: 73, shoulder: 51, chest: 58, sleeve: 63 },
        ],
        { size: "L", intendedFit: "딱 맞게" }
      ),
      profile: upperProfile,
      reasonPattern: /어깨 실측.*정핏|가슴단면.*여유/,
    },
    {
      item: createItem(
        "measured-outer",
        "아우터",
        [
          { size: "M", totalLength: 67, shoulder: 45, chest: 51, sleeve: 58 },
          { size: "L", totalLength: 71, shoulder: 49, chest: 56, sleeve: 61 },
          { size: "XL", totalLength: 75, shoulder: 53, chest: 61, sleeve: 64 },
        ],
        {
          size: "L",
          subCategory: "자켓",
          detailCategory: "긴팔 자켓",
          intendedFit: "여유 있게",
        }
      ),
      profile: upperProfile,
      reasonPattern: /어깨.*세미오버|여유 있는 착용감/,
    },
    {
      item: createItem(
        "measured-bottom",
        "하의",
        [
          { size: "M", totalLength: 100, waist: 38, hip: 49, thigh: 30 },
          { size: "L", totalLength: 104, waist: 41, hip: 52, thigh: 33 },
          { size: "XL", totalLength: 109, waist: 45, hip: 57, thigh: 37 },
        ],
        { size: "L", intendedFit: "딱 맞게" }
      ),
      profile: bottomProfile,
      reasonPattern: /평소 잘 맞는 바지 총장.*거의 같|허리단면.*무난/,
    },
  ];

  scenarios.forEach(({ item, profile, reasonPattern }) => {
    const recommendation = getRecommendedProductSize(item, profile);
    const currentFit = getFitSuitability(item, profile);
    const topRecommendation = recommendation.sizeRecommendations[0];

    assert.equal(recommendation.recommendedSize, "L");
    assert.equal(recommendation.recommendedDisplaySize, "L");
    assert.equal(topRecommendation.fitResult, currentFit.fitResult);
    assert.equal(topRecommendation.lengthResult, currentFit.lengthResult);
    assert.equal(topRecommendation.widthResult, currentFit.widthResult);
    assert.match(topRecommendation.reasons.join(" "), reasonPattern);
    assert.match(currentFit.description, reasonPattern);
  });
});

test("FREE 단일 상품은 라벨 변환 없이 FREE를 추천하고 실측 핏을 계산한다", () => {
  const item = createItem(
    "free-top",
    "상의",
    [
      {
        size: "FREE",
        displaySize: "FREE",
        totalLength: 70,
        shoulder: 48,
        chest: 54,
        sleeve: 60,
      },
    ],
    { size: "FREE" }
  );
  const profile = {
    height: "175",
    topSize: "FREE",
    shoulderWidth: "47",
    chestCircumference: "100",
    armLength: "60",
  };

  const result = getRecommendedProductSize(item, profile);

  assert.equal(result.recommendedSize, "FREE");
  assert.equal(result.recommendedDisplaySize, "FREE");
  assert.notEqual(result.sizeRecommendations[0].fitResult, "unknown");
});

test("민소매는 어깨 실측과 사용자 어깨너비 없이 총장과 가슴으로 추천한다", () => {
  const item = createItem(
    "sleeveless-top",
    "상의",
    [
      { size: "S", totalLength: 58, chest: 44 },
      { size: "M", totalLength: 61, chest: 49 },
      { size: "L", totalLength: 64, chest: 55 },
    ],
    {
      size: "M",
      subCategory: "민소매",
      detailCategory: "민소매 티셔츠",
      intendedFit: "딱 맞게",
    }
  );
  const profile = {
    height: "170",
    chestCircumference: "96",
  };

  const result = getRecommendedProductSize(item, profile);

  assert.equal(result.recommendedSize, "M");
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.missingProductFields, undefined);
  assert.equal(result.blockedReason, undefined);
  assert.equal(result.sizeRecommendations.length, 3);
  assert.doesNotMatch(result.sizeRecommendations[0].reasons.join(" "), /어깨/);
});

test("래글런 상의는 어깨선과 일반 소매 길이를 신체 치수와 직접 비교하지 않는다", () => {
  const item = createItem(
    "raglan-top",
    "상의",
    [
      { size: "M", totalLength: 66, chest: 50, sleeve: 76 },
      { size: "L", totalLength: 69, chest: 54, sleeve: 80 },
    ],
    {
      size: "L",
      subCategory: "맨투맨",
      detailCategory: "래글런 긴팔 맨투맨",
      intendedFit: "여유 있게",
    }
  );
  const profile = {
    height: "175",
    chestCircumference: "100",
  };

  const result = getRecommendedProductSize(item, profile);

  assert.equal(result.recommendedSize, "L");
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.missingProductFields, undefined);
  assert.equal(result.blockedReason, undefined);
  assert.doesNotMatch(result.sizeRecommendations[0].reasons.join(" "), /어깨|팔 길이|손목|손등/);
});

test("실측표에 소매가 없으면 긴팔도 팔 길이 입력 없이 비교한다", () => {
  const item = createItem(
    "long-sleeve-without-sleeve-measurement",
    "상의",
    [
      { size: "M", totalLength: 67, shoulder: 46, chest: 51 },
      { size: "L", totalLength: 70, shoulder: 48, chest: 55 },
    ],
    { size: "L", detailCategory: "긴팔 셔츠" }
  );
  const profile = {
    height: "175",
    shoulderWidth: "48",
    chestCircumference: "104",
  };

  const recommendation = getRecommendedProductSize(item, profile);
  const currentFit = getFitSuitability(item, profile);

  assert.deepEqual(recommendation.missingFields, []);
  assert.equal(recommendation.sizeRecommendations.length, 2);
  assert.notEqual(currentFit.blockedReason, "missing_profile_measurements");
  assert.doesNotMatch(currentFit.description, /팔 길이/);
});

test("하의 실측표에 허벅지가 없으면 허벅지둘레 없이 비교한다", () => {
  const item = createItem(
    "bottom-without-thigh-measurement",
    "하의",
    [
      { size: "M", totalLength: 101, waist: 39, hip: 50 },
      { size: "L", totalLength: 104, waist: 42, hip: 53 },
    ],
    { size: "L" }
  );
  const profile = {
    preferredPantsTotalLength: 104,
    waistCircumference: "82",
    hipCircumference: "104",
  };

  const recommendation = getRecommendedProductSize(item, profile);
  const currentFit = getFitSuitability(item, profile);

  assert.deepEqual(recommendation.missingFields, []);
  assert.equal(recommendation.recommendedSize, "L");
  assert.notEqual(currentFit.blockedReason, "missing_profile_measurements");
  assert.doesNotMatch(currentFit.description, /허벅지둘레/);
});

test("일부 사이즈에만 있는 선택 실측은 추천 순위를 왜곡하지 않는다", () => {
  const item = createItem(
    "partially-measured-bottom",
    "하의",
    [
      { size: "M", totalLength: 104, waist: 41, hip: 52 },
      { size: "L", totalLength: 104, waist: 41, hip: 52, thigh: 33 },
    ],
    { size: "M" }
  );
  const profile = {
    preferredPantsTotalLength: 104,
    waistCircumference: "82",
    hipCircumference: "104",
    thighCircumference: "64",
  };

  const result = getRecommendedProductSize(item, profile);
  const [medium, large] = result.sizeRecommendations;

  assert.equal(result.recommendedSize, "M");
  assert.equal(medium.score, large.score);
});

test("일부 사이즈에만 있는 선택 실측은 해당 신체 치수를 필수로 요구하지 않는다", () => {
  const bottom = createItem(
    "optional-bottom-profile-measurement",
    "하의",
    [
      { size: "M", totalLength: 104, waist: 41, hip: 52 },
      { size: "L", totalLength: 106, waist: 43, hip: 54, thigh: 34 },
    ]
  );
  const upper = createItem(
    "optional-upper-profile-measurement",
    "상의",
    [
      { size: "M", totalLength: 68, shoulder: 46, chest: 52 },
      { size: "L", totalLength: 70, shoulder: 48, chest: 55, sleeve: 60 },
    ]
  );

  const bottomResult = getRecommendedProductSize(bottom, {
    preferredPantsTotalLength: 104,
    waistCircumference: "82",
    hipCircumference: "104",
  });
  const upperResult = getRecommendedProductSize(upper, {
    height: "175",
    shoulderWidth: "46",
    chestCircumference: "104",
  });

  assert.equal(bottomResult.blockedReason, undefined);
  assert.doesNotMatch(bottomResult.missingFields.join(" "), /허벅지/);
  assert.equal(bottomResult.sizeRecommendations.length, 2);
  assert.equal(upperResult.blockedReason, undefined);
  assert.doesNotMatch(upperResult.missingFields.join(" "), /팔 길이/);
  assert.equal(upperResult.sizeRecommendations.length, 2);
});

test("신체 정보와 기준 옷이 모두 없으면 부족한 프로필 정보를 반환한다", () => {
  const item = createItem("missing-profile", "상의", [
    { size: "M", totalLength: 68, shoulder: 46, chest: 52, sleeve: 59 },
  ]);

  const result = getRecommendedProductSize(item, null);

  assert.equal(result.blockedReason, "missing_profile_measurements");
  assert.ok(result.missingFields.length > 0);
  assert.equal(result.sizeRecommendations.length, 0);
  assert.deepEqual(getSizeRecommendationMissingInfo(result), {
    kind: "profile",
    title: "내 신체 치수를 입력해주세요",
    description:
      "추천에 필요한 프로필 정보: 어깨너비 · 가슴둘레 · 키 · 팔 길이. 입력하면 상품 실측과 비교할 수 있어요.",
    actionLabel: "프로필 입력하기",
  });
});

test("상품 실측이 부족하면 카테고리에 필요한 값만 안내하고 추천을 추측하지 않는다", () => {
  const item = createItem(
    "missing-product-measurement",
    "하의",
    [{ size: "L", totalLength: 104, waist: 41 }],
    { size: "L" }
  );
  const profile = {
    height: "175",
    bottomSize: "32",
    waistCircumference: "82",
    hipCircumference: "100",
    thighCircumference: "62",
    inseam: "78",
  };
  const result = getRecommendedProductSize(item, profile);

  assert.equal(result.blockedReason, "missing_product_measurements");
  assert.deepEqual(result.missingProductFields, ["엉덩이 또는 허벅지 단면"]);
  assert.equal(result.sizeRecommendations.length, 0);
  assert.deepEqual(getSizeRecommendationMissingInfo(result), {
    kind: "product",
    title: "상품 실측을 추가해주세요",
    description:
      "추천에 필요한 상품 실측: 엉덩이 또는 허벅지 단면. 이 값이 없어 사이즈를 추측하지 않았어요.",
    actionLabel: "실측 직접 입력",
  });
});

test("신발은 실측표가 있어도 자동 사이즈 추천 대상에서 제외한다", () => {
  const item = createItem(
    "shoes",
    "신발",
    [{ size: "270", footLength: 270 }],
    { subCategory: "스니커즈", detailCategory: "러닝화", size: "270" }
  );

  const result = getRecommendedProductSize(item, { shoeSize: "270" });
  const comparison = getMeasurementComparison(item, { shoeSize: "270" });

  assert.equal(result.recommendedSize, undefined);
  assert.deepEqual(result.sizeRecommendations, []);
  assert.deepEqual(result.missingFields, []);
  assert.equal(comparison.fitResult, "unknown");
  assert.deepEqual(comparison.comparisons, []);
  assert.equal(comparison.description, "신발은 자동 핏 비교에서 제외돼요.");
});

test("프로필 실측이 부족해도 같은 카테고리 기준 옷 실측으로 비교한다", () => {
  const candidate = createItem("candidate", "상의", [
    { size: "M", totalLength: 67, shoulder: 45, chest: 51, sleeve: 58 },
    { size: "L", totalLength: 70, shoulder: 48, chest: 55, sleeve: 61 },
    { size: "XL", totalLength: 73, shoulder: 51, chest: 59, sleeve: 64 },
  ]);
  const referenceItem = createItem(
    "reference",
    "상의",
    [{ size: "L", totalLength: 70, shoulder: 48, chest: 55, sleeve: 61 }],
    { size: "L" }
  );

  const result = getRecommendedProductSize(candidate, null, { referenceItem });

  assert.equal(result.recommendedSize, "L");
  assert.deepEqual(result.missingFields, []);
  assert.match(result.sizeRecommendations[0].reasons.join(" "), /기준 옷/);
});

test("현재 하의를 자기 자신의 기준 바지 총장으로 비교하지 않는다", () => {
  const item = createItem(
    "self-reference-bottom",
    "하의",
    [
      { size: "M", totalLength: 100, waist: 41, hip: 52, thigh: 33 },
      { size: "L", totalLength: 104, waist: 41, hip: 52, thigh: 33 },
      { size: "XL", totalLength: 108, waist: 41, hip: 52, thigh: 33 },
    ],
    { size: "M" }
  );
  const profile = {
    height: "180",
    bottomSize: "32",
    waistCircumference: "82",
    hipCircumference: "104",
    thighCircumference: "66",
    inseam: "82",
    preferredPantsTotalLength: 108,
  };

  const result = getRecommendedProductSize(item, profile, { referenceItem: item });

  assert.equal(result.recommendedSize, "XL");
  assert.match(result.sizeRecommendations[0].reasons.join(" "), /평소 잘 맞는 바지 총장/);
  assert.doesNotMatch(result.sizeRecommendations[0].reasons.join(" "), /기준 바지/);
});

test("다른 카테고리 기준 옷은 프로필 실측 부족을 우회하지 않는다", () => {
  const candidate = createItem("candidate-top", "상의", [
    { size: "M", totalLength: 67, shoulder: 45, chest: 51, sleeve: 58 },
    { size: "L", totalLength: 70, shoulder: 48, chest: 55, sleeve: 61 },
  ]);
  const outerReference = createItem(
    "reference-outer",
    "아우터",
    [{ size: "L", totalLength: 70, shoulder: 48, chest: 55, sleeve: 61 }],
    { size: "L", subCategory: "자켓", detailCategory: "긴팔 자켓" }
  );

  const result = getRecommendedProductSize(candidate, null, {
    referenceItem: outerReference,
  });

  assert.equal(result.recommendedSize, undefined);
  assert.equal(result.blockedReason, "missing_profile_measurements");
  assert.ok(result.missingFields.length > 0);
});

test("실측이 불완전한 같은 카테고리 기준 옷은 추천 근거로 사용하지 않는다", () => {
  const candidate = createItem("candidate-bottom", "하의", [
    { size: "M", totalLength: 101, waist: 39, hip: 50, thigh: 31 },
    { size: "L", totalLength: 104, waist: 42, hip: 53, thigh: 34 },
  ]);
  const incompleteReference = createItem(
    "reference-bottom",
    "하의",
    [{ size: "L", totalLength: 104, waist: 42 }],
    { size: "L" }
  );

  const result = getRecommendedProductSize(candidate, null, {
    referenceItem: incompleteReference,
  });

  assert.equal(result.recommendedSize, undefined);
  assert.equal(result.blockedReason, "missing_profile_measurements");
  assert.ok(result.missingFields.length > 0);
});

test("실측 직접 입력은 양수인 유한값만 저장하고 빈 행을 거부한다", () => {
  const validMeasurement = buildProductSizeMeasurement({
    size: "XL(33~34)",
    totalLength: "104,5 cm",
    shoulder: "-1",
    chest: "not-a-number",
    sleeve: "0",
    waist: "42",
    hip: "52 cm",
    thigh: "34~36 cm",
    rise: "",
    hem: "",
    footLength: "",
  });
  const emptyMeasurement = buildProductSizeMeasurement({
    size: "L",
    totalLength: "0",
    shoulder: "-1",
    chest: "",
    sleeve: "",
    waist: "",
    hip: "",
    thigh: "",
    rise: "",
    hem: "",
    footLength: "",
  });

  assert.deepEqual(validMeasurement, {
    size: "XL",
    rawSize: "XL(33~34)",
    displaySize: "XL(33~34)",
    numericRange: { min: 33, max: 34 },
    totalLength: 104.5,
    shoulder: undefined,
    chest: undefined,
    sleeve: undefined,
    waist: 42,
    hip: 52,
    thigh: undefined,
    rise: undefined,
    hem: undefined,
    footLength: undefined,
  });
  assert.equal(emptyMeasurement, null);
});

test("기존 실측표의 잘못된 값은 숨기고 같은 사이즈 입력은 한 행으로 교체한다", () => {
  const rows = getValidProductSizeRows({
    unit: "cm",
    sizes: [
      { size: "무신사 단독", totalLength: 100 },
      { size: "M", totalLength: Number.NaN, chest: 0 },
      { size: "2XL", totalLength: 72, chest: 58 },
      { size: "XXL", totalLength: 74, shoulder: 50, chest: 60 },
    ],
  });
  const replacement = buildProductSizeMeasurement({
    size: "XXL",
    totalLength: "74",
    shoulder: "",
    chest: "60",
    sleeve: "",
    waist: "",
    hip: "",
    thigh: "",
    rise: "",
    hem: "",
    footLength: "",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].totalLength, 74);
  assert.equal(rows[0].shoulder, 50);
  assert.ok(replacement);
  const nextRows = upsertProductSizeMeasurement(rows, replacement);
  assert.equal(nextRows.length, 1);
  assert.equal(nextRows[0].size, "XXL");
  assert.equal(nextRows[0].totalLength, 74);
});

test("숫자 범위가 겹쳐도 서로 다른 상품 사이즈 행은 덮어쓰지 않는다", () => {
  const rangedSize = {
    size: "XL",
    displaySize: "XL(33~34)",
    numericRange: { min: 33, max: 34 },
    totalLength: 108,
    waist: 44,
  };
  const numericSize = buildProductSizeMeasurement({
    size: "33",
    totalLength: "106",
    shoulder: "",
    chest: "",
    sleeve: "",
    waist: "42",
    hip: "",
    thigh: "",
    rise: "",
    hem: "",
    footLength: "",
  });

  assert.ok(numericSize);
  const rows = upsertProductSizeMeasurement([rangedSize], numericSize);

  assert.deepEqual(
    rows.map((row) => row.size),
    ["XL", "33"]
  );
});

test("복합 사이즈 표시명만 남은 기존 실측도 상품별 숫자 범위를 복원한다", () => {
  const [measurement] = getValidProductSizeRows({
    unit: "cm",
    sizes: [
      {
        size: "XL",
        displaySize: "XL(33~34)",
        totalLength: 104,
        waist: 41,
        hip: 52,
        thigh: 33,
      },
    ],
  });

  assert.deepEqual(getProductSizeNumericRange(measurement), { min: 33, max: 34 });
  assert.deepEqual(measurement.numericRange, { min: 33, max: 34 });
  assert.equal(doesProductSizeRowMatch(measurement, "33"), true);

  const item = createItem("legacy-range-bottom", "하의", [measurement], {
    size: "33",
  });
  const fit = getFitSuitability(item, {
    height: "175",
    bottomSize: "33",
    waistCircumference: "82",
    hipCircumference: "104",
    thighCircumference: "64",
    preferredPantsTotalLength: 104,
  });

  assert.notEqual(fit.blockedReason, "unmatched_item_size");
  assert.match(fit.description, /상품 실측 기준으로 비교했어요/);
});

test("같은 사이즈의 분리된 실측 행은 유효 필드를 합쳐 보존한다", () => {
  const [mergedRow] = getValidProductSizeRows({
    unit: "cm",
    sizes: [
      { size: "L", totalLength: 72, chest: 58 },
      { size: "L", shoulder: 50, sleeve: 61 },
    ],
  });

  assert.deepEqual(mergedRow, {
    size: "L",
    totalLength: 72,
    shoulder: 50,
    chest: 58,
    sleeve: 61,
    waist: undefined,
    hip: undefined,
    thigh: undefined,
    rise: undefined,
    hem: undefined,
    footLength: undefined,
  });
});

test("현재 사이즈 적합도는 부족한 정보에 맞는 차단 이유를 반환한다", () => {
  const profile = {
    height: "175",
    shoulderWidth: "47",
    chestCircumference: "100",
    armLength: "60",
  };
  const itemWithoutSize = createItem(
    "no-size",
    "상의",
    [{ size: "L", totalLength: 70, shoulder: 48, chest: 55, sleeve: 61 }],
    { size: "" }
  );
  const itemWithoutMatchingRow = createItem(
    "no-row",
    "상의",
    [{ size: "M", totalLength: 68, shoulder: 46, chest: 52, sleeve: 59 }],
    { size: "XL" }
  );

  assert.equal(
    getFitSuitability(itemWithoutSize, profile).blockedReason,
    "missing_item_size"
  );
  assert.equal(
    getFitSuitability(itemWithoutMatchingRow, profile).blockedReason,
    "unmatched_item_size"
  );
  assert.equal(
    getFitSuitability(
      createItem("profile-needed", "상의", [
        { size: "M", totalLength: 68, shoulder: 46, chest: 52, sleeve: 59 },
      ]),
      null
    ).blockedReason,
    "missing_profile_measurements"
  );
});

test("프로필 신체 치수는 양수 숫자만 정규화하고 잘못된 필드를 구분한다", () => {
  const result = validateProfileMeasurementInputs({
    height: "175",
    shoulderWidth: "47,5",
    chestCircumference: "0",
    waistCircumference: "82cm",
    hipCircumference: "",
    armLength: "60",
    inseam: "-1",
    thighCircumference: "64",
    preferredPantsTotalLength: "104.0",
  });

  assert.equal(result.values.shoulderWidth, "47.5");
  assert.equal(result.values.preferredPantsTotalLength, "104");
  assert.deepEqual(result.invalidFields, [
    "가슴 둘레",
    "허리 둘레",
    "다리 안쪽 길이(인심)",
  ]);
  assert.equal(
    countValidProfileMeasurements(result.values, ["height"]),
    4
  );
});

test("프로필 신체 치수의 명백한 자릿수 오입력을 거부한다", () => {
  const result = validateProfileMeasurementInputs({
    height: "1750",
    shoulderWidth: "10",
    chestCircumference: "100",
    waistCircumference: "82",
    hipCircumference: "98",
    armLength: "600",
    inseam: "78",
    thighCircumference: "58",
    preferredPantsTotalLength: "1040",
  });

  assert.deepEqual(result.invalidFields, [
    "키",
    "어깨 너비",
    "팔 길이",
    "평소 잘 맞는 바지 총장",
  ]);
  assert.equal(countValidProfileMeasurements(result.values), 5);
});

test("상품 실측 행 삭제는 선택한 사이즈만 제거하고 나머지 행을 유지한다", () => {
  const rows = [
    { size: "M", displaySize: "M", totalLength: 68 },
    { size: "L", displaySize: "L(31~32)", totalLength: 70 },
    { size: "XL", displaySize: "XL(33~34)", totalLength: 72 },
  ];

  const nextRows = removeProductSizeMeasurement(rows, rows[1]);

  assert.deepEqual(
    nextRows.map((row) => row.displaySize),
    ["M", "XL(33~34)"]
  );
});

test("기준 옷 참조는 남아 있는 같은 카테고리 ID만 유지한다", () => {
  const referenceClothing = pruneReferenceClothing(
    {
      topItemId: "top",
      bottomItemId: "deleted-bottom",
      outerItemId: "outer",
      shoesItemId: "moved-shoe",
    },
    [
      { id: "top", category: "상의" },
      { id: "outer", category: "아우터" },
      { id: "moved-shoe", category: "액세서리" },
      { id: "unrelated", category: "상의" },
    ]
  );

  assert.deepEqual(referenceClothing, {
    topItemId: "top",
    outerItemId: "outer",
  });
});

test("size ranking keeps precision when display scores round to the same value", () => {
  const item = createItem(
    "precise-ranking-bottom",
    "\uD558\uC758",
    [
      { size: "M", totalLength: 104.05, waist: 41, hip: 52, thigh: 33 },
      { size: "L", totalLength: 104.04, waist: 41, hip: 52, thigh: 33 },
    ]
  );
  const profile = {
    preferredPantsTotalLength: 104,
    waistCircumference: "82",
    hipCircumference: "104",
    thighCircumference: "64",
  };

  const result = getRecommendedProductSize(item, profile);

  assert.equal(result.sizeRecommendations[0].score, result.sizeRecommendations[1].score);
  assert.equal(result.recommendedSize, "L");
});

test("reference clothing ranking keeps precision before display score rounding", () => {
  const candidate = createItem(
    "precise-reference-candidate",
    "\uC0C1\uC758",
    [
      { size: "M", totalLength: 70.05, shoulder: 48, chest: 55, sleeve: 61 },
      { size: "L", totalLength: 70.04, shoulder: 48, chest: 55, sleeve: 61 },
    ]
  );
  const referenceItem = createItem(
    "precise-reference-item",
    "\uC0C1\uC758",
    [{ size: "L", totalLength: 70, shoulder: 48, chest: 55, sleeve: 61 }],
    { size: "L" }
  );

  const result = getRecommendedProductSize(candidate, null, { referenceItem });

  assert.equal(result.sizeRecommendations[0].score, result.sizeRecommendations[1].score);
  assert.equal(result.recommendedSize, "L");
});
