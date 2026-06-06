import { Feather } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

export type BottomNavTab = "home" | "analyze" | "history" | "profile";

async function hideAndroidNavigationBar() {
  if (Platform.OS !== "android") return;

  try {
    await NavigationBar.setBehaviorAsync("overlay-swipe");
    await NavigationBar.setVisibilityAsync("hidden");
    await NavigationBar.setBackgroundColorAsync("#00000000");
  } catch (error) {
    console.log("NavigationBar hide failed:", error);
  }
}

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
      {active ? (
        <View style={styles.activeIconCircle}>
          <Feather name={icon} size={18} color="#fff" />
        </View>
      ) : (
        <Feather name={icon} size={20} color="#8c8c8c" />
      )}
      <Text style={active ? styles.navTextActive : styles.navText}>{label}</Text>
    </Pressable>
  );
}

export default function BottomNav({ activeTab }: { activeTab: BottomNavTab }) {
  return (
    <View style={styles.bottomNav}>
      <NavItem
        active={activeTab === "home"}
        icon="home"
        label="홈"
        onPress={() => router.replace("/")}
      />
      <NavItem
        active={activeTab === "analyze"}
        icon="search"
        label="분석"
        onPress={() => router.replace("/")}
      />
      <NavItem
        active={activeTab === "history"}
        icon="archive"
        label="기록"
        onPress={() => router.push("/history")}
      />
      <NavItem
        active={activeTab === "profile"}
        icon="user"
        label="마이"
        onPress={() => router.push("/profile")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 66,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderColor: "#eee7dd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 8,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 54,
    gap: 3,
  },
  activeIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  navTextActive: {
    color: "#111",
    fontSize: 10,
    fontWeight: "900",
  },
  navText: {
    color: "#8c8c8c",
    fontSize: 10,
    fontWeight: "900",
  },
});
