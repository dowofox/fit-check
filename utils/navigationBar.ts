import { useFocusEffect } from "@react-navigation/native";
import * as NavigationBar from "expo-navigation-bar";
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";

export async function hideAndroidNavigationBar() {
  if (Platform.OS !== "android") return;

  try {
    await NavigationBar.setVisibilityAsync("hidden");
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

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        hideWithDelay();
      }
    });

    return () => {
      clearDelays();
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
