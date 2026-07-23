import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";

import type { ClosetAnalysisRefreshManager } from "@/utils/closetAnalysisRefreshManager";
import { closetAnalysisRefreshManager } from "@/utils/closetAnalysisRefreshRuntime";

const ClosetAnalysisRefreshContext =
  createContext<ClosetAnalysisRefreshManager | null>(null);

export function ClosetAnalysisRefreshProvider({
  children,
}: PropsWithChildren) {
  useEffect(() => {
    let isMounted = true;

    void closetAnalysisRefreshManager.hydrate().then(() => {
      if (isMounted && AppState.currentState === "active") {
        void closetAnalysisRefreshManager.resumeInterrupted();
      }
    });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void closetAnalysisRefreshManager.resumeInterrupted();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <ClosetAnalysisRefreshContext.Provider
      value={closetAnalysisRefreshManager}
    >
      {children}
    </ClosetAnalysisRefreshContext.Provider>
  );
}

export function useClosetAnalysisRefresh() {
  const manager = useContext(ClosetAnalysisRefreshContext);
  if (!manager) {
    throw new Error(
      "useClosetAnalysisRefresh must be used inside ClosetAnalysisRefreshProvider"
    );
  }

  const snapshot = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot
  );

  return useMemo(
    () => ({
      ...snapshot,
      isRunning: snapshot.job?.status === "running",
      start: (targetItemIds?: string[]) => manager.start(targetItemIds),
      cancel: () => manager.cancel(),
      resume: () => manager.resume(),
      retryFailed: () => manager.retryFailed(),
      clearResult: () => manager.clearResult(),
      refreshSnapshot: () => manager.hydrate(),
    }),
    [manager, snapshot]
  );
}
