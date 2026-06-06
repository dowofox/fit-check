import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

function getRiskStyle(riskLevel?: string) {
  const risk = String(riskLevel ?? "");

  if (risk.includes("낮음")) {
    return { backgroundColor: "#edf6df", dotColor: "#84cc16", textColor: "#3f6212" };
  }

  if (risk.includes("높음")) {
    return { backgroundColor: "#fee2e2", dotColor: "#ef4444", textColor: "#991b1b" };
  }

  return { backgroundColor: "#fff3d6", dotColor: "#f59e0b", textColor: "#92400e" };
}

function getScoreMessage(score?: string | string[]) {
  const numericScore = Number(score ?? 0);

  if (numericScore >= 90) return "완성도 높은 스타일이에요.";
  if (numericScore >= 80) return "안정적으로 좋은 코디예요.";
  if (numericScore >= 70) return "무난하지만 조금 더 다듬으면 좋아요.";
  if (numericScore >= 60) return "개선하면 훨씬 좋아질 수 있어요.";
  return "전체적인 정리가 필요한 코디예요.";
}

function getStars(score?: string | string[]) {
  const numericScore = Number(score ?? 0);
  const filledCount = Math.max(0, Math.min(5, Math.round(numericScore / 20)));

  return "★".repeat(filledCount) + "☆".repeat(5 - filledCount);
}

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

  const scoreText = String(score ?? "-");
  const riskText = String(riskLevel ?? "-");
  const summaryText = String(summary ?? "분석 결과를 불러오지 못했어요.");
  const pointText = String(point ?? "코디 포인트를 불러오지 못했어요.");
  const problemsText = String(problems ?? "문제점을 불러오지 못했어요.");
  const improvementText = String(improvement ?? "개선 팁을 불러오지 못했어요.");
  const riskStyle = getRiskStyle(riskText);

  const handleShare = async () => {
    await Share.share({
      message: `NAES 스타일 분석 결과\n\nSTYLE SCORE ${scoreText}점\n실패 위험 ${riskText}\n\n${summaryText}`,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color="#111" />
        </Pressable>

        <View>
          <Text style={styles.headerEyebrow}>ANALYSIS COMPLETE</Text>
          <Text style={styles.headerTitle}>분석 결과</Text>
        </View>

        <Pressable style={styles.shareIconButton} onPress={handleShare}>
          <Feather name="share-2" size={18} color="#111" />
        </Pressable>
      </View>

      <View style={styles.scoreCard}>
        <View style={styles.scoreCardTop}>
          <View>
            <Text style={styles.scoreLabel}>STYLE SCORE</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.score}>{scoreText}</Text>
              <Text style={styles.scoreUnit}>점</Text>
            </View>
            <Text style={styles.stars}>{getStars(score as string)}</Text>
          </View>

          {imageUri && (
            <Image source={{ uri: imageUri as string }} style={styles.image} />
          )}
        </View>

        <View style={styles.scoreDivider} />

        <Text style={styles.scoreMessage}>{getScoreMessage(score as string)}</Text>
      </View>

      <View style={styles.riskCard}>
        <View>
          <Text style={styles.sectionEyebrow}>RISK CHECK</Text>
          <Text style={styles.riskTitle}>실패 위험</Text>
        </View>

        <View style={[styles.riskPill, { backgroundColor: riskStyle.backgroundColor }]}>
          <View style={[styles.riskDot, { backgroundColor: riskStyle.dotColor }]} />
          <Text style={[styles.riskText, { color: riskStyle.textColor }]}>{riskText}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionEyebrow}>AI REVIEW</Text>
        <Text style={styles.cardTitle}>AI 총평</Text>
        <Text style={styles.summaryText}>{summaryText}</Text>
      </View>

      <View style={styles.detailCard}>
        <View style={styles.detailHeaderRow}>
          <View style={styles.detailIconCircle}>
            <Feather name="check" size={17} color="#111" />
          </View>
          <Text style={styles.cardTitle}>코디 포인트</Text>
        </View>
        <Text style={styles.cardText}>{pointText}</Text>
      </View>

      <View style={styles.detailCard}>
        <View style={styles.detailHeaderRow}>
          <View style={styles.detailIconCircle}>
            <Feather name="alert-circle" size={17} color="#111" />
          </View>
          <Text style={styles.cardTitle}>아쉬운 점</Text>
        </View>
        <Text style={styles.cardText}>{problemsText}</Text>
      </View>

      <View style={styles.detailCard}>
        <View style={styles.detailHeaderRow}>
          <View style={styles.detailIconCircle}>
            <Feather name="trending-up" size={17} color="#111" />
          </View>
          <Text style={styles.cardTitle}>개선 팁</Text>
        </View>
        <Text style={styles.cardText}>{improvementText}</Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={styles.primaryButton} onPress={handleShare}>
          <Feather name="share-2" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>공유하기</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/")}>
          <Text style={styles.secondaryButtonText}>다시 분석</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f2ee",
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 44,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#eee7dd",
  },
  shareIconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#eee7dd",
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
  scoreCard: {
    backgroundColor: "#111",
    borderRadius: 30,
    padding: 22,
    marginBottom: 14,
    overflow: "hidden",
  },
  scoreCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  scoreLabel: {
    color: "#caa46a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  score: {
    color: "#fff",
    fontSize: 66,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 72,
  },
  scoreUnit: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
    marginLeft: 4,
  },
  stars: {
    color: "#caa46a",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 6,
  },
  image: {
    width: 112,
    height: 148,
    borderRadius: 22,
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#2d2d2d",
  },
  scoreDivider: {
    height: 1,
    backgroundColor: "#2f2f32",
    marginVertical: 18,
  },
  scoreMessage: {
    color: "#efe9df",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 24,
  },
  riskCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f0eee9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  riskTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
  },
  riskPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 7,
  },
  riskText: {
    fontSize: 14,
    fontWeight: "900",
  },
  summaryCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  cardTitle: {
    color: "#111",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 9,
  },
  summaryText: {
    color: "#47413a",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 24,
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 3,
  },
  detailIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    color: "#514a43",
    fontSize: 15,
    fontWeight: "650",
    lineHeight: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    width: 110,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#eee7dd",
  },
  secondaryButtonText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
  },
});
