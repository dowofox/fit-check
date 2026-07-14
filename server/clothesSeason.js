const ALLOWED_SEASONS = ["봄", "여름", "가을", "겨울", "사계절"];

// 구체적인 의류 단서가 일반 소재 단서보다 먼저 적용되도록 우선순위를 둡니다.
const SEASON_EVIDENCE_RULES = [
  {
    id: "summer-knit",
    priority: 120,
    keywords: ["반팔 니트", "민소매 니트", "니트 베스트", "short sleeve knit"],
    seasons: ["봄", "여름"],
  },
  {
    id: "deep-winter-outer",
    priority: 115,
    keywords: [
      "패딩",
      "다운 자켓",
      "다운 재킷",
      "다운 점퍼",
      "무스탕",
      "퍼 코트",
      "헤비 코트",
      "puffer",
      "down jacket",
      "shearling",
    ],
    seasons: ["겨울"],
  },
  {
    id: "summer-sleeve-and-bottom",
    priority: 110,
    keywords: [
      "민소매",
      "슬리브리스",
      "나시",
      "탱크탑",
      "반바지",
      "쇼츠",
      "비치웨어",
      "sleeveless",
      "tank top",
    ],
    seasons: ["여름"],
  },
  {
    id: "summer-footwear",
    priority: 108,
    categories: ["신발"],
    keywords: ["샌들", "슬리퍼", "쪼리", "크록스", "sandal", "slides", "flip flop"],
    seasons: ["여름"],
  },
  {
    id: "linen",
    priority: 105,
    keywords: ["린넨", "마", "linen"],
    seasons: ["봄", "여름"],
  },
  {
    id: "short-sleeve",
    priority: 100,
    keywords: ["반팔", "숏슬리브", "숏 슬리브", "하프 슬리브", "short sleeve", "short-sleeve"],
    seasons: ["여름"],
  },
  {
    id: "warm-material",
    priority: 95,
    keywords: ["플리스", "후리스", "기모", "울", "모직", "캐시미어", "fleece", "wool", "cashmere"],
    seasons: ["가을", "겨울"],
  },
  {
    id: "winter-accessory",
    priority: 92,
    categories: ["액세서리"],
    keywords: ["비니", "귀마개", "방한", "머플러", "beanie", "earmuff"],
    seasons: ["가을", "겨울"],
  },
  {
    id: "coat-and-boots",
    priority: 90,
    keywords: ["코트", "부츠", "첼시부츠", "워커", "coat", "boots"],
    seasons: ["가을", "겨울"],
  },
  {
    id: "transitional-layer",
    priority: 85,
    keywords: [
      "가디건",
      "바람막이",
      "윈드브레이커",
      "블루종",
      "트러커 자켓",
      "트러커 재킷",
      "데님 자켓",
      "데님 재킷",
      "후드 집업",
      "맨투맨",
      "스웨트셔츠",
      "cardigan",
      "windbreaker",
      "sweatshirt",
    ],
    seasons: ["봄", "가을"],
  },
  {
    id: "long-sleeve-shirt",
    priority: 80,
    keywords: ["긴팔 셔츠", "롱슬리브 셔츠", "long sleeve shirt", "long-sleeve shirt"],
    seasons: ["봄", "가을"],
  },
  {
    id: "explicit-all-season",
    priority: 70,
    keywords: ["사계절", "올시즌", "all season", "all-season", "year round"],
    seasons: ["사계절"],
  },
];

function normalizeSeasons(seasonValue) {
  const values = Array.isArray(seasonValue)
    ? seasonValue
    : typeof seasonValue === "string"
      ? [seasonValue]
      : [];
  const matchedSeasons = ALLOWED_SEASONS.filter((option) =>
    values.some((season) => typeof season === "string" && season.includes(option))
  );

  if (matchedSeasons.length > 1 && matchedSeasons.includes("사계절")) {
    return matchedSeasons.filter((season) => season !== "사계절");
  }

  return matchedSeasons;
}

