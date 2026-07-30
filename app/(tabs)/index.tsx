import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import ClosetItemImage from "@/components/ClosetItemImage";
import {
  getOutfitDisplayReasons,
  getOutfitRecommendationResult,
} from "@/utils/outfitRecommend";
import type {
  OutfitRecommendationWeather,
} from "@/utils/outfitRecommend";
import { getOutfitRecommendationEmptyContent } from "@/utils/outfitRecommendationEmptyState";
import {
  createOutfitRecommendationContext,
  getOutfitRecommendationContextCacheKey,
} from "@/utils/outfitRecommendationContext";
import {
  getCurrentSeasonForReadiness,
  getOutfitRecommendationReadinessContent,
} from "@/utils/outfitRecommendationReadiness";
import type { OutfitRecommendationFeedback } from "@/utils/outfitFeedback";
import { canReuseHomeDashboardData } from "@/utils/homeDashboardRefresh";
import {
  areRecommendationWeathersEquivalent,
  createHomeRecommendationCacheEntry,
  getHomeRecommendationCacheRevisionMismatchReason,
  getHomeRecommendationCacheHydrationResult,
  getHomeRecommendationCacheSnapshotLoadResult,
  HOME_RECOMMENDATION_CACHE_VERSION,
  isHomeWeatherRecommendationCacheEntryFresh,
  saveHomeRecommendationCacheSnapshot,
  type HomeRecommendationCacheSnapshot,
  type HomeRecommendationCardData,
  type HomeRecommendationEmptyState,
  type HydratedHomeRecommendationCacheEntry,
} from "@/utils/homeRecommendationCache";
import {
  endPerformanceTimer,
  logPerformanceMetric,
  startPerformanceTimer,
} from "@/utils/performance";
import {
  getSavedOutfitItemIds,
} from "@/utils/recommendationInput";
import { isHomeRecommendationCacheKeyForRevision } from "@/utils/homeRecommendationIndex";
import {
  ClosetItem,
  getClosetRecommendationIndex,
  getOutfitRecommendationFeedbacksLoadResult,
  getRecommendationRevisionKey,
  getRecommendationRevisionState,
  getSavedOutfitsLoadResult,
  getUserProfile,
  getUserProfileLoadResult,
  SavedOutfit,
} from "@/utils/storage";
import { colors, typography } from "@/utils/theme";
import {
  formatWeatherRecommendationLabel,
  getCachedWeatherRecommendationResult,
  getCurrentWeatherRecommendationResult,
} from "@/utils/weather";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function getWeatherKey(weather: OutfitRecommendationWeather) {
  return [
    weather.temperature ?? "",
    weather.apparentTemperature ?? "",
    weather.condition || "",
    weather.rainChance ?? "",
    weather.windSpeed ?? "",
    weather.humidity ?? "",
  ].join("|");
}

function getCurrentWeek(today: Date) {
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  return WEEKDAY_LABELS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);

    return {
      label,
      date: date.getDate(),
      selected:
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate(),
    };
  });
}

function getCoreItems(recommendation: HomeRecommendationCardData) {
  const outer = recommendation.items.find((item) => item.category === "아우터");
  const top = recommendation.items.find((item) => item.category === "상의");
  const bottom = recommendation.items.find((item) => item.category === "하의");
  const shoes = recommendation.items.find((item) => item.category === "신발");

  return [top, bottom, shoes, outer].filter(
    (item): item is ClosetItem => Boolean(item)
  );
}

function getItemShortLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function getWeatherIconName(
  weather: OutfitRecommendationWeather | null
): keyof typeof Feather.glyphMap {
  const condition = weather?.condition?.toLowerCase() || "";

  if (/비|소나기|rain|drizzle/.test(condition)) return "cloud-rain";
  if (/눈|snow/.test(condition)) return "cloud-snow";
  if (/흐림|구름|cloud|fog|mist/.test(condition)) return "cloud";
  return "sun";
}

function getRecommendationRouteParams(
  recommendation?: HomeRecommendationCardData
) {
  return {
    source: "home",
    selectedItemIds: recommendation?.items.map((item) => item.id).join(",") || "",
  };
}

