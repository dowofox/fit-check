let performanceSequence = 0;

export type PerformanceTimer = string | null;

export function startPerformanceTimer(label: string): PerformanceTimer {
  if (!__DEV__) return null;

  performanceSequence += 1;
  const timerLabel = `[perf] ${label} #${performanceSequence}`;
  console.time(timerLabel);
  return timerLabel;
}

export function endPerformanceTimer(
  timerLabel: PerformanceTimer,
  details?: Record<string, unknown>
) {
  if (!timerLabel || !__DEV__) return;

  if (details) {
    console.info(`${timerLabel} details`, details);
  }
  console.timeEnd(timerLabel);
}
