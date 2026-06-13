import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import { deleteAnalysis, getAnalysisHistory } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function formatDate(createdAt?: string) {
  if (!createdAt) return "날짜 없음";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "날짜 없음";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function getRiskStyle(riskLevel?: string) {
  const risk = String(riskLevel ?? "");
  if (risk.includes("낮음")) return { backgroundColor: "#edf6df", dotColor: "#84cc16", textColor: "#3f6212" };
  if (risk.includes("높음")) return { backgroundColor: "#fee2e2", dotColor: "#ef4444", textColor: "#991b1b" };
  return { backgroundColor: "#fff3d6", dotColor: "#f59e0b", textColor: "#92400e" };
}

function getScoreColor(score?: number | string) {
  const numericScore = Number(score);
  if (numericScore >= 90) return "#b88932";
  if (numericScore >= 80) return "#111";
  if (numericScore >= 70) return "#2b2b2b";
  return "#dc2626";
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const [sortType, setSortType] = useState<"recent" | "score">("recent");
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const data = await getAnalysisHistory();
    setHistory(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      setOpenedMenuId(null);
    }, [loadHistory])
  );

  const sortedHistory = useMemo(() => {
    if (sortType === "score") return [...history].sort((a, b) => Number(b.score) - Number(a.score));
    return history;
  }, [history, sortType]);

  const totalCount = history.length;
  const highestScore = totalCount > 0 ? Math.max(...history.map((item) => Number(item.score))) : 0;
  const averageScore = totalCount > 0 ? Math.round(history.reduce((sum, item) => sum + Number(item.score), 0) / totalCount) : 0;

  const handleDelete = (id: string) => {
    Alert.alert("기록 삭제", "이 코디 기록을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const updatedHistory = await deleteAnalysis(id);
          setHistory(updatedHistory);
          setOpenedMenuId(null);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroArea}>
          <View style={styles.heroTextArea}>
            <View style={styles.heroAccentLine} />
            <Text style={styles.heroBadge}>ARCHIVE</Text>
            <Text style={styles.heroTitle}>내 코디 기록</Text>
            <Text style={styles.heroDescription}>지금까지 분석한 코디를{"\n"}한눈에 확인해보세요.</Text>
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
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalCount}</Text>
              <Text style={styles.statLabel}>분석</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{highestScore}</Text>
              <Text style={styles.statLabel}>최고</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{averageScore}</Text>
              <Text style={styles.statLabel}>평균</Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterButton, sortType === "recent" && styles.activeFilterButton]}
              onPress={() => {
                setSortType("recent");
                setOpenedMenuId(null);
              }}
            >
              <Text style={[styles.filterText, sortType === "recent" && styles.activeFilterText]}>최근 순</Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, sortType === "score" && styles.activeFilterButton]}
              onPress={() => {
                setSortType("score");
                setOpenedMenuId(null);
              }}
            >
              <Text style={[styles.filterText, sortType === "score" && styles.activeFilterText]}>높은 점수순</Text>
            </Pressable>
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>◇</Text>
              <Text style={styles.emptyTitle}>기록이 없어요</Text>
              <Text style={styles.emptyText}>분석한 코디가 여기에 표시됩니다.</Text>
            </View>
          ) : (
            sortedHistory.map((item) => {
              const riskStyle = getRiskStyle(item.riskLevel);
              const scoreColor = getScoreColor(item.score);
              const isMenuOpen = openedMenuId === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={styles.card}
                  onPress={() => {
                    if (isMenuOpen) {
                      setOpenedMenuId(null);
                      return;
                    }
                    router.push({ pathname: "/result", params: item });
                  }}
                >
                  <Image source={{ uri: item.imageUri }} style={styles.image} />
                  <View style={styles.info}>
                    <Text style={styles.date}>□ {formatDate(item.createdAt)}</Text>
                    <View style={styles.scoreRow}>
                      <Text style={[styles.score, { color: scoreColor }]}>{item.score}</Text>
                      <Text style={[styles.scoreUnit, { color: scoreColor }]}>점</Text>
                    </View>
                    <View style={[styles.riskPill, { backgroundColor: riskStyle.backgroundColor }]}> 
                      <View style={[styles.riskDot, { backgroundColor: riskStyle.dotColor }]} />
                      <Text style={[styles.risk, { color: riskStyle.textColor }]}>실패 위험 {item.riskLevel}</Text>
                    </View>
                    <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
                  </View>
                  <View style={styles.actionArea}>
                    {isMenuOpen && (
                      <Pressable
                        style={styles.deleteAction}
                        onPress={(event) => {
                          event.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        <Text style={styles.deleteActionText}>삭제</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.menuButton, isMenuOpen && styles.activeMenuButton]}
                      onPress={(event) => {
                        event.stopPropagation();
                        setOpenedMenuId(isMenuOpen ? null : item.id);
                      }}
                    >
                      <Text style={styles.menuButtonText}>•••</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
      <BottomNav activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  container: { backgroundColor: "#f5f2ee", paddingTop: 28, paddingHorizontal: 0, paddingBottom: BOTTOM_NAV_CONTENT_PADDING },
  heroArea: { minHeight: 198, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 18, position: "relative", overflow: "hidden" },
  heroTextArea: { zIndex: 2 },
  heroAccentLine: { position: "absolute", left: -9, top: 2, width: 1, height: 112, backgroundColor: "#b99862" },
  heroBadge: { color: "#9b7a4b", fontSize: 13, fontWeight: "800", letterSpacing: 8, marginBottom: 10 },
  heroTitle: { color: "#111", fontSize: 38, fontWeight: "900", letterSpacing: -2, marginBottom: 10 },
  heroDescription: { color: "#5f5a55", fontSize: 17, lineHeight: 27, fontWeight: "700" },
  heroObject: { position: "absolute", right: 30, top: 64, width: 98, height: 124, borderTopLeftRadius: 48, borderTopRightRadius: 48, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, backgroundColor: "#111", borderWidth: 1, borderColor: "#9b7a4b", alignItems: "center", justifyContent: "center", zIndex: 1 },
  heroObjectIcon: { color: "#caa46a", fontSize: 21, marginBottom: 7 },
  heroObjectText: { color: "#caa46a", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  heroObjectSubText: { color: "#caa46a", fontSize: 8, fontWeight: "800", letterSpacing: 2, marginTop: 5 },
  heroGhostText: { position: "absolute", right: 18, top: 10, color: "#ede8e1", fontSize: 54, fontWeight: "900", letterSpacing: 2 },
  heroStar: { position: "absolute", right: 24, top: 30, color: "#111", fontSize: 19 },
  listPanel: { backgroundColor: "#fff", borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 24, minHeight: 540 },
  statsCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#faf8f5", borderRadius: 24, paddingVertical: 14, marginBottom: 14, borderWidth: 1, borderColor: "#f0eee9" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 23, fontWeight: "900", color: "#111" },
  statLabel: { marginTop: 3, fontSize: 12, fontWeight: "900", color: "#8c8175" },
  statDivider: { width: 1, height: 28, backgroundColor: "#e7e1d8" },
  filterRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#f6f3ef", borderRadius: 999, padding: 5, marginBottom: 18 },
  filterButton: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999 },
  activeFilterButton: { backgroundColor: "#111" },
  filterText: { color: "#777", fontSize: 14, fontWeight: "900" },
  activeFilterText: { color: "#fff" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 34, alignItems: "center", borderWidth: 1, borderColor: "#f0eee9" },
  emptyIcon: { fontSize: 38, color: "#cbb89c", marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#111", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#777", lineHeight: 21, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 12, marginBottom: 18, flexDirection: "row", gap: 14, alignItems: "center", borderWidth: 1, borderColor: "#f0eee9", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3 },
  image: { width: 96, height: 126, borderRadius: 18, backgroundColor: "#ddd" },
  info: { flex: 1 },
  date: { fontSize: 12, fontWeight: "900", color: "#8c8c8c", marginBottom: 4 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end" },
  score: { fontSize: 34, fontWeight: "900", letterSpacing: -1 },
  scoreUnit: { fontSize: 17, fontWeight: "900", marginBottom: 5, marginLeft: 3 },
  riskPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginTop: 5 },
  riskDot: { width: 7, height: 7, borderRadius: 999, marginRight: 6 },
  risk: { fontSize: 12, fontWeight: "900" },
  summary: { fontSize: 14, color: "#555", lineHeight: 21, marginTop: 9, fontWeight: "600" },
  actionArea: { width: 58, alignItems: "flex-end", gap: 8 },
  menuButton: { backgroundColor: "#faf8f5", width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ebe3d8" },
  activeMenuButton: { backgroundColor: "#111", borderColor: "#111" },
  menuButtonText: { color: "#8c8175", fontSize: 18, fontWeight: "900", lineHeight: 18, marginTop: -5 },
  deleteAction: { backgroundColor: "#fee2e2", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#ffd7d7" },
  deleteActionText: { color: "#dc2626", fontSize: 12, fontWeight: "900" },
});
