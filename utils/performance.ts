let performanceSequence = 0;

export type PerformanceTimer = {
  label: string;
  startedAt: number;
} | null;

export function startPerformanceTimer(label: string): PerformanceTimer {
  if (!__DEV__) return null;

  performanceSequence += 1;
  const timerLabel = `[perf] ${label} #${performanceSequence}`;
  console.time(timerLabel);
  return {
    label: timerLabel,
    startedAt: Date.now(),
  };
}

export function endPerformanceTimer(
  timer: PerformanceTimer,
  details?: Record<string, unknown>
) {
  if (!timer || !__DEV__) return;

  const durationMs = Date.now() - timer.startedAt;

  console.info(`${timer.label} details`, {
    durationMs,
    ...(details || {}),
  });
  console.timeEnd(timer.label);
}

export function logPerformanceMetric(label: string, details: Record<string, unknown>) {
  if (!__DEV__) return;
  console.info(`[perf] ${label}`, details);
}
