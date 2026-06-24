import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import { getOutfitRecommendationResult, OutfitRecommendation } from "@/utils/outfitRecommend";
import { openProductSearch } from "@/utils/productSearch";
import {
  getRecommendedShoppingItems,
  RecommendedShoppingItem,
} from "@/utils/shoppingRecommend";
import {
  ClosetItem,
  getClosetItems,
  getSavedOutfits,
  getUserProfile,
  saveOutfit,
} from "@/utils/storage";
import { colors } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const DEFAULT_EMPTY_MESSAGE = {
  title: "추천 가능한 조합이 부족해요",
  text: "상의, 하의, 신발을 저장했는지 확인해주세요. 현재 계절과 맞지 않는 옷은 추천 후보에서 제외됩니다.",
};

const SAVED_ONLY_EMPTY_MESSAGE = {
  title: "새로운 추천 조합이 없어요",
  text: "저장한 코디와 겹치지 않는 조합을 만들려면 옷을 더 추가해보세요.",
};

const GRADE_LABELS: Record<OutfitRecommendation["grade"], string> = {
  S: "완성도 높은 추천",
  A: "좋은 추천",
  B: "무난한 추천",
  C: "참고용",
  D: "비추천",
};

function getItemName(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function getItemImageUri(item: ClosetItem) {
  return item.cleanImageUri || item.imageUri;
}

function getSortedItemIds(items: ClosetItem[]) {
  return items.map((item) => item.id).sort();
}

function isSameItemCombination(firstItemIds: string[], secondItemIds: string[]) {
  const firstSortedIds = [...firstItemIds].sort();
  const secondSortedIds = [...secondItemIds].sort();

  return (
    firstSortedIds.length === secondSortedIds.length &&
    firstSortedIds.every((id, index) => id === secondSortedIds[index])
  );
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
  const previewReasons = recommendation.reasons.slice(0, 2);
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

        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{recommendation.grade} {recommendation.score}점</Text>
          <Text style={styles.scoreGradeLabel}>{GRADE_LABELS[recommendation.grade]}</Text>
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
              <Image
                source={{ uri: getItemImageUri(item) }}
                style={styles.itemImage}
                resizeMode="contain"
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
          {(isDetailOpen ? recommendation.reasons : previewReasons).map((reason) => (
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

          {isDetailOpen ? (
            <View style={styles.compactBreakdownBox}>
              <Text style={styles.breakdownText}>
                실루엣 {recommendation.breakdown.silhouette} · 실착 핏 {recommendation.breakdown.wearFit} · 포인트 {recommendation.breakdown.pointBalance} · 색상 {recommendation.breakdown.colorSupport} · 스타일 {recommendation.breakdown.styleSupport} · 계절/날씨 {recommendation.breakdown.weather} · 회전율 {recommendation.breakdown.rotation}
              </Text>
              {recommendation.penalty ? (
                <Text style={styles.penaltyText}>경고 감점 -{recommendation.penalty}</Text>
              ) : null}
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
                  {alternative.grade} · {GRADE_LABELS[alternative.grade]} · {alternative.score}점
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
                {getDisplayItems(alternative.items, 3).map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.alternativeItemCard}
                    onPress={() => router.push({
                      pathname: "/clothes-detail",
                      params: { id: item.id },
                    })}
                  >
                    <Image
                      source={{ uri: getItemImageUri(item) }}
                      style={styles.alternativeItemImage}
                      resizeMode="contain"
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
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
  const [shoppingRecommendations, setShoppingRecommendations] = useState<RecommendedShoppingItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState(DEFAULT_EMPTY_MESSAGE);

  const loadRecommendations = useCallback(async () => {
    setIsLoaded(false);

    const [items, profile, savedOutfits] = await Promise.all([
      getClosetItems(),
      getUserProfile(),
      getSavedOutfits(),
    ]);
    const savedOutfitItemIds = savedOutfits.map((outfit) => outfit.itemIds);
    const recommendationResult = getOutfitRecommendationResult(
      items,
      profile,
      undefined,
      savedOutfitItemIds
    );

    setRecommendations(recommendationResult.recommendations);
    setShoppingRecommendations(getRecommendedShoppingItems(items));
    setEmptyMessage(
      recommendationResult.hasAnyRecommendation && recommendationResult.recommendations.length === 0
        ? SAVED_ONLY_EMPTY_MESSAGE
        : DEFAULT_EMPTY_MESSAGE
    );
    setIsLoaded(true);
  }, []);

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

        {isLoaded && recommendations.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="layers" size={26} color={colors.point} />
            </View>
            <Text style={styles.emptyTitle}>{emptyMessage.title}</Text>
            <Text style={styles.emptyText}>{emptyMessage.text}</Text>
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
  scoreBadge: {
    minWidth: 88,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  scoreText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  scoreGradeLabel: {
    color: colors.subText,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },
  scoreUnit: {
    color: colors.inactiveTab,
    fontSize: 10,
    fontWeight: "900",
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
    paddingRight: 2,
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
