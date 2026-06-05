import { useLocalSearchParams } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ResultScreen() {
  const {
    imageUri,
    score,
    riskLevel,
    point,
    problems,
    improvement,
    summary,
  } = useLocalSearchParams();

  const riskText = String(riskLevel ?? "-");

  const riskIcon =
    riskText.includes("낮음") ? "🟢" :
    riskText.includes("보통") ? "🟡" :
    riskText.includes("높음") ? "🔴" :
    "⚪";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.mainCard}>
        <View style={styles.topRow}>
          {imageUri && (
            <Image source={{ uri: imageUri as string }} style={styles.image} />
          )}

          <View style={styles.scoreArea}>
            <Text style={styles.label}>NAES SCORE</Text>
            <Text style={styles.score}>{score ?? "-"}점</Text>

            <View style={styles.riskPill}>
              <Text style={styles.riskText}>{riskIcon} {riskText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.summaryLabel}>총평</Text>
        <Text style={styles.summary}>{summary}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>코디 포인트</Text>
        <Text style={styles.cardText}>{point}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>문제점</Text>
        <Text style={styles.cardText}>{problems}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>개선 팁</Text>
        <Text style={styles.cardText}>{improvement}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f4f4f5",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  mainCard: {
    backgroundColor: "#111",
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  image: {
    width: 118,
    height: 154,
    borderRadius: 22,
    backgroundColor: "#333",
  },
  scoreArea: {
    flex: 1,
  },
  label: {
    color: "#a3e635",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  score: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "900",
    marginBottom: 10,
  },
  riskPill: {
    alignSelf: "flex-start",
    backgroundColor: "#27272a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  riskText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: "#2f2f32",
    marginVertical: 18,
  },
  summaryLabel: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  summary: {
    color: "#f4f4f5",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 23,
  },
});