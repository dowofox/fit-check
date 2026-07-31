import { getFitSuitability } from "@/utils/sizeMatch";
import {
  legacyColorValuesMatch as colorValuesMatch,
  isLegacyBasicColor as isBasicColor,
  isLegacyStrongColor as isStrongColor,
} from "@/utils/fashionCompatibility/legacyColorRules";
import { evaluateLegacyFashionCompatibility } from "@/utils/fashionCompatibility/legacyEvaluator";
import { getResolvedLegacyGarmentProfile as getResolvedGarmentProfile } from "@/utils/fashionCompatibility/legacyShapeRules";
import {
  getLegacyItemStyles as getItemStyles,
  getLegacyStyleGroup as getStyleGroup,
} from "@/utils/fashionCompatibility/legacyStyleRules";
import {
  estimateOutfitCombinationCount,
  LARGE_WARDROBE_CANDIDATE_LIMITS,
  limitOutfitCandidatePool,
  MAX_OUTFIT_COMBINATION_BUDGET,
} from "@/utils/outfitCandidateBudget";
import {
  getOutfitFeedbackKey,
  getOutfitFeedbackRankingAdjustment,
  type OutfitFeedbackValue,
  type OutfitRecommendationFeedback,
} from "@/utils/outfitFeedback";
import {
  getItemSituationScore,
  getOutfitSituationScore,
  isOutfitSituationMatch,
  MIN_OUTFIT_SITUATION_SCORE,
  type OutfitSituation,
} from "@/utils/outfitSituation";
import { getRecommendationMaterialText } from "@/utils/productClassification";
import { getCanonicalClosetItemSeasons } from "@/utils/closetSeason";
import {
  assessItemTemperatureSuitability,
  assessOutfitTemperatureSuitability,
  NEUTRAL_TEMPERATURE_COMFORT_SCORE,
} from "@/utils/outfitTemperatureSuitability";
import {
  ClosetItem,
  UserProfile,
  isClosetItemAvailableForRecommendation,
} from "@/utils/storage";

export type OutfitRecommendation = {
  id: string;
  items: ClosetItem[];
  title: string;
  tags: string[];
  recommendedShoes?: {
    type: string;
    reason: string;
  };
  sockRecommendation: {
    required: boolean;
    optional?: boolean;
    type: string;
    color: string;
    reason: string;
  };
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  alternativeCount?: number;
  alternatives?: OutfitRecommendation[];
  feedbackPreference?: OutfitFeedbackValue;
  feedbackTrendAdjustment?: number;
  penalty?: number;
  reasons: string[];
  warnings: string[];
  breakdown: {
    silhouette: number;
    wearFit: number;
    pointBalance: number;
    colorSupport: number;
    styleSupport: number;
    weather: number;
    rotation: number;
  };
};

export type OutfitRecommendationResult = {
  recommendations: OutfitRecommendation[];
  hasAnyRecommendation: boolean;
  emptyReason?: OutfitRecommendationEmptyReason;
  missingCategories?: string[];
};

const DISPLAY_REASON_GROUPS = [
  /상황|데이트|깔끔한 상황|편안한 상황|데일리 상황/,
  /오늘|기온|날씨|비나 눈|예보|계절/,
  /실루엣|핏|볼륨|비율|기장|상체|하체/,
  /색|무채색|베이직 컬러|밝은 톤/,
  /스타일|무드|캐주얼|포멀|미니멀/,
  /신발|아우터|액세서리|완성도/,
];

const INTERNAL_REASON_PATTERNS = [
  /AI/,
  /사진상/,
  /추정값/,
  /분석값/,
  /보수적으로 판단/,
  /상품 실측을 기준/,
  /한 아이템은 상품 실측/,
  /실측이 없어/,
  /점수/,
  /추천 후보에서 제외/,
];

export function getOutfitDisplayReasons(reasons: string[], limit = 3) {
  if (limit <= 0) return [];

  const candidates = reasons.filter(
    (reason, index, allReasons) =>
      Boolean(reason?.trim()) &&
      allReasons.indexOf(reason) === index &&
      !INTERNAL_REASON_PATTERNS.some((pattern) => pattern.test(reason))
  );
  const selected: string[] = [];

  DISPLAY_REASON_GROUPS.forEach((pattern) => {
    const matchedReason = candidates.find(
      (reason) => !selected.includes(reason) && pattern.test(reason)
    );
    if (matchedReason && selected.length < limit) selected.push(matchedReason);
  });

  candidates.forEach((reason) => {
    if (selected.length < limit && !selected.includes(reason)) selected.push(reason);
  });

  return selected.slice(0, limit);
}

export type OutfitRecommendationEmptyReason =
  | "missing_core_category"
  | "below_quality_threshold"
  | "no_situation_match"
  | "saved_combinations_exhausted";

export type OutfitRecommendationWeather = {
  temperature?: number;
  apparentTemperature?: number;
  condition?: string;
  rainChance?: number;
  windSpeed?: number;
  humidity?: number;
};

export type OutfitRecommendationOptions = {
  weather?: OutfitRecommendationWeather | null;
  allowSeasonFallback?: boolean;
  feedbacks?: OutfitRecommendationFeedback[];
  preferredItemIds?: string[];
  situation?: OutfitSituation;
  onDiagnostics?: (diagnostic: OutfitRecommendationDiagnostic) => void;
};

export type OutfitRecommendationDiagnostic = {
  stage:
    | "filtering"
    | "category-grouping"
    | "candidate-selection"
    | "combination-generation"
    | "scoring"
    | "weather-feedback"
    | "saved-comparison"
    | "deduplication"
    | "alternatives"
    | "final-sorting";
  durationMs: number;
  inputItemCount?: number;
  candidateCount?: number;
  generatedCombinationCount?: number;
  scoredCombinationCount?: number;
  removedDuplicateCount?: number;
  returnedRecommendationCount?: number;
};

export const MIN_DISPLAY_RECOMMENDATION_SCORE = 70;

export type ShoeRecommendation = {
  shoe: ClosetItem;
  score: number;
  reason: string;
  isCurrent: boolean;
};

const UNIVERSAL_SEASONS = ["사계절", "전체"];
const itemSeasonsCache = new WeakMap<ClosetItem, string[]>();
const itemSearchTextCache = new WeakMap<ClosetItem, string>();

function getItemSeasons(item: ClosetItem) {
  const cachedSeasons = itemSeasonsCache.get(item);
  if (cachedSeasons) return cachedSeasons;

  const seasons = getCanonicalClosetItemSeasons(item);
  itemSeasonsCache.set(item, seasons);
  return seasons;
}

function hasUncertainSeason(item: ClosetItem) {
  return item.seasonNeedsReview === true || getItemSeasons(item).length === 0;
}

function hasTrustedSeasonSource(item: ClosetItem) {
  return (
    getItemSeasons(item).length > 0 &&
    ["user", "official_product", "rule"].includes(item.seasonSource || "")
  );
}

function hasUserConfirmedSeason(item: ClosetItem) {
  const isUserEdited = item.userEditedClassificationFields?.includes("season") === true;

  return (
    getItemSeasons(item).length > 0 &&
    item.seasonNeedsReview !== true &&
    (item.seasonSource === "user" || isUserEdited)
  );
}

function getItemLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category || "아이템";
}