function TodayRecommendationCard({
  recommendation,
  current,
  total,
}: {
  recommendation: HomeRecommendationCardData;
  current: number;
  total: number;
}) {
  const coreItems = getCoreItems(recommendation);
  const reasonSummary = getOutfitDisplayReasons(recommendation.reasons, 2).join(" ");

  return (
    <View style={styles.outfitCard}>
      <View style={styles.outfitImageStage}>
        {coreItems.map((item) => (
          <View key={item.id} style={styles.outfitImageSlot}>
            <ClosetItemImage
              item={item}
              style={styles.outfitImage}
              contentFit="contain"
            />
          </View>
        ))}
        <View style={styles.cardCount}>
          <Text style={styles.cardCountText}>
            {current} / {total}
          </Text>
        </View>
      </View>

      <View style={styles.outfitCopy}>
        <View style={styles.outfitTagRow}>
          {recommendation.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={styles.outfitTag}>
              <Text style={styles.outfitTagText}>#{tag}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.outfitTitle} numberOfLines={2}>
          {recommendation.title}
        </Text>
        <Text style={styles.outfitItems} numberOfLines={1}>
          {recommendation.items.map(getItemShortLabel).join(" · ")}
        </Text>
        {reasonSummary ? (
          <Text style={styles.outfitReason} numberOfLines={2}>
            {reasonSummary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [todayRecommendations, setTodayRecommendations] = useState<
    HomeRecommendationCardData[]
  >([]);
  const [recommendationEmptyState, setRecommendationEmptyState] =
    useState<HomeRecommendationEmptyState>({});
  const [weatherLabel, setWeatherLabel] = useState<string | null>(null);
  const [currentRecommendationWeather, setCurrentRecommendationWeather] =
    useState<OutfitRecommendationWeather | null>(null);
  const [recommendationSeason, setRecommendationSeason] = useState(() =>
    getCurrentSeasonForReadiness()
  );
  const [isRecommendationPreparing, setIsRecommendationPreparing] = useState(true);
  const [hasDashboardData, setHasDashboardData] = useState(false);
  const [hasDashboardLoadError, setHasDashboardLoadError] = useState(false);
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);
  const [recommendationCursor, setRecommendationCursor] = useState(0);
  const initialRecommendationCacheRef =
    useRef<HydratedHomeRecommendationCacheEntry | null>(null);
  const weatherRecommendationCacheRef =
    useRef<HydratedHomeRecommendationCacheEntry | null>(null);
  const persistentRecommendationCacheRef = useRef<HomeRecommendationCacheSnapshot>({
    version: HOME_RECOMMENDATION_CACHE_VERSION,
  });
  const persistentCacheWriteRef = useRef<Promise<void>>(Promise.resolve());
  const recommendationExecutionCountRef = useRef({ initial: 0, weather: 0 });
  const dashboardContextRef = useRef<{
    dataKey: string;
    recommendationContextKey: string;
    currentSeason: string;
    items: ClosetItem[];
    profile: Awaited<ReturnType<typeof getUserProfile>>;
    savedOutfitItemIds: string[][];
    feedbacks: OutfitRecommendationFeedback[];
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      const isManualReload = dashboardReloadKey > 0;
      let isActive = true;
      let frameRequest: number | null = null;
      let deferredTimer: ReturnType<typeof setTimeout> | null = null;
      let baseTimersEnded = false;
      let fullLoadTimersEnded = false;
      const screenTimer = startPerformanceTimer("screen.home.focus-to-full-load");
      const initialRenderTimer = startPerformanceTimer("home.time-to-initial-render");
      const baseRenderTimer = startPerformanceTimer("home.time-to-base-render");
      const fullLoadTimer = startPerformanceTimer("home.focus-to-full-load");

      function endBaseRenderTimers(details: Record<string, unknown>) {
        if (baseTimersEnded) return;
        baseTimersEnded = true;
        endPerformanceTimer(baseRenderTimer, details);
        endPerformanceTimer(initialRenderTimer, details);
      }

      function endFullLoadTimers(details: Record<string, unknown>) {
        if (fullLoadTimersEnded) return;
        fullLoadTimersEnded = true;
        endPerformanceTimer(fullLoadTimer, details);
        endPerformanceTimer(screenTimer, details);
      }

      function applyCachedRecommendation(
        cache: HydratedHomeRecommendationCacheEntry,
        items: ClosetItem[]
      ) {
        if (!isActive) return;

        const context = createOutfitRecommendationContext({
          items,
          recommendationItems: items,
          weather: cache.weather,
        });
        setTodayRecommendations(
          context.readiness.ready ? cache.recommendations : []
        );
        setRecommendationEmptyState(cache.emptyState);
        setWeatherLabel(cache.weatherLabel);
        setCurrentRecommendationWeather(cache.weather);
        setIsRecommendationPreparing(false);
      }

      function restoreCachedRecommendation(
        recommendationContextKey: string,
        persistentSnapshot: HomeRecommendationCacheSnapshot | null,
        items: ClosetItem[],
        sharedWeather: OutfitRecommendationWeather | null
      ) {
        const restoreTimer = startPerformanceTimer(
          "home.cached-recommendation-restore"
        );
        const persistedWeatherResult = getHomeRecommendationCacheHydrationResult(
          persistentSnapshot?.weather,
          items,
          recommendationContextKey
        );
        const persistedInitialResult = getHomeRecommendationCacheHydrationResult(
          persistentSnapshot?.initial,
          items,
          recommendationContextKey
        );
        const persistedWeatherCache = persistedWeatherResult.cache;
        const persistedInitialCache = persistedInitialResult.cache;
        const memoryWeatherEntry = weatherRecommendationCacheRef.current;
        const memoryInitialEntry = initialRecommendationCacheRef.current;
        const memoryWeatherCache =
          isHomeRecommendationCacheKeyForRevision(
            memoryWeatherEntry?.key,
            recommendationContextKey
          ) &&
          isHomeWeatherRecommendationCacheEntryFresh(memoryWeatherEntry) &&
          sharedWeather &&
          areRecommendationWeathersEquivalent(
            memoryWeatherEntry?.weather,
            sharedWeather
          )
          ? memoryWeatherEntry
          : null;
        const memoryInitialCache =
          !sharedWeather &&
          isHomeRecommendationCacheKeyForRevision(
            memoryInitialEntry?.key,
            recommendationContextKey
          )
            ? memoryInitialEntry
            : null;
        const weatherCacheCandidate = memoryWeatherCache || persistedWeatherCache;
        const weatherCache =
          weatherCacheCandidate &&
          sharedWeather &&
          areRecommendationWeathersEquivalent(
            weatherCacheCandidate.weather,
            sharedWeather
          )
            ? weatherCacheCandidate
            : null;
        const initialCache = sharedWeather
          ? null
          : memoryInitialCache || persistedInitialCache;

        weatherRecommendationCacheRef.current = weatherCache;
        initialRecommendationCacheRef.current = initialCache;
        persistentRecommendationCacheRef.current = {
          version: HOME_RECOMMENDATION_CACHE_VERSION,
          ...(persistedInitialCache && persistentSnapshot?.initial
            ? { initial: persistentSnapshot.initial }
            : {}),
          ...(weatherCache && persistentSnapshot?.weather
            ? { weather: persistentSnapshot.weather }
            : {}),
        };
        const cachedResult = isHomeRecommendationCacheKeyForRevision(
          weatherCache?.key,
          recommendationContextKey
        )
          ? weatherCache
          : isHomeRecommendationCacheKeyForRevision(
                initialCache?.key,
                recommendationContextKey
              )
            ? initialCache
            : null;
        const memoryCacheMissReason =
          (memoryWeatherEntry
            ? getHomeRecommendationCacheRevisionMismatchReason(
                memoryWeatherEntry.key,
                recommendationContextKey
              )
            : null) ||
          (memoryInitialEntry
            ? getHomeRecommendationCacheRevisionMismatchReason(
                memoryInitialEntry.key,
                recommendationContextKey
              )
            : null) ||
          (memoryWeatherEntry &&
                !isHomeWeatherRecommendationCacheEntryFresh(memoryWeatherEntry)
            ? "weather_expired"
            : null);
        const persistentCacheMissReason =
          persistedWeatherResult.missReason !== "cache_empty"
            ? persistedWeatherResult.missReason
            : persistedInitialResult.missReason;
        const cacheMissReason = cachedResult
          ? null
          : memoryCacheMissReason || persistentCacheMissReason || "cache_empty";

        if (cachedResult) {
          applyCachedRecommendation(cachedResult, items);
        }

        endPerformanceTimer(restoreTimer, {
          cacheHit: Boolean(cachedResult),
          cacheMissReason,
          recommendationExecutionCount:
            recommendationExecutionCountRef.current.initial +
            recommendationExecutionCountRef.current.weather,
          weatherSource: cachedResult?.weather
            ? memoryWeatherCache === cachedResult
              ? "memory_weather"
              : "persistent_weather"
            : "none",
        });

        return {
          restored: Boolean(cachedResult),
          missReason: cacheMissReason,
        };
      }

      function persistRecommendationCache(
        kind: "initial" | "weather",
        cache: HydratedHomeRecommendationCacheEntry
      ) {
        const persistedEntry = createHomeRecommendationCacheEntry(
          cache.key,
          cache.recommendations,
          cache.emptyState,
          cache.weatherLabel,
          cache.weather,
          cache.cachedAt
        );
        const nextSnapshot = {
          ...persistentRecommendationCacheRef.current,
          version: HOME_RECOMMENDATION_CACHE_VERSION,
          [kind]: persistedEntry,
        };

        persistentRecommendationCacheRef.current = nextSnapshot;
        persistentCacheWriteRef.current = persistentCacheWriteRef.current.then(() =>
          saveHomeRecommendationCacheSnapshot(nextSnapshot)
        );
      }

      function applyRecommendation(
        items: ClosetItem[],
        profile: Awaited<ReturnType<typeof getUserProfile>>,
        weather: OutfitRecommendationWeather | null,
        recommendationContextKey: string,
        currentSeason: string,
        savedOutfitItemIds: string[][],
        feedbacks: OutfitRecommendationFeedback[],
        weatherSource: "none" | "cache" | "live" = "none"
      ) {
        const kind = weather ? "weather" : "initial";
        const cacheRef = weather
          ? weatherRecommendationCacheRef
          : initialRecommendationCacheRef;
        const cacheKey = weather
          ? `${recommendationContextKey}|${getWeatherKey(weather)}`
          : recommendationContextKey;
        const cachedResult = cacheRef.current;
        const hasEquivalentWeatherCache = Boolean(
          weather &&
            cachedResult?.weather &&
            isHomeRecommendationCacheKeyForRevision(
              cachedResult.key,
              recommendationContextKey
            ) &&
            areRecommendationWeathersEquivalent(cachedResult.weather, weather)
        );

        if (
          cachedResult &&
          (cachedResult.key === cacheKey || hasEquivalentWeatherCache)
        ) {
          applyCachedRecommendation(cachedResult, items);
          logPerformanceMetric(`home.${kind}-outfit-recommendation.skipped`, {
            reason: hasEquivalentWeatherCache ? "equivalent weather" : "same input",
            recommendationExecutionCount:
              recommendationExecutionCountRef.current[kind],
            cacheHit: true,
            cacheMissReason: null,
            weatherSource,
          });
          return false;
        }

        recommendationExecutionCountRef.current[kind] += 1;
        const recommendationTimer = startPerformanceTimer(
          weather ? "home.weather-outfit-recommendation" : "home.initial-outfit-recommendation"
        );
        const context = createOutfitRecommendationContext({
          items,
          recommendationItems: items,
          profile,
          currentSeason,
          weather,
          feedbacks,
          savedOutfitItemIds,
        });
        const recommendationResult = context.readiness.ready
          ? getOutfitRecommendationResult(
              context.recommendationItems,
              context.profile,
              context.currentSeason,
              context.savedOutfitItemIds,
              {
                weather: context.weather,
                allowSeasonFallback: false,
                feedbacks: context.feedbacks,
                onDiagnostics: (diagnostic) => {
                  logPerformanceMetric(
                    `home.recommendation.stage.${diagnostic.stage}`,
                    diagnostic
                  );
                },
              }
            )
          : {
              recommendations: [],
              emptyReason: undefined,
              missingCategories: undefined,
            };
        const recommendations = recommendationResult.recommendations.slice(0, 5);
        const cardRecommendations = recommendations.map((recommendation) => ({
          id: recommendation.id,
          items: recommendation.items,
          title: recommendation.title,
          tags: recommendation.tags,
          reasons: recommendation.reasons,
        }));
        const nextWeatherLabel = formatWeatherRecommendationLabel(weather);
        const emptyState = {
          emptyReason: recommendationResult.emptyReason,
          missingCategories: recommendationResult.missingCategories,
        };

        const nextCache: HydratedHomeRecommendationCacheEntry = {
          key: cacheKey,
          cachedAt: Date.now(),
          recommendations: cardRecommendations,
          emptyState,
          weatherLabel: nextWeatherLabel,
          weather,
        };
        cacheRef.current = nextCache;
        persistRecommendationCache(kind, nextCache);
        endPerformanceTimer(recommendationTimer, {
          itemCount: items.length,
          recommendationCount: recommendationResult.recommendations.length,
          recommendationExecutionCount: recommendationExecutionCountRef.current[kind],
          cacheHit: false,
          cacheMissReason: "recommendation_not_cached",
          weatherSource,
        });

        if (!isActive) return true;

        setTodayRecommendations(cardRecommendations);
        setRecommendationEmptyState(emptyState);
        setWeatherLabel(nextWeatherLabel);
        setCurrentRecommendationWeather(weather);
        setIsRecommendationPreparing(false);
        return true;
      }

      async function refreshWeatherRecommendation(
        items: ClosetItem[],
        profile: Awaited<ReturnType<typeof getUserProfile>>,
        recommendationContextKey: string,
        currentSeason: string,
        savedOutfitItemIds: string[][],
        feedbacks: OutfitRecommendationFeedback[],
        fallbackToInitial = false
      ) {
        const weatherTimer = startPerformanceTimer("home.weather-background-refresh");
        let weatherSource = "none";
        let failed = false;
        let failureReason: string | null = null;
        let weatherFound = false;
        let recommendationAvailable = false;
        let initialFallbackApplied = false;

        try {
          const cachedWeatherTimer = startPerformanceTimer(
            "home.cached-weather-recommendation"
          );
          let cachedWeather: OutfitRecommendationWeather | null = null;
          let cachedWeatherApplied = false;

          let cachedWeatherResult: Awaited<
            ReturnType<typeof getCachedWeatherRecommendationResult>
          > | null = null;

          try {
            cachedWeatherResult = await getCachedWeatherRecommendationResult();
            cachedWeather = cachedWeatherResult.weather;
            if (cachedWeather && isActive) {
              cachedWeatherApplied = applyRecommendation(
                items,
                profile,
                cachedWeather,
                recommendationContextKey,
                currentSeason,
                savedOutfitItemIds,
                feedbacks,
                "cache"
              );
              weatherSource = "cache";
              weatherFound = true;
              recommendationAvailable = true;
            }
          } catch (error) {
            console.error("캐시 날씨 적용 실패:", error);
            cachedWeather = null;
          } finally {
            endPerformanceTimer(cachedWeatherTimer, {
              weatherFound: Boolean(cachedWeather),
              recommendationExecuted: cachedWeatherApplied,
              recommendationExecutionCount:
                recommendationExecutionCountRef.current.weather,
              cacheHit: cachedWeatherResult?.cacheHit ?? false,
              cacheMissReason:
                cachedWeatherResult?.cacheMissReason ??
                (cachedWeather ? null : "weather_cache_read_failed"),
              weatherSource: "cache",
            });
          }

          const liveWeatherTimer = startPerformanceTimer("home.live-weather-recommendation");
          let currentWeather: OutfitRecommendationWeather | null = null;
          let liveWeatherApplied = false;
          let liveWeatherResult: Awaited<
            ReturnType<typeof getCurrentWeatherRecommendationResult>
          > | null = null;

          try {
            liveWeatherResult = await getCurrentWeatherRecommendationResult();
            currentWeather = liveWeatherResult.weather;
            if (currentWeather && isActive) {
              liveWeatherApplied = applyRecommendation(
                items,
                profile,
                currentWeather,
                recommendationContextKey,
                currentSeason,
                savedOutfitItemIds,
                feedbacks,
                "live"
              );
              weatherSource = "current";
              weatherFound = true;
              recommendationAvailable = true;
            }
            if (!weatherFound && liveWeatherResult.failed) {
              failed = true;
              failureReason = liveWeatherResult.failureReason || "unknown_error";
            }
          } catch (error) {
            console.error("실시간 날씨 적용 실패:", error);
            currentWeather = null;
            if (!weatherFound) {
              failed = true;
              failureReason = "unknown_error";
            }
          } finally {
            endPerformanceTimer(liveWeatherTimer, {
              weatherFound: Boolean(currentWeather),
              failed: liveWeatherResult?.failed ?? !currentWeather,
              skipped: liveWeatherResult?.skipped ?? false,
              failureReason:
                liveWeatherResult?.failureReason ??
                (currentWeather ? null : "unknown_error"),
              permissionStatus: liveWeatherResult?.permissionStatus,
              locationSource: liveWeatherResult?.locationSource ?? "none",
              apiStatus: liveWeatherResult?.apiStatus,
              timeout: liveWeatherResult?.timeout ?? false,
              recommendationExecuted: liveWeatherApplied,
              recommendationExecutionCount:
                recommendationExecutionCountRef.current.weather,
              cacheHit: Boolean(currentWeather) && !liveWeatherApplied,
              cacheMissReason: currentWeather
                ? null
                : liveWeatherResult?.failureReason || "live_weather_unavailable",
              weatherSource: "live",
            });
          }
        } catch {
          failed = true;
        } finally {
          if (fallbackToInitial && !recommendationAvailable && isActive) {
            initialFallbackApplied = applyRecommendation(
              items,
              profile,
              null,
              recommendationContextKey,
              currentSeason,
              savedOutfitItemIds,
              feedbacks
            );
            recommendationAvailable = initialFallbackApplied;
          }

          endPerformanceTimer(weatherTimer, {
            weatherSource,
            failed,
            failureReason,
            weatherFound,
            skipped: false,
            initialFallbackApplied,
            recommendationAvailable,
          });
        }

        return recommendationAvailable;
      }

      async function loadDashboard() {
        try {
          const cachedDashboardContext = dashboardContextRef.current;
          const currentSeason = getCurrentSeasonForReadiness();
          setRecommendationSeason(currentSeason);

          if (cachedDashboardContext) {
            const revisionTimer = startPerformanceTimer(
              "home.storage.revision-check"
            );
            const currentRevisions = await getRecommendationRevisionState();
            const canReuseDashboard =
              cachedDashboardContext.currentSeason === currentSeason &&
              canReuseHomeDashboardData(
                cachedDashboardContext.dataKey,
                currentRevisions
              );
            endPerformanceTimer(revisionTimer, {
              cacheHit: canReuseDashboard,
              cacheMissReason: canReuseDashboard
                ? null
                : cachedDashboardContext.currentSeason !== currentSeason
                  ? "season_changed"
                  : "revision_changed",
            });

            if (canReuseDashboard) {
              if (!isActive) return;

              setIsRecommendationPreparing(false);
              setHasDashboardLoadError(false);
              logPerformanceMetric("home.focus-reload.skipped", {
                reason: "recommendation revision unchanged",
                itemCount: cachedDashboardContext.items.length,
              });

              frameRequest = requestAnimationFrame(() => {
                if (!isActive) return;

                const details = {
                  itemCount: cachedDashboardContext.items.length,
                  cacheHit: true,
                  cacheMissReason: null,
                  fullDataReloadSkipped: true,
                };
                endBaseRenderTimers(details);
                endFullLoadTimers({
                  ...details,
                  initialRecommendationReady: true,
                  recommendationExecutionCount:
                    recommendationExecutionCountRef.current.initial,
                });
                void refreshWeatherRecommendation(
                  cachedDashboardContext.items,
                  cachedDashboardContext.profile,
                  cachedDashboardContext.recommendationContextKey,
                  cachedDashboardContext.currentSeason,
                  cachedDashboardContext.savedOutfitItemIds,
                  cachedDashboardContext.feedbacks,
                  true
                );
              });
              return;
            }
          }

          const baseDataTimer = startPerformanceTimer("screen.home.base-data");
          const [
            indexLoad,
            savedOutfitsLoad,
            profileLoad,
            feedbacksLoad,
            recommendationCacheLoad,
            sharedWeatherLoad,
          ] = await Promise.all([
            (async () => {
              const timer = startPerformanceTimer("home.storage.closet-load");
              const result = await getClosetRecommendationIndex();
              endPerformanceTimer(timer, {
                itemCount: result.index.recommendationItems.length,
                serializedCharacters: result.serializedCharacters,
                closetSerializedCharacters: result.closetSerializedCharacters,
                cacheHit: result.source === "cache",
                cacheMissReason: result.source === "cache" ? null : result.source,
                fullClosetParsed: result.fullClosetParsed,
              });
              return result;
            })(),
            (async () => {
              const timer = startPerformanceTimer(
                "home.storage.saved-outfits-load"
              );
              const result = await getSavedOutfitsLoadResult();
              endPerformanceTimer(timer, {
                itemCount: result.outfits.length,
                status: result.status,
                serializedCharacters: JSON.stringify(result.outfits).length,
              });
              return result;
            })(),
            (async () => {
              const timer = startPerformanceTimer("home.storage.profile-load");
              const result = await getUserProfileLoadResult();
              endPerformanceTimer(timer, {
                itemCount: result.profile ? 1 : 0,
                status: result.status,
                serializedCharacters: JSON.stringify(result.profile).length,
              });
              return result;
            })(),
            (async () => {
              const timer = startPerformanceTimer("home.storage.feedback-load");
              const result = await getOutfitRecommendationFeedbacksLoadResult();
              endPerformanceTimer(timer, {
                itemCount: result.feedbacks.length,
                status: result.status,
                serializedCharacters: JSON.stringify(result.feedbacks).length,
              });
              return result;
            })(),
            (async () => {
              const timer = startPerformanceTimer(
                "home.storage.recommendation-cache-load"
              );
              const result = await getHomeRecommendationCacheSnapshotLoadResult();
              endPerformanceTimer(timer, {
                cacheHit: result.status === "loaded",
                cacheMissReason:
                  result.status === "loaded"
                    ? null
                    : `persistent_cache_${result.status}`,
                status: result.status,
              });
              return result;
            })(),
            getCachedWeatherRecommendationResult(),
          ]);

          if (
            savedOutfitsLoad.status === "failed" ||
            profileLoad.status === "failed" ||
            feedbacksLoad.status === "failed"
          ) {
            throw new Error("Home dashboard storage input could not be loaded");
          }

          const nextSavedOutfits = savedOutfitsLoad.outfits;
          const nextProfile = profileLoad.profile;
          const feedbacks = feedbacksLoad.feedbacks;
          endPerformanceTimer(baseDataTimer, {
            closetItemCount: indexLoad.index.recommendationItems.length,
            savedOutfitCount: nextSavedOutfits.length,
          });

          if (!isActive) return;

          const inputBuildTimer = startPerformanceTimer(
            "home.recommendation-input-build"
          );
          const recommendationItems = indexLoad.index.recommendationItems;
          const savedOutfitItemIds = getSavedOutfitItemIds(
            nextSavedOutfits,
            recommendationItems
          );
          endPerformanceTimer(inputBuildTimer, {
            itemCount: recommendationItems.length,
            serializedCharacters: indexLoad.serializedCharacters,
            cacheHit: indexLoad.source === "cache",
            cacheMissReason: indexLoad.source === "cache" ? null : indexLoad.source,
          });

          const keyBuildTimer = startPerformanceTimer(
            "home.recommendation-key-build"
          );
          const dataKey = getRecommendationRevisionKey(indexLoad.revisions);
          const recommendationContextKey =
            getOutfitRecommendationContextCacheKey(dataKey, currentSeason);
          endPerformanceTimer(keyBuildTimer, {
            serializedCharacters: recommendationContextKey.length,
            cacheHit: indexLoad.source === "cache",
            cacheMissReason: indexLoad.source === "cache" ? null : indexLoad.source,
          });

          logPerformanceMetric("home.lightweight-recommendation-data", {
            itemCount: recommendationItems.length,
            serializedCharacters: indexLoad.serializedCharacters,
            recommendationKeyCharacters: recommendationContextKey.length,
            containsProductSizeGuide: recommendationItems.some(
              (item) => Boolean(item.confirmedProduct?.productSizeGuide)
            ),
            fullClosetParsed: indexLoad.fullClosetParsed,
          });

          setClosetItems(recommendationItems);
          setSavedOutfits(nextSavedOutfits);
          setHasDashboardData(true);
          setHasDashboardLoadError(false);
          dashboardContextRef.current = {
            dataKey,
            recommendationContextKey,
            currentSeason,
            items: recommendationItems,
            profile: nextProfile,
            savedOutfitItemIds,
            feedbacks,
          };
          const cacheRestoreResult = restoreCachedRecommendation(
            recommendationContextKey,
            recommendationCacheLoad.snapshot,
            recommendationItems,
            sharedWeatherLoad.weather
          );
          const cacheRestored = cacheRestoreResult.restored;

          if (!cacheRestored) {
            setTodayRecommendations([]);
            setWeatherLabel(null);
            setCurrentRecommendationWeather(null);
            setIsRecommendationPreparing(true);
          }

          const baseRenderDetails = {
            itemCount: recommendationItems.length,
            cacheHit: cacheRestored,
            cacheMissReason: cacheRestoreResult.missReason,
          };

          const startWeatherRefresh = (fallbackToInitial = false) => {
            return refreshWeatherRecommendation(
              recommendationItems,
              nextProfile,
              recommendationContextKey,
              currentSeason,
              savedOutfitItemIds,
              feedbacks,
              fallbackToInitial
            );
          };

          frameRequest = requestAnimationFrame(() => {
            if (!isActive) return;
            endBaseRenderTimers(baseRenderDetails);

            if (cacheRestored) {
              endFullLoadTimers({
                initialRecommendationReady: true,
                recommendationExecutionCount:
                  recommendationExecutionCountRef.current.initial,
                cacheHit: true,
              });
              void startWeatherRefresh(true);
              return;
            }

            deferredTimer = setTimeout(() => {
              if (!isActive) return;

              void startWeatherRefresh(true).finally(() => {
                endFullLoadTimers({
                  initialRecommendationReady: true,
                  recommendationExecutionCount:
                    recommendationExecutionCountRef.current.initial +
                    recommendationExecutionCountRef.current.weather,
                  cacheHit: false,
                });
              });
            }, 0);
          });
        } catch (error) {
          if (isActive) {
            setIsRecommendationPreparing(false);
            setHasDashboardLoadError(true);
          }
          logPerformanceMetric("home.load-failed", {
            message: error instanceof Error ? error.message : String(error),
            manualRetry: isManualReload,
          });
          endBaseRenderTimers({ failed: true });
          endFullLoadTimers({ failed: true });
        }
      }

      loadDashboard();

      return () => {
        isActive = false;
        if (frameRequest !== null) cancelAnimationFrame(frameRequest);
        if (deferredTimer !== null) clearTimeout(deferredTimer);
        endBaseRenderTimers({ cancelled: true });
        endFullLoadTimers({ cancelled: true });
      };
    }, [dashboardReloadKey])
  );

  async function startAnalysis() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled) {
      router.push({ pathname: "/analyzing", params: { imageUri: result.assets[0].uri } });
    }
  }

  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getCurrentWeek(today), [today]);
  const homeRecommendationContext = useMemo(
    () =>
      createOutfitRecommendationContext({
        items: closetItems,
        recommendationItems: closetItems,
        currentSeason: recommendationSeason,
        weather: currentRecommendationWeather,
      }),
    [closetItems, currentRecommendationWeather, recommendationSeason]
  );
  const homeReadiness = homeRecommendationContext.readiness;
  const recommendationEmptyContent = homeReadiness.ready
    ? getOutfitRecommendationEmptyContent(recommendationEmptyState, closetItems)
    : getOutfitRecommendationReadinessContent(homeReadiness);
  const visibleTodayRecommendations = homeReadiness.ready
    ? todayRecommendations
    : [];
  const activeRecommendationIndex =
    visibleTodayRecommendations.length > 0
      ? recommendationCursor % visibleTodayRecommendations.length
      : 0;
  const activeRecommendation =
    visibleTodayRecommendations[activeRecommendationIndex];
  const weatherIconName = getWeatherIconName(currentRecommendationWeather);
  const contextLabel =
    weatherLabel ||
    (isRecommendationPreparing
      ? "오늘 조건을 확인하고 있어요"
      : "오늘 옷장 기준 추천");

  function showNextRecommendation() {
    if (visibleTodayRecommendations.length < 2) return;
    setRecommendationCursor((current) => current + 1);
  }

  function openActiveRecommendation() {
    if (!activeRecommendation) return;

    router.push({
      pathname: "/outfit-recommend",
      params: getRecommendationRouteParams(activeRecommendation),
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logoText}>NAES</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="마이페이지 열기"
            style={styles.profileButton}
            onPress={() => router.push("/profile")}
          >
            <Feather name="user" size={17} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.todayHeading}>
          <View style={styles.todayHeadingCopy}>
            <Text style={styles.todayEyebrow}>
              TODAY · {MONTH_LABELS[today.getMonth()]} {today.getDate()}
            </Text>
            <Text style={styles.todayTitle}>오늘 입을 한 벌</Text>
          </View>
          {visibleTodayRecommendations.length > 0 ? (
            <View style={styles.stepIndicator}>
              <Text style={styles.stepCurrent}>{activeRecommendationIndex + 1}</Text>
              <Text style={styles.stepTotal}> / {visibleTodayRecommendations.length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.week}>
          {weekDays.map((day) => (
            <View
              key={`${day.label}-${day.date}`}
              style={[styles.day, day.selected && styles.daySelected]}
            >
              <Text style={[styles.dayLabel, day.selected && styles.dayTextSelected]}>
                {day.label}
              </Text>
              <Text style={[styles.dayDate, day.selected && styles.dayTextSelected]}>
                {day.date}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.contextRow}>
          <View style={styles.contextIcon}>
            <Feather name={weatherIconName} size={14} color={colors.point} />
          </View>
          <Text style={styles.contextText} numberOfLines={1}>
            {contextLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`저장한 코디 ${savedOutfits.length}개 보기`}
            style={styles.savedContextAction}
            onPress={() => router.push("/saved-outfits")}
          >
            <Feather name="bookmark" size={13} color={colors.point} />
            <Text style={styles.savedContextText}>
              저장 {hasDashboardLoadError && !hasDashboardData ? "-" : savedOutfits.length}
            </Text>
          </Pressable>
        </View>

        {hasDashboardLoadError ? (
          <View style={styles.loadErrorCard}>
            <Feather name="alert-circle" size={17} color={colors.warning} />
            <View style={styles.loadErrorTextArea}>
              <Text style={styles.loadErrorTitle}>홈 정보를 불러오지 못했어요</Text>
              <Text style={styles.loadErrorText}>
                {hasDashboardData
                  ? "마지막으로 확인한 추천을 유지하고 있어요."
                  : "저장된 옷과 코디는 그대로예요. 다시 불러와주세요."}
              </Text>
            </View>
            <Pressable
              style={styles.loadErrorAction}
              onPress={() => setDashboardReloadKey((value) => value + 1)}
            >
              <Text style={styles.loadErrorActionText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.cardStage}>
          <View style={styles.cardBehind} />
          {activeRecommendation ? (
            <TodayRecommendationCard
              recommendation={activeRecommendation}
              current={activeRecommendationIndex + 1}
              total={visibleTodayRecommendations.length}
            />
          ) : (
            <View style={styles.recommendationStateCard}>
              <View style={styles.recommendationStateIcon}>
                <Feather
                  name={
                    hasDashboardLoadError && !hasDashboardData
                      ? "refresh-cw"
                      : isRecommendationPreparing
                        ? "clock"
                        : "plus"
                  }
                  size={20}
                  color={colors.point}
                />
              </View>
              <Text style={styles.recommendationStateTitle}>
                {hasDashboardLoadError && !hasDashboardData
                  ? "추천 정보를 다시 불러와주세요"
                  : isRecommendationPreparing
                    ? "오늘의 코디를 준비하고 있어요"
                    : recommendationEmptyContent.title}
              </Text>
              <Text style={styles.recommendationStateText}>
                {hasDashboardLoadError && !hasDashboardData
                  ? "옷장 상태를 확인한 뒤 오늘의 코디를 준비할게요."
                  : isRecommendationPreparing
                    ? "옷장과 오늘 조건을 확인하고 있어요."
                    : recommendationEmptyContent.text}
              </Text>
              {!isRecommendationPreparing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasDashboardLoadError && !hasDashboardData
                      ? "홈 정보 다시 불러오기"
                      : "옷 추가하기"
                  }
                  style={styles.recommendationStateButton}
                  onPress={
                    hasDashboardLoadError && !hasDashboardData
                      ? () => setDashboardReloadKey((value) => value + 1)
                      : () => router.push("/add-clothes")
                  }
                >
                  <Text style={styles.recommendationStateButtonText}>
                    {hasDashboardLoadError && !hasDashboardData
                      ? "다시 불러오기"
                      : "옷 추가하기"}
                  </Text>
                  <Feather name="arrow-right" size={15} color={colors.card} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {activeRecommendation ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다른 코디 보기"
              accessibilityState={{
                disabled: visibleTodayRecommendations.length < 2,
              }}
              style={[
                styles.nextButton,
                visibleTodayRecommendations.length < 2 && styles.nextButtonDisabled,
              ]}
              disabled={visibleTodayRecommendations.length < 2}
              onPress={showNextRecommendation}
            >
              <Feather name="refresh-cw" size={18} color={colors.subText} />
              <Text style={styles.nextButtonText}>다른 코디</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이 코디 상세 보기"
              style={styles.selectButton}
              onPress={openActiveRecommendation}
            >
              <Feather name="check" size={18} color={colors.card} />
              <Text style={styles.selectButtonText}>이 코디 선택</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.quickLinks}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진으로 코디 분석하기"
            style={styles.quickLink}
            onPress={startAnalysis}
          >
            <Feather name="camera" size={15} color={colors.point} />
            <Text style={styles.quickLinkText}>사진 코디 분석</Text>
          </Pressable>
          <View style={styles.quickLinkDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="옷장 열기"
            style={styles.quickLink}
            onPress={() => router.push("/closet")}
          >
            <Feather name="grid" size={15} color={colors.point} />
            <Text style={styles.quickLinkText}>
              옷장 {hasDashboardLoadError && !hasDashboardData ? "-" : closetItems.length}벌
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingTop: 18,
    paddingHorizontal: 17,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  header: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  greetingArea: {
    marginBottom: 18,
  },
  greetingEyebrow: {
    color: colors.point,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
  greeting: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
  },
  greetingSub: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 7,
  },
  loadErrorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  loadErrorTextArea: {
    flex: 1,
    minWidth: 0,
  },
  loadErrorTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  loadErrorText: {
    color: colors.subText,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  loadErrorAction: {
    minHeight: 30,
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.softCard,
    flexShrink: 0,
  },
  loadErrorActionText: {
    color: colors.point,
    fontSize: 11,
    fontWeight: "700",
  },
  primaryAction: {
    minHeight: 120,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.point,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 10,
  },
  primaryActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  actionTextArea: {
    flex: 1,
    minWidth: 0,
  },
  primaryActionEyebrow: {
    color: "#B9D3C8",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 4,
  },
  primaryActionTitle: {
    color: colors.card,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  primaryActionText: {
    color: "#D8E8E1",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  secondaryAction: {
    minHeight: 88,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  secondaryActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  secondaryActionTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  secondaryActionText: {
    color: colors.subText,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 3,
  },
  stepSection: {
    marginBottom: 18,
  },
  stepRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotComplete: {
    backgroundColor: colors.point,
  },
  stepNumber: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "900",
  },
  stepLabel: {
    color: colors.subText,
    fontSize: 10,
    fontWeight: "700",
  },
  closetSummary: {
    minHeight: 76,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    flexDirection: "row",
    marginBottom: 20,
  },
  closetSummaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  closetSummaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  closetSummaryLabel: {
    color: colors.subText,
    fontSize: 9,
    fontWeight: "700",
  },
  heroCard: {
    height: 148,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    position: "relative",
  },
  heroBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    lineHeight: 21,
  },
  heroText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.subText,
  },
  heroButton: {
    marginTop: 12,
    backgroundColor: colors.text,
    height: 32,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  heroButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.text,
  },
  weatherBasisText: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  moreWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  moreText: {
    color: colors.point,
    fontSize: 12,
    fontWeight: "600",
  },
  closetGrid: {
    flexDirection: "row",
    gap: 8,
  },
  countTile: {
    flex: 1,
    height: 96,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  countLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  countValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  emptyText: {
    ...typography.body,
    color: colors.subText,
    lineHeight: 19,
  },
  recommendationEmptyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recommendationEmptyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  recommendationEmptyTextArea: {
    flex: 1,
    minWidth: 0,
  },
  recommendationEmptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  recommendationEmptyButton: {
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: colors.text,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    flexShrink: 0,
  },
  recommendationEmptyButtonText: {
    color: colors.card,
    fontSize: 11,
    fontWeight: "700",
  },
  recommendCarousel: {
    gap: 12,
    paddingRight: 18,
  },
  recommendCard: {
    width: 310,
    minHeight: 132,
    padding: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  recommendVisual: {
    width: 104,
    height: 110,
    padding: 5,
    borderRadius: 14,
    backgroundColor: colors.inactiveTab,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "space-between",
  },
  recommendVisualItem: {
    width: "48%",
    height: "48%",
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  recommendCopy: {
    flex: 1,
    minWidth: 0,
  },
  recommendEyebrow: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "900",
    marginBottom: 4,
  },
  recommendTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    marginBottom: 4,
  },
  recommendItems: {
    color: colors.subText,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  recommendReason: {
    color: colors.subText,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  recommendTagRow: {
    flexDirection: "row",
    gap: 4,
  },
  recommendTag: {
    backgroundColor: colors.softCard,
    color: colors.point,
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  savedCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    marginBottom: 18,
    minHeight: 94,
  },
  savedTextArea: {
    flex: 1,
    paddingRight: 12,
    justifyContent: "center",
  },
  savedTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  savedDescription: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  savedActionArea: {
    width: 72,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  savedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  savedLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  savedLinkText: {
    color: colors.point,
    fontSize: 12,
    fontWeight: "700",
  },
  analysisShortcut: {
    minHeight: 68,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 18,
  },
  analysisShortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
  },
  analysisShortcutTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  analysisShortcutText: {
    color: colors.subText,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  todayHeading: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  todayHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayEyebrow: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "900",
  },
  todayTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingBottom: 3,
  },
  stepCurrent: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  stepTotal: {
    color: colors.subText,
    fontSize: 10,
    fontWeight: "700",
  },
  week: {
    minHeight: 58,
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  day: {
    flex: 1,
    maxWidth: 43,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  daySelected: {
    backgroundColor: colors.text,
  },
  dayLabel: {
    color: colors.subText,
    fontSize: 9,
    fontWeight: "800",
  },
  dayDate: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  dayTextSelected: {
    color: colors.card,
  },
  contextRow: {
    minHeight: 42,
    marginTop: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.softCard,
  },
  contextIcon: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.card,
  },
  contextText: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 8,
  },
  savedContextAction: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 8,
  },
  savedContextText: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "800",
  },
  cardStage: {
    minHeight: 350,
    marginTop: 13,
    position: "relative",
  },
  cardBehind: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 8,
    bottom: -5,
    borderRadius: 18,
    backgroundColor: colors.border,
    transform: [{ rotate: "-1deg" }],
  },
  outfitCard: {
    minHeight: 350,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outfitImageStage: {
    height: 228,
    position: "relative",
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inactiveTab,
  },
  outfitImageSlot: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingHorizontal: 2,
  },
  outfitImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  cardCount: {
    position: "absolute",
    right: 10,
    top: 10,
    minWidth: 42,
    height: 24,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  cardCountText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "900",
  },
  outfitCopy: {
    minHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  outfitTagRow: {
    minHeight: 21,
    flexDirection: "row",
    gap: 5,
  },
  outfitTag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.softCard,
  },
  outfitTagText: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "800",
  },
  outfitTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    marginTop: 7,
  },
  outfitItems: {
    color: colors.point,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  outfitReason: {
    color: colors.subText,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  recommendationStateCard: {
    minHeight: 350,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  recommendationStateIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softCard,
  },
  recommendationStateTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
  },
  recommendationStateText: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
  recommendationStateButton: {
    minHeight: 42,
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.text,
  },
  recommendationStateButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "800",
  },
  actions: {
    minHeight: 58,
    marginTop: 11,
    flexDirection: "row",
    gap: 8,
  },
  nextButton: {
    width: 112,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  nextButtonDisabled: {
    opacity: 0.42,
  },
  nextButtonText: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "800",
  },
  selectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 17,
    backgroundColor: colors.text,
  },
  selectButtonText: {
    color: colors.card,
    fontSize: 11,
    fontWeight: "900",
  },
  quickLinks: {
    minHeight: 42,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  quickLink: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickLinkDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
  },
  quickLinkText: {
    color: colors.subText,
    fontSize: 10,
    fontWeight: "700",
  },
});
