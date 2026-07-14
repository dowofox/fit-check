const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveClothesSeasons } = require("../server/clothesSeason");

function seasons(input) {
  return resolveClothesSeasons(input).seasons;
}

test("반팔 니트는 일반 니트보다 구체적인 봄·여름 규칙을 적용한다", () => {
  assert.deepEqual(
    seasons({ detailCategory: "반팔 니트", material: "니트", seasons: ["겨울"] }),
    ["봄", "여름"]
  );
});

test("린넨 셔츠와 민소매는 더운 계절 중심으로 정규화한다", () => {
  assert.deepEqual(seasons({ detailCategory: "린넨 셔츠", seasons: ["사계절"] }), [
    "봄",
    "여름",
  ]);
  assert.deepEqual(seasons({ detailCategory: "민소매 탑", seasons: ["봄"] }), ["여름"]);
});

test("패딩과 울·플리스는 겨울 계절감을 보수적으로 반영한다", () => {
  assert.deepEqual(seasons({ category: "아우터", detailCategory: "숏 패딩" }), ["겨울"]);
  assert.deepEqual(seasons({ detailCategory: "울 니트", material: "울" }), [
    "가을",
    "겨울",
  ]);
});

test("가디건과 바람막이는 환절기 레이어로 분류한다", () => {
  assert.deepEqual(seasons({ detailCategory: "니트 가디건" }), ["봄", "가을"]);
  assert.deepEqual(seasons({ detailCategory: "나일론 바람막이" }), ["봄", "가을"]);
});

test("사계절은 명시 근거가 있을 때만 확정한다", () => {
  assert.deepEqual(seasons({ category: "하의", detailCategory: "올시즌 데님 팬츠" }), [
    "사계절",
  ]);
  assert.deepEqual(seasons({ category: "신발", detailCategory: "화이트 스니커즈" }), []);
});

test("근거 없는 계절은 사계절로 대체하지 않고 확인 대상으로 남긴다", () => {
  const result = resolveClothesSeasons({ detailCategory: "기타 상의" });

  assert.deepEqual(result.seasons, []);
  assert.equal(result.needsReview, true);
  assert.equal(result.source, "photo_ai");
});

test("사진 AI 계절과 강한 의류 단서가 충돌하면 안전한 계절과 확인 상태를 반환한다", () => {
  const padding = resolveClothesSeasons({
    category: "아우터",
    detailCategory: "숏 패딩",
    seasons: ["여름"],
  });
  const shortSleeve = resolveClothesSeasons({
    category: "상의",
    detailCategory: "반팔 티셔츠",
    seasons: ["겨울"],
  });
  const brushedPants = resolveClothesSeasons({
    category: "하의",
    detailCategory: "기모 팬츠",
    seasons: ["여름"],
  });
  const linenShirt = resolveClothesSeasons({
    category: "상의",
    detailCategory: "린넨 셔츠",
    seasons: ["겨울"],
  });

  assert.deepEqual(padding.seasons, ["겨울"]);
  assert.equal(padding.needsReview, true);
  assert.deepEqual(shortSleeve.seasons, ["여름"]);
  assert.equal(shortSleeve.needsReview, true);
  assert.deepEqual(brushedPants.seasons, ["가을", "겨울"]);
  assert.equal(brushedPants.needsReview, true);
  assert.deepEqual(linenShirt.seasons, ["봄", "여름"]);
  assert.equal(linenShirt.needsReview, true);
});

test("구체적인 단서가 없으면 AI 계절을 유지하고 사계절 중복을 제거한다", () => {
  assert.deepEqual(seasons({ detailCategory: "블라우스", seasons: ["봄", "가을"] }), [
    "봄",
    "가을",
  ]);
  assert.deepEqual(seasons({ detailCategory: "블라우스", seasons: ["사계절", "여름"] }), [
    "여름",
  ]);
});

test("의류명이 불명확해도 두께와 통기성 근거로 범위를 보정한다", () => {
  assert.deepEqual(
    seasons({
      detailCategory: "기타 상의",
      seasonEvidence: { thickness: "두꺼움", insulation: "높음" },
    }),
    ["가을", "겨울"]
  );
  assert.deepEqual(
    seasons({
      detailCategory: "기타 상의",
      seasonEvidence: { thickness: "얇음", breathability: "높음" },
    }),
    ["봄", "여름"]
  );
});