function getRecommendationDisplay(items: ClosetItem[], currentSeason: string) {
  const itemNames = items
    .map((item) => `${item.detailCategory || ""} ${item.subCategory || ""} ${item.category || ""}`)
    .join(" ");

  const styles = items.flatMap(getItemStyles).filter(Boolean);
  const colors = items.map((item) => item.color).filter(Boolean);

  const hasDenim = ["청바지", "데님"].some((keyword) => itemNames.includes(keyword));
  const hasHoodOrSweatshirt = ["후드", "맨투맨"].some((keyword) => itemNames.includes(keyword));
  const hasShirt = itemNames.includes("셔츠");
  const hasSlacks = itemNames.includes("슬랙스");
  const hasMinimalStyle = styles.some((style) => ["미니멀", "모던", "클래식"].includes(style || ""));
  const hasOuter = ["자켓", "재킷", "코트", "아우터", "블레이저", "가디건"].some((keyword) =>
    itemNames.includes(keyword)
  ) || items.some((item) => item.category === "아우터");

  const seasonalTag =
    currentSeason === "봄" ? "봄" :
      currentSeason === "여름" ? "여름" :
        currentSeason === "가을" ? "가을" :
          "겨울";
  const seasonalTitlePrefix =
    currentSeason === "봄" ? "봄날" :
      currentSeason === "여름" ? "여름" :
        currentSeason === "가을" ? "가을" :
          "겨울";
  const seasonalMood =
    currentSeason === "봄" ? "산책" :
      currentSeason === "여름" ? "데일리" :
        currentSeason === "가을" ? "카페" :
          "데이트";

  let title = `${seasonalTitlePrefix} ${seasonalMood} 코디`;

  if ((hasShirt && hasSlacks) || hasMinimalStyle) {
    title = `${seasonalTitlePrefix} 미니멀 데일리 룩`;
  } else if (hasHoodOrSweatshirt) {
    title = `${seasonalTitlePrefix} 캐주얼 편안한 룩`;
  } else if (hasDenim) {
    title = `${seasonalTitlePrefix} 캐주얼 데님 룩`;
  } else if (hasOuter) {
    title = currentSeason === "겨울"
      ? "겨울 데이트 코디"
      : `${seasonalTitlePrefix} 아우터 룩`;
  }

  const tags = [
    seasonalTag,
    currentSeason === "여름" ? "가벼움" : null,
    currentSeason === "겨울" ? "따뜻함" : null,
    hasDenim ? "데님" : null,
    hasHoodOrSweatshirt ? "편안함" : null,
    hasShirt || hasSlacks ? "깔끔함" : null,
    hasOuter ? "아우터" : null,
    colors.some((color) => ["블랙", "화이트", "아이보리", "베이지", "그레이"].includes(color || "")) ? "베이직" : null,
    styles[0] || null,
  ].filter((tag): tag is string => Boolean(tag)).slice(0, 2);

  return {
    title,
    tags: tags.length > 0 ? tags : ["데일리", "추천"],
  };
}

function getRecommendedShoes(items: ClosetItem[]): OutfitRecommendation["recommendedShoes"] {
  const hasShoes = items.some((item) => item.category === "신발");

  if (hasShoes) return undefined;

  const styles = items.flatMap(getItemStyles).filter((style): style is string => Boolean(style));
  const colors = items.map((item) => item.color).filter((color): color is string => Boolean(color));
  const itemNames = items.map(getItemLabel).join(" ");
  const isFormal = styles.some((style) => ["포멀", "댄디", "클래식", "프레피"].some((keyword) => style.includes(keyword)));
  const isStreet = styles.some((style) => ["스트릿", "고프코어", "테크웨어", "워크웨어"].some((keyword) => style.includes(keyword)));
  const hasDenim = itemNames.includes("데님") || itemNames.includes("청바지");

  if (isFormal) {
    return {
      type: "블랙 로퍼",
      reason: "포멀한 상하의 조합에는 블랙 로퍼가 가장 깔끔하게 어울립니다.",
    };
  }

  if (isStreet) {
    return {
      type: "블랙 스니커즈",
      reason: "스트릿 스타일에는 무게감 있는 블랙 스니커즈가 안정적으로 어울립니다.",
    };
  }

  if (hasDenim || colors.some((color) => ["블랙", "네이비", "데님", "그레이"].includes(color))) {
    return {
      type: "화이트 스니커즈",
      reason: "캐주얼 스타일과 가장 무난하게 어울립니다.",
    };
  }

  return {
    type: "아이보리 스니커즈",
    reason: "밝은 기본색 신발이라 대부분의 데일리 코디에 자연스럽게 연결됩니다.",
  };
}

function getSockRecommendation(
  items: ClosetItem[],
  recommendedShoes?: OutfitRecommendation["recommendedShoes"]
): OutfitRecommendation["sockRecommendation"] {
  const styles = items.flatMap(getItemStyles).filter((style): style is string => Boolean(style));
  const shoe = items.find((item) => item.category === "신발");
  const bottom = items.find((item) => item.category === "하의");
  const shoeText = shoe ? getItemSearchText(shoe) : recommendedShoes?.type || "";
  const shoeColor = shoe?.color || recommendedShoes?.type || "";
  const bottomLabel = bottom ? getItemLabel(bottom) : "하의";
  const shoeLabel = shoe ? `${shoeColor || ""} ${getItemLabel(shoe)}`.trim() : recommendedShoes?.type || "신발";
  const noSockKeywords = [
    "슬리퍼",
    "샌들",
    "슬라이드",
    "플립플랍",
    "플립플롭",
    "쪼리",
    "뮬",
    "크록스",
  ];
  const optionalSockKeywords = [
    "버켄스탁",
    "피셔맨 샌들",
    "피셔맨",
    "클로그",
  ];
  const sockRecommendedKeywords = ["운동화", "스니커즈", "러닝화", "로퍼", "더비슈즈", "더비", "부츠", "워커"];
  const isNoSockShoe = noSockKeywords.some((keyword) => shoeText.includes(keyword)) &&
    !optionalSockKeywords.some((keyword) => shoeText.includes(keyword));
  const isOptionalSockShoe = optionalSockKeywords.some((keyword) => shoeText.includes(keyword));
  const isSockRecommendedShoe = sockRecommendedKeywords.some((keyword) => shoeText.includes(keyword));
  const isDaily = styles.some((style) => ["데일리", "캐주얼", "편안함", "꾸안꾸"].some((keyword) => style.includes(keyword)));
  const isMinimal = styles.some((style) => ["미니멀", "모던", "깔끔함"].some((keyword) => style.includes(keyword)));
  const isStreet = styles.some((style) => ["스트릿", "고프코어", "테크웨어", "워크웨어"].some((keyword) => style.includes(keyword)));
  const isFormal = styles.some((style) => ["포멀", "댄디", "클래식", "프레피"].some((keyword) => style.includes(keyword)));
  let type = "크루삭스";
  let color = "흰색";

  if (isNoSockShoe) {
    return {
      required: false,
      type: "양말 없음",
      color: "",
      reason: `${shoeLabel} 스타일이라 양말 없이 착용하는 것이 자연스럽습니다.`,
    };
  }

  if (isFormal) {
    type = "얇은 드레스삭스";
  } else if (isStreet) {
    type = "스포츠 양말";
  } else if (isMinimal) {
    type = "무지 크루삭스";
  } else if (isDaily) {
    type = "크루삭스";
  }

  if (isDaily) {
    color = "흰색";
  } else if (["화이트", "아이보리", "크림"].some((keyword) => shoeColor.includes(keyword))) {
    color = "흰색/아이보리";
  } else if (["블랙", "검정", "차콜"].some((keyword) => shoeColor.includes(keyword))) {
    color = "검정/회색";
  } else if (["베이지", "브라운", "카멜"].some((keyword) => shoeColor.includes(keyword))) {
    color = "아이보리/베이지";
  } else if (isFormal) {
    color = "검정/네이비";
  }

  if (isOptionalSockShoe) {
    type = isDaily || isMinimal ? "무지 크루삭스" : "양말 없음 또는 크루삭스";
    color = isDaily ? "아이보리" : color;
  }

  const styleReason = isStreet
    ? "스트릿 스타일과 잘 어울립니다."
    : isFormal
      ? "포멀한 신발에는 얇은 양말이 실루엣을 깔끔하게 잡아줍니다."
      : isMinimal
        ? "미니멀한 분위기를 해치지 않는 무지 양말이 좋아요."
        : "데일리 코디에 자연스럽게 연결됩니다.";
  const shoeReason = shoe || recommendedShoes
    ? isSockRecommendedShoe
      ? `${shoeLabel}와 자연스럽게 연결됩니다.`
      : `${shoeLabel}에 부담 없이 맞출 수 있어요.`
    : "";
  const reason = shoe || recommendedShoes
    ? isOptionalSockShoe
      ? `${shoeLabel}는 양말 없이도 자연스럽고, 포인트를 주고 싶다면 ${color} ${type}도 좋아요.`
      : `${bottomLabel}와 ${shoeLabel} 조합에 ${color} ${type}가 가장 자연스럽게 어울려요. ${shoeReason} ${styleReason}`
    : `${bottomLabel} 중심의 코디라 ${color} ${type}를 신으면 전체 분위기를 깔끔하게 마무리할 수 있어요.`;

  return {
    required: !isOptionalSockShoe,
    optional: isOptionalSockShoe || undefined,
    type,
    color,
    reason,
  };
}

