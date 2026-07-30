import { getClosetItemReviewFields } from "@/utils/closetRegistration";
import { getCanonicalClosetItemSeasons } from "@/utils/closetSeason";
import type { OutfitRecommendationWeather } from "@/utils/outfitRecommend";
import {
  isClosetItemAvailableForRecommendation,
  type ClosetItem,
} from "@/utils/storage";

export const OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS = {
  tops: 3,
  bottoms: 3,
  coreCombinations: 6,
  recommendedShoes: 2,
  recommendedOuters: 1,
} as const;

export type OutfitRecommendationReadinessReason =
  | "ready"
  | "not_enough_tops"
  | "not_enough_bottoms"
  | "not_enough_core_combinations"
  | "not_enough_season_items"
  | "not_enough_weather_items";

export type OutfitRecommendationReadinessCounts = {
  tops: number;
  bottoms: number;
  shoes: number;
  outers: number;
  coreCombinations: number;
};

export type OutfitRecommendationReadiness = {
  ready: boolean;
  reason: OutfitRecommendationReadinessReason;
  counts: OutfitRecommendationReadinessCounts;
  seasonCounts: OutfitRecommendationReadinessCounts;
  currentConditionCounts: OutfitRecommendationReadinessCounts;
  requirements: typeof OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  missing: {
    tops: number;
    bottoms: number;
    coreCombinations: number;
  };
  seasonMissing: {
    tops: number;
    bottoms: number;
    coreCombinations: number;
  };
  currentConditionMissing: {
    tops: number;
    bottoms: number;
    coreCombinations: number;
  };
  diagnostics: {
    currentSeason: string;
    temperature?: number;
    excluded: {
      archived: number;
      reviewRequired: number;
      invalidCategory: number;
      seasonMismatch: number;
      temperatureRange: number;
      strongWeatherKeyword: number;
    };
  };
};

export type OutfitRecommendationReadinessContent = {
  title: string;
  text: string;
  primaryActionLabel: string;
};

const HEAVY_WARM_WEATHER_KEYWORDS = [
  "패딩",
  "다운",
  "플리스",
  "후리스",
  "무스탕",
  "퍼 코트",
  "울 코트",
];
const LIGHT_COLD_WEATHER_KEYWORDS = [
  "민소매",
  "슬리브리스",
  "나시",
  "반팔",
  "린넨",
  "리넨",
];

