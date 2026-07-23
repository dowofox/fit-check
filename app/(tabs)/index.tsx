import BagIcon from "@/assets/icons/bag.svg";
import JacketIcon from "@/assets/icons/jacket.svg";
import PantsIcon from "@/assets/icons/pants.svg";
import ShirtIcon from "@/assets/icons/shirt.svg";
import ShoeIcon from "@/assets/icons/sneakers.svg";
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
import { getOutfitRecommendationReadiness } from "@/utils/outfitRecommendationReadiness";
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

const CLOSET_CATEGORIES = [
  { label: "상의", Icon: ShirtIcon },
  { label: "하의", Icon: PantsIcon },
  { label: "신발", Icon: ShoeIcon },
  { label: "아우터", Icon: JacketIcon },
  { label: "액세서리", Icon: BagIcon },
];

function getWeatherKey(weather: OutfitRecommendationWeather) {
  return [
    weather.temperature ?? "",
    weather.condition || "",
    weather.rainChance ?? "",
  ].join("|");
}

function getCategoryCount(categoryCounts: Record<string, number>, category: string) {
  return categoryCounts[category] || 0;
}

function getCoreItems(recommendation: HomeRecommendationCardData) {
  const priority = ["아우터", "상의", "하의", "신발"];

  return priority
    .map((category) => recommendation.items.find((item) => item.category === category))
    .filter((item): item is ClosetItem => Boolean(item))
    .slice(0, 3);
}

function getItemShortLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function getRecommendationRouteParams(
  recommendation?: HomeRecommendationCardData,
  weather?: OutfitRecommendationWeather | null
) {
  return {
    source: "home",
    selectedItemIds: recommendation?.items.map((item) => item.id).join(",") || "",
    weatherTemperature:
      typeof weather?.temperature === "number" ? String(weather.temperature) : "",
    weatherCondition: weather?.condition || "",
    weatherRainChance:
      typeof weather?.rainChance === "number" ? String(weather.rainChance) : "",
  };
}