function getGrade(score: number): OutfitRecommendation["grade"] {
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function byCategory(items: ClosetItem[], category: string) {
  return items.filter((item) => item.category === category);
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1;

  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울";
}

function isSeasonAllowed(item: ClosetItem, currentSeason: string, warnings: string[]) {
  const seasons = getItemSeasons(item);

  if (hasUncertainSeason(item) && !hasTrustedSeasonSource(item)) {
    warnings.push(`${getItemLabel(item)}: 계절 정보가 불확실해 중립적으로 비교했어요.`);
    return true;
  }

  const isAllowed = isSeasonCandidate(item, currentSeason);

  if (!isAllowed) {
    warnings.push(`${getItemLabel(item)}: ${currentSeason}에 맞는 계절 정보가 아니라 실제 착용감이 어색할 수 있어요.`);
  }

  return isAllowed;
}

function isSeasonCandidate(item: ClosetItem, currentSeason: string) {
  const seasons = getItemSeasons(item);

  if (hasUncertainSeason(item) && !hasTrustedSeasonSource(item)) return true;
  if (seasons.length === 0) return true;

  return seasons.some((season) => {
    if (UNIVERSAL_SEASONS.includes(season)) return true;
    if (season.includes(currentSeason)) return true;
    if (currentSeason === "봄" && season.includes("가을")) return true;
    if (currentSeason === "가을" && season.includes("봄")) return true;
    return false;
  });
}

function getItemSearchText(item: ClosetItem) {
  const cachedText = itemSearchTextCache.get(item);
  if (cachedText !== undefined) return cachedText;

  const text = [
    item.confirmedProduct?.brand,
    item.confirmedProduct?.productName,
    item.confirmedBrand,
    item.inferredBrand,
    item.category,
    item.subCategory,
    item.detailCategory,
    item.description,
    item.fit,
    item.style,
    ...(item.styleTags || []),
  ].filter(Boolean).join(" ");
  itemSearchTextCache.set(item, text);
  return text;
}

function isWeatherCandidate(item: ClosetItem, weather?: OutfitRecommendationWeather | null) {
  return !assessItemTemperatureSuitability(item, weather).hardBlocked;
}

function getSeasonMatchedItems(
  items: ClosetItem[],
  currentSeason: string,
  weather?: OutfitRecommendationWeather | null,
  strictSeasonFilter = true
) {
  if (!strictSeasonFilter) {
    return items.filter((item) => {
      const isUserConfirmedMismatch =
        hasUserConfirmedSeason(item) && !isSeasonCandidate(item, currentSeason);

      return !isUserConfirmedMismatch && isWeatherCandidate(item, weather);
    });
  }

  return items.filter((item) =>
    isSeasonCandidate(item, currentSeason) &&
    isWeatherCandidate(item, weather)
  );
}

function getSeasonPriority(item: ClosetItem, currentSeason: string) {
  const seasons = getItemSeasons(item);

  if (hasUncertainSeason(item) && !hasTrustedSeasonSource(item)) return 1;
  if (seasons.length === 0) return 1;
  if (isSeasonCandidate(item, currentSeason)) return 2;
  return 0;
}

function sortBySeasonPriority(items: ClosetItem[], currentSeason: string) {
  return [...items].sort((first, second) => {
    const seasonDiff = getSeasonPriority(second, currentSeason) - getSeasonPriority(first, currentSeason);

    if (seasonDiff !== 0) return seasonDiff;

    const firstCreatedAt = new Date(first.createdAt).getTime();
    const secondCreatedAt = new Date(second.createdAt).getTime();

    return (Number.isNaN(secondCreatedAt) ? 0 : secondCreatedAt) - (Number.isNaN(firstCreatedAt) ? 0 : firstCreatedAt);
  });
}

function hasMatchingStyle(item: ClosetItem, baseItems: ClosetItem[]) {
  const itemStyles = getItemStyles(item);
  if (itemStyles.length === 0) return false;

  return baseItems.some((baseItem) => {
    const baseStyles = getItemStyles(baseItem);
    if (baseStyles.length === 0) return false;
    if (itemStyles.some((style) => baseStyles.includes(style))) return true;

    return itemStyles.some((style) => {
      const itemStyleGroup = getStyleGroup(style);

      return baseStyles.some((baseStyle) => {
        const baseStyleGroup = getStyleGroup(baseStyle);
        return Boolean(itemStyleGroup && baseStyleGroup && itemStyleGroup === baseStyleGroup);
      });
    });
  });
}

function getRotationBreakdownScore(items: ClosetItem[], reasons: string[]) {
  const rawRotationScore = getRotationScore(items, reasons);
  return Math.max(0, Math.min(5, Math.round((rawRotationScore + 20) / 8)));
}

function getSizeWarnings(
  items: ClosetItem[],
  profile?: UserProfile | null,
  fitSuitabilityCache = new Map<string, ReturnType<typeof getFitSuitability>>()
) {
  if (!profile) return ["프로필 사이즈가 없어 사이즈 적합도는 참고하지 못했어요."];

  return items
    .filter((item) => ["상의", "하의", "아우터"].includes(item.category))
    .map((item) => {
      if (!fitSuitabilityCache.has(item.id)) {
        fitSuitabilityCache.set(item.id, getFitSuitability(item, profile));
      }

      const result = fitSuitabilityCache.get(item.id)!;
      const hasSizeWarning =
        result.fitResult === "small" ||
        ["작을 수", "클 수", "많이 여유로울 수"].some((keyword) =>
          result.status.includes(keyword)
        );

      return hasSizeWarning ? `${getItemLabel(item)}: ${result.status}` : "";
    })
    .filter(Boolean);
}

function isImportantWarning(warning: string) {
  return [
    "신발",
    "부해",
    "산만",
    "복잡",
    "작을 수",
    "답답",
    "과해",
    "계절",
    "충돌",
    "색상",
    "어색",
  ].some((keyword) => warning.includes(keyword));
}

function getWarningPenalty(warnings: string[]) {
  return warnings.reduce(
    (totalPenalty, warning) => totalPenalty + (isImportantWarning(warning) ? 6 : 3),
    0
  );
}

function applyScoreCaps(
  score: number,
  warnings: string[],
  reasons: string[],
  breakdown: OutfitRecommendation["breakdown"],
  measurementSourceCount: number
) {
  let maximumScore = 100;

  if (warnings.length >= 1) maximumScore = Math.min(maximumScore, 88);
  if (warnings.length >= 2) maximumScore = Math.min(maximumScore, 82);
  if (warnings.some(isImportantWarning)) maximumScore = Math.min(maximumScore, 78);
  if (reasons.length < 3) maximumScore = Math.min(maximumScore, 78);
  if (breakdown.silhouette < 16) maximumScore = Math.min(maximumScore, 75);
  if (breakdown.wearFit < 13) maximumScore = Math.min(maximumScore, 78);
  if (breakdown.pointBalance < 6) maximumScore = Math.min(maximumScore, 82);
  if (breakdown.weather < 10) maximumScore = Math.min(maximumScore, 69);
  if (breakdown.weather < 15) maximumScore = Math.min(maximumScore, 79);
  if (measurementSourceCount === 0) maximumScore = Math.min(maximumScore, 82);
  if (measurementSourceCount === 1) maximumScore = Math.min(maximumScore, 88);

  const isExceptionalCombination =
    measurementSourceCount === 2 &&
    warnings.length === 0 &&
    reasons.length >= 4 &&
    breakdown.silhouette >= 23 &&
    breakdown.wearFit >= 18 &&
    breakdown.pointBalance >= 9 &&
    breakdown.colorSupport >= 8 &&
    breakdown.styleSupport >= 4 &&
    breakdown.weather >= 20;

  if (!isExceptionalCombination) maximumScore = Math.min(maximumScore, 89);

  return Math.min(maximumScore, Math.max(0, Math.round(score)));
}

function getRotationScore(items: ClosetItem[], reasons: string[]) {
  if (items.length === 0) return 0;

  const now = Date.now();
  let hasRecentlyWornItem = false;
  let hasLongUnwornItem = false;
  let hasFrequentlyWornItem = false;
  const itemScores = items.map((item) => {
    let score = 0;
    const wornAt = item.lastWornAt ? new Date(item.lastWornAt).getTime() : Number.NaN;
    const daysSinceWorn = Number.isNaN(wornAt)
      ? Number.POSITIVE_INFINITY
      : Math.max(0, (now - wornAt) / (1000 * 60 * 60 * 24));
    const wearCount = item.wearCount || 0;

    if (daysSinceWorn <= 3) {
      score -= 10;
      hasRecentlyWornItem = true;
    } else if (daysSinceWorn <= 7) {
      score -= 5;
      hasRecentlyWornItem = true;
    } else if (daysSinceWorn >= 30) {
      score += 5;
      hasLongUnwornItem = true;
    }

    if (wearCount <= 1) {
      score += 5;
    } else if (wearCount >= 5) {
      score -= 5;
      hasFrequentlyWornItem = true;
    }

    return score;
  });
  const score = Math.round(
    itemScores.reduce((total, itemScore) => total + itemScore, 0) / itemScores.length
  );
  const preferenceAdjustment = items.reduce((adjustment, item) => {
    if (item.recommendationPreference === "prefer") return adjustment + 5;
    if (item.recommendationPreference === "less") return adjustment - 10;
    return adjustment;
  }, 0);
  const normalizedScore = Math.max(-20, Math.min(20, score + preferenceAdjustment));
  const hasPreferredItem = items.some((item) => item.recommendationPreference === "prefer");
  const hasLessPreferredItem = items.some((item) => item.recommendationPreference === "less");

  if (hasPreferredItem) {
    reasons.push("자주 추천으로 설정한 아이템을 이번 조합에 우선 반영했어요.");
  }

  if (hasLessPreferredItem) {
    reasons.push("잠시 덜 추천으로 설정한 아이템은 추천 우선순위를 낮췄어요.");
  } else if (normalizedScore >= 5 && hasLongUnwornItem) {
    reasons.push("최근 코디 저장에 덜 포함된 아이템을 우선 반영해 추천 구성을 다양하게 했어요.");
  } else if (normalizedScore <= -5 && (hasRecentlyWornItem || hasFrequentlyWornItem)) {
    reasons.push("최근 자주 저장한 옷은 추천 우선순위를 낮췄어요.");
  }

  return normalizedScore;
}

function buildRecommendation(
  items: ClosetItem[],
  currentSeason: string,
  profile?: UserProfile | null,
  fitSuitabilityCache?: Map<string, ReturnType<typeof getFitSuitability>>,
  weather?: OutfitRecommendationWeather | null
): OutfitRecommendation | null {
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");
  const shoes = items.find((item) => item.category === "신발");

  if (!top || !bottom) return null;

  const temperatureAssessment = assessOutfitTemperatureSuitability(
    items,
    weather
  );
  if (temperatureAssessment.hardBlocked) return null;

  const reasons: string[] = [...temperatureAssessment.reasons];
  const warnings = [
    ...getSizeWarnings(items, profile, fitSuitabilityCache),
    ...temperatureAssessment.warnings,
  ];
  const topProfileSource = getResolvedGarmentProfile(top).source;
  const bottomProfileSource = getResolvedGarmentProfile(bottom).source;
  const measurementSourceCount = [topProfileSource, bottomProfileSource].filter(
    (source) => source === "measurement"
  ).length;
  const hasUncertainSeasonItem = items.some(hasUncertainSeason);
  const isSeasonMatched = items.every((item) => isSeasonAllowed(item, currentSeason, warnings));

  if (measurementSourceCount === 2) {
    reasons.push("상품 실측을 기준으로 상하의 실루엣 균형을 봤어요.");
  } else if (measurementSourceCount === 1) {
    reasons.push("한 아이템은 상품 실측을 사용하고, 나머지는 보수적인 추정값으로 판단했어요.");
  } else if (
    topProfileSource === "impression" ||
    bottomProfileSource === "impression"
  ) {
    reasons.push("실측이 없어 사진상 의류 인상으로 보수적으로 판단했어요.");
  } else {
    reasons.push("실측과 사진 분석값이 없어 옷 종류와 설명만으로 보수적으로 판단했어요.");
  }

  if (!isSeasonMatched) {
    warnings.push(`${currentSeason} 기준으로 계절감이 맞지 않는 아이템이 포함되어 점수를 낮게 봤어요.`);
  } else if (hasUncertainSeasonItem) {
    reasons.push("계절 정보가 불확실한 아이템은 사계절로 단정하지 않고 중립적으로 비교했어요.");
  } else {
    reasons.push(`${currentSeason}에 입기 좋은 계절 정보의 아이템들로 구성됐어요.`);
  }

  const legacyCompatibility = evaluateLegacyFashionCompatibility({
    items,
    top,
    bottom,
    currentSeason,
    profile,
    reasons,
    warnings,
  });
  const {
    silhouette,
    wearFit,
    pointBalance,
    colorSupport,
    styleSupport,
  } = legacyCompatibility.breakdown;
  const weatherScore = weather
    ? temperatureAssessment.score
    : isSeasonMatched
      ? NEUTRAL_TEMPERATURE_COMFORT_SCORE
      : 0;
  const rotation = getRotationBreakdownScore(items, reasons);
  const detailMaterialAdjustment =
    legacyCompatibility.detailMaterialAdjustment;

  reasons.unshift(...detailMaterialAdjustment.reasons);
  warnings.unshift(...detailMaterialAdjustment.warnings);

  if (shoes) {
    reasons.push("신발까지 포함되어 코디 완성도는 높아요.");
  } else {
    warnings.push("신발이 빠져 완성 코디로 보기 어렵고 실제 착장 완성도가 낮아요.");
  }

  if (silhouette < 22 && colorSupport >= 8) {
    warnings.push("색상은 안정적이지만 실루엣 균형이 약해 강한 추천은 아니에요.");
  }

  const warningPenalty = getWarningPenalty(warnings);
  const breakdown: OutfitRecommendation["breakdown"] = {
    silhouette,
    wearFit,
    pointBalance,
    colorSupport,
    styleSupport,
    weather: weatherScore,
    rotation,
  };
  const rawScore =
    silhouette +
    wearFit +
    pointBalance +
    colorSupport +
    styleSupport +
    weatherScore +
    rotation +
    detailMaterialAdjustment.score;
  const score = applyScoreCaps(
    rawScore - warningPenalty,
    warnings,
    reasons,
    breakdown,
    measurementSourceCount
  );
  const display = getRecommendationDisplay(items, currentSeason);
  const recommendedShoes = getRecommendedShoes(items);
  const sockRecommendation = getSockRecommendation(items, recommendedShoes);

  if (score < 70 && reasons.length > 0) {
    reasons.push("전체적으로 무난할 수는 있지만 강한 추천 조합은 아니에요.");
  }
  return {
    id: items.map((item) => item.id).join("-"),
    items,
    title: display.title,
    tags: display.tags,
    recommendedShoes,
    sockRecommendation,
    score,
    grade: getGrade(score),
    penalty: warningPenalty,
    reasons,
    warnings,
    breakdown,
  };
}

function hasCategory(recommendation: OutfitRecommendation, category: string) {
  return recommendation.items.some((item) => item.category === category);
}

function applyOutfitRecommendationFeedback(
  recommendation: OutfitRecommendation,
  feedbackByKey: ReadonlyMap<string, OutfitFeedbackValue>,
  feedbackTrendByItemId: ReadonlyMap<string, number>
) {
  const feedbackPreference = feedbackByKey.get(
    getOutfitFeedbackKey(recommendation.items.map((item) => item.id))
  );
  const feedbackTrendAdjustment = Math.max(
    -6,
    Math.min(
      3,
      recommendation.items.reduce(
        (adjustment, item) => adjustment + (feedbackTrendByItemId.get(item.id) || 0),
        0
      )
    )
  );

  if (!feedbackPreference && feedbackTrendAdjustment === 0) return recommendation;

  return {
    ...recommendation,
    feedbackPreference,
    feedbackTrendAdjustment,
  };
}

function getFeedbackTrendByItemId(
  feedbacks: OutfitRecommendationFeedback[]
) {
  const feedbackCountsByItemId = new Map<
    string,
    { like: number; less: number }
  >();

  feedbacks.forEach((feedback) => {
    feedback.itemIds.forEach((itemId) => {
      const counts = feedbackCountsByItemId.get(itemId) || { like: 0, less: 0 };

      counts[feedback.value] += 1;
      feedbackCountsByItemId.set(itemId, counts);
    });
  });

  const trendByItemId = new Map<string, number>();

  feedbackCountsByItemId.forEach((counts, itemId) => {
    const evidenceCount = counts.like + counts.less;
    const preferenceGap = counts.like - counts.less;

    if (evidenceCount < 2 || Math.abs(preferenceGap) < 2) return;

    trendByItemId.set(itemId, preferenceGap > 0 ? 1 : -2);
  });

  return trendByItemId;
}

function applyRecommendationOptions(
  recommendations: OutfitRecommendation[],
  options: OutfitRecommendationOptions,
  accessories: ClosetItem[],
  currentSeason: string
) {
  const feedbackByKey = new Map<string, OutfitFeedbackValue>(
    (options.feedbacks || []).map((feedback) => [
      getOutfitFeedbackKey(feedback.itemIds),
      feedback.value,
    ])
  );
  const feedbackTrendByItemId = getFeedbackTrendByItemId(options.feedbacks || []);

  return attachBestAccessoryCandidates(
    recommendations,
    accessories,
    currentSeason,
    options.situation
  )
    .map((recommendation) =>
      applyOutfitRecommendationFeedback(
        recommendation,
        feedbackByKey,
        feedbackTrendByItemId
      )
    );
}

function compareRecommendations(
  a: OutfitRecommendation,
  b: OutfitRecommendation,
  situation?: OutfitSituation
) {
  const firstSituationAdjustment =
    situation && situation.id !== "all"
      ? Math.max(
          0,
          (getOutfitSituationScore(a.items, situation) -
            MIN_OUTFIT_SITUATION_SCORE) *
            2
        )
      : 0;
  const secondSituationAdjustment =
    situation && situation.id !== "all"
      ? Math.max(
          0,
          (getOutfitSituationScore(b.items, situation) -
            MIN_OUTFIT_SITUATION_SCORE) *
            2
        )
      : 0;
  const firstRankingScore =
    a.score +
    firstSituationAdjustment +
    getOutfitFeedbackRankingAdjustment(a.feedbackPreference) +
    (a.feedbackTrendAdjustment || 0);
  const secondRankingScore =
    b.score +
    secondSituationAdjustment +
    getOutfitFeedbackRankingAdjustment(b.feedbackPreference) +
    (b.feedbackTrendAdjustment || 0);
  const scoreDiff = secondRankingScore - firstRankingScore;
  if (scoreDiff !== 0) return scoreDiff;

  const accessoryMatchDiff =
    (accessoryMatchScoreCache.get(b) || 0) -
    (accessoryMatchScoreCache.get(a) || 0);
  if (accessoryMatchDiff !== 0) return accessoryMatchDiff;

  const shoeDiff = Number(hasCategory(b, "신발")) - Number(hasCategory(a, "신발"));
  if (shoeDiff !== 0) return shoeDiff;

  const outerDiff = Number(hasCategory(b, "아우터")) - Number(hasCategory(a, "아우터"));
  if (outerDiff !== 0) return outerDiff;

  const warningDiff = a.warnings.length - b.warnings.length;
  if (warningDiff !== 0) return warningDiff;

  return getItemCombinationKey(a).localeCompare(getItemCombinationKey(b));
}

export const MIN_ACCESSORY_MATCH_SCORE = 6;

type AccessoryMatchAssessment = {
  score: number;
  styleScore: number;
  colorScore: number;
  situationScore: number;
  pointPenalty: number;
};

const accessoryMatchScoreCache = new WeakMap<OutfitRecommendation, number>();

function getAccessoryMatchAssessment(
  accessory: ClosetItem,
  outfitItems: ClosetItem[],
  situation?: OutfitSituation
): AccessoryMatchAssessment {
  const accessoryStyles = getItemStyles(accessory);
  const outfitStyles = outfitItems.flatMap(getItemStyles);
  const hasExactStyle = accessoryStyles.some((style) => outfitStyles.includes(style));
  const styleScore = hasExactStyle
    ? 4
    : hasMatchingStyle(accessory, outfitItems)
      ? 3
      : 0;
  const outfitColors = outfitItems
    .map((item) => item.color)
    .filter((color): color is string => Boolean(color));
  const colorScore = !accessory.color
    ? 0
    : outfitColors.some((color) => colorValuesMatch(color, accessory.color))
      ? 3
      : isBasicColor(accessory.color)
        ? 2
        : 0;
  const rawSituationScore = getItemSituationScore(accessory, situation);
  const situationScore = Math.max(-2, Math.min(2, rawSituationScore));
  const outfitHasStrongPoint = outfitItems.some(
    (item) =>
      getResolvedGarmentProfile(item).pointLevel >= 7 ||
      item.graphicDetected === true ||
      isStrongColor(item.color)
  );
  const accessoryIsStrongPoint =
    getResolvedGarmentProfile(accessory).pointLevel >= 7 ||
    accessory.graphicDetected === true ||
    isStrongColor(accessory.color);
  const pointPenalty = outfitHasStrongPoint && accessoryIsStrongPoint ? 3 : 0;
  const hasRequiredInformation = accessoryStyles.length > 0 && Boolean(accessory.color);
  const rawScore = styleScore + colorScore + situationScore - pointPenalty;
  const score = hasRequiredInformation
    ? Math.max(0, Math.min(10, rawScore))
    : Math.max(0, Math.min(5, rawScore));

  return { score, styleScore, colorScore, situationScore, pointPenalty };
}

export function getAccessoryMatchScore(
  accessory: ClosetItem,
  outfitItems: ClosetItem[],
  situation?: OutfitSituation
) {
  return getAccessoryMatchAssessment(accessory, outfitItems, situation).score;
}

function getAccessoryMatchReason(assessment: AccessoryMatchAssessment) {
  if (assessment.styleScore >= 3 && assessment.colorScore >= 2) {
    return "액세서리가 코디의 스타일과 색상에 자연스럽게 이어져 포인트로 선택했어요.";
  }
  if (assessment.situationScore > 0) {
    return "선택한 상황과 코디 흐름에 어울리는 액세서리 하나만 더했어요.";
  }
  return "코디의 전체 인상을 방해하지 않는 액세서리 하나만 선택했어요.";
}

function getBestAccessoryMatch(
  accessories: ClosetItem[],
  outfitItems: ClosetItem[],
  situation?: OutfitSituation
) {
  return accessories
    .map((accessory) => ({
      accessory,
      assessment: getAccessoryMatchAssessment(accessory, outfitItems, situation),
    }))
    .filter(({ assessment }) => assessment.score >= MIN_ACCESSORY_MATCH_SCORE)
    .sort(
      (first, second) =>
        second.assessment.score - first.assessment.score ||
        second.assessment.styleScore - first.assessment.styleScore ||
        second.assessment.colorScore - first.assessment.colorScore ||
        second.assessment.situationScore - first.assessment.situationScore ||
        first.accessory.id.localeCompare(second.accessory.id)
    )[0];
}

function attachBestAccessoryCandidates(
  recommendations: OutfitRecommendation[],
  accessories: ClosetItem[],
  currentSeason: string,
  situation?: OutfitSituation
) {
  if (accessories.length === 0) return recommendations;

  return recommendations.flatMap((recommendation) => {
    const bestMatch = getBestAccessoryMatch(
      accessories,
      recommendation.items,
      situation
    );
    if (!bestMatch) return [recommendation];

    const items = [...recommendation.items, bestMatch.accessory];
    const display = getRecommendationDisplay(items, currentSeason);
    const enrichedRecommendation: OutfitRecommendation = {
      ...recommendation,
      id: items.map((item) => item.id).join("-"),
      items,
      title: display.title,
      tags: display.tags,
      reasons: [
        ...recommendation.reasons,
        getAccessoryMatchReason(bestMatch.assessment),
      ],
    };

    accessoryMatchScoreCache.set(enrichedRecommendation, bestMatch.assessment.score);

    // 저장된 액세서리 포함 조합이 제외되면 같은 핵심 코디의 기본형이 올라올 수 있게 함께 둔다.
    return [enrichedRecommendation, recommendation];
  });
}

const coreOutfitKeyCache = new WeakMap<OutfitRecommendation, string>();
const itemCombinationKeyCache = new WeakMap<OutfitRecommendation, string>();

function getCoreOutfitKey(recommendation: OutfitRecommendation) {
  const cachedKey = coreOutfitKeyCache.get(recommendation);
  if (cachedKey) return cachedKey;

  const topId = recommendation.items.find((item) => item.category === "상의")?.id || "no-top";
  const bottomId = recommendation.items.find((item) => item.category === "하의")?.id || "no-bottom";
  const shoeId = recommendation.items.find((item) => item.category === "신발")?.id || "no-shoes";
  const key = [topId, bottomId, shoeId].join("-");

  coreOutfitKeyCache.set(recommendation, key);
  return key;
}

function getItemCombinationKey(recommendation: OutfitRecommendation) {
  const cachedKey = itemCombinationKeyCache.get(recommendation);
  if (cachedKey) return cachedKey;

  const key = getSortedItemIds(recommendation.items).join("|");
  itemCombinationKeyCache.set(recommendation, key);
  return key;
}

function isDisplayableRecommendation(recommendation: OutfitRecommendation) {
  return recommendation.score >= MIN_DISPLAY_RECOMMENDATION_SCORE;
}

function filterDisplayableRecommendations(recommendations: OutfitRecommendation[]) {
  return recommendations.filter(isDisplayableRecommendation);
}

function stripAlternatives(recommendation: OutfitRecommendation): OutfitRecommendation {
  return {
    ...recommendation,
    alternativeCount: 0,
    alternatives: [],
  };
}

function getAlternativeRecommendations(
  baseRecommendation: OutfitRecommendation,
  recommendations: OutfitRecommendation[],
  reservedItemKeys = new Set<string>(),
  reservedCoreKeys = new Set<string>()
) {
  const baseCoreKey = getCoreOutfitKey(baseRecommendation);
  const baseItemKey = getItemCombinationKey(baseRecommendation);
  const usedItemKeys = new Set<string>();
  const usedCoreKeys = new Set<string>();
  const alternatives: OutfitRecommendation[] = [];

  for (const recommendation of recommendations) {
    if (!isDisplayableRecommendation(recommendation)) continue;

    const itemKey = getItemCombinationKey(recommendation);
    const coreKey = getCoreOutfitKey(recommendation);

    if (itemKey === baseItemKey) continue;
    if (coreKey === baseCoreKey) continue;
    if (reservedItemKeys.has(itemKey)) continue;
    if (reservedCoreKeys.has(coreKey)) continue;
    if (usedItemKeys.has(itemKey)) continue;
    if (usedCoreKeys.has(coreKey)) continue;

    usedItemKeys.add(itemKey);
    usedCoreKeys.add(coreKey);
    alternatives.push(stripAlternatives(recommendation));

    if (alternatives.length >= 3) break;
  }

  return alternatives;
}

function getBestRecommendationByCoreOutfit(
  sortedRecommendations: OutfitRecommendation[]
) {
  const bestRecommendationByCore = new Map<string, OutfitRecommendation>();

  sortedRecommendations.forEach((recommendation) => {
    const coreKey = getCoreOutfitKey(recommendation);
    if (!bestRecommendationByCore.has(coreKey)) {
      bestRecommendationByCore.set(coreKey, recommendation);
    }
  });

  return Array.from(bestRecommendationByCore.values()).map(stripAlternatives);
}

function attachAlternativeRecommendations(
  baseRecommendations: OutfitRecommendation[],
  allRecommendations: OutfitRecommendation[]
) {
  const reservedItemKeys = new Set(baseRecommendations.map(getItemCombinationKey));
  const reservedCoreKeys = new Set(baseRecommendations.map(getCoreOutfitKey));

  return baseRecommendations.map((baseRecommendation) => {
    const alternatives = getAlternativeRecommendations(
      baseRecommendation,
      allRecommendations,
      reservedItemKeys,
      reservedCoreKeys
    );

    alternatives.forEach((alternative) => {
      reservedItemKeys.add(getItemCombinationKey(alternative));
      reservedCoreKeys.add(getCoreOutfitKey(alternative));
    });

    return {
      ...baseRecommendation,
      alternativeCount: alternatives.length,
      alternatives,
    };
  });
}

function getCategoryItemId(
  recommendation: OutfitRecommendation,
  category: "상의" | "하의" | "신발"
) {
  return recommendation.items.find((item) => item.category === category)?.id;
}

function diversifyRecommendations(recommendations: OutfitRecommendation[], limit = 5) {
  const result: OutfitRecommendation[] = [];
  const categories = ["상의", "하의", "신발"] as const;
  const usageByCategory = new Map(
    categories.map((category) => [category, new Map<string, number>()])
  );
  const enforceDiversity = new Map(
    categories.map((category) => [
      category,
      new Set(
        recommendations
          .map((recommendation) => getCategoryItemId(recommendation, category))
          .filter((itemId): itemId is string => Boolean(itemId))
      ).size > 1,
    ])
  );

  for (const recommendation of recommendations) {
    const exceedsUsageLimit = categories.some((category) => {
      if (!enforceDiversity.get(category)) return false;
      const itemId = getCategoryItemId(recommendation, category);
      if (!itemId) return false;
      return (usageByCategory.get(category)?.get(itemId) || 0) >= 2;
    });
    if (exceedsUsageLimit) continue;

    result.push(recommendation);
    categories.forEach((category) => {
      const itemId = getCategoryItemId(recommendation, category);
      if (!itemId) return;
      const usage = usageByCategory.get(category)!;
      usage.set(itemId, (usage.get(itemId) || 0) + 1);
    });

    if (result.length >= limit) return result;
  }

  return result;
}

function getSortedItemIds(items: ClosetItem[]) {
  return items.map((item) => item.id).sort();
}

function excludeSavedCombinations(recommendations: OutfitRecommendation[], savedOutfitItemIds: string[][]) {
  if (savedOutfitItemIds.length === 0) return recommendations;

  const savedCombinationKeys = new Set(
    savedOutfitItemIds.map((itemIds) => [...itemIds].sort().join("|"))
  );

  return recommendations.filter(
    (recommendation) => !savedCombinationKeys.has(getItemCombinationKey(recommendation))
  );
}

function getMissingCoreCategories(items: ClosetItem[]) {
  const missingCategories: string[] = [];

  if (byCategory(items, "상의").length === 0) missingCategories.push("상의");
  if (byCategory(items, "하의").length === 0) missingCategories.push("하의");

  return missingCategories;
}

function getEmptyReason({
  items,
  recommendationCandidates,
  displayableRecommendations,
  situationDisplayableRecommendations,
  recommendations,
  savedOutfitItemIds,
  situation,
}: {
  items: ClosetItem[];
  recommendationCandidates: OutfitRecommendation[];
  displayableRecommendations: OutfitRecommendation[];
  situationDisplayableRecommendations: OutfitRecommendation[];
  recommendations: OutfitRecommendation[];
  savedOutfitItemIds: string[][];
  situation?: OutfitSituation;
}): OutfitRecommendationEmptyReason | undefined {
  if (recommendations.length > 0) return undefined;

  const missingCategories = getMissingCoreCategories(items);
  if (missingCategories.length > 0) return "missing_core_category";
  if (
    situation &&
    situation.id !== "all" &&
    displayableRecommendations.length > 0 &&
    situationDisplayableRecommendations.length === 0
  ) {
    return "no_situation_match";
  }
  if (situationDisplayableRecommendations.length > 0 && savedOutfitItemIds.length > 0) {
    return "saved_combinations_exhausted";
  }
  if (recommendationCandidates.length > 0) return "below_quality_threshold";

  return "below_quality_threshold";
}

function getOutfitColorsWithoutShoes(outfitItems: ClosetItem[]) {
  return uniqueValues(
    outfitItems
      .filter((item) => item.category !== "신발")
      .map((item) => item.color)
  );
}

function getShoeRecommendationScore(
  shoe: ClosetItem,
  outfitItems: ClosetItem[],
  currentSeason: string,
  isCurrent: boolean
): ShoeRecommendation | null {
  if (!isCurrent && !isSeasonCandidate(shoe, currentSeason)) return null;

  const baseItems = outfitItems.filter((item) => !["신발"].includes(item.category));
  const outfitColors = getOutfitColorsWithoutShoes(outfitItems);
  const shoeColor = shoe.color;
  const reasons: string[] = [];
  let score = isCurrent ? 2 : 0;

  if (hasMatchingStyle(shoe, baseItems)) {
    score += 5;
    reasons.push("코디 스타일 흐름과 잘 맞아요.");
  } else if (getItemStyles(shoe).length > 0) {
    score += 2;
    reasons.push("스타일 정보는 있지만 코디와 완전히 같은 계열은 아니에요.");
  }

  if (isBasicColor(shoeColor)) {
    score += 4;
    reasons.push("기본색이라 코디에 안정적으로 붙어요.");
  } else if (shoeColor && outfitColors.includes(shoeColor)) {
    score += 3;
    reasons.push("코디 안의 색상과 연결감이 있어요.");
  } else if (shoeColor) {
    score += 1;
    reasons.push("색상이 포인트가 될 수 있어요.");
  }

  if (!shoeColor) {
    reasons.push("색상 정보가 부족해 실제 조화는 확인이 필요해요.");
  }

  return {
    shoe,
    score,
    reason: reasons[0] || "무난하게 함께 신어볼 수 있어요.",
    isCurrent,
  };
}

export function getShoeRecommendationsForOutfit(
  outfitItems: ClosetItem[],
  allClosetItems: ClosetItem[],
  currentSeason = getCurrentSeason()
) {
  const currentShoeIds = new Set(
    outfitItems
      .filter((item) => item.category === "신발")
      .map((item) => item.id)
  );
  const shoes = byCategory(allClosetItems, "신발");
  const availableShoes = shoes.filter(
    (shoe) =>
      currentShoeIds.has(shoe.id) || isClosetItemAvailableForRecommendation(shoe)
  );
  const currentShoes = availableShoes
    .filter((shoe) => currentShoeIds.has(shoe.id))
    .map((shoe) => getShoeRecommendationScore(shoe, outfitItems, currentSeason, true))
    .filter((recommendation): recommendation is ShoeRecommendation => Boolean(recommendation));
  const recommendations = availableShoes
    .filter((shoe) => !currentShoeIds.has(shoe.id))
    .map((shoe) => getShoeRecommendationScore(shoe, outfitItems, currentSeason, false))
    .filter((recommendation): recommendation is ShoeRecommendation => Boolean(recommendation))
    .sort((first, second) => second.score - first.score)
    .slice(0, 3);

  return {
    currentShoes,
    recommendations,
  };
}

function buildRecommendationCandidates(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  options: OutfitRecommendationOptions & { strictSeasonFilter?: boolean } = {}
) {
  const filteringStartedAt = Date.now();
  const strictSeasonFilter = options.strictSeasonFilter ?? true;
  const availableItems = items.filter(isClosetItemAvailableForRecommendation);
  const seasonItems = getSeasonMatchedItems(
    availableItems,
    currentSeason,
    options.weather,
    strictSeasonFilter
  );
  options.onDiagnostics?.({
    stage: "filtering",
    durationMs: Date.now() - filteringStartedAt,
    inputItemCount: items.length,
    candidateCount: seasonItems.length,
  });

  const groupingStartedAt = Date.now();
  const allTops = sortBySeasonPriority(byCategory(seasonItems, "상의"), currentSeason);
  const allBottoms = sortBySeasonPriority(byCategory(seasonItems, "하의"), currentSeason);
  const allShoes = sortBySeasonPriority(byCategory(seasonItems, "신발"), currentSeason);
  const allOuters = sortBySeasonPriority(byCategory(seasonItems, "아우터"), currentSeason);
  options.onDiagnostics?.({
    stage: "category-grouping",
    durationMs: Date.now() - groupingStartedAt,
    inputItemCount: seasonItems.length,
    candidateCount:
      allTops.length +
      allBottoms.length +
      allShoes.length +
      allOuters.length,
  });

  const selectionStartedAt = Date.now();
  const shouldLimitCandidatePools =
    estimateOutfitCombinationCount({
      topCount: allTops.length,
      bottomCount: allBottoms.length,
      shoeCount: allShoes.length,
      outerCount: allOuters.length,
      accessoryCount: 0,
    }) > MAX_OUTFIT_COMBINATION_BUDGET;
  const tops = shouldLimitCandidatePools
    ? limitOutfitCandidatePool(allTops, LARGE_WARDROBE_CANDIDATE_LIMITS.tops)
    : allTops;
  const bottoms = shouldLimitCandidatePools
    ? limitOutfitCandidatePool(allBottoms, LARGE_WARDROBE_CANDIDATE_LIMITS.bottoms)
    : allBottoms;
  const shoes = shouldLimitCandidatePools
    ? limitOutfitCandidatePool(allShoes, LARGE_WARDROBE_CANDIDATE_LIMITS.shoes)
    : allShoes;
  const outers = shouldLimitCandidatePools
    ? limitOutfitCandidatePool(allOuters, LARGE_WARDROBE_CANDIDATE_LIMITS.outers)
    : allOuters;
  const estimatedCombinationCount = estimateOutfitCombinationCount({
    topCount: tops.length,
    bottomCount: bottoms.length,
    shoeCount: shoes.length,
    outerCount: outers.length,
    accessoryCount: 0,
  });
  options.onDiagnostics?.({
    stage: "candidate-selection",
    durationMs: Date.now() - selectionStartedAt,
    inputItemCount: seasonItems.length,
    candidateCount:
      tops.length + bottoms.length + shoes.length + outers.length,
    generatedCombinationCount: estimatedCombinationCount,
  });
  const recommendations: OutfitRecommendation[] = [];
  const fitSuitabilityCache = new Map<string, ReturnType<typeof getFitSuitability>>();
  const shoeOptions = shoes.length > 0 ? [null, ...shoes] : [null];
  const outerOptions = outers.length > 0 ? [null, ...outers] : [null];
  const combinationStartedAt = Date.now();
  const generatedCombinationCount =
    tops.length *
    bottoms.length *
    shoeOptions.length *
    outerOptions.length;
  options.onDiagnostics?.({
    stage: "combination-generation",
    durationMs: Date.now() - combinationStartedAt,
    candidateCount: tops.length + bottoms.length + shoes.length + outers.length,
    generatedCombinationCount,
  });
  const scoringStartedAt = Date.now();
  let scoredCombinationCount = 0;

  for (const top of tops) {
    for (const bottom of bottoms) {
      const baseItems = [top, bottom];

      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          const outfitItems = [
            ...baseItems,
            ...(shoe ? [shoe] : []),
            ...(outer ? [outer] : []),
          ];
          const recommendation = buildRecommendation(
            outfitItems,
            currentSeason,
            profile,
            fitSuitabilityCache,
            options.weather
          );
          scoredCombinationCount += 1;

          if (recommendation) {
            if (strictSeasonFilter) {
              recommendation.reasons.unshift(
                options.weather
                  ? "현재 날씨와 계절에 맞는 옷만 우선 추천했어요."
                  : "현재 계절에 맞는 옷만 우선 추천했어요."
              );
              recommendation.reasons.push("계절이 맞지 않는 아이템은 추천 후보에서 제외했어요.");
            } else {
              recommendation.warnings.unshift(
                "계절에 맞는 조합이 부족해서 일부 계절감이 애매한 아이템까지 함께 비교했어요."
              );
            }

            recommendations.push(recommendation);
          }
        }
      }
    }
  }

  options.onDiagnostics?.({
    stage: "scoring",
    durationMs: Date.now() - scoringStartedAt,
    generatedCombinationCount,
    scoredCombinationCount,
    returnedRecommendationCount: recommendations.length,
  });

  return recommendations;
}