function buildEvidenceText(input) {
  return [
    input.category,
    input.subCategory,
    input.detailCategory,
    input.material,
    input.description,
    input.styleProfile?.sleeveLength,
    input.styleProfile?.lengthType,
    input.seasonEvidence?.sleeveLength,
    input.seasonEvidence?.thickness,
    input.seasonEvidence?.insulation,
    input.seasonEvidence?.breathability,
    input.seasonEvidence?.layeringRole,
    ...(Array.isArray(input.seasonEvidence?.evidence)
      ? input.seasonEvidence.evidence
      : []),
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase();
}

function findEvidenceRule(input) {
  const evidenceText = buildEvidenceText(input);
  const category = String(input.category || "");

  return [...SEASON_EVIDENCE_RULES]
    .sort((first, second) => second.priority - first.priority)
    .find(
      (rule) =>
        (!rule.categories || rule.categories.includes(category)) &&
        rule.keywords.some((keyword) => evidenceText.includes(keyword.toLowerCase()))
    );
}

function getSeasonEvidenceFallback(input) {
  const seasonEvidence = input.seasonEvidence || {};
  const evidenceText = [
    seasonEvidence.thickness,
    seasonEvidence.insulation,
    seasonEvidence.breathability,
    seasonEvidence.layeringRole,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/두꺼|헤비|보온|기모|충전|thick|heavy|insulated/.test(evidenceText)) {
    return ["가을", "겨울"];
  }
  if (/얇|가벼|통기|시원|thin|light|breathable/.test(evidenceText)) {
    return ["봄", "여름"];
  }

  return [];
}

function resolveClothesSeasons(input = {}) {
  const aiSeasons = normalizeSeasons(input.seasons || input.season);
  const rule = findEvidenceRule(input);
  if (rule) {
    const hasConflict =
      aiSeasons.length > 0 &&
      !aiSeasons.some((season) => rule.seasons.includes(season));

    return {
      seasons: [...rule.seasons],
      source: "rule",
      needsReview: hasConflict,
      ruleId: rule.id,
      reasons: hasConflict
        ? ["사진 AI의 계절과 의류 단서 기반 계절이 달라 확인이 필요합니다."]
        : [`${rule.id} 의류 단서를 기준으로 계절을 판단했습니다.`],
    };
  }

  const evidenceFallback = getSeasonEvidenceFallback(input);
  if (evidenceFallback.length > 0) {
    return {
      seasons: evidenceFallback,
      source: "rule",
      needsReview:
        aiSeasons.length > 0 &&
        !aiSeasons.some((season) => evidenceFallback.includes(season)),
      ruleId: null,
      reasons: ["사진에서 보이는 두께, 보온성, 통기성 단서를 기준으로 판단했습니다."],
    };
  }

  if (aiSeasons.length > 0) {
    const seasonConfidence = Number(input.confidence?.season);
    const hasReliableConfidence = Number.isFinite(seasonConfidence) && seasonConfidence >= 65;
    const isAllSeasonGuess = aiSeasons.includes("사계절");

    return {
      seasons: aiSeasons,
      source: "photo_ai",
      needsReview: !hasReliableConfidence || isAllSeasonGuess,
      ruleId: null,
      reasons: isAllSeasonGuess
        ? ["사진만으로 사계절 착용 여부를 확정하기 어려워 확인이 필요합니다."]
        : ["사진 AI의 의류 특성 분석을 기준으로 판단했습니다."],
    };
  }

  return {
    seasons: [],
    source: "photo_ai",
    needsReview: true,
    ruleId: null,
    reasons: ["사진에서 계절을 판단할 근거를 충분히 찾지 못했습니다."],
  };
}

module.exports = {
  ALLOWED_SEASONS,
  SEASON_EVIDENCE_RULES,
  normalizeSeasons,
  resolveClothesSeasons,
};
