import { getClosetItemReviewFields } from "@/utils/closetRegistration";
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
  | "not_enough_season_items";

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
  currentConditionCounts: OutfitRecommendationReadinessCounts;
  requirements: typeof OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  missing: {
    tops: number;
    bottoms: number;
    coreCombinations: number;
  };
  currentConditionMissing: {
    tops: number;
    bottoms: number;
    coreCombinations: number;
  };
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

function getItemSeasons(item: ClosetItem) {
  if (item.seasons?.length) return item.seasons;
  if (!item.season) return [];

  return ["봄", "여름", "가을", "겨울", "사계절", "전체"].filter(
    (season) => item.season?.includes(season)
  );
}

function isSeasonMatch(item: ClosetItem, currentSeason?: string) {
  if (!currentSeason) return true;
  const seasons = getItemSeasons(item);
  return (
    seasons.includes(currentSeason) ||
    seasons.includes("사계절") ||
    seasons.includes("전체")
  );
}

function isWeatherMatch(
  item: ClosetItem,
  weather?: OutfitRecommendationWeather | null
) {
  const temperature = weather?.temperature;
  if (typeof temperature !== "number") return true;

  const range = item.styleProfile?.temperatureRange;
  if (typeof range?.min === "number" && temperature < range.min) return false;
  if (typeof range?.max === "number" && temperature > range.max) return false;

  const searchText = getItemSearchText(item);
  if (
    temperature >= 24 &&
    HEAVY_WARM_WEATHER_KEYWORDS.some((keyword) => searchText.includes(keyword))
  ) {
    return false;
  }
  if (
    temperature <= 10 &&
    LIGHT_COLD_WEATHER_KEYWORDS.some((keyword) => searchText.includes(keyword))
  ) {
    return false;
  }

  return true;
}

function isReadinessCandidate(item: ClosetItem) {
  return (
    isClosetItemAvailableForRecommendation(item) &&
    getClosetItemReviewFields(item).length === 0
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

export function getOutfitRecommendationReadiness(
  items: ClosetItem[],
  currentSeason?: string,
  weather?: OutfitRecommendationWeather | null
): OutfitRecommendationReadiness {
  const availableItems = items.filter(isReadinessCandidate);
  const currentConditionItems = availableItems.filter(
    (item) =>
      isSeasonMatch(item, currentSeason) && isWeatherMatch(item, weather)
  );
  const counts = getCounts(availableItems);
  const currentConditionCounts = getCounts(currentConditionItems);
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;

  let reason: OutfitRecommendationReadinessReason = "ready";
  if (counts.tops < requirements.tops) {
    reason = "not_enough_tops";
  } else if (counts.bottoms < requirements.bottoms) {
    reason = "not_enough_bottoms";
  } else if (counts.coreCombinations < requirements.coreCombinations) {
    reason = "not_enough_core_combinations";
  } else if (
    currentConditionCounts.tops < requirements.tops ||
    currentConditionCounts.bottoms < requirements.bottoms ||
    currentConditionCounts.coreCombinations <
      requirements.coreCombinations
  ) {
    reason = "not_enough_season_items";
  }

  return {
    ready: reason === "ready",
    reason,
    counts,
    currentConditionCounts,
    requirements,
    missing: getMissing(counts),
    currentConditionMissing: getMissing(currentConditionCounts),
  };
}
