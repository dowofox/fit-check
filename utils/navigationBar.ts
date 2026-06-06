import { useFocusEffect } from "@react-navigation/native";
import * as NavigationBar from "expo-navigation-bar";
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";

export async function hideAndroidNavigationBar() {
  if (Platform.OS !== "android") return;

  try {
    await NavigationBar.setPositionAsync("absolute");
    await NavigationBar.setBehaviorAsync("overlay-swipe");
    await NavigationBar.setVisibilityAsync("hidden");
    await NavigationBar.setBackgroundColorAsync("#00000000");
    await NavigationBar.setButtonStyleAsync("dark");
  } catch (error) {
    console.log("NavigationBar hide failed:", error);
  }
}

function hideWithDelay() {
  hideAndroidNavigationBar();

  const first = setTimeout(() => hideAndroidNavigationBar(), 250);
  const second = setTimeout(() => hideAndroidNavigationBar(), 800);

  return () => {
    clearTimeout(first);
    clearTimeout(second);
  };
}

export function useHideAndroidNavigationBar() {
  useEffect(() => {
    const clearDelays = hideWithDelay();

    const interval = setInterval(() => {
      hideAndroidNavigationBar();
    }, 2000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        hideWithDelay();
      }
    });

    return () => {
      clearDelays();
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const clearDelays = hideWithDelay();

      return () => clearDelays();
    }, [])
  );
}
