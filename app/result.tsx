import BottomNav from "@/components/BottomNav";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

type ParamValue = string | string[] | undefined;

type DetailScore = {
  key: string;
  title: string;
  score: number;
  comment: string;
};

function getRiskStyle(riskLevel?: string) {
  const risk = String(riskLevel ?? "");
  if (risk.includes("낮음")) return { backgroundColor: "#edf6df", dotColor: "#84cc16", textColor: "#3f6212" };
  if (risk.includes("높음")) return { backgroundColor: "#fee2e2", dotColor: "#ef4444", textColor: "#991b1b" };
  return { backgroundColor: "#fff3d6", dotColor: "#f59e0b", textColor: "#92400e" };
}

function getScoreMessage(score?: ParamValue) {
  const numericScore = toNumber(score);
  if (numericScore >= 90) return "완성도 높은 스타일이에요.";
  if (numericScore >= 80) return "안정적으로 좋은 코디예요.";
  if (numericScore >= 70) return "무난하지만 조금 더 다듬으면 좋아요.";
  if (numericScore >= 60) return "개선하면 훨씬 좋아질 수 있어요.";
  return "전체적인 정리가 필요한 코디예요.";
}

function getStars(score?: ParamValue) {
  const numericScore = toNumber(score);
  const filledCount = Math.max(0, Math.min(5, Math.round(numericScore / 20)));
  return "★".repeat(filledCount) + "☆".repeat(5 - filledCount);
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

function getScoreLabel(score: number) {
  if (score >= 90) return "아주 좋음";
  if (score >= 85) return "좋음";
  if (score >= 70) return "보통";
  if (score >= 66) return "아쉬움";
  if (score >= 50) return "개선 필요";
  return "많이 아쉬움";
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

  const scoreText = toText(score, "-");
  const imageUriText = toText(imageUri, "");
  const riskText = toText(riskLevel, "-");
  const summaryText = toText(summary, "분석 결과를 불러오지 못했어요.");
  const pointText = toText(point, "코디 포인트를 불러오지 못했어요.");
  const problemsText = toText(problems, "문제점을 불러오지 못했어요.");
  const improvementText = toText(improvement, "개선 팁을 불러오지 못했어요.");
  const riskStyle = getRiskStyle(riskText);

  const detailScores: DetailScore[] = [
    { key: "fit", title: "핏", score: toNumber(fitScore), comment: toText(fitComment, "핏 평가를 불러오지 못했어요.") },
    { key: "color", title: "색조합", score: toNumber(colorScore), comment: toText(colorComment, "색조합 평가를 불러오지 못했어요.") },
    { key: "balance", title: "비율", score: toNumber(balanceScore), comment: toText(balanceComment, "비율 평가를 불러오지 못했어요.") },
    { key: "bodyFit", title: "체형 적합", score: toNumber(bodyFitScore), comment: toText(bodyFitComment, "체형 적합 평가를 불러오지 못했어요.") },
    { key: "item", title: "아이템 조화", score: toNumber(itemScore), comment: toText(itemComment, "아이템 조화 평가를 불러오지 못했어요.") },
    { key: "season", title: "계절감", score: toNumber(seasonScore), comment: toText(seasonComment, "계절감 평가를 불러오지 못했어요.") },
    { key: "trend", title: "트렌드", score: toNumber(trendScore), comment: toText(trendComment, "트렌드 평가를 불러오지 못했어요.") },
    { key: "finish", title: "완성도", score: toNumber(finishScore), comment: toText(finishComment, "완성도 평가를 불러오지 못했어요.") },
  ];

  const sortedByHighScore = [...detailScores].sort((a, b) => b.score - a.score);
  const sortedByLowScore = [...detailScores].sort((a, b) => a.score - b.score);

  const strengths = sortedByHighScore
    .filter((item) => item.score >= 85)
    .slice(0, 3);

  const strengthKeys = new Set(strengths.map((item) => item.key));

  const weaknesses = sortedByLowScore
    .filter((item) => item.score <= 65 && !strengthKeys.has(item.key))
    .slice(0, 3);

  const hasStrengths = strengths.length > 0;
  const hasWeaknesses = weaknesses.length > 0;

  const handleShare = async () => {
    await Share.share({
      message: `NAES 스타일 분석 결과\n\nSTYLE SCORE ${scoreText}점\n실패 위험 ${riskText}\n\n${summaryText}`,
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

        <View style={styles.scoreCard}>
          <View style={styles.scoreCardTop}>
            <View>
              <Text style={styles.scoreLabel}>STYLE SCORE</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.score}>{scoreText}</Text>
                <Text style={styles.scoreUnit}>점</Text>
              </View>
              <Text style={styles.stars}>{getStars(score)}</Text>
            </View>

            {imageUriText !== "" && <Image source={{ uri: imageUriText }} style={styles.image} />}
          </View>

          <View style={styles.scoreDivider} />
          <Text style={styles.scoreMessage}>{getScoreMessage(score)}</Text>
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

        {(hasStrengths || hasWeaknesses) && (
          <View style={styles.quickInsightRow}>
            {hasStrengths && (
              <View style={styles.quickInsightCard}>
                <View style={styles.quickInsightHeader}>
                  <Text style={styles.quickInsightEmoji}>🏆</Text>
                  <Text style={styles.quickInsightTitle}>강점</Text>
                </View>

                {strengths.map((item) => (
                  <View key={`strength-${item.key}`} style={styles.quickScoreRow}>
                    <Text style={styles.quickScoreTitle}>{item.title}</Text>
                    <Text style={styles.quickScoreValue}>{item.score}점</Text>
                  </View>
                ))}
              </View>
            )}

            {hasWeaknesses && (
              <View style={styles.quickInsightCard}>
                <View style={styles.quickInsightHeader}>
                  <Text style={styles.quickInsightEmoji}>⚠</Text>
                  <Text style={styles.quickInsightTitle}>개선 필요</Text>
                </View>

                {weaknesses.map((item) => (
                  <View key={`weakness-${item.key}`} style={styles.quickScoreRow}>
                    <Text style={styles.quickScoreTitle}>{item.title}</Text>
                    <Text style={styles.quickScoreValue}>{item.score}점</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.detailSectionHeader}>
          <Text style={styles.sectionEyebrow}>DETAIL ANALYSIS</Text>
          <Text style={styles.detailSectionTitle}>세부 분석</Text>
        </View>

        {detailScores.map((item) => (
          <View key={item.key} style={styles.analysisCard}>
            <View style={styles.analysisHeaderRow}>
              <View>
                <Text style={styles.analysisTitle}>{item.title}</Text>
                <Text style={styles.analysisLabel}>{getScoreLabel(item.score)}</Text>
              </View>

              <Text style={styles.analysisScore}>{item.score}점</Text>
            </View>

            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${item.score}%` }]} />
            </View>

            <Text style={styles.analysisComment}>{item.comment}</Text>
          </View>
        ))}

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

      <BottomNav activeTab="analyze" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  container: { backgroundColor: "#f5f2ee", paddingTop: 30, paddingHorizontal: 20, paddingBottom: 112 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee7dd" },
  shareIconButton: { width: 40, height: 40, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee7dd" },
  headerEyebrow: { color: "#9b7a4b", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textAlign: "center" },
  headerTitle: { color: "#111", fontSize: 24, fontWeight: "900", marginTop: 2, textAlign: "center" },

  scoreCard: { backgroundColor: "#111", borderRadius: 30, padding: 22, marginBottom: 14, overflow: "hidden" },
  scoreCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  scoreLabel: { color: "#caa46a", fontSize: 12, fontWeight: "900", letterSpacing: 1.6, marginBottom: 8 },
  scoreRow: { flexDirection: "row", alignItems: "flex-end" },
  score: { color: "#fff", fontSize: 66, fontWeight: "900", letterSpacing: -2, lineHeight: 72 },
  scoreUnit: { color: "#fff", fontSize: 18, fontWeight: "900", marginBottom: 12, marginLeft: 4 },
  stars: { color: "#caa46a", fontSize: 18, fontWeight: "900", letterSpacing: 2, marginTop: 6 },
  image: { width: 112, height: 148, borderRadius: 22, backgroundColor: "#333", borderWidth: 1, borderColor: "#2d2d2d" },
  scoreDivider: { height: 1, backgroundColor: "#2f2f32", marginVertical: 18 },
  scoreMessage: { color: "#efe9df", fontSize: 16, fontWeight: "800", lineHeight: 24 },

  riskCard: { backgroundColor: "#faf8f5", borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#f0eee9", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionEyebrow: { color: "#9b7a4b", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginBottom: 6 },
  riskTitle: { color: "#111", fontSize: 20, fontWeight: "900" },
  riskPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },
  riskDot: { width: 8, height: 8, borderRadius: 999, marginRight: 7 },
  riskText: { fontSize: 14, fontWeight: "900" },

  summaryCard: { backgroundColor: "#faf8f5", borderRadius: 26, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#f0eee9" },
  cardTitle: { color: "#111", fontSize: 19, fontWeight: "900", marginBottom: 9 },
  summaryText: { color: "#47413a", fontSize: 15, fontWeight: "700", lineHeight: 24 },

  quickInsightRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  quickInsightCard: { flex: 1, backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "#f0eee9" },
  quickInsightHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  quickInsightEmoji: { fontSize: 17 },
  quickInsightTitle: { color: "#111", fontSize: 17, fontWeight: "900" },
  quickScoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 },
  quickScoreTitle: { flex: 1, color: "#5f5a55", fontSize: 13, fontWeight: "800" },
  quickScoreValue: { color: "#111", fontSize: 13, fontWeight: "900" },

  detailSectionHeader: { marginBottom: 10, marginTop: 2 },
  detailSectionTitle: { color: "#111", fontSize: 24, fontWeight: "900" },

  analysisCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "#f0eee9" },
  analysisHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  analysisTitle: { color: "#111", fontSize: 19, fontWeight: "900" },
  analysisLabel: { color: "#9b7a4b", fontSize: 12, fontWeight: "900", marginTop: 4 },
  analysisScore: { color: "#111", fontSize: 20, fontWeight: "900" },
  progressBg: { height: 9, backgroundColor: "#eee7dd", borderRadius: 999, overflow: "hidden", marginBottom: 12 },
  progressFill: { height: "100%", backgroundColor: "#111", borderRadius: 999 },
  analysisComment: { color: "#514a43", fontSize: 15, fontWeight: "600", lineHeight: 24 },

  detailCard: { backgroundColor: "#fff", borderRadius: 24, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "#f0eee9" },
  detailHeaderRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 3 },
  detailIconCircle: { width: 30, height: 30, borderRadius: 999, backgroundColor: "#f0e7dc", alignItems: "center", justifyContent: "center" },
  cardText: { color: "#514a43", fontSize: 15, fontWeight: "600", lineHeight: 24 },

  buttonRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  primaryButton: { flex: 1, backgroundColor: "#111", borderRadius: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  secondaryButton: { width: 110, backgroundColor: "#fff", borderRadius: 18, paddingVertical: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#eee7dd" },
  secondaryButtonText: { color: "#111", fontSize: 16, fontWeight: "900" },
});