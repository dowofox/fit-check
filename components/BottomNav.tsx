import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, shadow } from "@/utils/theme";

const ACTIVE_COLOR = colors.point;
const INACTIVE_COLOR = colors.subText;

export const BOTTOM_NAV_CONTENT_PADDING = 20;

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
    <Pressable style={styles.navItem} onPress={onPress}>
      <View style={[styles.iconWrap, active && styles.activeIconWrap]}>
        <Feather name={icon} size={17} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />
      </View>
      <Text style={active ? styles.navTextActive : styles.navText}>{label}</Text>
    </Pressable>
  );
}

export default function BottomNav({ activeTab }: { activeTab: BottomNavTab }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bottomNavWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}> 
      <View style={styles.bottomNav}>
        <NavItem active={activeTab === "home"} icon="home" label="홈" onPress={() => router.replace("/")} />
        <NavItem active={activeTab === "closet"} icon="book-open" label="옷장" onPress={() => router.push("/closet")} />
        <Pressable style={styles.centerButton} onPress={() => router.push("/add-clothes")}>
          <Feather name="plus" size={21} color={colors.card} />
        </Pressable>
        <NavItem active={activeTab === "outfit"} icon="star" label="코디" onPress={() => router.push("/outfit")} />
        <NavItem active={activeTab === "profile"} icon="user" label="마이" onPress={() => router.push("/profile")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavWrap: {
    flexShrink: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...shadow.subtle,
  },
  bottomNav: {
    height: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    position: "relative",
  },
  centerButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.point,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 7,
    marginTop: -8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 9,
    elevation: 3,
  },
  iconWrap: {
    width: 24,
    height: 22,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconWrap: {
    backgroundColor: "transparent",
  },
  navTextActive: {
    color: ACTIVE_COLOR,
    fontSize: 10,
    fontWeight: "600",
  },
  navText: {
    color: INACTIVE_COLOR,
    fontSize: 10,
    fontWeight: "500",
  },
});
