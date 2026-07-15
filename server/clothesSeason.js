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
    id: "summer-bottom",
    priority: 109,
    categories: ["하의"],
    keywords: [
      "버뮤다",
      "하프 팬츠",
      "쿨링 팬츠",
      "냉감 팬츠",
      "시어서커 팬츠",
      "메쉬 팬츠",
      "mesh pants",
      "seersucker pants",
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
    id: "summer-accessory",
    priority: 107,
    categories: ["액세서리"],
    keywords: [
      "밀짚모자",
      "밀짚 모자",
      "라피아 햇",
      "라피아 모자",
      "선캡",
      "비치 햇",
      "straw hat",
      "sun visor",
    ],
    seasons: ["여름"],
  },
  {
    id: "linen",
    priority: 105,
    keywords: ["린넨", "linen"],
    seasons: ["봄", "여름"],
  },
  {
    id: "short-sleeve",
    priority: 100,
    keywords: ["반팔", "숏슬리브", "숏 슬리브", "하프 슬리브", "short sleeve", "short-sleeve"],
    seasons: ["여름"],
  },
  {
    id: "winter-bottom",
    priority: 98,
    categories: ["하의"],
    keywords: [
      "기모 팬츠",
      "기모 바지",
      "코듀로이 팬츠",
      "골덴 팬츠",
      "울 팬츠",
      "모직 팬츠",
      "플리스 팬츠",
      "후리스 팬츠",
      "벨벳 팬츠",
      "corduroy pants",
      "wool pants",
      "fleece pants",
    ],
    keywordGroups: [
      ["기모", "팬츠"],
      ["기모", "바지"],
      ["코듀로이", "팬츠"],
      ["골덴", "팬츠"],
      ["울", "팬츠"],
      ["모직", "팬츠"],
      ["플리스", "팬츠"],
      ["후리스", "팬츠"],
      ["벨벳", "팬츠"],
    ],
    seasons: ["가을", "겨울"],
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
    keywords: [
      "비니",
      "귀마개",
      "방한",
      "머플러",
      "목도리",
      "겨울 장갑",
      "바라클라바",
      "beanie",
      "earmuff",
      "winter gloves",
      "balaclava",
    ],
    seasons: ["가을", "겨울"],
  },
  {
    id: "trench-coat",
    priority: 91,
    categories: ["아우터"],
    keywords: ["트렌치코트", "트렌치 코트", "trench coat"],
    seasons: ["봄", "가을"],
  },
  {
    id: "winter-footwear",
    priority: 90,
    categories: ["신발"],
    keywords: [
      "부츠",
      "첼시부츠",
      "첼시 부츠",
      "앵클부츠",
      "앵클 부츠",
      "롱부츠",
      "롱 부츠",
      "워커",
      "방한화",
      "스노우 부츠",
      "boots",
      "chelsea boots",
      "snow boots",
    ],
    seasons: ["가을", "겨울"],
  },
  {
    id: "coat",
    priority: 90,
    categories: ["아우터"],
    keywords: ["코트", "coat"],
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
      "셔켓",
      "셔츠 자켓",
      "셔츠 재킷",
      "오버셔츠",
      "오버 셔츠",
      "후드 집업",
      "맨투맨",
      "스웨트셔츠",
      "cardigan",
      "windbreaker",
      "shirt jacket",
      "shirt-jacket",
      "shacket",
      "overshirt",
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

function includesSeasonKeyword(text, keyword) {
  const normalizedKeyword = keyword.toLowerCase();
  if (normalizedKeyword === "기모") {
    return text.replace(/기모노/g, "").includes(normalizedKeyword);
  }

  if (/^[가-힣]$/.test(normalizedKeyword)) {
    return text
      .split(/[\s,/%()[\]{}·:;]+/)
      .filter(Boolean)
      .includes(normalizedKeyword);
  }

  return text.includes(normalizedKeyword);
}

function findEvidenceRule(input) {
  const evidenceText = buildEvidenceText(input);
  const category = String(input.category || "");

  return [...SEASON_EVIDENCE_RULES]
    .sort((first, second) => second.priority - first.priority)
    .find(
      (rule) =>
        (!rule.categories || rule.categories.includes(category)) &&
        (rule.keywords.some((keyword) => includesSeasonKeyword(evidenceText, keyword)) ||
          (rule.keywordGroups || []).some((keywords) =>
            keywords.every((keyword) => includesSeasonKeyword(evidenceText, keyword))
          ))
    );
}

function getSeasonEvidenceResolution(input) {
  const seasonEvidence = input.seasonEvidence || {};
  const thickness = String(seasonEvidence.thickness || "").toLowerCase();
  const insulation = String(seasonEvidence.insulation || "").toLowerCase();
  const breathability = String(seasonEvidence.breathability || "").toLowerCase();
  const layeringRole = String(seasonEvidence.layeringRole || "").toLowerCase();
  const evidenceText = [thickness, insulation, breathability, layeringRole].join(" ");
  const hasWarmEvidence =
    /두꺼|헤비|thick|heavy/.test(thickness) ||
    /높음|보온|충전|high|insulated/.test(insulation) ||
    /방한\s*겉옷|winter outer|insulated outer/.test(layeringRole) ||
    /기모|플리스|후리스|보온|충전|fleece|insulated/.test(evidenceText);
  const hasCoolingEvidence =
    /얇|가벼|thin|light/.test(thickness) ||
    /낮음|low/.test(insulation) ||
    /높음|통기|high|breathable/.test(breathability) ||
    /가벼운\s*겉옷|light outer/.test(layeringRole) ||
    /시원/.test(evidenceText);

  if (hasWarmEvidence && hasCoolingEvidence) {
    return { seasons: [], hasConflict: true };
  }
  if (hasWarmEvidence) {
    return { seasons: ["가을", "겨울"], hasConflict: false };
  }
  if (hasCoolingEvidence) {
    return { seasons: ["봄", "여름"], hasConflict: false };
  }

  return { seasons: [], hasConflict: false };
}

function resolveClothesSeasons(input = {}) {
  const aiSeasons = normalizeSeasons(input.seasons || input.season);
  const rule = findEvidenceRule(input);
  const evidenceResolution = getSeasonEvidenceResolution(input);
  const evidenceFallback = evidenceResolution.seasons;
  if (rule) {
    const hasAiConflict =
      aiSeasons.length > 0 &&
      !aiSeasons.some((season) => rule.seasons.includes(season));
    const hasStructuredEvidenceConflict =
      evidenceResolution.hasConflict ||
      (evidenceFallback.length > 0 &&
        !evidenceFallback.some((season) => rule.seasons.includes(season)));
    const hasConflict = hasAiConflict || hasStructuredEvidenceConflict;

    return {
      seasons: [...rule.seasons],
      source: "rule",
      needsReview: hasConflict,
      ruleId: rule.id,
      reasons: evidenceResolution.hasConflict
        ? ["사진의 두께·보온성·통기성 단서가 서로 달라 확인이 필요합니다."]
        : hasStructuredEvidenceConflict
          ? ["의류 종류와 사진의 두께·보온성·통기성 단서가 달라 확인이 필요합니다."]
        : hasAiConflict
          ? ["사진 AI의 계절과 의류 단서 기반 계절이 달라 확인이 필요합니다."]
        : [`${rule.id} 의류 단서를 기준으로 계절을 판단했습니다.`],
    };
  }

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
      needsReview:
        evidenceResolution.hasConflict || !hasReliableConfidence || isAllSeasonGuess,
      ruleId: null,
      reasons: evidenceResolution.hasConflict
        ? ["사진의 두께·보온성·통기성 단서가 서로 달라 확인이 필요합니다."]
        : isAllSeasonGuess
          ? ["사진만으로 사계절 착용 여부를 확정하기 어려워 확인이 필요합니다."]
        : ["사진 AI의 의류 특성 분석을 기준으로 판단했습니다."],
    };
  }

  return {
    seasons: [],
    source: "photo_ai",
    needsReview: true,
    ruleId: null,
    reasons: evidenceResolution.hasConflict
      ? ["사진의 두께·보온성·통기성 단서가 서로 달라 확인이 필요합니다."]
      : ["사진에서 계절을 판단할 근거를 충분히 찾지 못했습니다."],
  };
}

module.exports = {
  ALLOWED_SEASONS,
  SEASON_EVIDENCE_RULES,
  normalizeSeasons,
  resolveClothesSeasons,
};
