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
  getFitSuitability,
  getRecommendedProductSize,
  getSizeRecommendationMissingInfo,
  normalizeSize,
} = require("../utils/sizeMatch.ts");
const {
  buildProductSizeMeasurement,
  doesProductSizeRowMatch,
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

  assert.equal(result.recommendedSize, undefined);
  assert.deepEqual(result.sizeRecommendations, []);
  assert.deepEqual(result.missingFields, []);
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

test("기준 옷 참조는 옷장에 남아 있는 ID만 유지한다", () => {
  const referenceClothing = pruneReferenceClothing(
    {
      topItemId: "top",
      bottomItemId: "deleted-bottom",
      outerItemId: "outer",
      shoesItemId: "",
    },
    [
      { id: "top" },
      { id: "outer" },
      { id: "unrelated" },
    ]
  );

  assert.deepEqual(referenceClothing, {
    topItemId: "top",
    outerItemId: "outer",
  });
});
