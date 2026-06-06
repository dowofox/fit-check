import { getAnalysisHistory } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        const data = await getAnalysisHistory();
        setHistory(data);
      };

      loadHistory();
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>내 코디 기록</Text>

      {history.map((item) => (
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
            <Text style={styles.score}>{item.score}점</Text>
            <Text style={styles.risk}>실패 위험 {item.riskLevel}</Text>
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          </View>
        </Pressable>
      ))}
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
});