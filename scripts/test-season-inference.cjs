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

test("공식 품목 계절과 유의미한 공식 소재 계절이 충돌하면 확인 대상으로 남긴다", () => {
  const woolKnit = resolveRegistrationSeasonInference({
    selectedSeasons: ["여름"],
    selectedSource: "photo_ai",
    selectedNeedsReview: false,
    userEdited: false,
    confirmedProduct: {
      brand: "NAES",
      productName: "반팔 니트",
      materialComposition: {
        summary: "울 100%",
        items: [{ name: "울", percentage: 100 }],
        source: "official",
      },
      confirmedAt: "2026-07-14T00:00:00.000Z",
    },
  });
  const minorWoolKnit = inferSeasonsFromOfficialProduct({
    productName: "반팔 니트",
    materialComposition: {
      summary: "면 95%, 울 5%",
      items: [
        { name: "면", percentage: 95 },
        { name: "울", percentage: 5 },
      ],
      source: "official",
    },
  });

  assert.deepEqual(woolKnit.seasons, ["봄", "여름"]);
  assert.equal(woolKnit.source, "official_product");
  assert.equal(woolKnit.needsReview, true);
  assert.match(woolKnit.reasons[0], /상품명과 소재의 계절 단서/);
  assert.deepEqual(minorWoolKnit.seasons, ["봄", "여름"]);
  assert.equal(minorWoolKnit.needsReview, false);
});

test("공식 혼용률 안의 계절 근거가 서로 충돌하면 확인 대상으로 남긴다", () => {
  const balancedLinenWool = inferSeasonsFromOfficialProduct({
    productName: "베이직 셔츠",
    materialComposition: {
      summary: "린넨 50%, 울 50%",
      items: [
        { name: "린넨", percentage: 50 },
        { name: "울", percentage: 50 },
      ],
      source: "official",
    },
  });
  const minorWoolLinen = inferSeasonsFromOfficialProduct({
    productName: "베이직 셔츠",
    materialComposition: {
      summary: "린넨 95%, 울 5%",
      items: [
        { name: "린넨", percentage: 95 },
        { name: "울", percentage: 5 },
      ],
      source: "official",
    },
  });

  assert.deepEqual(balancedLinenWool.seasons, ["봄", "여름"]);
  assert.equal(balancedLinenWool.needsReview, true);
  assert.match(balancedLinenWool.reasons[0], /소재 구성 안의 계절 단서/);
  assert.deepEqual(minorWoolLinen.seasons, ["봄", "여름"]);
  assert.equal(minorWoolLinen.needsReview, false);
});

test("배색 소재는 옷 전체의 공식 계절 근거로 사용하지 않는다", () => {
  const result = inferSeasonsFromOfficialProduct({
    productName: "베이직 상의",
    materialComposition: {
      summary: "겉감: 면 100% / 배색: 울 100%",
      items: [
        { name: "면", percentage: 100, section: "outer" },
        { name: "울", percentage: 100, section: "trim" },
      ],
      source: "official",
    },
  });

  assert.equal(result, null);
});

