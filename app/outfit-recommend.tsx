import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import ClosetItemImage from "@/components/ClosetItemImage";
import {
  getOutfitDisplayReasons,
  getOutfitRecommendationResult,
  OutfitRecommendation,
  OutfitRecommendationResult,
  OutfitRecommendationWeather,
} from "@/utils/outfitRecommend";
import { openProductSearch } from "@/utils/productSearch";
import {
  getRecommendedShoppingItems,
  RecommendedShoppingItem,
} from "@/utils/shoppingRecommend";
import {
  getSavedOutfitItemIds,
  toRecommendationInputItems,
} from "@/utils/recommendationInput";
import {
  ClosetItem,
  getClosetItems,
  getSavedOutfits,
  getUserProfile,
  saveOutfit,
} from "@/utils/storage";
import { colors } from "@/utils/theme";
import {
  getCachedWeatherForRecommendation,
  getCurrentWeatherForRecommendation,
} from "@/utils/weather";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const DEFAULT_EMPTY_MESSAGE = {
  title: "추천 가능한 조합이 부족해요",
  text: "상의와 하의를 등록하면 코디를 추천할 수 있어요.",
};

const SAVED_ONLY_EMPTY_MESSAGE = {
  title: "새로운 추천 조합이 없어요",
  text: "추천 가능한 조합을 이미 저장했어요. 옷을 더 추가하면 새로운 코디를 만들 수 있어요.",
};

const BELOW_QUALITY_EMPTY_MESSAGE = {
  title: "추천할 만한 조합이 아직 부족해요",
  text: "현재 옷으로는 충분히 잘 맞는 조합을 찾지 못했어요. 다른 색상이나 실루엣의 옷을 추가해보세요.",
};

const SHOES_GUIDE_TEXT = "신발을 등록하면 완성도 높은 코디를 추천할 수 있어요.";

const SITUATION_OPTIONS = [
  { id: "all", label: "전체", keywords: [] },
  {
    id: "date",
    label: "데이트",
    keywords: ["데이트", "깔끔", "미니멀", "댄디", "포멀", "러블리", "페미닌", "로퍼", "니트", "셔츠"],
    reason: "데이트 상황에 어울리도록 깔끔하고 부드러운 인상의 아이템을 우선했어요.",
  },
  {
    id: "clean",
    label: "깔끔한",
    keywords: ["깔끔", "미니멀", "포멀", "댄디", "모던", "클래식", "셔츠", "슬랙스", "로퍼", "더비"],
    reason: "깔끔한 상황에 맞게 단정한 소재와 미니멀한 조합을 우선했어요.",
  },
  {
    id: "daily",
    label: "데일리",
    keywords: ["데일리", "캐주얼", "편안", "청바지", "데님", "스니커즈", "티셔츠"],
    reason: "데일리로 입기 좋은 편안한 카테고리와 무난한 조합을 우선했어요.",
  },
  {
    id: "relaxed",
    label: "편안한",
    keywords: ["편안", "캐주얼", "후드", "맨투맨", "와이드", "조거", "스니커즈"],
    reason: "편안한 상황에 맞게 여유로운 실루엣과 캐주얼한 아이템을 우선했어요.",
  },
] as const;
type SituationId = (typeof SITUATION_OPTIONS)[number]["id"];

