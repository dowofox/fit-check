import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";

import ClosetAnalysisRefreshGlobalStatus from "@/components/ClosetAnalysisRefreshGlobalStatus";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ClosetAnalysisRefreshProvider } from "@/providers/ClosetAnalysisRefreshProvider";
import { endPerformanceTimer, startPerformanceTimer } from "@/utils/performance";

let appStartTimer = startPerformanceTimer("app.start-to-root-mounted");

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    endPerformanceTimer(appStartTimer);
    appStartTimer = null;

    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("visible");
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <ClosetAnalysisRefreshProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="analyzing" options={{ headerShown: false }} />
          <Stack.Screen name="result" options={{ headerShown: false }} />
          <Stack.Screen name="history" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="closet" options={{ headerShown: false }} />
          <Stack.Screen name="clothes-detail" options={{ headerShown: false }} />
          <Stack.Screen name="add-clothes" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
        </Stack>

        <ClosetAnalysisRefreshGlobalStatus />
        <StatusBar style="auto" />
      </ClosetAnalysisRefreshProvider>
    </ThemeProvider>
  );
}
