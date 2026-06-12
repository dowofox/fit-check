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
        <Feather name={icon} size={18} color={active ? "#8A6F47" : "#7C776F"} />
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
        <Pressable
          style={styles.centerButton}
          onPress={async () => {
            await hideAndroidNavigationBar();
            router.push("/add-clothes");
          }}
        >
          <Feather name="plus" size={26} color="#fff" />
        </Pressable>
        <NavItem active={activeTab === "outfit"} icon="star" label="코디" onPress={() => router.push("/outfit")} />
        <NavItem active={activeTab === "profile"} icon="user" label="마이" onPress={() => router.push("/profile")} />
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
    backgroundColor: "#FFFDF9",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...shadow.subtle,
  },
  bottomNav: {
    height: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 9,
  },
  navItem: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    position: "relative",
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#6F5A3E",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
    marginTop: -24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
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
    color: "#8A6F47",
    fontSize: 11,
    fontWeight: "600",
  },
  navText: {
    color: "#7C776F",
    fontSize: 11,
    fontWeight: "500",
  },
});