function getItemName(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function getRecommendationSearchText(recommendation: OutfitRecommendation) {
  return [
    recommendation.title,
    ...recommendation.tags,
    ...recommendation.reasons,
    ...recommendation.items.flatMap((item) => [
      item.category,
      item.subCategory,
      item.detailCategory,
      item.style,
      ...(item.styleTags || []),
      item.material,
      item.color,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getRecommendationGrade(score: number): OutfitRecommendation["grade"] {
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function getSituationMatchScore(
  recommendation: OutfitRecommendation,
  keywords: readonly string[]
) {
  const searchText = getRecommendationSearchText(recommendation);

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    const matches = searchText.split(normalizedKeyword).length - 1;

    return score + matches;
  }, 0);
}

function applySituationRecommendationScoring(
  recommendations: OutfitRecommendation[],
  situationId: SituationId
) {
  const situation = SITUATION_OPTIONS.find((option) => option.id === situationId);
  if (!situation || situation.id === "all") return recommendations;

  const scoredRecommendations: (OutfitRecommendation & { situationMatchScore: number })[] = [];

  recommendations.forEach((recommendation) => {
    const situationMatchScore = getSituationMatchScore(recommendation, situation.keywords);
    if (situationMatchScore <= 0) return;

    const adjustedScore = Math.min(100, recommendation.score + Math.min(10, situationMatchScore * 2));
    const situationReason = situation.reason;
    const reasons = recommendation.reasons.includes(situationReason)
      ? recommendation.reasons
      : [situationReason, ...recommendation.reasons];
    const alternatives = (recommendation.alternatives || [])
      .map((alternative) => {
        const alternativeMatchScore = getSituationMatchScore(
          alternative,
          situation.keywords
        );
        if (alternativeMatchScore <= 0) return null;

        const alternativeScore = Math.min(
          100,
          alternative.score + Math.min(10, alternativeMatchScore * 2)
        );

        return {
          ...alternative,
          score: alternativeScore,
          grade: getRecommendationGrade(alternativeScore),
          tags: Array.from(new Set([situation.label, ...alternative.tags])).slice(0, 3),
        };
      })
      .filter((alternative): alternative is OutfitRecommendation => Boolean(alternative));

    scoredRecommendations.push({
      ...recommendation,
      score: adjustedScore,
      grade: getRecommendationGrade(adjustedScore),
      reasons,
      tags: Array.from(new Set([situation.label, ...recommendation.tags])).slice(0, 3),
      alternatives,
      alternativeCount: alternatives.length,
      situationMatchScore,
    });
  });

  return scoredRecommendations
    .sort((first, second) =>
      second.situationMatchScore - first.situationMatchScore ||
      second.score - first.score
    )
    .map(({ situationMatchScore, ...recommendation }) => recommendation);
}

function getSortedItemIds(items: ClosetItem[]) {
  return items.map((item) => item.id).sort();
}

function parseParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumberParam(value?: string | string[]) {
  const parsed = Number(parseParamValue(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseSelectedItemIds(value?: string | string[]) {
  return (parseParamValue(value) || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function getWeatherFromParams(params: {
  weatherTemperature?: string | string[];
  weatherCondition?: string | string[];
  weatherRainChance?: string | string[];
}): OutfitRecommendationWeather | null {
  const temperature = parseNumberParam(params.weatherTemperature);
  const rainChance = parseNumberParam(params.weatherRainChance);
  const condition = parseParamValue(params.weatherCondition);

  if (temperature === undefined && rainChance === undefined && !condition) return null;

  return {
    temperature,
    condition: condition || undefined,
    rainChance,
  };
}

async function getWeatherForRecommendation(
  paramsWeather: OutfitRecommendationWeather | null
) {
  if (paramsWeather && typeof paramsWeather.temperature === "number") return paramsWeather;

  const cachedWeather = await getCachedWeatherForRecommendation();
  if (cachedWeather) return cachedWeather;

  return getCurrentWeatherForRecommendation();
}

function isSameItemCombination(firstItemIds: string[], secondItemIds: string[]) {
  const firstSortedIds = [...firstItemIds].sort();
  const secondSortedIds = [...secondItemIds].sort();

  return (
    firstSortedIds.length === secondSortedIds.length &&
    firstSortedIds.every((id, index) => id === secondSortedIds[index])
  );
}

function getCategoryCount(items: ClosetItem[], category: string) {
  return items.filter((item) => item.category === category).length;
}

function getMissingCoreCategoryText(missingCategories?: string[]) {
  if (!missingCategories?.length) return DEFAULT_EMPTY_MESSAGE.text;

  return `${missingCategories.join(", ")}를 추가해주세요. 상의와 하의가 있어야 코디를 추천할 수 있어요.`;
}

function getEmptyMessage(
  result: OutfitRecommendationResult,
  items: ClosetItem[]
) {
  if (result.emptyReason === "missing_core_category") {
    return {
      title: "추천에 필요한 옷이 부족해요",
      text: getMissingCoreCategoryText(result.missingCategories),
    };
  }

  if (result.emptyReason === "below_quality_threshold") {
    const hasShoes = getCategoryCount(items, "신발") > 0;

    return {
      ...BELOW_QUALITY_EMPTY_MESSAGE,
      text: hasShoes
        ? `${BELOW_QUALITY_EMPTY_MESSAGE.text} 더 자연스럽게 맞는 아이템을 추가하면 추천이 좋아져요.`
        : `${BELOW_QUALITY_EMPTY_MESSAGE.text} ${SHOES_GUIDE_TEXT}`,
    };
  }

  if (result.emptyReason === "saved_combinations_exhausted") {
    return SAVED_ONLY_EMPTY_MESSAGE;
  }

  return DEFAULT_EMPTY_MESSAGE;
}

function isRecommendationSameAsSelected(
  recommendation: OutfitRecommendation,
  selectedItemIds: string[]
) {
  if (selectedItemIds.length === 0) return false;
  return isSameItemCombination(getSortedItemIds(recommendation.items), selectedItemIds);
}

function isSavedSelectedCombination(savedOutfitItemIds: string[][], selectedItemIds: string[]) {
  return savedOutfitItemIds.some((itemIds) => isSameItemCombination(itemIds, selectedItemIds));
}

function moveSelectedRecommendationFirst(
  recommendations: OutfitRecommendation[],
  selectedItemIds: string[]
) {
  if (selectedItemIds.length === 0) return recommendations;

  const selectedIndex = recommendations.findIndex((recommendation) =>
    isRecommendationSameAsSelected(recommendation, selectedItemIds)
  );

  if (selectedIndex <= 0) return recommendations;

  const selectedRecommendation = recommendations[selectedIndex];
  return [
    selectedRecommendation,
    ...recommendations.slice(0, selectedIndex),
    ...recommendations.slice(selectedIndex + 1),
  ];
}

function getDefaultOutfitName(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `코디 ${year}.${month}.${day}`;
}

function getCategorySummary(items: ClosetItem[]) {
  const order = ["상의", "하의", "신발", "아우터", "액세서리"];

  return order
    .map((category) => {
      const count = items.filter((item) => item.category === category).length;
      return count > 0 ? `${category} ${count}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function getDisplayItems(items: ClosetItem[], limit?: number) {
  const order = ["상의", "하의", "신발", "아우터", "액세서리"];
  const sortedItems = [...items].sort((firstItem, secondItem) => {
    const firstIndex = order.indexOf(firstItem.category);
    const secondIndex = order.indexOf(secondItem.category);
    const firstOrder = firstIndex === -1 ? order.length : firstIndex;
    const secondOrder = secondIndex === -1 ? order.length : secondIndex;

    return firstOrder - secondOrder;
  });

  return typeof limit === "number" ? sortedItems.slice(0, limit) : sortedItems;
}

function RecommendationCard({
  recommendation,
  index,
  onSave,
}: {
  recommendation: OutfitRecommendation;
  index: number;
  onSave: (recommendation: OutfitRecommendation) => void;
}) {
  const [isAlternativeOpen, setIsAlternativeOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const alternatives = recommendation.alternatives || [];
  const displayReasons = getOutfitDisplayReasons(recommendation.reasons, 3);
  const previewReasons = displayReasons.slice(0, 2);
  const sockRecommendation = recommendation.sockRecommendation;

  return (
    <View style={styles.recommendCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderTextArea}>
          <Text style={styles.cardEyebrow}>OUTFIT {index + 1}</Text>
          <Text style={styles.cardTitle}>{recommendation.title}</Text>
          <View style={styles.recommendationTagRow}>
            {recommendation.tags.slice(0, 3).map((tag) => (
              <Text key={tag} style={styles.recommendationTagText}>#{tag}</Text>
            ))}
          </View>
          <Text style={styles.categorySummary}>
            {getCategorySummary(recommendation.items)}
          </Text>
        </View>

      </View>

      <View style={styles.itemShowcase}>
        <View style={styles.itemGrid}>
          {getDisplayItems(recommendation.items).map((item) => (
            <Pressable
              key={item.id}
              style={styles.itemCard}
              onPress={() => router.push({
                pathname: "/clothes-detail",
                params: { id: item.id },
              })}
            >
              <ClosetItemImage
                item={item}
                style={styles.itemImage}
                contentFit="contain"
              />
              <Text style={styles.itemName} numberOfLines={1}>
                {getItemName(item)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {previewReasons.length > 0 ? (
        <Pressable
          style={styles.reasonSummaryBox}
          onPress={() => setIsDetailOpen((current) => !current)}
        >
          <View style={styles.noteHeader}>
            <Feather name="check-circle" size={16} color={colors.text} />
            <Text style={styles.noteTitle}>추천 이유</Text>
            <Feather
              name={isDetailOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.point}
              style={styles.noteHeaderIcon}
            />
          </View>
          {(isDetailOpen ? displayReasons : previewReasons).map((reason) => (
            <Text key={reason} style={styles.noteText}>- {reason}</Text>
          ))}

          {isDetailOpen && recommendation.warnings.length > 0 ? (
            <View style={styles.inlineWarningArea}>
              <Text style={styles.inlineWarningTitle}>주의사항</Text>
              {recommendation.warnings.map((warning) => (
                <Text key={warning} style={styles.noteText}>- {warning}</Text>
              ))}
            </View>
          ) : null}

        </Pressable>
      ) : null}

      <View style={styles.addonRow}>
        {recommendation.recommendedShoes ? (
          <View style={styles.addonCard}>
            <Feather name="navigation" size={15} color={colors.point} />
            <Text style={styles.addonLabel}>추천 신발</Text>
            <Text style={styles.addonTitle} numberOfLines={1}>
              {recommendation.recommendedShoes.type}
            </Text>
            <Text style={styles.addonText} numberOfLines={2}>
              {recommendation.recommendedShoes.reason}
            </Text>
          </View>
        ) : null}

        {sockRecommendation ? (
        <View style={styles.addonCard}>
          <Feather name="circle" size={15} color={colors.point} />
          <Text style={styles.addonLabel}>
            {sockRecommendation.required ? "추천 양말" : "양말"}
          </Text>
          <Text style={styles.addonTitle} numberOfLines={1}>
            {sockRecommendation.required
              ? `${sockRecommendation.color} ${sockRecommendation.type}`
              : "양말 없음"}
          </Text>
          <Text style={styles.addonText} numberOfLines={2}>
            {sockRecommendation.required
              ? sockRecommendation.reason
              : "착용하지 않아도 자연스러운 코디입니다."}
          </Text>
        </View>
        ) : null}
      </View>

      {recommendation.alternativeCount ? (
        <Pressable
          style={styles.alternativeBox}
          onPress={() => setIsAlternativeOpen((current) => !current)}
        >
          <Feather name="shuffle" size={15} color={colors.point} />
          <Text style={styles.alternativeText}>
            다른 버전 {recommendation.alternativeCount}개 보기
          </Text>
          <Feather
            name={isAlternativeOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.point}
          />
        </Pressable>
      ) : null}

      {isAlternativeOpen && alternatives.length > 0 && (
        <View style={styles.alternativeList}>
          {alternatives.map((alternative, alternativeIndex) => (
            <View key={alternative.id} style={styles.alternativeCard}>
              <View style={styles.alternativeHeader}>
                <Text style={styles.alternativeEyebrow}>VERSION {alternativeIndex + 1}</Text>
                <Text style={styles.alternativeTitle}>
                  {alternative.title}
                </Text>
                <Text style={styles.alternativeSummary}>
                  {getCategorySummary(alternative.items)}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.alternativeItemList}
              >
                {getDisplayItems(alternative.items).map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.alternativeItemCard}
                    onPress={() => router.push({
                      pathname: "/clothes-detail",
                      params: { id: item.id },
                    })}
                  >
                    <ClosetItemImage
                      item={item}
                      style={styles.alternativeItemImage}
                      contentFit="contain"
                    />
                    <Text style={styles.alternativeItemName} numberOfLines={1}>
                      {getItemName(item)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                style={styles.alternativeSaveButton}
                onPress={() => onSave(alternative)}
              >
                <Feather name="bookmark" size={15} color={colors.card} />
                <Text style={styles.alternativeSaveButtonText}>이 버전 저장</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={styles.saveOutfitButton}
        onPress={() => onSave(recommendation)}
      >
        <Feather name="bookmark" size={17} color={colors.card} />
        <Text style={styles.saveOutfitButtonText}>이 코디 저장하기</Text>
      </Pressable>
    </View>
  );
}

const SHOPPING_PRIORITY_LABELS = {
  high: "우선 추천",
  medium: "추천",
  low: "여유 있을 때",
} as const;

function ShoppingRecommendationSection({ items }: { items: RecommendedShoppingItem[] }) {
  return (
    <View style={styles.shoppingSection}>
      <View style={styles.shoppingSectionHeader}>
        <View style={styles.shoppingSectionIcon}>
          <Feather name="shopping-bag" size={17} color={colors.point} />
        </View>
        <View style={styles.shoppingSectionHeaderText}>
          <Text style={styles.shoppingSectionTitle}>지금 옷장에 부족한 아이템</Text>
          <Text style={styles.shoppingSectionDescription}>
            현재 옷장의 구성과 스타일을 기준으로 골랐어요.
          </Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.shoppingEmptyCard}>
          <Feather name="check-circle" size={19} color={colors.point} />
          <Text style={styles.shoppingEmptyText}>
            현재 옷장 균형이 좋아요. 더 많은 옷을 등록하면 추천이 정교해져요.
          </Text>
        </View>
      ) : (
        <View style={styles.shoppingList}>
          {items.map((item) => (
            <View key={item.id} style={styles.shoppingCard}>
              <View style={styles.shoppingCardHeader}>
                <View style={styles.shoppingCardTitleArea}>
                  <Text style={styles.shoppingCategory}>{item.category}</Text>
                  <Text style={styles.shoppingTitle}>{item.title}</Text>
                </View>
                <View
                  style={[
                    styles.shoppingPriorityBadge,
                    item.priority === "high" && styles.shoppingPriorityBadgeHigh,
                  ]}
                >
                  <Text
                    style={[
                      styles.shoppingPriorityText,
                      item.priority === "high" && styles.shoppingPriorityTextHigh,
                    ]}
                  >
                    {SHOPPING_PRIORITY_LABELS[item.priority]}
                  </Text>
                </View>
              </View>

              <Text style={styles.shoppingReason}>{item.reason}</Text>

              <View style={styles.shoppingSearchRow}>
                <Pressable
                  style={styles.shoppingSearchButton}
                  onPress={() => openProductSearch("musinsa", item.searchQuery)}
                >
                  <Text style={styles.shoppingSearchButtonText}>무신사에서 찾기</Text>
                </Pressable>
                <Pressable
                  style={styles.shoppingSearchButton}
                  onPress={() => openProductSearch("naver", item.searchQuery)}
                >
                  <Text style={styles.shoppingSearchButtonText}>네이버에서 찾기</Text>
                </Pressable>
                <Pressable
                  style={styles.shoppingSearchButton}
                  onPress={() => openProductSearch("google", item.searchQuery)}
                >
                  <Text style={styles.shoppingSearchButtonText}>구글에서 찾기</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function OutfitRecommendScreen() {
  const params = useLocalSearchParams<{
    source?: string;
    selectedItemIds?: string;
    weatherTemperature?: string;
    weatherCondition?: string;
    weatherRainChance?: string;
  }>();
  const sourceParam = parseParamValue(params.source);
  const selectedItemIdsParam = parseParamValue(params.selectedItemIds);
  const weatherTemperatureParam = parseParamValue(params.weatherTemperature);
  const weatherConditionParam = parseParamValue(params.weatherCondition);
  const weatherRainChanceParam = parseParamValue(params.weatherRainChance);
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
  const [shoppingRecommendations, setShoppingRecommendations] = useState<RecommendedShoppingItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState(DEFAULT_EMPTY_MESSAGE);
  const [selectedSituation, setSelectedSituation] = useState<SituationId>("all");

  const loadRecommendations = useCallback(async () => {
    setIsLoaded(false);

    const source = sourceParam;
    const selectedItemIds = source === "home"
      ? parseSelectedItemIds(selectedItemIdsParam)
      : [];
    const paramsWeather = source === "home"
      ? getWeatherFromParams({
          weatherTemperature: weatherTemperatureParam,
          weatherCondition: weatherConditionParam,
          weatherRainChance: weatherRainChanceParam,
        })
      : null;
    const [items, profile, savedOutfits] = await Promise.all([
      getClosetItems(),
      getUserProfile(),
      getSavedOutfits(),
    ]);
    const recommendationItems = toRecommendationInputItems(items);
    const savedOutfitItemIds = getSavedOutfitItemIds(savedOutfits);
    const weather = await getWeatherForRecommendation(paramsWeather);
    const recommendationResult = getOutfitRecommendationResult(
      recommendationItems,
      profile,
      undefined,
      savedOutfitItemIds,
      weather ? { weather } : undefined
    );
    let nextRecommendations = moveSelectedRecommendationFirst(
      recommendationResult.recommendations,
      selectedItemIds
    );

    if (
      source === "home" &&
      selectedItemIds.length > 0 &&
      !nextRecommendations.some((recommendation) =>
        isRecommendationSameAsSelected(recommendation, selectedItemIds)
      ) &&
      !isSavedSelectedCombination(savedOutfitItemIds, selectedItemIds)
    ) {
      const allRecommendationResult = getOutfitRecommendationResult(
        recommendationItems,
        profile,
        undefined,
        [],
        weather ? { weather } : undefined
      );
      const selectedRecommendation = allRecommendationResult.recommendations.find(
        (recommendation) => isRecommendationSameAsSelected(recommendation, selectedItemIds)
      );

      if (selectedRecommendation) {
        nextRecommendations = [selectedRecommendation, ...nextRecommendations];
      }
    }

    const situationRecommendations = applySituationRecommendationScoring(
      nextRecommendations,
      selectedSituation
    );

    setRecommendations(situationRecommendations);
    setShoppingRecommendations(getRecommendedShoppingItems(items));
    setEmptyMessage(
      nextRecommendations.length > 0 && situationRecommendations.length === 0
        ? {
            title: "상황에 맞는 추천이 아직 부족해요",
            text: "현재 옷장에서는 선택한 상황에 자연스럽게 맞는 코디를 찾지 못했어요. 다른 스타일의 옷을 추가해보세요.",
          }
        : getEmptyMessage(recommendationResult, items)
    );
    setIsLoaded(true);
  }, [
    selectedItemIdsParam,
    selectedSituation,
    sourceParam,
    weatherConditionParam,
    weatherRainChanceParam,
    weatherTemperatureParam,
  ]);

  async function handleSaveOutfit(recommendation: OutfitRecommendation) {
    const itemIds = getSortedItemIds(recommendation.items);
    const savedOutfits = await getSavedOutfits();
    const isDuplicate = savedOutfits.some((outfit) =>
      isSameItemCombination(outfit.itemIds, itemIds)
    );

    if (isDuplicate) {
      Alert.alert("이미 저장된 코디예요", "같은 아이템 조합이 이미 저장되어 있어요.");
      return;
    }

    const savedAt = new Date();

    const updatedOutfits = await saveOutfit({
      id: Date.now().toString(),
      name: getDefaultOutfitName(savedAt),
      memo: "",
      itemIds,
      score: recommendation.score,
      grade: recommendation.grade,
      reasons: recommendation.reasons,
      warnings: recommendation.warnings,
      createdAt: savedAt.toISOString(),
    }, true);

    if (updatedOutfits.length === 0) {
      Alert.alert("저장 실패", "코디를 저장하지 못했어요. 다시 시도해주세요.");
      return;
    }

    await loadRecommendations();

    Alert.alert("저장 완료", "추천 코디를 저장했어요.");
  }

  useFocusEffect(
    useCallback(() => {
      loadRecommendations();
    }, [loadRecommendations])
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={20} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle}>코디 추천</Text>

          <Pressable
            style={styles.savedIconButton}
            onPress={() => router.push("/saved-outfits")}
          >
            <Feather name="bookmark" size={17} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.situationFilterRow}
        >
          {SITUATION_OPTIONS.map((option) => {
            const isActive = selectedSituation === option.id;

            return (
              <Pressable
                key={option.id}
                style={[styles.situationChip, isActive && styles.situationChipActive]}
                onPress={() => setSelectedSituation(option.id)}
              >
                <Text
                  style={[
                    styles.situationChipText,
                    isActive && styles.situationChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoaded && recommendations.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="layers" size={26} color={colors.point} />
            </View>
            <Text style={styles.emptyTitle}>{emptyMessage.title}</Text>
            <Text style={styles.emptyText}>{emptyMessage.text}</Text>
            <Pressable
              style={styles.emptyActionButton}
              onPress={() => router.push("/add-clothes")}
            >
              <Feather name="plus" size={16} color={colors.card} />
              <Text style={styles.emptyActionButtonText}>옷 추가하기</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listArea}>
            {recommendations.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                index={index}
                onSave={handleSaveOutfit}
              />
            ))}
          </View>
        )}

        {isLoaded ? <ShoppingRecommendationSection items={shoppingRecommendations} /> : null}
      </ScrollView>
      <BottomNav activeTab="outfit" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  savedIconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  situationFilterRow: {
    gap: 8,
    paddingRight: 14,
    marginBottom: 14,
  },
  situationChip: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  situationChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  situationChipText: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "800",
  },
  situationChipTextActive: {
    color: colors.card,
  },
  listArea: {
    gap: 14,
  },
  savedOutfitsButton: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  savedOutfitsButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  recommendCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  cardHeaderTextArea: {
    flex: 1,
  },
  cardEyebrow: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  recommendationTagRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  recommendationTagText: {
    backgroundColor: colors.softCard,
    color: colors.point,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categorySummary: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  breakdownBox: {
    backgroundColor: colors.softCard,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 12,
  },
  breakdownText: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 17,
  },
  breakdownDescription: {
    color: colors.subText,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 15,
    marginTop: 3,
  },
  penaltyText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },
  itemShowcase: {
    backgroundColor: colors.softCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  itemCard: {
    width: "31%",
    minWidth: 86,
  },
  itemImage: {
    width: "100%",
    height: 112,
    borderRadius: 16,
    backgroundColor: colors.card,
    marginBottom: 7,
  },
  itemName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },
  itemMeta: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  alternativeBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
    marginTop: 2,
  },
  alternativeText: {
    flex: 1,
    color: colors.subText,
    fontSize: 13,
    fontWeight: "900",
  },
  alternativeList: {
    gap: 10,
    marginBottom: 10,
  },
  alternativeCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  alternativeHeader: {
    marginBottom: 10,
  },
  alternativeEyebrow: {
    color: colors.point,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  alternativeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  alternativeSummary: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  alternativeItemList: {
    gap: 8,
    paddingRight: 14,
    marginBottom: 10,
  },
  alternativeItemCard: {
    width: 76,
  },
  alternativeItemImage: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: colors.inactiveTab,
    marginBottom: 6,
  },
  alternativeItemName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },
  alternativeReason: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  alternativeSaveButton: {
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  alternativeSaveButtonText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "900",
  },
  noteBox: {
    backgroundColor: colors.softCard,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  reasonSummaryBox: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: colors.softCard,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  addonRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  addonCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 112,
  },
  addonLabel: {
    color: colors.point,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 5,
  },
  addonTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 5,
  },
  addonText: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  noteHeaderIcon: {
    marginLeft: "auto",
  },
  inlineWarningArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 10,
    paddingTop: 10,
  },
  inlineWarningTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },
  compactBreakdownBox: {
    backgroundColor: colors.softCard,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  detailToggle: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailToggleText: {
    color: colors.point,
    fontSize: 13,
    fontWeight: "900",
  },
  detailArea: {
    marginBottom: 2,
  },
  recommendedShoeBox: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  recommendedShoeName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 5,
  },
  recommendedShoeReason: {
    color: colors.subText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  recommendedShoeHint: {
    color: colors.point,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 7,
  },
  sockBox: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  sockName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 5,
  },
  sockReason: {
    color: colors.subText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  saveOutfitButton: {
    backgroundColor: colors.point,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  saveOutfitButtonText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: "900",
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  noteText: {
    color: colors.subText,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: colors.softCard,
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: colors.subText,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyActionButton: {
    marginTop: 18,
    backgroundColor: colors.point,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  emptyActionButtonText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: "800",
  },
  shoppingSection: {
    marginTop: 22,
  },
  shoppingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  shoppingSectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  shoppingSectionHeaderText: {
    flex: 1,
  },
  shoppingSectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 3,
  },
  shoppingSectionDescription: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  shoppingList: {
    gap: 10,
  },
  shoppingCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  shoppingCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 9,
  },
  shoppingCardTitleArea: {
    flex: 1,
  },
  shoppingCategory: {
    color: colors.point,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  shoppingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  shoppingPriorityBadge: {
    backgroundColor: colors.softCard,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  shoppingPriorityBadgeHigh: {
    backgroundColor: "#F7EBDD",
  },
  shoppingPriorityText: {
    color: colors.point,
    fontSize: 10,
    fontWeight: "800",
  },
  shoppingPriorityTextHigh: {
    color: colors.warning,
  },
  shoppingReason: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    marginBottom: 12,
  },
  shoppingSearchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  shoppingSearchButton: {
    flexGrow: 1,
    minWidth: 92,
    backgroundColor: colors.softCard,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  shoppingSearchButtonText: {
    color: colors.point,
    fontSize: 10,
    fontWeight: "800",
  },
  shoppingEmptyCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shoppingEmptyText: {
    flex: 1,
    color: colors.subText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
});