function RecommendationLookbookCard({
  recommendation,
  weather,
}: {
  recommendation: HomeRecommendationCardData;
  weather: OutfitRecommendationWeather | null;
}) {
  const coreItems = getCoreItems(recommendation);
  const top = recommendation.items.find((item) => item.category === "상의");
  const bottom = recommendation.items.find((item) => item.category === "하의");
  const shoes = recommendation.items.find((item) => item.category === "신발");
  const reasonSummary = getOutfitDisplayReasons(recommendation.reasons, 2).join(" ");

  return (
    <Pressable
      style={styles.recommendCard}
      onPress={() =>
        router.push({
          pathname: "/outfit-recommend",
          params: getRecommendationRouteParams(recommendation, weather),
        })
      }
    >
      <View style={styles.recommendVisual}>
        {coreItems.map((item) => (
          <ClosetItemImage
            key={item.id}
            item={item}
            style={styles.recommendVisualItem}
            contentFit="contain"
          />
        ))}
      </View>

      <View style={styles.recommendCopy}>
        <Text style={styles.recommendEyebrow}>오늘의 미리보기</Text>
        <Text style={styles.recommendTitle} numberOfLines={2}>
          {recommendation.title}
        </Text>

        <Text style={styles.recommendItems} numberOfLines={2}>
          {[top, bottom, shoes]
            .filter((item): item is ClosetItem => Boolean(item))
            .map(getItemShortLabel)
            .join(" + ")}
        </Text>

        {reasonSummary ? (
          <Text style={styles.recommendReason} numberOfLines={2}>
            {reasonSummary}
          </Text>
        ) : null}

        <View style={styles.recommendTagRow}>
          {recommendation.tags.slice(0, 2).map((tag) => (
            <Text key={tag} style={styles.recommendTag}>
              #{tag}
            </Text>
          ))}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.subText} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [todayRecommendations, setTodayRecommendations] = useState<
    HomeRecommendationCardData[]
  >([]);
  const [recommendationEmptyState, setRecommendationEmptyState] =
    useState<HomeRecommendationEmptyState>({});
  const [weatherLabel, setWeatherLabel] = useState<string | null>(null);
  const [currentRecommendationWeather, setCurrentRecommendationWeather] =
    useState<OutfitRecommendationWeather | null>(null);
  const [isRecommendationPreparing, setIsRecommendationPreparing] = useState(true);
  const [hasDashboardData, setHasDashboardData] = useState(false);
  const [hasDashboardLoadError, setHasDashboardLoadError] = useState(false);
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);
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
        cache: HydratedHomeRecommendationCacheEntry
      ) {
        if (!isActive) return;

        setTodayRecommendations(cache.recommendations);
        setRecommendationEmptyState(cache.emptyState);
        setWeatherLabel(cache.weatherLabel);
        setCurrentRecommendationWeather(cache.weather);
        setIsRecommendationPreparing(false);
      }

      function restoreCachedRecommendation(
        dataKey: string,
        persistentSnapshot: HomeRecommendationCacheSnapshot | null,
        items: ClosetItem[]
      ) {
        const restoreTimer = startPerformanceTimer(
          "home.cached-recommendation-restore"
        );
        const persistedWeatherResult = getHomeRecommendationCacheHydrationResult(
          persistentSnapshot?.weather,
          items,
          dataKey
        );
        const persistedInitialResult = getHomeRecommendationCacheHydrationResult(
          persistentSnapshot?.initial,
          items,
          dataKey
        );
        const persistedWeatherCache = persistedWeatherResult.cache;
        const persistedInitialCache = persistedInitialResult.cache;
        const memoryWeatherEntry = weatherRecommendationCacheRef.current;
        const memoryInitialEntry = initialRecommendationCacheRef.current;
        const memoryWeatherCache =
          isHomeRecommendationCacheKeyForRevision(
            memoryWeatherEntry?.key,
            dataKey
          ) &&
          isHomeWeatherRecommendationCacheEntryFresh(memoryWeatherEntry)
          ? memoryWeatherEntry
          : null;
        const memoryInitialCache = isHomeRecommendationCacheKeyForRevision(
          memoryInitialEntry?.key,
          dataKey
        )
          ? memoryInitialEntry
          : null;
        const weatherCache = memoryWeatherCache || persistedWeatherCache;
        const initialCache = memoryInitialCache || persistedInitialCache;

        weatherRecommendationCacheRef.current = weatherCache;
        initialRecommendationCacheRef.current = initialCache;
        persistentRecommendationCacheRef.current = {
          version: HOME_RECOMMENDATION_CACHE_VERSION,
          ...(persistedInitialCache && persistentSnapshot?.initial
            ? { initial: persistentSnapshot.initial }
            : {}),
          ...(persistedWeatherCache && persistentSnapshot?.weather
            ? { weather: persistentSnapshot.weather }
            : {}),
        };
        const cachedResult = isHomeRecommendationCacheKeyForRevision(
          weatherCache?.key,
          dataKey
        )
          ? weatherCache
          : isHomeRecommendationCacheKeyForRevision(initialCache?.key, dataKey)
            ? initialCache
            : null;
        const memoryCacheMissReason =
          (memoryWeatherEntry
            ? getHomeRecommendationCacheRevisionMismatchReason(
                memoryWeatherEntry.key,
                dataKey
              )
            : null) ||
          (memoryInitialEntry
            ? getHomeRecommendationCacheRevisionMismatchReason(
                memoryInitialEntry.key,
                dataKey
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
          applyCachedRecommendation(cachedResult);
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
        dataKey: string,
        savedOutfitItemIds: string[][],
        feedbacks: OutfitRecommendationFeedback[],
        weatherSource: "none" | "cache" | "live" = "none"
      ) {
        const kind = weather ? "weather" : "initial";
        const cacheRef = weather
          ? weatherRecommendationCacheRef
          : initialRecommendationCacheRef;
        const cacheKey = weather ? `${dataKey}|${getWeatherKey(weather)}` : dataKey;
        const cachedResult = cacheRef.current;
        const hasEquivalentWeatherCache = Boolean(
          weather &&
            cachedResult?.weather &&
            isHomeRecommendationCacheKeyForRevision(cachedResult.key, dataKey) &&
            areRecommendationWeathersEquivalent(cachedResult.weather, weather)
        );

        if (cachedResult?.key === cacheKey || hasEquivalentWeatherCache) {
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
        const recommendationResult = getOutfitRecommendationResult(
          items,
          profile,
          undefined,
          savedOutfitItemIds,
          {
            weather,
            feedbacks,
            onDiagnostics: (diagnostic) => {
              logPerformanceMetric(
                `home.recommendation.stage.${diagnostic.stage}`,
                diagnostic
              );
            },
          }
        );
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
        dataKey: string,
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
                dataKey,
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
                dataKey,
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
              dataKey,
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

          if (cachedDashboardContext) {
            const revisionTimer = startPerformanceTimer(
              "home.storage.revision-check"
            );
            const currentRevisions = await getRecommendationRevisionState();
            const canReuseDashboard = canReuseHomeDashboardData(
              cachedDashboardContext.dataKey,
              currentRevisions
            );
            endPerformanceTimer(revisionTimer, {
              cacheHit: canReuseDashboard,
              cacheMissReason: canReuseDashboard ? null : "revision_changed",
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
                  cachedDashboardContext.dataKey,
                  cachedDashboardContext.savedOutfitItemIds,
                  cachedDashboardContext.feedbacks
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
          endPerformanceTimer(keyBuildTimer, {
            serializedCharacters: dataKey.length,
            cacheHit: indexLoad.source === "cache",
            cacheMissReason: indexLoad.source === "cache" ? null : indexLoad.source,
          });

          logPerformanceMetric("home.lightweight-recommendation-data", {
            itemCount: recommendationItems.length,
            serializedCharacters: indexLoad.serializedCharacters,
            recommendationKeyCharacters: dataKey.length,
            containsProductSizeGuide: recommendationItems.some(
              (item) => Boolean(item.confirmedProduct?.productSizeGuide)
            ),
            fullClosetParsed: indexLoad.fullClosetParsed,
          });

          setClosetItems(recommendationItems);
          setCategoryCounts(indexLoad.index.categoryCounts);
          setSavedOutfits(nextSavedOutfits);
          setHasDashboardData(true);
          setHasDashboardLoadError(false);
          dashboardContextRef.current = {
            dataKey,
            items: recommendationItems,
            profile: nextProfile,
            savedOutfitItemIds,
            feedbacks,
          };
          const cacheRestoreResult = restoreCachedRecommendation(
            dataKey,
            recommendationCacheLoad.snapshot,
            recommendationItems
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
              dataKey,
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
              void startWeatherRefresh();
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

  const recommendationEmptyContent = getOutfitRecommendationEmptyContent(
    recommendationEmptyState,
    closetItems
  );
  const recommendationReadiness = useMemo(
    () => getOutfitRecommendationReadiness(closetItems),
    [closetItems]
  );
  const homeSteps = [
    {
      label: "옷 등록",
      complete: closetItems.length > 0,
    },
    {
      label: "준비 확인",
      complete: recommendationReadiness.ready,
    },
    {
      label: "코디 받기",
      complete: todayRecommendations.length > 0,
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>N</Text>
            </View>
            <Text style={styles.logoText}>NAES</Text>
          </View>
          <Pressable style={styles.profileButton} onPress={() => router.push("/profile")}>
            <Feather name="user" size={16} color={colors.point} />
          </Pressable>
        </View>

        <View style={styles.greetingArea}>
          <Text style={styles.greetingEyebrow}>TODAY · MY WARDROBE</Text>
          <Text style={styles.greeting}>오늘 무엇을{"\n"}도와드릴까요?</Text>
          <Text style={styles.greetingSub}>
            복잡한 메뉴 대신 하고 싶은 일부터 골라보세요.
          </Text>
        </View>

        {hasDashboardLoadError ? (
          <View style={styles.loadErrorCard}>
            <Feather name="alert-circle" size={17} color={colors.warning} />
            <View style={styles.loadErrorTextArea}>
              <Text style={styles.loadErrorTitle}>홈 정보를 불러오지 못했어요</Text>
              <Text style={styles.loadErrorText}>
                {hasDashboardData
                  ? "마지막으로 확인한 내용을 유지하고 있어요."
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

        <Pressable style={styles.primaryAction} onPress={() => router.push("/outfit")}>
          <View style={styles.primaryActionIcon}>
            <Feather name="sun" size={20} color={colors.card} />
          </View>
          <View style={styles.actionTextArea}>
            <Text style={styles.primaryActionEyebrow}>오늘 바로 입기</Text>
            <Text style={styles.primaryActionTitle}>내 옷으로 코디 찾기</Text>
            <Text style={styles.primaryActionText}>
              날씨와 옷장을 보고 가장 자연스러운 조합을 골라요.
            </Text>
          </View>
          <Feather name="arrow-right" size={20} color={colors.card} />
        </Pressable>

        <Pressable style={styles.secondaryAction} onPress={() => router.push("/add-clothes")}>
          <View style={styles.secondaryActionIcon}>
            <Feather name="shopping-bag" size={18} color={colors.point} />
          </View>
          <View style={styles.actionTextArea}>
            <Text style={styles.secondaryActionTitle}>새 옷이 나에게 맞을지 보기</Text>
            <Text style={styles.secondaryActionText}>
              상품 링크 하나로 실측 기반 핏을 확인해요.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.subText} />
        </Pressable>

        <View style={styles.stepSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>추천까지 3단계</Text>
            <Pressable style={styles.moreWrap} onPress={() => router.push("/closet")}>
              <Text style={styles.moreText}>옷장 보기</Text>
              <Feather name="chevron-right" size={14} color={colors.point} />
            </Pressable>
          </View>
          <View style={styles.stepRow}>
            {homeSteps.map((step, index) => (
              <View key={step.label} style={styles.stepItem}>
                <View style={[styles.stepDot, step.complete && styles.stepDotComplete]}>
                  {step.complete ? (
                    <Feather name="check" size={14} color={colors.card} />
                  ) : (
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>{step.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.closetSummary}>
          {CLOSET_CATEGORIES.slice(0, 4).map((category) => {
            const Icon = category.Icon;
            return (
              <Pressable
                key={category.label}
                style={styles.closetSummaryItem}
                onPress={() =>
                  router.push({
                    pathname: "/closet",
                    params: { category: category.label },
                  })
                }
              >
                <Icon width={18} height={18} color={colors.point} />
                <Text style={styles.closetSummaryValue}>
                  {hasDashboardLoadError && !hasDashboardData
                    ? "-"
                    : getCategoryCount(categoryCounts, category.label)}
                </Text>
                <Text style={styles.closetSummaryLabel}>{category.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>오늘의 미리보기</Text>
              {weatherLabel ? <Text style={styles.weatherBasisText}>{weatherLabel}</Text> : null}
            </View>
            {todayRecommendations.length > 0 ? (
              <Pressable
                style={styles.moreWrap}
                onPress={() =>
                  router.push({
                    pathname: "/outfit-recommend",
                    params: getRecommendationRouteParams(
                      todayRecommendations[0],
                      currentRecommendationWeather
                    ),
                  })
                }
              >
                <Text style={styles.moreText}>추천 더보기</Text>
                <Feather name="chevron-right" size={14} color={colors.point} />
              </Pressable>
            ) : null}
          </View>

          {todayRecommendations.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendCarousel}
            >
              {todayRecommendations.map((recommendation) => (
                <RecommendationLookbookCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  weather={currentRecommendationWeather}
                />
              ))}
            </ScrollView>
          ) : hasDashboardLoadError && !hasDashboardData ? (
            <View style={styles.recommendationEmptyCard}>
              <View style={styles.recommendationEmptyIcon}>
                <Feather name="refresh-cw" size={16} color={colors.point} />
              </View>
              <View style={styles.recommendationEmptyTextArea}>
                <Text style={styles.recommendationEmptyTitle}>
                  추천 정보를 다시 불러와주세요
                </Text>
                <Text style={styles.emptyText}>
                  옷장 상태를 확인한 뒤 오늘의 코디를 준비할게요.
                </Text>
              </View>
            </View>
          ) : isRecommendationPreparing ? (
            <View style={styles.recommendationEmptyCard}>
              <View style={styles.recommendationEmptyIcon}>
                <Feather name="clock" size={16} color={colors.point} />
              </View>
              <View style={styles.recommendationEmptyTextArea}>
                <Text style={styles.recommendationEmptyTitle}>
                  오늘의 코디를 준비하고 있어요
                </Text>
                <Text style={styles.emptyText}>
                  옷장 현황을 먼저 확인하면서 추천을 만들고 있어요.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.recommendationEmptyCard}>
              <View style={styles.recommendationEmptyIcon}>
                <Feather name="plus" size={16} color={colors.point} />
              </View>
              <View style={styles.recommendationEmptyTextArea}>
                <Text style={styles.recommendationEmptyTitle}>
                  {recommendationEmptyContent.title}
                </Text>
                <Text style={styles.emptyText}>{recommendationEmptyContent.text}</Text>
              </View>
              <Pressable
                style={styles.recommendationEmptyButton}
                onPress={() => router.push("/add-clothes")}
              >
                <Text style={styles.recommendationEmptyButtonText}>옷 추가하기</Text>
                <Feather name="chevron-right" size={14} color={colors.card} />
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.savedCard}>
          <View style={styles.savedTextArea}>
            <Text style={styles.savedTitle}>
              {hasDashboardLoadError && !hasDashboardData
                ? "저장한 코디를 확인하지 못했어요"
                : `저장한 코디가 ${savedOutfits.length}개 있어요`}
            </Text>
            <Text style={styles.savedDescription}>나의 다양한 스타일을 확인해보세요.</Text>
          </View>

          <Pressable style={styles.savedActionArea} onPress={() => router.push("/saved-outfits")}>
            <View style={styles.savedIconBox}>
              <Feather name="bookmark" size={17} color={colors.point} />
            </View>

            <View style={styles.savedLink}>
              <Text style={styles.savedLinkText}>바로가기</Text>
              <Feather name="chevron-right" size={14} color={colors.point} />
            </View>
          </Pressable>
        </View>

        <Pressable style={styles.analysisShortcut} onPress={startAnalysis}>
          <View style={styles.analysisShortcutIcon}>
            <Feather name="camera" size={17} color={colors.point} />
          </View>
          <View style={styles.actionTextArea}>
            <Text style={styles.analysisShortcutTitle}>사진으로 코디 분석</Text>
            <Text style={styles.analysisShortcutText}>
              지금 입은 코디가 어떤지 빠르게 확인해보세요.
            </Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.subText} />
        </Pressable>
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
    paddingTop: 24,
    paddingHorizontal: 18,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.point,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "900",
  },
  logoText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.softCard,
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
});
