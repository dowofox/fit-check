import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  colors,
  control,
  iconSize,
  radius,
  spacing,
  typography,
} from "@/utils/theme";

type FeatherIconName = keyof typeof Feather.glyphMap;

export function HeaderIconButton({
  accessibilityLabel,
  icon,
  onPress,
  disabled = false,
}: {
  accessibilityLabel: string;
  icon: FeatherIconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        pressed && !disabled && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}
    >
      <Feather name={icon} size={iconSize.md} color={colors.primaryText} />
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  eyebrow,
  onBack,
  right,
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.headerSide}>
        {onBack ? (
          <HeaderIconButton
            accessibilityLabel="이전 화면으로 돌아가기"
            icon="chevron-left"
            onPress={onBack}
          />
        ) : null}
      </View>

      <View style={styles.headerTextArea}>
        {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>

      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [
            styles.sectionAction,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Feather name="chevron-right" size={iconSize.sm} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ActionButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export function ActionButton({
  label,
  onPress,
  icon,
  variant = "primary",
  loading = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: FeatherIconName;
  variant?: ActionButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const isDisabled = disabled || loading;
  const isFilled = variant === "primary" || variant === "danger";
  const iconColor = isFilled ? colors.surface : colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        styles[`actionButton_${variant}`],
        pressed && !isDisabled && styles.controlPressed,
        isDisabled && styles.controlDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : icon ? (
        <Feather name={icon} size={iconSize.md} color={iconColor} />
      ) : null}
      <Text
        numberOfLines={2}
        style={[
          styles.actionButtonText,
          isFilled ? styles.actionButtonTextFilled : styles.actionButtonTextOutline,
          variant === "danger" && styles.actionButtonTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FilterChip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} 조건`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && !disabled && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type StatusCardKind = "loading" | "empty" | "error";

export function StatusCard({
  kind,
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: {
  kind: StatusCardKind;
  title: string;
  description?: string;
  icon?: FeatherIconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const statusIcon =
    icon || (kind === "error" ? "alert-circle" : kind === "empty" ? "layers" : null);

  return (
    <View
      accessibilityRole={kind === "error" ? "alert" : "summary"}
      style={[styles.statusCard, kind === "error" && styles.statusCardError]}
    >
      <View style={styles.statusIcon}>
        {kind === "loading" ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : statusIcon ? (
          <Feather
            name={statusIcon}
            size={iconSize.lg}
            color={kind === "error" ? colors.warning : colors.accent}
          />
        ) : null}
      </View>
      <Text style={styles.statusTitle}>{title}</Text>
      {description ? <Text style={styles.statusDescription}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.statusAction}>
          <ActionButton
            label={actionLabel}
            onPress={onAction}
            icon={kind === "error" ? "refresh-cw" : "arrow-right"}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerSide: {
    width: control.minTouchSize,
    minHeight: control.minTouchSize,
    alignItems: "flex-start",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerTextArea: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  headerEyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: 2,
  },
  headerTitle: {
    ...typography.screenTitle,
    color: colors.primaryText,
    textAlign: "center",
  },
  headerIconButton: {
    width: control.minTouchSize,
    height: control.minTouchSize,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    minHeight: control.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.primaryText,
    flex: 1,
    minWidth: 0,
  },
  sectionAction: {
    minHeight: control.minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  sectionActionText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  actionButton: {
    minHeight: control.buttonHeight,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
  },
  actionButton_primary: {
    backgroundColor: colors.primaryText,
    borderColor: colors.primaryText,
  },
  actionButton_secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  actionButton_quiet: {
    backgroundColor: colors.softCard,
    borderColor: colors.softCard,
  },
  actionButton_danger: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  actionButtonText: {
    ...typography.button,
    textAlign: "center",
    flexShrink: 1,
  },
  actionButtonTextFilled: {
    color: colors.surface,
  },
  actionButtonTextOutline: {
    color: colors.accent,
  },
  actionButtonTextDanger: {
    color: colors.surface,
  },
  filterChip: {
    minHeight: control.minTouchSize,
    borderRadius: radius.round,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  filterChipSelected: {
    backgroundColor: colors.primaryText,
    borderColor: colors.primaryText,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.secondaryText,
    fontWeight: "700",
  },
  filterChipTextSelected: {
    color: colors.surface,
  },
  statusCard: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  statusCardError: {
    borderColor: colors.warning,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.round,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  statusTitle: {
    ...typography.cardTitle,
    color: colors.primaryText,
    textAlign: "center",
  },
  statusDescription: {
    ...typography.body,
    color: colors.secondaryText,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  statusAction: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
  controlPressed: {
    opacity: 0.72,
  },
  controlDisabled: {
    opacity: 0.45,
  },
});
