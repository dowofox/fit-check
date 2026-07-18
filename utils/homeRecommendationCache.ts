import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  HOME_RECOMMENDATION_CACHE_STORAGE_KEY,
  isHomeRecommendationCacheKeyForRevision,
} from "@/utils/homeRecommendationIndex";
import type {
  OutfitRecommendation,
  OutfitRecommendationEmptyReason,
  OutfitRecommendationWeather,
} from "@/utils/outfitRecommend";
import type { ClosetItem } from "@/utils/storage";

export { HOME_RECOMMENDATION_CACHE_STORAGE_KEY };
export const HOME_RECOMMENDATION_CACHE_VERSION = 2;
export const HOME_WEATHER_RECOMMENDATION_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 2;

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
  cachedAt: number;
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

export type HomeRecommendationCacheSnapshotLoadResult = {
  snapshot: HomeRecommendationCacheSnapshot | null;
  status:
    | "loaded"
    | "missing"
    | "invalid"
    | "version_mismatch"
    | "failed";
};

export type HydratedHomeRecommendationCacheEntry = Omit<
  PersistedHomeRecommendationCacheEntry,
  "recommendations"
> & {
  recommendations: HomeRecommendationCardData[];
};

export type HomeRecommendationCacheMissReason =
  | "cache_empty"
  | "revision_changed"
  | "closet_revision_changed"
  | "profile_revision_changed"
  | "saved_outfit_revision_changed"
  | "feedback_revision_changed"
  | "weather_expired"
  | "missing_item";

export type HomeRecommendationCacheHydrationResult = {
  cache: HydratedHomeRecommendationCacheEntry | null;
  missReason: HomeRecommendationCacheMissReason | null;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

type RecommendationRevisionKeyParts = {
  version: number;
  closet: number;
  profile: number;
  savedOutfit: number;
  feedback: number;
};

function parseRecommendationRevisionKey(
  key: string
): RecommendationRevisionKeyParts | null {
  const match = key.match(/^v(\d+)\|c(\d+)\|p(\d+)\|s(\d+)\|f(\d+)/);
  if (!match) return null;

  return {
    version: Number(match[1]),
    closet: Number(match[2]),
    profile: Number(match[3]),
    savedOutfit: Number(match[4]),
    feedback: Number(match[5]),
  };
}

export function getHomeRecommendationCacheRevisionMismatchReason(
  cacheKey: string,
  revisionKey: string
): HomeRecommendationCacheMissReason | null {
  if (isHomeRecommendationCacheKeyForRevision(cacheKey, revisionKey)) return null;

  const cached = parseRecommendationRevisionKey(cacheKey);
  const current = parseRecommendationRevisionKey(revisionKey);
  if (!cached || !current || cached.version !== current.version) {
    return "revision_changed";
  }
  if (cached.closet !== current.closet) return "closet_revision_changed";
  if (cached.profile !== current.profile) return "profile_revision_changed";
  if (cached.savedOutfit !== current.savedOutfit) {
    return "saved_outfit_revision_changed";
  }
  if (cached.feedback !== current.feedback) return "feedback_revision_changed";

  return "revision_changed";
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
    typeof entry.cachedAt !== "number" ||
    !Number.isFinite(entry.cachedAt) ||
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
    cachedAt: entry.cachedAt,
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

export function parseHomeRecommendationCacheSnapshotLoadResult(
  rawValue: string | null
): HomeRecommendationCacheSnapshotLoadResult {
  if (!rawValue) return { snapshot: null, status: "missing" };

  try {
    const rawSnapshot = JSON.parse(rawValue) as Partial<HomeRecommendationCacheSnapshot>;
    if (rawSnapshot.version !== HOME_RECOMMENDATION_CACHE_VERSION) {
      return { snapshot: null, status: "version_mismatch" };
    }
    const snapshot = parseHomeRecommendationCacheSnapshot(rawValue);

    if (!snapshot) return { snapshot: null, status: "invalid" };
    if (
      (rawSnapshot.initial !== undefined && !snapshot.initial) ||
      (rawSnapshot.weather !== undefined && !snapshot.weather)
    ) {
      return { snapshot: null, status: "invalid" };
    }
    if (!snapshot.initial && !snapshot.weather) {
      return { snapshot: null, status: "missing" };
    }

    return { snapshot, status: "loaded" };
  } catch {
    return { snapshot: null, status: "invalid" };
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
  weather: OutfitRecommendationWeather | null,
  cachedAt = Date.now()
): PersistedHomeRecommendationCacheEntry {
  return {
    key,
    cachedAt,
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

export function isHomeWeatherRecommendationCacheEntryFresh(
  entry?: Pick<PersistedHomeRecommendationCacheEntry, "cachedAt" | "weather"> | null,
  now = Date.now()
) {
  if (!entry?.weather || !Number.isFinite(entry.cachedAt)) return false;
  return now - entry.cachedAt <= HOME_WEATHER_RECOMMENDATION_CACHE_MAX_AGE_MS;
}

export function getHomeRecommendationCacheHydrationResult(
  entry: PersistedHomeRecommendationCacheEntry | undefined,
  items: ClosetItem[],
  revisionKey: string,
  now = Date.now()
): HomeRecommendationCacheHydrationResult {
  if (!entry) {
    return { cache: null, missReason: "cache_empty" };
  }
  if (!isHomeRecommendationCacheKeyForRevision(entry.key, revisionKey)) {
    return {
      cache: null,
      missReason: getHomeRecommendationCacheRevisionMismatchReason(
        entry.key,
        revisionKey
      ),
    };
  }
  if (entry.weather && !isHomeWeatherRecommendationCacheEntryFresh(entry, now)) {
    return { cache: null, missReason: "weather_expired" };
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

  if (hasMissingItem) {
    return { cache: null, missReason: "missing_item" };
  }

  return {
    cache: {
      ...entry,
      recommendations,
    },
    missReason: null,
  };
}

export function hydrateHomeRecommendationCacheEntry(
  entry: PersistedHomeRecommendationCacheEntry | undefined,
  items: ClosetItem[],
  revisionKey: string,
  now = Date.now()
): HydratedHomeRecommendationCacheEntry | null {
  return getHomeRecommendationCacheHydrationResult(
    entry,
    items,
    revisionKey,
    now
  ).cache;
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
  return (await getHomeRecommendationCacheSnapshotLoadResult()).snapshot;
}

export async function getHomeRecommendationCacheSnapshotLoadResult(): Promise<HomeRecommendationCacheSnapshotLoadResult> {
  try {
    const rawValue = await AsyncStorage.getItem(HOME_RECOMMENDATION_CACHE_STORAGE_KEY);
    return parseHomeRecommendationCacheSnapshotLoadResult(rawValue);
  } catch (error) {
    console.error("홈 추천 캐시 불러오기 실패:", error);
    return { snapshot: null, status: "failed" };
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