function selectRecommendations(
  recommendations: OutfitRecommendation[],
  savedOutfitItemIds: string[][] = [],
  preferredItemIds: string[] = [],
  onDiagnostics?: OutfitRecommendationOptions["onDiagnostics"],
  situation?: OutfitSituation
) {
  const savedComparisonStartedAt = Date.now();
  const situationRecommendations = filterDisplayableRecommendations(recommendations)
    .filter((recommendation) => isOutfitSituationMatch(recommendation, situation))
    .map((recommendation) => {
      if (!situation || situation.id === "all" || !situation.reason) {
        return recommendation;
      }

      const adjustedRecommendation: OutfitRecommendation = {
        ...recommendation,
        reasons: recommendation.reasons.includes(situation.reason)
          ? recommendation.reasons
          : [situation.reason, ...recommendation.reasons],
        tags: Array.from(new Set([situation.label, ...recommendation.tags])).slice(0, 3),
      };
      const accessoryMatchScore = accessoryMatchScoreCache.get(recommendation);
      if (accessoryMatchScore !== undefined) {
        accessoryMatchScoreCache.set(adjustedRecommendation, accessoryMatchScore);
      }

      return adjustedRecommendation;
    });
  const displayableRecommendations = excludeSavedCombinations(
    situationRecommendations,
    savedOutfitItemIds
  );
  onDiagnostics?.({
    stage: "saved-comparison",
    durationMs: Date.now() - savedComparisonStartedAt,
    candidateCount: recommendations.length,
    returnedRecommendationCount: displayableRecommendations.length,
  });

  const deduplicationStartedAt = Date.now();
  const sortedDisplayableRecommendations = [...displayableRecommendations].sort(
    (first, second) => compareRecommendations(first, second, situation)
  );
  const sortedRecommendations = getBestRecommendationByCoreOutfit(
    sortedDisplayableRecommendations
  );
  onDiagnostics?.({
    stage: "deduplication",
    durationMs: Date.now() - deduplicationStartedAt,
    candidateCount: displayableRecommendations.length,
    removedDuplicateCount:
      displayableRecommendations.length - sortedRecommendations.length,
    returnedRecommendationCount: sortedRecommendations.length,
  });

  const sortingStartedAt = Date.now();
  const preferredItemKey = [...preferredItemIds].sort().join("|");
  const preferredRecommendation = preferredItemKey
    ? displayableRecommendations.find(
        (recommendation) => getItemCombinationKey(recommendation) === preferredItemKey
      )
    : undefined;
  const recommendationsForDiversity = preferredRecommendation
    ? [
        stripAlternatives(preferredRecommendation),
        ...sortedRecommendations.filter(
          (recommendation) =>
            getCoreOutfitKey(recommendation) !== getCoreOutfitKey(preferredRecommendation)
        ),
      ]
    : sortedRecommendations;
  const diversifiedRecommendations = diversifyRecommendations(
    recommendationsForDiversity,
    5
  );
  onDiagnostics?.({
    stage: "final-sorting",
    durationMs: Date.now() - sortingStartedAt,
    candidateCount: sortedRecommendations.length,
    returnedRecommendationCount: diversifiedRecommendations.length,
  });

  const alternativesStartedAt = Date.now();
  const result = attachAlternativeRecommendations(
    diversifiedRecommendations,
    sortedDisplayableRecommendations
  );
  onDiagnostics?.({
    stage: "alternatives",
    durationMs: Date.now() - alternativesStartedAt,
    candidateCount: displayableRecommendations.length,
    returnedRecommendationCount: result.reduce(
      (count, recommendation) => count + (recommendation.alternatives?.length || 0),
      0
    ),
  });

  return result;
}

