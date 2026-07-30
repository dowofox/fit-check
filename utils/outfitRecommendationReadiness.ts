import { getClosetItemReviewFields } from "@/utils/closetRegistration";
import { getCanonicalClosetItemSeasons } from "@/utils/closetSeason";
import type { OutfitRecommendationWeather } from "@/utils/outfitRecommend";
import {
  assessItemTemperatureSuitability,
  assessOutfitTemperatureSuitability,
  getEffectiveOutfitTemperature,
  MIN_SAFE_TEMPERATURE_COMFORT_SCORE,
} from "@/utils/outfitTemperatureSuitability";
import {
  isClosetItemAvailableForRecommendation,
  type ClosetItem,
} from "@/utils/storage";

export const OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS = {
  tops: 3,
  bottoms: 3,
  coreCombinations: 6,
  weatherCoreCategoryMinimum: 2,
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
    temperatureRangeSoftened: number;
  };
};

export type OutfitRecommendationReadinessContent = {
  title: string;
  text: string;
  primaryActionLabel: string;
};

function isSeasonMatch(item: ClosetItem, currentSeason?: string) {
  if (!currentSeason) return true;
  const seasons = getCanonicalClosetItemSeasons(item);
  return (
    seasons.includes(currentSeason) ||
    seasons.includes("사계절")
  );
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

function hasEnoughWeatherCoreItems(
  counts: OutfitRecommendationReadinessCounts
) {
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  return (
    counts.tops >= requirements.weatherCoreCategoryMinimum &&
    counts.bottoms >= requirements.weatherCoreCategoryMinimum &&
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

function getCurrentConditionCounts(
  items: ClosetItem[],
  weather?: OutfitRecommendationWeather | null
): OutfitRecommendationReadinessCounts {
  if (typeof getEffectiveOutfitTemperature(weather) !== "number") {
    return getCounts(items);
  }

  const tops = items.filter((item) => item.category === "상의");
  const bottoms = items.filter((item) => item.category === "하의");
  const shoes = items.filter((item) => item.category === "신발");
  const outers = items.filter((item) => item.category === "아우터");
  const safeTopIds = new Set<string>();
  const safeBottomIds = new Set<string>();
  let coreCombinations = 0;

  tops.forEach((top) => {
    bottoms.forEach((bottom) => {
      const hasSafeCombination = [undefined, ...outers].some((outer) => {
        const assessment = assessOutfitTemperatureSuitability(
          [top, bottom, ...(outer ? [outer] : [])],
          weather
        );
        return (
          !assessment.hardBlocked &&
          assessment.score >= MIN_SAFE_TEMPERATURE_COMFORT_SCORE
        );
      });

      if (!hasSafeCombination) return;
      safeTopIds.add(top.id);
      safeBottomIds.add(bottom.id);
      coreCombinations += 1;
    });
  });

  return {
    tops: safeTopIds.size,
    bottoms: safeBottomIds.size,
    shoes: shoes.filter(
      (item) => !assessItemTemperatureSuitability(item, weather).hardBlocked
    ).length,
    outers: outers.filter(
      (item) => !assessItemTemperatureSuitability(item, weather).hardBlocked
    ).length,
    coreCombinations,
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

function getWeatherMissing(counts: OutfitRecommendationReadinessCounts) {
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  return {
    tops: Math.max(requirements.weatherCoreCategoryMinimum - counts.tops, 0),
    bottoms: Math.max(
      requirements.weatherCoreCategoryMinimum - counts.bottoms,
      0
    ),
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
  counts: OutfitRecommendationReadinessCounts,
  coreCategoryMinimum: number =
    OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS.tops
) {
  const requirements = OUTFIT_RECOMMENDATION_READINESS_REQUIREMENTS;
  return [
    `상의 ${counts.tops}/${coreCategoryMinimum}`,
    `하의 ${counts.bottoms}/${coreCategoryMinimum}`,
    `핵심 조합 ${counts.coreCombinations}/${requirements.coreCombinations}`,
  ].join(" · ");
}

function getWeatherReadinessSummary(
  readiness: OutfitRecommendationReadiness
) {
  if (readiness.diagnostics.excluded.strongWeatherKeyword > 0) {
    return "현재 체감온도에 너무 덥거나 추운 옷은 제외했어요.";
  }
  return "현재 체감온도에서 편안하게 입을 수 있는 조합을 기준으로 확인했어요.";
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
        readiness.currentConditionCounts,
        readiness.requirements.weatherCoreCategoryMinimum
      )}. ${getWeatherReadinessSummary(readiness)} ${getMissingItemSummary(
        readiness.currentConditionMissing
      )}`.trim(),
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
    temperatureRangeSoftened: 0,
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
    const suitability = assessItemTemperatureSuitability(item, weather);
    const itemAssessment = suitability.itemAssessments[0];
    if (itemAssessment?.temperatureRangeSoftened) {
      diagnostics.temperatureRangeSoftened += 1;
    }
    if (suitability.hardBlocked) {
      diagnostics.excluded.strongWeatherKeyword += 1;
    }
    return !suitability.hardBlocked;
  });
  const counts = getCounts(availableItems);
  const seasonCounts = getCounts(seasonItems);
  const currentConditionCounts = getCurrentConditionCounts(
    currentConditionItems,
    weather
  );
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
  } else if (!hasEnoughWeatherCoreItems(currentConditionCounts)) {
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
    currentConditionMissing: getWeatherMissing(currentConditionCounts),
    diagnostics,
  };
}
