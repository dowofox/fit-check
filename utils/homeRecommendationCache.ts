import AsyncStorage from "@react-native-async-storage/async-storage";

import { isHomeRecommendationCacheKeyForRevision } from "@/utils/homeRecommendationIndex";
import type {
  OutfitRecommendation,
  OutfitRecommendationEmptyReason,
  OutfitRecommendationWeather,
} from "@/utils/outfitRecommend";
import type { ClosetItem } from "@/utils/storage";

export const HOME_RECOMMENDATION_CACHE_STORAGE_KEY =
  "naes_home_recommendation_cache";
export const HOME_RECOMMENDATION_CACHE_VERSION = 1;

export type HomeRecommendationEmptyState = {
  emptyReason?: OutfitRecommendationEmptyReason;
  missingCategories?: string[];
};

export type HomeRecommendationCardData = Pick<
  OutfitRecommendation,
  "id" | "title" | "tags" | "reasons"
> & {
  items: ClosetItem[];
};

export type PersistedHomeRecommendationCacheEntry = {
  key: string;
  recommendations: {
    id: string;
    itemIds: string[];
    title: string;
    tags: string[];
    reasons: string[];
  }[];
  emptyState: HomeRecommendationEmptyState;
  weatherLabel: string | null;
  weather: OutfitRecommendationWeather | null;
};

export type HomeRecommendationCacheSnapshot = {
  version: number;
  initial?: PersistedHomeRecommendationCacheEntry;
  weather?: PersistedHomeRecommendationCacheEntry;
};

export type HydratedHomeRecommendationCacheEntry = Omit<
  PersistedHomeRecommendationCacheEntry,
  "recommendations"
> & {
  recommendations: HomeRecommendationCardData[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidWeather(value: unknown): value is OutfitRecommendationWeather | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const weather = value as OutfitRecommendationWeather;

  return (
    (weather.temperature === undefined || typeof weather.temperature === "number") &&
    (weather.condition === undefined || typeof weather.condition === "string") &&
    (weather.rainChance === undefined || typeof weather.rainChance === "number")
  );
}

function parseCacheEntry(value: unknown): PersistedHomeRecommendationCacheEntry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const entry = value as Partial<PersistedHomeRecommendationCacheEntry>;
  if (
    typeof entry.key !== "string" ||
    !Array.isArray(entry.recommendations) ||
    !entry.emptyState ||
    typeof entry.emptyState !== "object" ||
    (entry.weatherLabel !== null && typeof entry.weatherLabel !== "string") ||
    !isValidWeather(entry.weather)
  ) {
    return undefined;
  }

  const recommendations = entry.recommendations.filter((recommendation) =>
    Boolean(
      recommendation &&
        typeof recommendation.id === "string" &&
        Array.isArray(recommendation.itemIds) &&
        recommendation.itemIds.length > 0 &&
        isStringArray(recommendation.itemIds) &&
        typeof recommendation.title === "string" &&
        isStringArray(recommendation.tags) &&
        isStringArray(recommendation.reasons)
    )
  );

  if (recommendations.length !== entry.recommendations.length) return undefined;

  const emptyState = entry.emptyState as HomeRecommendationEmptyState;
  if (
    emptyState.missingCategories !== undefined &&
    !isStringArray(emptyState.missingCategories)
  ) {
    return undefined;
  }

  return {
    key: entry.key,
    recommendations,
    emptyState,
    weatherLabel: entry.weatherLabel,
    weather: entry.weather,
  };
}

export function parseHomeRecommendationCacheSnapshot(
  rawValue: string | null
): HomeRecommendationCacheSnapshot | null {
  if (!rawValue) return null;

  try {
    const value = JSON.parse(rawValue) as Partial<HomeRecommendationCacheSnapshot>;
    if (value.version !== HOME_RECOMMENDATION_CACHE_VERSION) return null;

    const initial = parseCacheEntry(value.initial);
    const weather = parseCacheEntry(value.weather);

    return {
      version: HOME_RECOMMENDATION_CACHE_VERSION,
      ...(initial ? { initial } : {}),
      ...(weather ? { weather } : {}),
    };
  } catch {
    return null;
  }
}

