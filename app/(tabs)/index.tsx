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
  OutfitRecommendation,
  OutfitRecommendationEmptyReason,
  OutfitRecommendationWeather,
} from "@/utils/outfitRecommend";
import { getOutfitRecommendationEmptyContent } from "@/utils/outfitRecommendationEmptyState";
import type { OutfitRecommendationFeedback } from "@/utils/outfitFeedback";
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
  getOutfitRecommendationFeedbacks,
  getRecommendationRevisionKey,
  getSavedOutfits,
  getUserProfile,
  SavedOutfit,
} from "@/utils/storage";
import { colors, typography } from "@/utils/theme";
import {
  formatWeatherRecommendationLabel,
  getCachedWeatherForRecommendation,
  getCurrentWeatherForRecommendation,
} from "@/utils/weather";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const CLOSET_CATEGORIES = [
  { label: "상의", Icon: ShirtIcon },
  { label: "하의", Icon: PantsIcon },
  { label: "신발", Icon: ShoeIcon },
  { label: "아우터", Icon: JacketIcon },
  { label: "액세서리", Icon: BagIcon },
];

type HomeRecommendationCache = {
  key: string;
  recommendations: OutfitRecommendation[];
  emptyState: HomeRecommendationEmptyState;
  weatherLabel: string | null;
  weather: OutfitRecommendationWeather | null;
};

type HomeRecommendationEmptyState = {
  emptyReason?: OutfitRecommendationEmptyReason;
  missingCategories?: string[];
};

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