test("공식 충전재 정보는 보온 계절 근거로 사용한다", () => {
  const result = inferSeasonsFromOfficialProduct({
    productName: "베이직 퀼팅 재킷",
    materialComposition: {
      summary: "겉감: 나일론 100% / 충전재: 폴리에스터 100%",
      items: [
        { name: "나일론", percentage: 100, section: "outer" },
        { name: "폴리에스터", percentage: 100, section: "filling" },
      ],
      source: "official",
    },
  });

  assert.deepEqual(result.seasons, ["겨울"]);
  assert.equal(result.source, "official_product");
  assert.equal(result.needsReview, false);

  const downResult = inferSeasonsFromOfficialProduct({
    productName: "베이직 퀼팅 재킷",
    materialComposition: {
      summary: "겉감: 나일론 100% / 충전재: 구스다운 80%, 깃털 20%",
      items: [
        { name: "나일론", percentage: 100, section: "outer" },
        { name: "구스다운", percentage: 80, section: "filling" },
        { name: "깃털", percentage: 20, section: "filling" },
      ],
      source: "official",
    },
  });

  assert.deepEqual(downResult.seasons, ["겨울"]);
  assert.equal(downResult.needsReview, false);

  const syntheticFillingResult = inferSeasonsFromOfficialProduct({
    productName: "베이직 퀼팅 재킷",
    materialComposition: {
      summary: "겉감: 나일론 100% / 충전재: 웰론 100%",
      items: [
        { name: "나일론", percentage: 100, section: "outer" },
        { name: "웰론", percentage: 100, section: "filling" },
      ],
      source: "official",
    },
  });

  assert.deepEqual(syntheticFillingResult.seasons, ["겨울"]);
  assert.equal(syntheticFillingResult.needsReview, false);
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
    inferSeasonsFromOfficialProduct({ productName: "올시즌 구스 다운 패딩" }).seasons,
    ["겨울"]
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
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "울 혼방 반팔 셔츠" }).seasons,
    ["여름"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "코튼 오버셔츠" }).seasons,
    ["봄", "가을"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "린넨 오버셔츠" }).seasons,
    ["봄", "여름"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "울 셔켓" }).seasons,
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

test("소량 혼방 소재 하나로 계절을 과하게 확정하지 않는다", () => {
  const minorWool = {
    summary: "면 95%, 울 5%",
    items: [
      { name: "면", percentage: 95 },
      { name: "울", percentage: 5 },
    ],
    source: "official",
  };
  const substantialWool = {
    summary: "폴리에스터 60%, 울 40%",
    items: [
      { name: "폴리에스터", percentage: 60 },
      { name: "울", percentage: 40 },
    ],
    source: "official",
  };

  assert.equal(
    inferSeasonsFromOfficialProduct({
      productName: "베이직 와이드 팬츠",
      materialComposition: minorWool,
    }),
    null
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({
      productName: "베이직 와이드 팬츠",
      materialComposition: substantialWool,
    }).seasons,
    ["가을", "겨울"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({
      productName: "울 블렌드 와이드 팬츠",
      materialComposition: minorWool,
    }).seasons,
    ["가을", "겨울"]
  );
});

test("공식 상품명의 울트라를 울 소재로 오인하지 않는다", () => {
  assert.equal(
    inferSeasonsFromOfficialProduct({ productName: "울트라 스트레치 팬츠" }),
    null
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({
      productName: "베이직 니트",
      materialComposition: {
        summary: "울 100%",
        items: [{ name: "울", percentage: 100 }],
      },
    })?.seasons,
    ["가을", "겨울"]
  );
});

test("다운타운과 기모노를 보온 소재로 오인하지 않는다", () => {
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({
      productName: "다운타운 그래픽 반팔 티셔츠",
    })?.seasons,
    ["여름"]
  );

  const kimonoJacket = inferSeasonsFromOfficialProduct({
    productName: "기모노 로브 자켓",
  });
  assert.equal(kimonoJacket?.seasons.includes("겨울") || false, false);

  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "구스 다운 베스트" })?.seasons,
    ["겨울"]
  );
  assert.deepEqual(
    inferSeasonsFromOfficialProduct({ productName: "기모 와이드 팬츠" })?.seasons,
    ["가을", "겨울"]
  );
});

test("대표 품목은 사진 분석과 공식 상품 보정에서 같은 계절을 반환한다", () => {
  const cases = [
    { category: "상의", name: "반팔 니트" },
    { category: "상의", name: "울 혼방 반팔 셔츠" },
    { category: "아우터", name: "니트 가디건" },
    { category: "아우터", name: "코튼 오버셔츠" },
    { category: "아우터", name: "데일리 셔켓" },
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
