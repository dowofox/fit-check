import { deleteAnalysis, getAnalysisHistory } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function formatDate(createdAt?: string) {
  if (!createdAt) {
    return "날짜 없음";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [sortType, setSortType] = useState<"recent" | "score">("recent");

  const loadHistory = useCallback(async () => {
    const data = await getAnalysisHistory();
    setHistory(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const sortedHistory = useMemo(() => {
    if (sortType === "score") {
      return [...history].sort((a, b) => Number(b.score) - Number(a.score));
    }

    return history;
  }, [history, sortType]);

  const handleDelete = (id: string) => {
    Alert.alert(
      "기록 삭제",
      "이 코디 기록을 삭제할까요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            const updatedHistory = await deleteAnalysis(id);
            setHistory(updatedHistory);
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroArea}>
        <View style={styles.heroTextArea}>
          <View style={styles.heroAccentLine} />
          <Text style={styles.heroBadge}>ARCHIVE</Text>
          <Text style={styles.heroTitle}>내 코디 기록</Text>
          <Text style={styles.heroDescription}>
            지금까지 분석한 코디를{"\n"}한눈에 확인해보세요.
          </Text>
        </View>

        <View style={styles.heroObject}>
          <Text style={styles.heroObjectIcon}>♢</Text>
          <Text style={styles.heroObjectText}>NAES</Text>
          <Text style={styles.heroObjectSubText}>ARCHIVE</Text>
        </View>

        <Text style={styles.heroGhostText}>NAES</Text>
        <Text style={styles.heroStar}>✦</Text>
      </View>

      <View style={styles.listPanel}>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterButton, sortType === "recent" && styles.activeFilterButton]}
            onPress={() => setSortType("recent")}
          >
            <Text style={[styles.filterText, sortType === "recent" && styles.activeFilterText]}>
              최근 순
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterButton, sortType === "score" && styles.activeFilterButton]}
            onPress={() => setSortType("score")}
          >
            <Text style={[styles.filterText, sortType === "score" && styles.activeFilterText]}>
              높은 점수순
            </Text>
          </Pressable>

          <View style={styles.filterIconButton}>
            <Text style={styles.filterIconText}>☰</Text>
          </View>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>◇</Text>
            <Text style={styles.emptyTitle}>기록이 없어요</Text>
            <Text style={styles.emptyText}>
              분석한 코디가 여기에 표시됩니다.
            </Text>
          </View>
        ) : (
          sortedHistory.map((item) => (
            <Pressable
              key={item.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/result",
                  params: item,
                })
              }
            >
              <Image source={{ uri: item.imageUri }} style={styles.image} />

              <View style={styles.info}>
                <Text style={styles.date}>▣ {formatDate(item.createdAt)}</Text>

                <View style={styles.scoreRow}>
                  <Text style={styles.score}>{item.score}</Text>
                  <Text style={styles.scoreUnit}>점</Text>
                </View>

                <View style={styles.riskPill}>
                  <View style={styles.riskDot} />
                  <Text style={styles.risk}>실패 위험 {item.riskLevel}</Text>
                </View>

                <Text style={styles.summary} numberOfLines={2}>
                  {item.summary}
                </Text>
              </View>

              <Pressable
                style={styles.deleteButton}
                onPress={(event) => {
                  event.stopPropagation();
                  handleDelete(item.id);
                }}
              >
                <Text style={styles.deleteIcon}>⌫</Text>
                <Text style={styles.deleteButtonText}>삭제</Text>
              </Pressable>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f2ee",
    paddingTop: 42,
    paddingHorizontal: 0,
    paddingBottom: 44,
  },
  heroArea: {
    minHeight: 230,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    position: "relative",
    overflow: "hidden",
  },
  heroTextArea: {
    zIndex: 2,
  },
  heroAccentLine: {
    position: "absolute",
    left: -10,
    top: 6,
    width: 1,
    height: 136,
    backgroundColor: "#b99862",
  },
  heroBadge: {
    color: "#9b7a4b",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 8,
    marginBottom: 18,
  },
  heroTitle: {
    color: "#111",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 20,
  },
  heroDescription: {
    color: "#5f5a55",
    fontSize: 17,
    lineHeight: 28,
    fontWeight: "700",
  },
  heroObject: {
    position: "absolute",
    right: 22,
    top: 78,
    width: 118,
    height: 148,
    borderTopLeftRadius: 56,
    borderTopRightRadius: 56,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#9b7a4b",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  heroObjectIcon: {
    color: "#caa46a",
    fontSize: 24,
    marginBottom: 8,
  },
  heroObjectText: {
    color: "#caa46a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroObjectSubText: {
    color: "#caa46a",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 6,
  },
  heroGhostText: {
    position: "absolute",
    right: 12,
    top: 20,
    color: "#e9e3dc",
    fontSize: 58,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroStar: {
    position: "absolute",
    right: 22,
    top: 38,
    color: "#111",
    fontSize: 22,
  },
  listPanel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    minHeight: 540,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f6f3ef",
    borderRadius: 999,
    padding: 6,
    marginBottom: 18,
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  activeFilterButton: {
    backgroundColor: "#111",
  },
  filterText: {
    color: "#777",
    fontSize: 14,
    fontWeight: "900",
  },
  activeFilterText: {
    color: "#fff",
  },
  filterIconButton: {
    marginLeft: "auto",
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterIconText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 34,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  emptyIcon: {
    fontSize: 38,
    color: "#cbb89c",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
    lineHeight: 21,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  image: {
    width: 96,
    height: 126,
    borderRadius: 18,
    backgroundColor: "#ddd",
  },
  info: {
    flex: 1,
  },
  date: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8c8c8c",
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  score: {
    fontSize: 34,
    fontWeight: "900",
    color: "#111",
    letterSpacing: -1,
  },
  scoreUnit: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111",
    marginBottom: 5,
    marginLeft: 3,
  },
  riskPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#edf6df",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 5,
  },
  riskDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#84cc16",
    marginRight: 6,
  },
  risk: {
    fontSize: 12,
    fontWeight: "900",
    color: "#333",
  },
  summary: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
    marginTop: 9,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIcon: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 1,
  },
  deleteButtonText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "900",
  },
});
