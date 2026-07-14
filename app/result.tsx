import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

type ParamValue = string | string[] | undefined;

type DetailScore = {
  key: string;
  title: string;
  score: number;
  comment: string;
  icon: keyof typeof Feather.glyphMap;
};

function getRiskStyle(riskLevel?: string) {
  const risk = String(riskLevel ?? "");
  if (risk.includes("낮음")) {
    return {
      backgroundColor: "#edf6df",
      dotColor: "#84cc16",
      textColor: "#3f6212",
      label: "안정적으로 입기 좋아요",
    };
  }
  if (risk.includes("높음")) {
    return {
      backgroundColor: "#fee2e2",
      dotColor: "#ef4444",
      textColor: "#991b1b",
      label: "조합을 한 번 더 살펴보세요",
    };
  }
  if (risk.includes("실패")) {
    return {
      backgroundColor: "#fee2e2",
      dotColor: "#ef4444",
      textColor: "#991b1b",
      label: "분석을 완료하지 못했어요",
    };
  }
  return {
    backgroundColor: "#fff3d6",
    dotColor: "#f59e0b",
    textColor: "#92400e",
    label: "한두 가지를 다듬으면 더 좋아요",
  };
}

function getOutcomeHeadline(score?: ParamValue) {
  const numericScore = toNumber(score);
  if (numericScore >= 90) return "완성도 높은 스타일이에요.";
  if (numericScore >= 80) return "안정적으로 좋은 코디예요.";
  if (numericScore >= 70) return "무난하지만 조금 더 다듬으면 좋아요.";
  if (numericScore >= 60) return "개선하면 훨씬 좋아질 수 있어요.";
  return "전체적인 정리가 필요한 코디예요.";
}

function toText(value: ParamValue, fallback: string) {
  if (Array.isArray(value)) return value[0] ?? fallback;
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return String(value);
}

function toNumber(value: ParamValue) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numericValue = Number(rawValue ?? 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(100, numericValue));
}

