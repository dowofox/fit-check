import { getOutfitRecommendations, OutfitRecommendation } from "@/utils/outfitRecommend";
import {
  ClosetItem,
  getClosetItems,
  getSavedOutfits,
  getUserProfile,
  saveOutfit,
} from "@/utils/storage";
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
  return (
    <View style={styles.recommendCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardEyebrow}>OUTFIT {index + 1}</Text>
          <Text style={styles.cardTitle}>{recommendation.grade} 등급</Text>
          <Text style={styles.categorySummary}>
            {getCategorySummary(recommendation.items)}
          </Text>
        </View>

        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{recommendation.score}</Text>
          <Text style={styles.scoreUnit}>점</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.itemList}
      >
        {recommendation.items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.itemCard}
            onPress={() => router.push({
              pathname: "/clothes-detail",
              params: { id: item.id },
            })}
          >
            <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
            <Text style={styles.itemName} numberOfLines={1}>
              {getItemName(item)}
            </Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.category}{item.color ? ` · ${item.color}` : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {recommendation.alternativeCount ? (
        <View style={styles.alternativeBox}>
          <Feather name="shuffle" size={15} color="#8c6f47" />
          <Text style={styles.alternativeText}>
            이 코디의 다른 버전 {recommendation.alternativeCount}개가 있어요
          </Text>
        </View>
      ) : null}

      {recommendation.reasons.length > 0 && (
        <View style={styles.noteBox}>
          <View style={styles.noteHeader}>
            <Feather name="check-circle" size={16} color="#111" />
            <Text style={styles.noteTitle}>추천 이유</Text>
          </View>
          {recommendation.reasons.map((reason) => (
            <Text key={reason} style={styles.noteText}>- {reason}</Text>
          ))}
        </View>
      )}

      {recommendation.warnings.length > 0 && (
        <View style={styles.warningBox}>
          <View style={styles.noteHeader}>
            <Feather name="alert-circle" size={16} color="#8c6f47" />
            <Text style={styles.noteTitle}>주의사항</Text>
          </View>
          {recommendation.warnings.map((warning) => (
            <Text key={warning} style={styles.noteText}>- {warning}</Text>
          ))}
        </View>
      )}

      <Pressable
        style={styles.saveOutfitButton}
        onPress={() => onSave(recommendation)}
      >
        <Feather name="bookmark" size={17} color="#fff" />
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
    const allRecommendations = getOutfitRecommendations(items, profile);
    const newRecommendations = getOutfitRecommendations(
      items,
      profile,
      undefined,
      savedOutfitItemIds
    );

    setRecommendations(newRecommendations);
    setEmptyMessage(
      allRecommendations.length > 0 && newRecommendations.length === 0
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
            <Feather name="chevron-left" size={22} color="#111" />
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
          <Feather name="bookmark" size={18} color="#111" />
          <Text style={styles.savedOutfitsButtonText}>저장한 코디 보기</Text>
        </Pressable>

        {isLoaded && recommendations.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="layers" size={26} color="#8c6f47" />
            </View>
            <Text style={styles.emptyTitle}>{emptyMessage.title}</Text>
            <Text style={styles.emptyText}>
              {emptyMessage.text}
            </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  container: {
    flexGrow: 1,
    paddingTop: 34,
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerEyebrow: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textAlign: "center",
  },
  headerTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },
  listArea: {
    gap: 14,
  },
  savedOutfitsButton: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  savedOutfitsButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },
  recommendCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eee7dd",
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardEyebrow: {
    color: "#9b7a4b",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardTitle: {
    color: "#111",
    fontSize: 21,
    fontWeight: "900",
  },
  categorySummary: {
    color: "#6b6258",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  scoreBadge: {
    minWidth: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  scoreUnit: {
    color: "#d8d2ca",
    fontSize: 10,
    fontWeight: "900",
  },
  itemList: {
    gap: 10,
    paddingRight: 2,
    marginBottom: 14,
  },
  itemCard: {
    width: 104,
  },
  itemImage: {
    width: 104,
    height: 128,
    borderRadius: 18,
    backgroundColor: "#ddd",
    marginBottom: 8,
  },
  itemName: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },
  itemMeta: {
    color: "#777",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  alternativeBox: {
    backgroundColor: "#f8f1e8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadcc9",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  alternativeText: {
    color: "#6b6258",
    fontSize: 13,
    fontWeight: "900",
  },
  noteBox: {
    backgroundColor: "#faf8f5",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: "#f8f1e8",
    borderRadius: 18,
    padding: 13,
  },
  saveOutfitButton: {
    backgroundColor: "#111",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  saveOutfitButtonText: {
    color: "#fff",
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
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },
  noteText: {
    color: "#625a51",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  emptyIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    borderWidth: 1,
    borderColor: "#e6d9cb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: "#6b6258",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
});