function getCoreItems(recommendation: OutfitRecommendation) {
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
  recommendation?: OutfitRecommendation,
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
  recommendation: OutfitRecommendation;
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
      <View style={styles.lookbookImage}>
        <View style={styles.lookbookModelWrap}>
          <View style={styles.lookbookHead} />
          <View style={styles.lookbookBody} />
          <View style={styles.lookbookLegs} />
        </View>

        <View style={styles.itemPreviewRow}>
          {coreItems.map((item) => (
            <ClosetItemImage
              key={item.id}
              item={item}
              style={styles.itemPreviewImage}
              contentFit="contain"
            />
          ))}
        </View>

        <View style={styles.aiBadge}>
          <Feather name="star" size={10} color={colors.point} />
          <Text style={styles.aiBadgeText}>AI 룩북</Text>
        </View>
      </View>

      <Text style={styles.recommendTitle} numberOfLines={1}>
        {recommendation.title}
      </Text>

      <Text style={styles.recommendItems} numberOfLines={1}>
        {[top, bottom, shoes]
          .filter((item): item is ClosetItem => Boolean(item))
          .map(getItemShortLabel)
          .join(" + ")}
      </Text>

      {reasonSummary ? (
        <Text style={styles.recommendReason} numberOfLines={3}>
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
    </Pressable>
  );
}

export default function HomeScreen() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [todayRecommendations, setTodayRecommendations] = useState<OutfitRecommendation[]>([]);
  const [recommendationEmptyState, setRecommendationEmptyState] =
    useState<HomeRecommendationEmptyState>({});
  const [weatherLabel, setWeatherLabel] = useState<string | null>(null);
  const [currentRecommendationWeather, setCurrentRecommendationWeather] =
    useState<OutfitRecommendationWeather | null>(null);
  const [isRecommendationPreparing, setIsRecommendationPreparing] = useState(true);
  const initialRecommendationCacheRef = useRef<HomeRecommendationCache | null>(null);
  const weatherRecommendationCacheRef = useRef<HomeRecommendationCache | null>(null);
  const recommendationExecutionCountRef = useRef({ initial: 0, weather: 0 });

  useFocusEffect(
    useCallback(() => {
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

      function applyCachedRecommendation(cache: HomeRecommendationCache) {
        if (!isActive) return;

        setTodayRecommendations(cache.recommendations);
        setRecommendationEmptyState(cache.emptyState);
        setWeatherLabel(cache.weatherLabel);
        setCurrentRecommendationWeather(cache.weather);
        setIsRecommendationPreparing(false);
      }

      function restoreCachedRecommendation(dataKey: string) {
        const restoreTimer = startPerformanceTimer(
          "home.cached-recommendation-restore"
        );
        const weatherCache = weatherRecommendationCacheRef.current;
        const initialCache = initialRecommendationCacheRef.current;
        const cachedResult = isHomeRecommendationCacheKeyForRevision(
          weatherCache?.key,
          dataKey
        )
          ? weatherCache
          : isHomeRecommendationCacheKeyForRevision(initialCache?.key, dataKey)
            ? initialCache
            : null;
        const cacheMissReason = cachedResult
          ? null
          : weatherCache || initialCache
            ? "revision_changed"
            : "memory_cache_empty";

        if (cachedResult) {
          applyCachedRecommendation(cachedResult);
        }

        endPerformanceTimer(restoreTimer, {
          cacheHit: Boolean(cachedResult),
          cacheMissReason,
          recommendationExecutionCount:
            recommendationExecutionCountRef.current.initial +
            recommendationExecutionCountRef.current.weather,
          weatherSource: cachedResult?.weather ? "memory_weather" : "none",
        });

        return Boolean(cachedResult);
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

        if (cachedResult?.key === cacheKey) {
          logPerformanceMetric(`home.${kind}-outfit-recommendation.skipped`, {
            reason: "same input",
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
          { weather, feedbacks }
        );
        const recommendations = recommendationResult.recommendations.slice(0, 5);
        const nextWeatherLabel = formatWeatherRecommendationLabel(weather);
        const emptyState = {
          emptyReason: recommendationResult.emptyReason,
          missingCategories: recommendationResult.missingCategories,
        };

        cacheRef.current = {
          key: cacheKey,
          recommendations,
          emptyState,
          weatherLabel: nextWeatherLabel,
          weather,
        };
        endPerformanceTimer(recommendationTimer, {
          itemCount: items.length,
          recommendationCount: recommendationResult.recommendations.length,
          recommendationExecutionCount: recommendationExecutionCountRef.current[kind],
          cacheHit: false,
          cacheMissReason: "recommendation_not_cached",
          weatherSource,
        });

        if (!isActive) return true;

        setTodayRecommendations(recommendations);
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
        feedbacks: OutfitRecommendationFeedback[]
      ) {
        const weatherTimer = startPerformanceTimer("home.weather-background-refresh");
        let weatherSource = "none";
        let failed = false;

        try {
          const cachedWeatherTimer = startPerformanceTimer(
            "home.cached-weather-recommendation"
          );
          let cachedWeather: OutfitRecommendationWeather | null = null;
          let cachedWeatherApplied = false;

          try {
            cachedWeather = await getCachedWeatherForRecommendation();
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
            }
          } finally {
            endPerformanceTimer(cachedWeatherTimer, {
              weatherFound: Boolean(cachedWeather),
              recommendationExecuted: cachedWeatherApplied,
              recommendationExecutionCount:
                recommendationExecutionCountRef.current.weather,
              cacheHit: Boolean(cachedWeather) && !cachedWeatherApplied,
              cacheMissReason: cachedWeather ? null : "weather_cache_empty",
              weatherSource: "cache",
            });
          }

          const liveWeatherTimer = startPerformanceTimer("home.live-weather-recommendation");
          let currentWeather: OutfitRecommendationWeather | null = null;
          let liveWeatherApplied = false;

          try {
            currentWeather = await getCurrentWeatherForRecommendation();
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
            }
          } catch {
            currentWeather = null;
          } finally {
            endPerformanceTimer(liveWeatherTimer, {
              weatherFound: Boolean(currentWeather),
              recommendationExecuted: liveWeatherApplied,
              recommendationExecutionCount:
                recommendationExecutionCountRef.current.weather,
              cacheHit: Boolean(currentWeather) && !liveWeatherApplied,
              cacheMissReason: currentWeather ? null : "live_weather_unavailable",
              weatherSource: "live",
            });
          }
        } catch {
          failed = true;
        } finally {
          endPerformanceTimer(weatherTimer, { weatherSource, failed });
        }
      }

      async function loadDashboard() {
        try {
          const baseDataTimer = startPerformanceTimer("screen.home.base-data");
          const [indexLoad, nextSavedOutfits, nextProfile, feedbacks] = await Promise.all([
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
              const result = await getSavedOutfits();
              endPerformanceTimer(timer, {
                itemCount: result.length,
                serializedCharacters: JSON.stringify(result).length,
              });
              return result;
            })(),
            (async () => {
              const timer = startPerformanceTimer("home.storage.profile-load");
              const result = await getUserProfile();
              endPerformanceTimer(timer, {
                itemCount: result ? 1 : 0,
                serializedCharacters: JSON.stringify(result).length,
              });
              return result;
            })(),
            (async () => {
              const timer = startPerformanceTimer("home.storage.feedback-load");
              const result = await getOutfitRecommendationFeedbacks();
              endPerformanceTimer(timer, {
                itemCount: result.length,
                serializedCharacters: JSON.stringify(result).length,
              });
              return result;
            })(),
          ]);
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
          const cacheRestored = restoreCachedRecommendation(dataKey);

          if (!cacheRestored) {
            setTodayRecommendations([]);
            setWeatherLabel(null);
            setCurrentRecommendationWeather(null);
            setIsRecommendationPreparing(true);
          }

          const baseRenderDetails = {
            itemCount: recommendationItems.length,
            cacheHit: cacheRestored,
            cacheMissReason: cacheRestored ? null : "recommendation_cache_miss",
          };

          const startWeatherRefresh = () => {
            void refreshWeatherRecommendation(
              recommendationItems,
              nextProfile,
              dataKey,
              savedOutfitItemIds,
              feedbacks
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
              startWeatherRefresh();
              return;
            }

            deferredTimer = setTimeout(() => {
              if (!isActive) return;

              applyRecommendation(
                recommendationItems,
                nextProfile,
                null,
                dataKey,
                savedOutfitItemIds,
                feedbacks
              );
              endFullLoadTimers({
                initialRecommendationReady: true,
                recommendationExecutionCount:
                  recommendationExecutionCountRef.current.initial,
                cacheHit: false,
              });
              startWeatherRefresh();
            }, 0);
          });
        } catch (error) {
          if (isActive) {
            setIsRecommendationPreparing(false);
          }
          logPerformanceMetric("home.load-failed", {
            message: error instanceof Error ? error.message : String(error),
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
    }, [])
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Text style={styles.logoText}>NAES</Text>
          <Pressable style={styles.bellButton}>
            <Feather name="bell" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.greetingArea}>
          <Text style={styles.greeting}>안녕하세요, 도현님</Text>
          <Text style={styles.greetingSub}>오늘도 멋진 하루 되세요!</Text>
        </View>

        <View style={styles.heroCard}>
          <Image
            source={require("@/assets/images/hero-fashion-wide.png")}
            style={styles.heroBackground}
            resizeMode="cover"
          />

          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>나만의 AI 스타일리스트</Text>
            <Text style={styles.heroText}>오늘의 코디를 분석하고{"\n"}새로운 스타일을 제안받아보세요.</Text>

            <Pressable style={styles.heroButton} onPress={startAnalysis}>
              <Text style={styles.heroButtonText}>코디 분석하기</Text>
              <Feather name="arrow-right" size={13} color={colors.card} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>내 옷장 현황</Text>

            <Pressable onPress={() => router.push("/closet")}>
              <View style={styles.moreWrap}>
                <Text style={styles.moreText}>전체 보기</Text>
                <Feather name="chevron-right" size={14} color={colors.point} />
              </View>
            </Pressable>
          </View>

          <View style={styles.closetGrid}>
            {CLOSET_CATEGORIES.map((category) => {
              const Icon = category.Icon;

              return (
                <Pressable
                  key={category.label}
                  style={styles.countTile}
                  onPress={() => router.push({ pathname: "/closet", params: { category: category.label } })}
                >
                  <Icon width={24} height={24} color={colors.point} />
                  <Text style={styles.countLabel}>{category.label}</Text>
                  <Text style={styles.countValue}>{getCategoryCount(categoryCounts, category.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>오늘의 추천 코디</Text>
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
            <Text style={styles.savedTitle}>저장한 코디가 {savedOutfits.length}개 있어요</Text>
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
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerSide: {
    width: 32,
  },
  logoText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bellButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  greetingArea: {
    marginBottom: 14,
  },
  greeting: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  greetingSub: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
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
    paddingRight: 20,
  },
  recommendCard: {
    width: 132,
  },
  lookbookImage: {
    width: 132,
    height: 158,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  lookbookModelWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  lookbookHead: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.inactiveTab,
    marginBottom: 5,
  },
  lookbookBody: {
    width: 44,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.point,
    opacity: 0.22,
  },
  lookbookLegs: {
    width: 34,
    height: 38,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.text,
    opacity: 0.12,
    marginTop: 3,
  },
  itemPreviewRow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  itemPreviewImage: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.softCard,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  aiBadgeText: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "800",
  },
  recommendTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  recommendItems: {
    color: colors.subText,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
  },
  recommendReason: {
    minHeight: 42,
    color: colors.subText,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "600",
    marginBottom: 7,
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
});
