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

test("마감과 마이크로화이버를 린넨 계절 근거로 오인하지 않는다", () => {
  const finishedDescription = resolveClothesSeasons({
    detailCategory: "긴팔 셔츠",
    description: "봉제 마감이 깔끔한 셔츠",
    seasons: ["가을"],
    confidence: { season: 85 },
  });
  const microfiberDescription = resolveClothesSeasons({
    detailCategory: "기능성 셔츠",
    description: "마이크로화이버 소재",
    seasons: ["가을"],
    confidence: { season: 85 },
  });

  assert.deepEqual(finishedDescription.seasons, ["봄", "가을"]);
  assert.equal(finishedDescription.ruleId, "long-sleeve-shirt");
  assert.equal(finishedDescription.seasons.includes("여름"), false);
  assert.deepEqual(microfiberDescription.seasons, ["가을"]);
  assert.equal(microfiberDescription.source, "photo_ai");
});

test("울트라를 울 소재 계절 근거로 오인하지 않는다", () => {
  const ultraPants = resolveClothesSeasons({
    category: "하의",
    detailCategory: "울트라 스트레치 팬츠",
    seasons: ["여름"],
    confidence: { season: 85 },
  });

  assert.deepEqual(ultraPants.seasons, ["여름"]);
  assert.equal(ultraPants.source, "photo_ai");
  assert.deepEqual(seasons({ detailCategory: "니트", material: "울" }), [
    "가을",
    "겨울",
  ]);
});

