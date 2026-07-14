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

const { getRecommendedProductSize } = require("../utils/sizeMatch.ts");

const createdAt = "2026-07-01T00:00:00.000Z";

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