function buildRecommendationCandidatesWithFallback(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  options: OutfitRecommendationOptions = {}
) {
  const filteredCandidates = buildRecommendationCandidates(items, profile, currentSeason, {
    ...options,
    strictSeasonFilter: true,
  });

  if (filteredCandidates.length > 0) return filteredCandidates;
  if (options.allowSeasonFallback !== true) return [];

  return buildRecommendationCandidates(items, profile, currentSeason, {
    ...options,
    strictSeasonFilter: false,
  });
}

function getAccessoryCandidatesForRecommendation(
  items: ClosetItem[],
  currentSeason: string,
  weather?: OutfitRecommendationWeather | null
) {
  const accessories = items
    .filter(isClosetItemAvailableForRecommendation)
    .filter((item) => item.category === "액세서리");

  // 액세서리는 선택 요소이므로 계절 fallback으로 억지로 붙이지 않는다.
  return getSeasonMatchedItems(accessories, currentSeason, weather, true);
}

export function getOutfitRecommendations(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  savedOutfitItemIds: string[][] = [],
  options: OutfitRecommendationOptions = {}
): OutfitRecommendation[] {
  const availableItems = items.filter(isClosetItemAvailableForRecommendation);
  const accessories = getAccessoryCandidatesForRecommendation(
    availableItems,
    currentSeason,
    options.weather
  );

  return selectRecommendations(
    applyRecommendationOptions(
      buildRecommendationCandidatesWithFallback(
        availableItems,
        profile,
        currentSeason,
        options
      ),
      options,
      accessories,
      currentSeason
    ),
    savedOutfitItemIds,
    options.preferredItemIds,
    options.onDiagnostics,
    options.situation
  );
}

