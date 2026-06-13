import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import { getOutfitRecommendationResult, OutfitRecommendation } from "@/utils/outfitRecommend";
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
  const hasDetails = recommendation.reasons.length > 2 || recommendation.warnings.length > 0;

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
            {recommendation.grade} 등급 · {getCategorySummary(recommendation.items)}
          </Text>
        </View>

        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{recommendation.score}</Text>
          <Text style={styles.scoreUnit}>점</Text>
        </View>
      </View>

      <View style={styles.itemGrid}>
        {recommendation.items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.itemCard}
            onPress={() => router.push({
              pathname: "/clothes-detail",
              params: { id: item.id },
            })}
          >
            <Image source={{ uri: getItemImageUri(item) }} style={styles.itemImage} />
            <Text style={styles.itemName} numberOfLines={1}>
              {getItemName(item)}
            </Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.category}{item.color ? ` · ${item.color}` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {previewReasons.length > 0 ? (
        <View style={styles.reasonSummaryBox}>
          <View style={styles.noteHeader}>
            <Feather name="check-circle" size={16} color={colors.text} />
            <Text style={styles.noteTitle}>왜 좋은 코디인가요?</Text>
          </View>
          {previewReasons.map((reason) => (
            <Text key={reason} style={styles.noteText}>- {reason}</Text>
          ))}
        </View>
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

        <View style={styles.addonCard}>
          <Feather name="circle" size={15} color={colors.point} />
          <Text style={styles.addonLabel}>
            {recommendation.sockRecommendation.required ? "추천 양말" : "양말"}
          </Text>
          <Text style={styles.addonTitle} numberOfLines={1}>
            {recommendation.sockRecommendation.required
              ? `${recommendation.sockRecommendation.color} ${recommendation.sockRecommendation.type}`
              : "양말 없음"}
          </Text>
          <Text style={styles.addonText} numberOfLines={2}>
            {recommendation.sockRecommendation.required
              ? recommendation.sockRecommendation.reason
              : "착용하지 않아도 자연스러운 코디입니다."}
          </Text>
        </View>
      </View>

      {hasDetails ? (
        <Pressable
          style={styles.detailToggle}
          onPress={() => setIsDetailOpen((current) => !current)}
        >
          <Text style={styles.detailToggleText}>
            {isDetailOpen ? "자세히 닫기" : "자세히 보기"}
          </Text>
          <Feather
            name={isDetailOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.point}
          />
        </Pressable>
      ) : null}

      {isDetailOpen ? (
        <View style={styles.detailArea}>
          <View style={styles.breakdownBox}>
            <Text style={styles.breakdownText}>
              스타일 {recommendation.breakdown.style} · 색상 {recommendation.breakdown.color} · 핏 {recommendation.breakdown.fit} · 완성도 {recommendation.breakdown.optional}
            </Text>
            <Text style={styles.breakdownDescription}>
              완성도 = 아우터, 액세서리 등 코디 마무리 요소 평가
            </Text>
            {recommendation.penalty ? (
              <Text style={styles.penaltyText}>경고 감점 -{recommendation.penalty}</Text>
            ) : null}
          </View>

          {recommendation.reasons.length > 0 && (
            <View style={styles.noteBox}>
              <View style={styles.noteHeader}>
                <Feather name="check-circle" size={16} color={colors.text} />
                <Text style={styles.noteTitle}>전체 추천 이유</Text>
              </View>
              {recommendation.reasons.map((reason) => (
                <Text key={reason} style={styles.noteText}>- {reason}</Text>
              ))}
            </View>
          )}

          {recommendation.warnings.length > 0 && (
            <View style={styles.warningBox}>
              <View style={styles.noteHeader}>
                <Feather name="alert-circle" size={16} color={colors.point} />
                <Text style={styles.noteTitle}>주의사항</Text>
              </View>
              {recommendation.warnings.map((warning) => (
                <Text key={warning} style={styles.noteText}>- {warning}</Text>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {recommendation.alternativeCount ? (
        <Pressable
          style={styles.alternativeBox}
          onPress={() => setIsAlternativeOpen((current) => !current)}
        >
          <Feather name="shuffle" size={15} color={colors.point} />
          <Text style={styles.alternativeText}>
            다른 버전 {recommendation.alternativeCount}개
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
                  {alternative.grade} 등급 · {alternative.score}점
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
                {alternative.items.map((item) => (
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
                    />
                    <Text style={styles.alternativeItemName} numberOfLines={1}>
                      {getItemName(item)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {alternative.reasons[0] && (
                <Text style={styles.alternativeReason} numberOfLines={2}>
                  {alternative.reasons[0]}
                </Text>
              )}

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
        <Text style={styles.saveOutfitButtonText}>코디 저장</Text>
      </Pressable>
    </View>
  );
}

export default function OutfitRecommendScreen() {
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
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

    await saveOutfit({
      id: Date.now().toString(),
      name: getDefaultOutfitName(savedAt),
      memo: "",
      itemIds,
      score: recommendation.score,
      grade: recommendation.grade,
      reasons: recommendation.reasons,
      warnings: recommendation.warnings,
      createdAt: savedAt.toISOString(),
    });

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
            <Feather name="chevron-left" size={22} color={colors.text} />
          </Pressable>

          <View>
            <Text style={styles.headerEyebrow}>AI CLOSET</Text>
            <Text style={styles.headerTitle}>코디 추천</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <Pressable
          style={styles.savedOutfitsButton}
          onPress={() => router.push("/saved-outfits")}
        >
          <Feather name="bookmark" size={18} color={colors.text} />
          <Text style={styles.savedOutfitsButtonText}>저장한 코디 보기</Text>
        </Pressable>

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
      </ScrollView>
      <BottomNav activeTab="outfit" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingTop: 34,
    paddingHorizontal: 20,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerEyebrow: {
    color: colors.point,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textAlign: "center",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
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
    padding: 15,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  cardHeaderTextArea: {
    flex: 1,
  },
  cardEyebrow: {
    color: colors.point,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
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
    fontSize: 11,
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
    minWidth: 58,
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: colors.card,
    fontSize: 19,
    fontWeight: "900",
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
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  itemCard: {
    width: "48%",
  },
  itemImage: {
    width: "100%",
    height: 150,
    borderRadius: 18,
    backgroundColor: colors.inactiveTab,
    marginBottom: 8,
  },
  itemName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  itemMeta: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  alternativeBox: {
    backgroundColor: colors.softCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
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
    backgroundColor: colors.softCard,
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
    fontSize: 16,
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
    width: 72,
  },
  alternativeItemImage: {
    width: 72,
    height: 88,
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
    backgroundColor: colors.softCard,
    borderRadius: 18,
    padding: 13,
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
    minHeight: 126,
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
    lineHeight: 18,
    fontWeight: "600",
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
    backgroundColor: colors.text,
    borderRadius: 18,
    paddingVertical: 14,
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
});
