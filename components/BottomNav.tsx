import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { hideAndroidNavigationBar, useHideAndroidNavigationBar } from "@/utils/navigationBar";
import { colors, radius, shadow } from "@/utils/theme";

export type BottomNavTab = "home" | "closet" | "outfit" | "profile";

function NavItem({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.navItem}
      onPress={async () => {
        await hideAndroidNavigationBar();
        onPress();
      }}
    >
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <Feather name={icon} size={18} color={active ? colors.point : colors.subText} />
      </View>
      <Text style={active ? styles.navTextActive : styles.navText}>{label}</Text>
    </Pressable>
  );
}

export default function BottomNav({ activeTab }: { activeTab: BottomNavTab }) {
  useHideAndroidNavigationBar();

  return (
    <View style={styles.bottomNavWrap}>
      <View style={styles.bottomNav}>
        <NavItem active={activeTab === "home"} icon="home" label="홈" onPress={() => router.replace("/")} />
        <NavItem active={activeTab === "closet"} icon="book-open" label="옷장" onPress={() => router.push("/closet")} />
        <NavItem active={activeTab === "outfit"} icon="star" label="코디" onPress={() => router.push("/outfit")} />
        <NavItem active={activeTab === "profile"} icon="user" label="프로필" onPress={() => router.push("/profile")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...shadow.subtle,
  },
  bottomNav: {
    height: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    position: "relative",
  },
  iconWrap: {
    width: 26,
    height: 24,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconWrap: {
    backgroundColor: colors.inactiveTab,
    opacity: 0,
  },
  navTextActive: {
    color: colors.point,
    fontSize: 11,
    fontWeight: "600",
  },
  navText: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "500",
  },
});
