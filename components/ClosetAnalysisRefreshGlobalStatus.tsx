import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useClosetAnalysisRefresh } from "@/providers/ClosetAnalysisRefreshProvider";
import { colors } from "@/utils/theme";

function getStatusText(
  status: NonNullable<
    ReturnType<typeof useClosetAnalysisRefresh>["job"]
  >["status"],
  processed: number,
  total: number,
  updated: number,
  failed: number,
  pending: number
) {
  if (status === "running") {
    return `옷장 분석 최신화 중 · ${Math.min(processed + 1, total)}/${total}`;
  }
  if (status === "paused") {
    return `옷장 최신화 재개 준비 · ${pending}개 남음`;
  }
  if (status === "cancelled") {
    return `옷장 최신화 중단 · ${pending}개 남음`;
  }
  if (status === "completed_with_errors") {
    return `옷장 최신화 완료 · ${updated}개 변경 · ${failed}개 실패`;
  }
  if (status === "failed") {
    return "옷장 최신화를 시작하지 못했어요";
  }
  return `옷장 최신화 완료 · ${updated}개 변경`;
}

export default function ClosetAnalysisRefreshGlobalStatus() {
  const insets = useSafeAreaInsets();
  const { job, clearResult } = useClosetAnalysisRefresh();

  if (!job || job.status === "idle") return null;

  const isActive = job.status === "running" || job.status === "paused";
  const canDismiss = !isActive;
  const text = getStatusText(
    job.status,
    job.processed,
    job.total,
    job.updated,
    job.failed,
    job.pendingItemIds.length
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: Math.max(insets.top, 8) + 6 }]}
    >
      <View style={styles.banner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${text}. 옷장 화면 열기`}
          style={styles.content}
          onPress={() => router.push("/closet")}
        >
          <View style={styles.icon}>
            <Feather
              name={isActive ? "refresh-cw" : "check"}
              size={14}
              color={colors.card}
            />
          </View>
          <Text style={styles.text} numberOfLines={2}>
            {text}
          </Text>
          <Feather name="chevron-right" size={15} color={colors.card} />
        </Pressable>
        {canDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="옷장 최신화 상태 닫기"
            hitSlop={8}
            style={styles.close}
            onPress={() => void clearResult()}
          >
            <Feather name="x" size={14} color={colors.card} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 100,
    elevation: 8,
    alignItems: "center",
  },
  banner: {
    width: "100%",
    maxWidth: 420,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: colors.text,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.point,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    color: colors.card,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  close: {
    width: 30,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
});
