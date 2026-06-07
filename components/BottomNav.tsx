import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { hideAndroidNavigationBar, useHideAndroidNavigationBar } from "@/utils/navigationBar";

export type BottomNavTab = "home" | "analyze" | "closet" | "history" | "profile";

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
        <Feather name={icon} size={19} color={active ? "#111" : "#8f8a84"} />
      </View>
      <Text style={active ? styles.navTextActive : styles.navText}>{label}</Text>
      {active && <View style={styles.activeLine} />}
    </Pressable>
  );
}

export default function BottomNav({ activeTab }: { activeTab: BottomNavTab }) {
  useHideAndroidNavigationBar();

  return (
    <View style={styles.bottomNavWrap}>
      <View style={styles.bottomNav}>
        <NavItem active={activeTab === "home"} icon="home" label="홈" onPress={() => router.replace("/")} />
        <View style={styles.divider} />
        <NavItem active={activeTab === "analyze"} icon="search" label="분석" onPress={() => router.replace("/")} />
        <View style={styles.divider} />
        <NavItem active={activeTab === "closet"} icon="shopping-bag" label="옷장" onPress={() => router.push("/closet")} />
        <View style={styles.divider} />
        <NavItem active={activeTab === "history"} icon="archive" label="기록" onPress={() => router.push("/history")} />
        <View style={styles.divider} />
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
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: "#eee7dd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomNav: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 3,
  },
  navItem: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    position: "relative",
  },
  iconWrap: {
    width: 30,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconWrap: {
    backgroundColor: "#f3ede5",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#eee7dd",
    opacity: 0.9,
  },
  navTextActive: {
    color: "#111",
    fontSize: 10,
    fontWeight: "900",
  },
  navText: {
    color: "#8f8a84",
    fontSize: 10,
    fontWeight: "900",
  },
  activeLine: {
    position: "absolute",
    bottom: 0,
    width: 18,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#111",
  },
});