export function getOutfitRecommendationResult(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  savedOutfitItemIds: string[][] = [],
  options: OutfitRecommendationOptions = {}
): OutfitRecommendationResult {
  const availableItems = items.filter(isClosetItemAvailableForRecommendation);
  const rawRecommendationCandidates = buildRecommendationCandidatesWithFallback(
    availableItems,
    profile,
    currentSeason,
    options
  );
  const accessories = getAccessoryCandidatesForRecommendation(
    availableItems,
    currentSeason,
    options.weather
  );
  const adjustmentStartedAt = Date.now();
  const recommendationCandidates = applyRecommendationOptions(
    rawRecommendationCandidates,
    options,
    accessories,
    currentSeason
  );
  options.onDiagnostics?.({
    stage: "weather-feedback",
    durationMs: Date.now() - adjustmentStartedAt,
    candidateCount: recommendationCandidates.length,
  });
  const recommendations = selectRecommendations(
    recommendationCandidates,
    savedOutfitItemIds,
    options.preferredItemIds,
    options.onDiagnostics,
    options.situation
  );
  const displayableRecommendations = filterDisplayableRecommendations(recommendationCandidates);
  const situationDisplayableRecommendations = displayableRecommendations.filter(
    (recommendation) => isOutfitSituationMatch(recommendation, options.situation)
  );
  const missingCategories = getMissingCoreCategories(availableItems);

  return {
    recommendations,
    hasAnyRecommendation: situationDisplayableRecommendations.length > 0,
    emptyReason: getEmptyReason({
      items: availableItems,
      recommendationCandidates,
      displayableRecommendations,
      recommendations,
      savedOutfitItemIds,
      situation: options.situation,
      situationDisplayableRecommendations,
    }),
    missingCategories: missingCategories.length > 0 ? missingCategories : undefined,
  };
}
