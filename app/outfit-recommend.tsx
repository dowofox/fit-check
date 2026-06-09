import { getOutfitRecommendations, OutfitRecommendation } from "@/utils/outfitRecommend";
import { ClosetItem, getClosetItems, getUserProfile } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function getItemName(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function RecommendationCard({
  recommendation,
  index,
}: {
  recommendation: OutfitRecommendation;
  index: number;
}) {
  return (
    <View style={styles.recommendCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardEyebrow}>OUTFIT {index + 1}</Text>
          <Text style={styles.cardTitle}>{recommendation.grade} 등급</Text>
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
          <View key={item.id} style={styles.itemCard}>
            <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
            <Text style={styles.itemName} numberOfLines={1}>
              {getItemName(item)}
            </Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.category}{item.color ? ` · ${item.color}` : ""}
            </Text>
          </View>
        ))}
      </ScrollView>

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
    </View>
  );
}

export default function OutfitRecommendScreen() {
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadRecommendations() {
        const [items, profile] = await Promise.all([
          getClosetItems(),
          getUserProfile(),
        ]);

        setRecommendations(getOutfitRecommendations(items, profile));
        setIsLoaded(true);
      }

      loadRecommendations();
    }, [])
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

        {isLoaded && recommendations.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="layers" size={26} color="#8c6f47" />
            </View>
            <Text style={styles.emptyTitle}>추천 가능한 조합이 부족해요</Text>
            <Text style={styles.emptyText}>
              상의, 하의, 신발을 저장했는지 확인해주세요. 현재 계절과 맞지 않는 옷은 추천 후보에서 제외됩니다.
            </Text>
          </View>
        ) : (
          <View style={styles.listArea}>
            {recommendations.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                index={index}
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