function getItemSearchText(item: ClosetItem) {
  return [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.material,
    item.description,
    item.confirmedProduct?.productName,
    item.confirmedProduct?.materialComposition?.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isSeasonMatch(item: ClosetItem, currentSeason?: string) {
  if (!currentSeason) return true;
  const seasons = getCanonicalClosetItemSeasons(item);
  return (
    seasons.includes(currentSeason) ||
    seasons.includes("사계절")
  );
}

type WeatherMismatchReason =
  | "temperatureRange"
  | "strongWeatherKeyword";

function getWeatherMismatchReason(
  item: ClosetItem,
  weather?: OutfitRecommendationWeather | null
): WeatherMismatchReason | null {
  const temperature = weather?.temperature;
  if (typeof temperature !== "number") return null;

  const range = item.styleProfile?.temperatureRange;
  if (typeof range?.min === "number" && temperature < range.min) {
    return "temperatureRange";
  }
  if (typeof range?.max === "number" && temperature > range.max) {
    return "temperatureRange";
  }

  const searchText = getItemSearchText(item);
  if (
    temperature >= 24 &&
    HEAVY_WARM_WEATHER_KEYWORDS.some((keyword) => searchText.includes(keyword))
  ) {
    return "strongWeatherKeyword";
  }
  if (
    temperature <= 10 &&
    LIGHT_COLD_WEATHER_KEYWORDS.some((keyword) => searchText.includes(keyword))
  ) {
    return "strongWeatherKeyword";
  }

  return null;
}

const READINESS_CATEGORIES = new Set([
  "상의",
  "하의",
  "신발",
  "아우터",
  "액세서리",
]);

function hasEnoughCoreItems(counts: OutfitRecommendationReadinessCounts) {
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  return (
    counts.tops >= requirements.tops &&
    counts.bottoms >= requirements.bottoms &&
    counts.coreCombinations >= requirements.coreCombinations
  );
}

function getCounts(items: ClosetItem[]): OutfitRecommendationReadinessCounts {
  const tops = items.filter((item) => item.category === "상의").length;
  const bottoms = items.filter((item) => item.category === "하의").length;

  return {
    tops,
    bottoms,
    shoes: items.filter((item) => item.category === "신발").length,
    outers: items.filter((item) => item.category === "아우터").length,
    coreCombinations: tops * bottoms,
  };
}

function getMissing(counts: OutfitRecommendationReadinessCounts) {
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  return {
    tops: Math.max(requirements.tops - counts.tops, 0),
    bottoms: Math.max(requirements.bottoms - counts.bottoms, 0),
    coreCombinations: Math.max(
      requirements.coreCombinations - counts.coreCombinations,
      0
    ),
  };
}

export function getCurrentSeasonForReadiness(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울";
}

function getMissingItemSummary(
  missing: OutfitRecommendationReadiness["missing"]
) {
  const parts = [
    missing.tops > 0 ? `상의 ${missing.tops}벌` : "",
    missing.bottoms > 0 ? `하의 ${missing.bottoms}벌` : "",
  ].filter(Boolean);

  if (parts.length > 0) return `${parts.join(", ")}을 더 추가해주세요.`;
  if (missing.coreCombinations > 0) {
    return "서로 다른 상의와 하의를 조금 더 추가해주세요.";
  }
  return "";
}

function getReadinessCountSummary(
  counts: OutfitRecommendationReadinessCounts
) {
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  return [
    `상의 ${counts.tops}/${requirements.tops}`,
    `하의 ${counts.bottoms}/${requirements.bottoms}`,
    `핵심 조합 ${counts.coreCombinations}/${requirements.coreCombinations}`,
  ].join(" · ");
}

export function getOutfitRecommendationReadinessContent(
  readiness: OutfitRecommendationReadiness
): OutfitRecommendationReadinessContent {
  if (readiness.ready) {
    return {
      title: "추천 준비가 끝났어요",
      text: "현재 옷장으로 서로 다른 코디를 추천할 수 있어요.",
      primaryActionLabel: "오늘의 코디 보기",
    };
  }

  if (readiness.reason === "not_enough_season_items") {
    return {
      title: "지금 계절에 맞는 옷이 조금 부족해요",
      text: `현재 조건 ${getReadinessCountSummary(
        readiness.seasonCounts
      )}. ${getMissingItemSummary(readiness.seasonMissing)}`.trim(),
      primaryActionLabel: "계절 옷 추가하기",
    };
  }

  if (readiness.reason === "not_enough_weather_items") {
    return {
      title: "현재 기온에 맞는 옷이 조금 부족해요",
      text: `현재 날씨 기준 ${getReadinessCountSummary(
        readiness.currentConditionCounts
      )}. ${getMissingItemSummary(readiness.currentConditionMissing)}`.trim(),
      primaryActionLabel: "날씨에 맞는 옷 추가하기",
    };
  }

  return {
    title: "추천 준비까지 조금 남았어요",
    text: `${getReadinessCountSummary(readiness.counts)}. ${getMissingItemSummary(
      readiness.missing
    )}`.trim(),
    primaryActionLabel: "필요한 옷 추가하기",
  };
}

export function getOutfitRecommendationReadiness(
  items: ClosetItem[],
  currentSeason = getCurrentSeasonForReadiness(),
  weather?: OutfitRecommendationWeather | null
): OutfitRecommendationReadiness {
  const diagnostics: OutfitRecommendationReadiness["diagnostics"] = {
    currentSeason,
    temperature: weather?.temperature,
    excluded: {
      archived: 0,
      reviewRequired: 0,
      invalidCategory: 0,
      seasonMismatch: 0,
      temperatureRange: 0,
      strongWeatherKeyword: 0,
    },
  };
  const availableItems = items.filter((item) => {
    if (!isClosetItemAvailableForRecommendation(item)) {
      diagnostics.excluded.archived += 1;
      return false;
    }
    if (getClosetItemReviewFields(item).length > 0) {
      diagnostics.excluded.reviewRequired += 1;
      return false;
    }
    if (!READINESS_CATEGORIES.has(item.category)) {
      diagnostics.excluded.invalidCategory += 1;
      return false;
    }
    return true;
  });
  const seasonItems = availableItems.filter((item) => {
    const matches = isSeasonMatch(item, currentSeason);
    if (!matches) diagnostics.excluded.seasonMismatch += 1;
    return matches;
  });
  const currentConditionItems = seasonItems.filter((item) => {
    const mismatchReason = getWeatherMismatchReason(item, weather);
    if (mismatchReason) diagnostics.excluded[mismatchReason] += 1;
    return mismatchReason === null;
  });
  const counts = getCounts(availableItems);
  const seasonCounts = getCounts(seasonItems);
  const currentConditionCounts = getCounts(currentConditionItems);
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;

  let reason: OutfitRecommendationReadinessReason = "ready";
  if (counts.tops < requirements.tops) {
    reason = "not_enough_tops";
  } else if (counts.bottoms < requirements.bottoms) {
    reason = "not_enough_bottoms";
  } else if (counts.coreCombinations < requirements.coreCombinations) {
    reason = "not_enough_core_combinations";
  } else if (!hasEnoughCoreItems(seasonCounts)) {
    reason = "not_enough_season_items";
  } else if (!hasEnoughCoreItems(currentConditionCounts)) {
    reason = "not_enough_weather_items";
  }

  return {
    ready: reason === "ready",
    reason,
    counts,
    seasonCounts,
    currentConditionCounts,
    requirements,
    missing: getMissing(counts),
    seasonMissing: getMissing(seasonCounts),
    currentConditionMissing: getMissing(currentConditionCounts),
    diagnostics,
  };
}
