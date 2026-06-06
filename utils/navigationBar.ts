import { useFocusEffect } from "@react-navigation/native";
import * as NavigationBar from "expo-navigation-bar";
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";

export async function hideAndroidNavigationBar() {
  if (Platform.OS !== "android") return;

  try {
    await NavigationBar.setBehaviorAsync("overlay-swipe");
    await NavigationBar.setVisibilityAsync("hidden");
    await NavigationBar.setBackgroundColorAsync("#00000000");
    await NavigationBar.setButtonStyleAsync("dark");
  } catch (error) {
    console.log("NavigationBar hide failed:", error);
  }
}

export function useHideAndroidNavigationBar() {
  useEffect(() => {
    hideAndroidNavigationBar();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        hideAndroidNavigationBar();
      }
    });

    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      hideAndroidNavigationBar();

      const timeout = setTimeout(() => {
        hideAndroidNavigationBar();
      }, 300);

      return () => clearTimeout(timeout);
    }, [])
  );
}
