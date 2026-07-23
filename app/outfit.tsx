import BottomNav, {
  BOTTOM_NAV_CONTENT_PADDING,
} from "@/components/BottomNav";
import { getOutfitRecommendationReadiness } from "@/utils/outfitRecommendationReadiness";
import {
  type ClosetItem,
  getClosetItems,
  getSavedOutfits,
} from "@/utils/storage";
import { colors, radius } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function OutfitHubScreen() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [savedOutfitCount, setSavedOutfitCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadOutfitSummary() {
        const [items, savedOutfits] = await Promise.all([
          getClosetItems(),
          getSavedOutfits(),
        ]);

        if (!isActive) return;
        setClosetItems(items);
        setSavedOutfitCount(savedOutfits.length);
      }

      void loadOutfitSummary();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const readiness = useMemo(
    () => getOutfitRecommendationReadiness(closetItems),
    [closetItems]
  );
  const metrics = [
    {
      label: "상의",
      current: readiness.counts.tops,
      required: readiness.requirements.tops,
      requiredLabel: "필수",
    },
    {
      label: "하의",
      current: readiness.counts.bottoms,
      required: readiness.requirements.bottoms,
      requiredLabel: "필수",
    },
    {
      label: "신발",
      current: readiness.counts.shoes,
      required: readiness.requirements.recommendedShoes,
      requiredLabel: "권장",
    },
    {
      label: "서로 다른 조합",
      current: readiness.counts.coreCombinations,
      required: readiness.requirements.coreCombinations,
      requiredLabel: "필수",
    },
  ];

  const missingMessage =
    readiness.missing.tops > 0
      ? `상의 ${readiness.missing.tops}벌을 더 추가하면 좋아요`
      : readiness.missing.bottoms > 0
        ? `하의 ${readiness.missing.bottoms}벌을 더 추가하면 좋아요`
        : readiness.missing.coreCombinations > 0
          ? "서로 다른 상의와 하의를 조금 더 추가해주세요"
          : "오늘의 코디를 확인할 준비가 끝났어요";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>N</Text>
            </View>
            <Text style={styles.logoText}>NAES</Text>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>STEP 2 OF 3</Text>
          </View>
        </View>

        <Text style={styles.eyebrow}>
          {readiness.ready ? "READY TO STYLE" : "WARDROBE CHECK"}
        </Text>
        <Text style={styles.title}>
          {readiness.ready ? "추천 준비가 끝났어요" : "조금만 더 채우면 돼요"}
        </Text>
        <Text style={styles.subtitle}>
          {readiness.ready
            ? "현재 옷장으로 서로 다른 코디를 만들 수 있어요."
            : "좋지 않은 조합을 억지로 보여주지 않고 필요한 옷만 알려드릴게요."}
        </Text>

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
            <Text style={styles.nextActionTitle}>{missingMessage}</Text>
            <Text style={styles.nextActionText}>
              {readiness.ready
                ? "날씨와 취향을 반영한 추천을 바로 확인해보세요."
                : "현재 가능한 추천도 확인할 수 있어요."}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/outfit-recommend")}
        >
          <Text style={styles.primaryButtonText}>
            {readiness.ready ? "오늘의 코디 보기" : "현재 가능한 코디 보기"}
          </Text>
          <Feather name="arrow-right" size={17} color={colors.card} />
        </Pressable>

        {!readiness.ready ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/add-clothes")}
          >
            <Text style={styles.secondaryButtonText}>필요한 옷 추가하기</Text>
            <Feather name="plus" size={16} color={colors.point} />
          </Pressable>
        ) : null}

        <Pressable
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