export function createHomeRecommendationCacheEntry(
  key: string,
  recommendations: (Pick<
    OutfitRecommendation,
    "id" | "items" | "title" | "tags" | "reasons"
  >)[],
  emptyState: HomeRecommendationEmptyState,
  weatherLabel: string | null,
  weather: OutfitRecommendationWeather | null
): PersistedHomeRecommendationCacheEntry {
  return {
    key,
    recommendations: recommendations.map((recommendation) => ({
      id: recommendation.id,
      itemIds: recommendation.items.map((item) => item.id),
      title: recommendation.title,
      tags: recommendation.tags,
      reasons: recommendation.reasons,
    })),
    emptyState,
    weatherLabel,
    weather,
  };
}

export function hydrateHomeRecommendationCacheEntry(
  entry: PersistedHomeRecommendationCacheEntry | undefined,
  items: ClosetItem[],
  revisionKey: string
): HydratedHomeRecommendationCacheEntry | null {
  if (!entry || !isHomeRecommendationCacheKeyForRevision(entry.key, revisionKey)) {
    return null;
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const recommendations = entry.recommendations.map((recommendation) => ({
    id: recommendation.id,
    title: recommendation.title,
    tags: recommendation.tags,
    reasons: recommendation.reasons,
    items: recommendation.itemIds
      .map((itemId) => itemsById.get(itemId))
      .filter((item): item is ClosetItem => Boolean(item)),
  }));
  const hasMissingItem = recommendations.some(
    (recommendation, index) =>
      recommendation.items.length !== entry.recommendations[index].itemIds.length
  );

  if (hasMissingItem) return null;

  return {
    ...entry,
    recommendations,
  };
}

export function areRecommendationWeathersEquivalent(
  first?: OutfitRecommendationWeather | null,
  second?: OutfitRecommendationWeather | null
) {
  if (!first || !second) return first === second;

  function areOptionalNumbersClose(
    firstValue: number | undefined,
    secondValue: number | undefined,
    threshold: number
  ) {
    if (firstValue === undefined || secondValue === undefined) {
      return firstValue === secondValue;
    }

    return Math.abs(firstValue - secondValue) < threshold;
  }

  function getConditionGroup(condition?: string) {
    const normalized = condition?.trim().toLowerCase() || "";

    if (normalized.includes("눈")) return "snow";
    if (normalized.includes("비")) return "rain";
    if (normalized.includes("맑")) return "clear";
    if (
      normalized.includes("흐") ||
      normalized.includes("구름") ||
      normalized.includes("안개")
    ) {
      return "cloudy";
    }

    return normalized;
  }

  return (
    areOptionalNumbersClose(first.temperature, second.temperature, 2) &&
    areOptionalNumbersClose(first.rainChance, second.rainChance, 20) &&
    getConditionGroup(first.condition) === getConditionGroup(second.condition)
  );
}

export async function getHomeRecommendationCacheSnapshot() {
  try {
    const rawValue = await AsyncStorage.getItem(HOME_RECOMMENDATION_CACHE_STORAGE_KEY);
    return parseHomeRecommendationCacheSnapshot(rawValue);
  } catch (error) {
    console.error("홈 추천 캐시 불러오기 실패:", error);
    return null;
  }
}

export async function saveHomeRecommendationCacheSnapshot(
  snapshot: HomeRecommendationCacheSnapshot
) {
  try {
    await AsyncStorage.setItem(
      HOME_RECOMMENDATION_CACHE_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        version: HOME_RECOMMENDATION_CACHE_VERSION,
      })
    );
  } catch (error) {
    console.error("홈 추천 캐시 저장 실패:", error);
  }
}