export default function ResultScreen() {
  const params = useLocalSearchParams();

  const {
    imageUri,
    score,
    riskLevel,
    point,
    problems,
    improvement,
    summary,
    fitScore,
    colorScore,
    balanceScore,
    bodyFitScore,
    itemScore,
    seasonScore,
    trendScore,
    finishScore,
    fitComment,
    colorComment,
    balanceComment,
    bodyFitComment,
    itemComment,
    seasonComment,
    trendComment,
    finishComment,
  } = params;

  const imageUriText = toText(imageUri, "");
  const riskText = toText(riskLevel, "-");
  const summaryText = toText(summary, "분석 결과를 불러오지 못했어요.");
  const pointText = toText(point, "코디 포인트를 불러오지 못했어요.");
  const problemsText = toText(problems, "문제점을 불러오지 못했어요.");
  const improvementText = toText(improvement, "개선 팁을 불러오지 못했어요.");
  const riskStyle = getRiskStyle(riskText);
  const outcomeHeadline = getOutcomeHeadline(score);

  const detailScores: DetailScore[] = [
    { key: "fit", title: "핏", icon: "move", score: toNumber(fitScore), comment: toText(fitComment, "핏 평가를 불러오지 못했어요.") },
    { key: "color", title: "색조합", icon: "droplet", score: toNumber(colorScore), comment: toText(colorComment, "색조합 평가를 불러오지 못했어요.") },
    { key: "balance", title: "비율", icon: "bar-chart-2", score: toNumber(balanceScore), comment: toText(balanceComment, "비율 평가를 불러오지 못했어요.") },
    { key: "bodyFit", title: "체형 적합", icon: "user", score: toNumber(bodyFitScore), comment: toText(bodyFitComment, "체형 적합 평가를 불러오지 못했어요.") },
    { key: "item", title: "아이템 조화", icon: "shopping-bag", score: toNumber(itemScore), comment: toText(itemComment, "아이템 조화 평가를 불러오지 못했어요.") },
    { key: "season", title: "계절감", icon: "sun", score: toNumber(seasonScore), comment: toText(seasonComment, "계절감 평가를 불러오지 못했어요.") },
    { key: "trend", title: "트렌드", icon: "trending-up", score: toNumber(trendScore), comment: toText(trendComment, "트렌드 평가를 불러오지 못했어요.") },
    { key: "finish", title: "완성도", icon: "star", score: toNumber(finishScore), comment: toText(finishComment, "완성도 평가를 불러오지 못했어요.") },
  ];

  const sortedByHighScore = [...detailScores].sort((a, b) => b.score - a.score);
  const sortedByLowScore = [...detailScores].sort((a, b) => a.score - b.score);

  const strengths = sortedByHighScore
    .filter((item) => item.score >= 75)
    .slice(0, 2);

  const strengthKeys = new Set(strengths.map((item) => item.key));

  const weaknesses = sortedByLowScore
    .filter((item) => item.score < 75 && !strengthKeys.has(item.key))
    .slice(0, 2);

  const handleShare = async () => {
    await Share.share({
      message: `NAES 코디 분석\n\n${outcomeHeadline}\n${summaryText}\n\n잘 어울린 점\n${pointText}\n\n다음에 바꿔볼 점\n${improvementText}`,
    });
  };

  return (
    <View style={styles.screen}>
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

        <View style={styles.outcomeCard}>
          <View style={styles.outcomeContent}>
            <Text style={styles.outcomeEyebrow}>TODAY&apos;S REVIEW</Text>
            <Text style={styles.outcomeTitle}>{outcomeHeadline}</Text>
            <Text style={styles.outcomeSummary}>{summaryText}</Text>
          </View>

          {imageUriText !== "" && <Image source={{ uri: imageUriText }} style={styles.image} />}
        </View>

        <View style={styles.riskCard}>
          <View>
            <Text style={styles.sectionEyebrow}>OUTFIT STATUS</Text>
            <Text style={styles.riskTitle}>오늘 코디 상태</Text>
          </View>

          <View style={[styles.riskPill, { backgroundColor: riskStyle.backgroundColor }]}>
            <View style={[styles.riskDot, { backgroundColor: riskStyle.dotColor }]} />
            <Text style={[styles.riskText, { color: riskStyle.textColor }]}>{riskStyle.label}</Text>
          </View>
        </View>

        <View style={styles.insightStack}>
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View style={styles.detailIconCircle}>
                <Feather name="check" size={17} color="#111" />
              </View>
              <Text style={styles.cardTitle}>잘 어울린 점</Text>
            </View>
            <Text style={styles.cardText}>{pointText}</Text>

            {strengths.map((item) => (
              <View key={`strength-${item.key}`} style={styles.insightItem}>
                <Text style={styles.insightItemTitle}>{item.title}</Text>
                <Text style={styles.insightItemText}>{item.comment}</Text>
              </View>
            ))}
          </View>

          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View style={styles.detailIconCircle}>
                <Feather name="edit-3" size={17} color="#111" />
              </View>
              <Text style={styles.cardTitle}>다음에 바꿔볼 점</Text>
            </View>
            <Text style={styles.cardText}>{improvementText}</Text>

            {weaknesses.map((item) => (
              <View key={`weakness-${item.key}`} style={styles.insightItem}>
                <Text style={styles.insightItemTitle}>{item.title}</Text>
                <Text style={styles.insightItemText}>{item.comment}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.detailSectionHeader}>
          <Text style={styles.sectionEyebrow}>DETAIL ANALYSIS</Text>
          <Text style={styles.detailSectionTitle}>세부 분석</Text>
        </View>

        <View style={styles.analysisPanel}>
          {detailScores.map((item) => (
            <View key={item.key} style={styles.analysisRow}>
              <View style={styles.analysisIconCircle}>
                <Feather name={item.icon} size={19} color="#8C6F47" />
              </View>

              <View style={styles.analysisContent}>
                <Text style={styles.analysisTitle}>{item.title}</Text>
                <Text style={styles.analysisComment}>{item.comment}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.detailCard}>
          <View style={styles.detailHeaderRow}>
            <View style={styles.detailIconCircle}>
              <Feather name="alert-circle" size={17} color="#111" />
            </View>
            <Text style={styles.cardTitle}>참고할 점</Text>
          </View>
          <Text style={styles.cardText}>{problemsText}</Text>
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

      <BottomNav activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  container: { backgroundColor: "#f5f2ee", paddingTop: 30, paddingHorizontal: 20, paddingBottom: BOTTOM_NAV_CONTENT_PADDING },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee7dd" },
  shareIconButton: { width: 40, height: 40, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee7dd" },
  headerEyebrow: { color: "#9b7a4b", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textAlign: "center" },
  headerTitle: { color: "#111", fontSize: 24, fontWeight: "900", marginTop: 2, textAlign: "center" },

  outcomeCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#eee7dd", flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden" },
  outcomeContent: { flex: 1, minWidth: 0 },
  outcomeEyebrow: { color: "#8C6F47", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 },
  outcomeTitle: { color: "#111", fontSize: 21, fontWeight: "800", lineHeight: 29, marginBottom: 8 },
  outcomeSummary: { color: "#5f5a55", fontSize: 14, fontWeight: "600", lineHeight: 21 },
  image: { width: 104, height: 136, borderRadius: 18, backgroundColor: "#F4EEE7", borderWidth: 1, borderColor: "#E8DED2" },

  riskCard: { backgroundColor: "#faf8f5", borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#f0eee9", alignItems: "flex-start", gap: 12 },
  sectionEyebrow: { color: "#9b7a4b", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6 },
  riskTitle: { color: "#111", fontSize: 20, fontWeight: "900" },
  riskPill: { maxWidth: "100%", flexDirection: "row", alignItems: "center", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },
  riskDot: { width: 8, height: 8, borderRadius: 999, marginRight: 7 },
  riskText: { flexShrink: 1, fontSize: 14, fontWeight: "800", lineHeight: 20 },

  cardTitle: { color: "#111", fontSize: 18, fontWeight: "800" },
  insightStack: { gap: 12, marginBottom: 18 },
  insightCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, borderWidth: 1, borderColor: "#f0eee9" },
  insightHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  insightItem: { borderTopWidth: 1, borderTopColor: "#eee7dd", marginTop: 12, paddingTop: 12 },
  insightItemTitle: { color: "#8C6F47", fontSize: 12, fontWeight: "800", marginBottom: 4 },
  insightItemText: { color: "#514a43", fontSize: 14, fontWeight: "600", lineHeight: 21 },

  detailSectionHeader: { marginBottom: 10, marginTop: 2 },
  detailSectionTitle: { color: "#111", fontSize: 24, fontWeight: "900" },

  analysisPanel: {
    gap: 10,
    marginBottom: 14,
  },

  analysisRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 14,
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#f0eee9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },

  analysisIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#F4EEE7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  analysisContent: {
    flex: 1,
    minWidth: 0,
  },

  analysisTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },

  analysisComment: {
    color: "#514a43",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
  },

  detailCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "#f0eee9" },
  detailHeaderRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  detailIconCircle: { width: 30, height: 30, borderRadius: 999, backgroundColor: "#f0e7dc", alignItems: "center", justifyContent: "center" },
  cardText: { color: "#514a43", fontSize: 15, fontWeight: "600", lineHeight: 24 },

  buttonRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  primaryButton: { flex: 1, backgroundColor: "#111", borderRadius: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryButton: { width: 110, backgroundColor: "#fff", borderRadius: 18, paddingVertical: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee7dd" },
  secondaryButtonText: { color: "#111", fontSize: 16, fontWeight: "900" },
});