test("기모노를 기모 소재 계절 근거로 오인하지 않는다", () => {
  const kimonoJacket = resolveClothesSeasons({
    category: "아우터",
    detailCategory: "기모노 로브 자켓",
    seasons: ["봄", "가을"],
    confidence: { season: 85 },
  });

  assert.deepEqual(kimonoJacket.seasons, ["봄", "가을"]);
  assert.equal(kimonoJacket.seasons.includes("겨울"), false);
  assert.deepEqual(
    seasons({ category: "하의", detailCategory: "기모 와이드 팬츠" }),
    ["가을", "겨울"]
  );
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

test("셔켓과 오버셔츠는 소재 단서를 우선하는 레이어로 분류한다", () => {
  assert.deepEqual(seasons({ category: "아우터", detailCategory: "데일리 셔켓" }), [
    "봄",
    "가을",
  ]);
  assert.deepEqual(seasons({ category: "아우터", detailCategory: "코튼 오버셔츠" }), [
    "봄",
    "가을",
  ]);
  assert.deepEqual(seasons({ category: "아우터", detailCategory: "린넨 오버셔츠" }), [
    "봄",
    "여름",
  ]);
  assert.deepEqual(seasons({ category: "아우터", detailCategory: "울 셔켓" }), [
    "가을",
    "겨울",
  ]);
});

test("하의는 통기성과 보온 단서에 따라 여름용과 겨울용을 구분한다", () => {
  assert.deepEqual(
    seasons({ category: "하의", detailCategory: "시어서커 버뮤다 팬츠" }),
    ["여름"]
  );
  assert.deepEqual(
    seasons({ category: "하의", detailCategory: "코듀로이 와이드 팬츠" }),
    ["가을", "겨울"]
  );
  assert.deepEqual(
    seasons({ category: "하의", detailCategory: "울 팬츠" }),
    ["가을", "겨울"]
  );
});

test("신발과 액세서리는 계절성이 명확한 품목만 확정한다", () => {
  assert.deepEqual(seasons({ category: "신발", detailCategory: "스트랩 샌들" }), [
    "여름",
  ]);
  assert.deepEqual(seasons({ category: "신발", detailCategory: "첼시 부츠" }), [
    "가을",
    "겨울",
  ]);
  assert.deepEqual(seasons({ category: "액세서리", detailCategory: "밀짚모자" }), [
    "여름",
  ]);
  assert.deepEqual(seasons({ category: "액세서리", detailCategory: "울 비니" }), [
    "가을",
    "겨울",
  ]);
  assert.deepEqual(seasons({ category: "액세서리", detailCategory: "레더 크로스백" }), []);
});

test("부츠컷 하의는 겨울 신발 규칙으로 오인하지 않는다", () => {
  assert.deepEqual(
    seasons({ category: "하의", detailCategory: "부츠컷 데님 팬츠" }),
    []
  );
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

test("구체 품목과 구조화된 두께·보온성 단서가 충돌하면 확인 대상으로 남긴다", () => {
  const warmShortSleeveKnit = resolveClothesSeasons({
    category: "상의",
    detailCategory: "반팔 니트",
    seasons: ["봄", "여름"],
    confidence: { season: 90 },
    seasonEvidence: {
      thickness: "보통",
      insulation: "높음",
      breathability: "낮음",
    },
  });
  const breathableShortSleeveKnit = resolveClothesSeasons({
    category: "상의",
    detailCategory: "반팔 니트",
    seasons: ["봄", "여름"],
    confidence: { season: 90 },
    seasonEvidence: {
      thickness: "얇음",
      insulation: "낮음",
      breathability: "높음",
    },
  });
  const lightPadding = resolveClothesSeasons({
    category: "아우터",
    detailCategory: "숏 패딩",
    seasons: ["겨울"],
    confidence: { season: 90 },
    seasonEvidence: {
      thickness: "얇음",
      insulation: "낮음",
      breathability: "높음",
    },
  });

  assert.deepEqual(warmShortSleeveKnit.seasons, ["봄", "여름"]);
  assert.equal(warmShortSleeveKnit.needsReview, true);
  assert.match(warmShortSleeveKnit.reasons[0], /두께·보온성·통기성/);
  assert.equal(breathableShortSleeveKnit.needsReview, false);
  assert.deepEqual(lightPadding.seasons, ["겨울"]);
  assert.equal(lightPadding.needsReview, true);
});

test("구조화된 보온·통기 근거가 서로 충돌하면 AI 결과도 확정하지 않는다", () => {
  const conflictedAiSeason = resolveClothesSeasons({
    category: "상의",
    detailCategory: "블라우스",
    seasons: ["여름"],
    confidence: { season: 95 },
    seasonEvidence: {
      thickness: "두꺼움",
      insulation: "높음",
      breathability: "높음",
    },
  });
  const conflictedWithoutAiSeason = resolveClothesSeasons({
    category: "상의",
    detailCategory: "블라우스",
    seasonEvidence: {
      thickness: "얇음",
      insulation: "높음",
      breathability: "높음",
    },
  });
  const conflictedShortSleeveRule = resolveClothesSeasons({
    category: "상의",
    detailCategory: "반팔 티셔츠",
    seasons: ["여름"],
    confidence: { season: 95 },
    seasonEvidence: {
      thickness: "두꺼움",
      insulation: "높음",
      breathability: "높음",
    },
  });

  assert.deepEqual(conflictedAiSeason.seasons, ["여름"]);
  assert.equal(conflictedAiSeason.needsReview, true);
  assert.match(conflictedAiSeason.reasons[0], /단서가 서로 달라/);
  assert.deepEqual(conflictedWithoutAiSeason.seasons, []);
  assert.equal(conflictedWithoutAiSeason.needsReview, true);
  assert.match(conflictedWithoutAiSeason.reasons[0], /단서가 서로 달라/);
  assert.deepEqual(conflictedShortSleeveRule.seasons, ["여름"]);
  assert.equal(conflictedShortSleeveRule.needsReview, true);
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
      seasonEvidence: { thickness: "보통", insulation: "낮음", breathability: "높음" },
    }),
    ["봄", "여름"]
  );
  assert.deepEqual(
    seasons({
      detailCategory: "기타 상의",
      seasonEvidence: { thickness: "보통", insulation: "높음", breathability: "낮음" },
    }),
    ["가을", "겨울"]
  );
});
