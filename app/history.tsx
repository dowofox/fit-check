import { deleteAnalysis, getAnalysisHistory } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
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

  const loadHistory = useCallback(async () => {
    const data = await getAnalysisHistory();
    setHistory(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

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
      <Text style={styles.title}>내 코디 기록</Text>

      {history.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🧥</Text>
          <Text style={styles.emptyTitle}>아직 저장된 기록이 없어요</Text>
          <Text style={styles.emptyText}>
            코디를 분석하면 이곳에서 전체 기록을 볼 수 있어요.
          </Text>
        </View>
      ) : (
        history.map((item) => (
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
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              <Text style={styles.score}>{item.score}점</Text>
              <Text style={styles.risk}>실패 위험 {item.riskLevel}</Text>
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
              <Text style={styles.deleteButtonText}>삭제</Text>
            </Pressable>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f4f4f5",
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111",
    marginBottom: 18,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 21,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  image: {
    width: 72,
    height: 92,
    borderRadius: 14,
    backgroundColor: "#ddd",
  },
  info: {
    flex: 1,
  },
  date: {
    fontSize: 11,
    fontWeight: "800",
    color: "#999",
    marginBottom: 3,
  },
  score: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },
  risk: {
    fontSize: 13,
    fontWeight: "800",
    color: "#666",
    marginTop: 2,
  },
  summary: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
    marginTop: 6,
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  deleteButtonText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "900",
  },
});
