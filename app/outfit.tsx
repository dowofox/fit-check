import BottomNav, {
  BOTTOM_NAV_CONTENT_PADDING,
} from "@/components/BottomNav";
import {
  ActionButton,
  ScreenHeader,
  StatusCard,
} from "@/components/ui/NaesUi";
import {
  getCurrentSeasonForReadiness,
  getOutfitRecommendationReadiness,
  getOutfitRecommendationReadinessContent,
} from "@/utils/outfitRecommendationReadiness";
import {
  type ClosetItem,
  getClosetItemsLoadResult,
  getSavedOutfitsLoadResult,
} from "@/utils/storage";
import { colors, radius } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function OutfitHubScreen() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [savedOutfitCount, setSavedOutfitCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const loadRequestRef = useRef(0);

  const loadOutfitSummary = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setHasLoadError(false);
    setIsLoaded(false);
    const [closetResult, savedOutfitsResult] = await Promise.all([
      getClosetItemsLoadResult(),
      getSavedOutfitsLoadResult(),
    ]);

    if (requestId !== loadRequestRef.current) return;
    if (
      closetResult.status === "failed" ||
      savedOutfitsResult.status === "failed"
    ) {
      setHasLoadError(true);
      setIsLoaded(true);
      return;
    }

    setClosetItems(closetResult.items);
    setSavedOutfitCount(savedOutfitsResult.outfits.length);
    setIsLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOutfitSummary();

      return () => {
        loadRequestRef.current += 1;
      };
    }, [loadOutfitSummary])
  );

  const readiness = useMemo(
    () =>
      getOutfitRecommendationReadiness(
        closetItems,
        getCurrentSeasonForReadiness()
      ),
    [closetItems]
  );
  const readinessContent = getOutfitRecommendationReadinessContent(readiness);
  const displayedCounts =
    readiness.reason === "not_enough_season_items"
      ? readiness.currentConditionCounts
      : readiness.counts;
  const metrics = [
    {
      label: "상의",
      current: displayedCounts.tops,
      required: readiness.requirements.tops,
      requiredLabel: "필수",
    },
    {
      label: "하의",
      current: displayedCounts.bottoms,
      required: readiness.requirements.bottoms,
      requiredLabel: "필수",
    },
    {
      label: "신발",
      current: displayedCounts.shoes,
      required: readiness.requirements.recommendedShoes,
      requiredLabel: "권장",
    },
    {
      label: "서로 다른 조합",
      current: displayedCounts.coreCombinations,
      required: readiness.requirements.coreCombinations,
      requiredLabel: "필수",
    },
  ];

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="코디 준비" />

        {!isLoaded ? (
          <StatusCard
            kind="loading"
            title="옷장 상태를 확인하고 있어요"
            description="추천에 사용할 수 있는 옷만 안전하게 확인할게요."
          />
        ) : null}

        {isLoaded && hasLoadError ? (
          <StatusCard
            kind="error"
            title="코디 준비 상태를 불러오지 못했어요"
            description="저장된 옷과 코디는 그대로 있어요. 다시 확인해주세요."
            actionLabel="다시 불러오기"
            onAction={() => void loadOutfitSummary()}
          />
        ) : null}

        {isLoaded && !hasLoadError ? (
          <>
            <Text style={styles.eyebrow}>
              {readiness.ready ? "READY TO STYLE" : "WARDROBE CHECK"}
            </Text>
            <Text style={styles.title}>{readinessContent.title}</Text>
            <Text style={styles.subtitle}>{readinessContent.text}</Text>

            <View style={styles.metrics}>
          {metrics.map((metric, index) => {
            const complete = metric.current >= metric.required;
            return (
              <View key={metric.label} style={styles.metricRow}>
                <View style={styles.metricTrack}>
                  <View
                    style={[
                      styles.metricDot,
                      complete && styles.metricDotComplete,
                    ]}
                  >
                    {complete ? (
                      <Feather name="check" size={13} color={colors.card} />
                    ) : (
                      <Text style={styles.metricIndex}>{index + 1}</Text>
                    )}
                  </View>
                  {index < metrics.length - 1 ? (
                    <View style={styles.metricLine} />
                  ) : null}
                </View>
                <View style={styles.metricTextArea}>
                  <View style={styles.metricTitleRow}>
                    <Text style={styles.metricTitle}>{metric.label}</Text>
                    <Text
                      style={[
                        styles.metricCount,
                        complete && styles.metricCountComplete,
                      ]}
                    >
                      {metric.current} / {metric.required} · {metric.requiredLabel}
                    </Text>
                  </View>
                  <Text style={styles.metricDescription}>
                    {complete
                      ? "준비됐어요"
                      : `${Math.max(metric.required - metric.current, 0)}개 더 필요해요`}
                  </Text>
                </View>
              </View>
            );
          })}
            </View>

            <View style={styles.nextAction}>
              <View style={styles.nextActionIcon}>
                <Feather
                  name={readiness.ready ? "star" : "plus"}
                  size={18}
                  color={colors.point}
                />
              </View>
              <View style={styles.nextActionTextArea}>
                <Text style={styles.nextActionEyebrow}>NEXT ACTION</Text>
                <Text style={styles.nextActionTitle}>
                  {readiness.ready
                    ? "오늘 입을 코디를 확인해보세요"
                    : readinessContent.primaryActionLabel}
                </Text>
                <Text style={styles.nextActionText}>
                  {readiness.ready
                    ? "날씨와 취향을 반영한 추천을 바로 확인할 수 있어요."
                    : "추천 기준을 채운 뒤 자신 있게 어울리는 조합만 보여드릴게요."}
                </Text>
              </View>
            </View>

            <ActionButton
              label={readinessContent.primaryActionLabel}
              icon={readiness.ready ? "arrow-right" : "plus"}
              onPress={() => {
                if (readiness.ready) {
                  router.push("/outfit-recommend");
                  return;
                }
                router.push("/add-clothes");
              }}
            />

            {!readiness.ready ? (
              <View style={styles.secondaryActionWrap}>
                <ActionButton
                  label="옷장 확인하기"
                  icon="grid"
                  variant="secondary"
                  onPress={() => router.push("/closet")}
                />
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`저장한 코디 ${savedOutfitCount}개 보기`}
              style={styles.savedRow}
              onPress={() => router.push("/saved-outfits")}
            >
              <View style={styles.savedIcon}>
                <Feather name="bookmark" size={17} color={colors.point} />
              </View>
              <View style={styles.savedTextArea}>
                <Text style={styles.savedTitle}>저장한 코디</Text>
                <Text style={styles.savedText}>{savedOutfitCount}개 저장됨</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.subText} />
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <BottomNav activeTab="outfit" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingTop: 24,
    paddingHorizontal: 18,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  header: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.point,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: colors.card,
    fontSize: 13,
    fontWeight: "900",
  },
  logoText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  stepBadge: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radius.round,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "900",
  },
  eyebrow: {
    color: colors.point,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.subText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 7,
    marginBottom: 24,
  },
  metrics: {
    marginBottom: 20,
  },
  metricRow: {
    minHeight: 72,
    flexDirection: "row",
    gap: 13,
  },
  metricTrack: {
    width: 34,
    alignItems: "center",
  },
  metricDot: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  metricDotComplete: {
    borderColor: colors.point,
    backgroundColor: colors.point,
  },
  metricIndex: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "900",
  },
  metricLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
  },
  metricTextArea: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  metricTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metricTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  metricCount: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },
  metricCountComplete: {
    color: colors.point,
  },
  metricDescription: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  nextAction: {
    minHeight: 88,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  nextActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
  },
  nextActionTextArea: {
    flex: 1,
    minWidth: 0,
  },
  nextActionEyebrow: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "900",
  },
  nextActionTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 3,
  },
  nextActionText: {
    color: colors.subText,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 3,
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.point,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 9,
  },
  secondaryButtonText: {
    color: colors.point,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryActionWrap: {
    marginTop: 9,
  },
  savedRow: {
    minHeight: 72,
    paddingVertical: 10,
    marginTop: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  savedIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
  },
  savedTextArea: {
    flex: 1,
  },
  savedTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  savedText: {
    color: colors.subText,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
});
