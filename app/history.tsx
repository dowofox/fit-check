import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import { deleteAnalysis, getAnalysisHistory } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
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

function getCreatedAtTime(createdAt?: string) {
  if (!createdAt) return 0;
  const time = new Date(createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
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
    return [...history].sort((a, b) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt));
  }, [history]);

  const totalCount = history.length;

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
            <View style={styles.statsIconCircle}>
              <Feather name="archive" size={20} color="#8C6F47" />
            </View>
            <View style={styles.statsCopy}>
              <Text style={styles.statValue}>{totalCount}개의 코디 분석</Text>
              <Text style={styles.statLabel}>최근 기록부터 변화를 살펴보세요.</Text>
            </View>
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>◇</Text>
              <Text style={styles.emptyTitle}>기록이 없어요</Text>
              <Text style={styles.emptyText}>분석한 코디가 여기에 표시됩니다.</Text>
            </View>
          ) : (
            sortedHistory.map((item) => {
              const isMenuOpen = openedMenuId === item.id;
              const summary = String(item.summary || "코디 요약을 불러오지 못했어요.");
              const improvement = String(item.improvement || item.problems || "다음 분석에서 개선점을 확인해보세요.");
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
                    <View style={styles.dateRow}>
                      <Feather name="clock" size={12} color="#8c8c8c" />
                      <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.summary} numberOfLines={3}>{summary}</Text>
                    <View style={styles.improvementBox}>
                      <Text style={styles.improvementLabel}>다음에 바꿔볼 점</Text>
                      <Text style={styles.improvementText} numberOfLines={2}>{improvement}</Text>
                    </View>
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
  statsCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#faf8f5", borderRadius: 24, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: "#f0eee9" },
  statsIconCircle: { width: 42, height: 42, borderRadius: 999, backgroundColor: "#F4EEE7", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statsCopy: { flex: 1, minWidth: 0 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#111" },
  statLabel: { marginTop: 3, fontSize: 12, lineHeight: 18, fontWeight: "600", color: "#8c8175" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 34, alignItems: "center", borderWidth: 1, borderColor: "#f0eee9" },
  emptyIcon: { fontSize: 38, color: "#cbb89c", marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#111", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#777", lineHeight: 21, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 12, marginBottom: 16, flexDirection: "row", gap: 14, alignItems: "flex-start", borderWidth: 1, borderColor: "#f0eee9", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.035, shadowRadius: 12, elevation: 2 },
  image: { width: 96, height: 132, borderRadius: 18, backgroundColor: "#ddd" },
  info: { flex: 1, minWidth: 0, paddingVertical: 3 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  date: { fontSize: 12, fontWeight: "700", color: "#8c8c8c" },
  summary: { fontSize: 15, color: "#222", lineHeight: 22, fontWeight: "700" },
  improvementBox: { backgroundColor: "#F4EEE7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginTop: 9 },
  improvementLabel: { color: "#8C6F47", fontSize: 10, fontWeight: "800", marginBottom: 3 },
  improvementText: { color: "#5f5a55", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  actionArea: { width: 42, alignItems: "flex-end", gap: 8 },
  menuButton: { backgroundColor: "#faf8f5", width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ebe3d8" },
  activeMenuButton: { backgroundColor: "#111", borderColor: "#111" },
  menuButtonText: { color: "#8c8175", fontSize: 18, fontWeight: "900", lineHeight: 18, marginTop: -5 },
  deleteAction: { backgroundColor: "#fee2e2", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#ffd7d7" },
  deleteActionText: { color: "#dc2626", fontSize: 12, fontWeight: "900" },
});
