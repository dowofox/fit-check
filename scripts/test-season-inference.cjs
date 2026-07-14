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
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(result.outputText, filename);
};

const {
  inferSeasonsFromOfficialProduct,
  resolveRegistrationSeasonInference,
} = require("../utils/seasonInference.ts");
const { resolveClothesSeasons } = require("../server/clothesSeason.js");
const { normalizeClosetSeasons } = require("../utils/closetRegistration.ts");

test("빈 계절은 사계절로 바꾸지 않는다", () => {
  assert.deepEqual(normalizeClosetSeasons(undefined), []);
  assert.deepEqual(normalizeClosetSeasons("판단 어려움"), []);
  assert.deepEqual(normalizeClosetSeasons("사계절"), ["사계절"]);
});

test("사용자 수정은 공식 상품과 사진 AI보다 우선한다", () => {
  const result = resolveRegistrationSeasonInference({
    selectedSeasons: ["가을"],
    selectedSource: "photo_ai",
    selectedNeedsReview: true,
    userEdited: true,
    confirmedProduct: {
      brand: "NAES",
      productName: "린넨 반팔 셔츠",
      confirmedAt: "2026-07-14T00:00:00.000Z",
    },
  });

  assert.deepEqual(result.seasons, ["가을"]);
  assert.equal(result.source, "user");
  assert.equal(result.needsReview, false);
});

test("공식 상품명과 소재는 사진 AI보다 우선한다", () => {
  const result = resolveRegistrationSeasonInference({
    selectedSeasons: ["겨울"],
    selectedSource: "photo_ai",
    selectedNeedsReview: false,
    userEdited: false,
    confirmedProduct: {
      brand: "NAES",
      productName: "린넨 반팔 셔츠",
      materialComposition: { summary: "린넨 55%, 면 45%", source: "official" },
      confirmedAt: "2026-07-14T00:00:00.000Z",
    },
  });

  assert.deepEqual(result.seasons, ["봄", "여름"]);
  assert.equal(result.source, "official_product");
  assert.equal(result.needsReview, false);
});

test("공식 근거가 없으면 사진 AI 결과와 확인 상태를 유지한다", () => {
  const result = resolveRegistrationSeasonInference({
    selectedSeasons: ["봄", "가을"],
    selectedSource: "photo_ai",
    selectedNeedsReview: true,
    userEdited: false,
    confirmedProduct: {
      brand: "NAES",
      productName: "베이직 셔츠",
      confirmedAt: "2026-07-14T00:00:00.000Z",
    },
  });

  assert.deepEqual(result.seasons, ["봄", "가을"]);
  assert.equal(result.source, "photo_ai");
  assert.equal(result.needsReview, true);
});

test("공식 계절 키워드를 품목별로 구분한다", () => {
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "구스 다운 패딩" }).seasons,
    ["겨울"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "기모 와이드 팬츠" }).seasons,
    ["가을", "겨울"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "올시즌 데님 팬츠" }).seasons,
    ["사계절"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "시어서커 버뮤다 팬츠" }).seasons,
    ["여름"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "코듀로이 와이드 팬츠" }).seasons,
    ["가을", "겨울"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "스트랩 샌들" }).seasons,
    ["여름"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "첼시 부츠" }).seasons,
    ["가을", "겨울"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "밀짚모자" }).seasons,
    ["여름"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "울 비니" }).seasons,
    ["가을", "겨울"]
  );
  assert.equal(
    inferSeasonsFromOfficialProduct({ productName: "부츠컷 데님 팬츠" }),
    null
  );
  assert.equal(
    inferSeasonsFromOfficialProduct({ productName: "레더 크로스백" }),
    null
  );
});

test("대표 품목은 사진 분석과 공식 상품 보정에서 같은 계절을 반환한다", () => {
  const cases = [
    { category: "상의", name: "반팔 니트" },
    { category: "아우터", name: "니트 가디건" },
    { category: "아우터", name: "트렌치코트" },
    { category: "아우터", name: "울 코트" },
    { category: "하의", name: "시어서커 버뮤다 팬츠" },
    { category: "하의", name: "코듀로이 와이드 팬츠" },
    { category: "신발", name: "스트랩 샌들" },
    { category: "신발", name: "첼시 부츠" },
    { category: "액세서리", name: "밀짚모자" },
    { category: "액세서리", name: "울 비니" },
  ];

  cases.forEach(({ category, name }) => {
    const photoResult = resolveClothesSeasons({ category, detailCategory: name });
    const officialResult = inferSeasonsFromOfficialProduct({ productName: name });

    assert.ok(officialResult, `${name} 공식 상품 계절 규칙이 필요합니다.`);
    assert.deepEqual(
      officialResult.seasons,
      photoResult.seasons,
      `${name}의 사진 분석과 공식 상품 계절이 다릅니다.`
    );
  });
});
