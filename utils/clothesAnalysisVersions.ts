export const CURRENT_CLASSIFICATION_VERSION = 1;
export const CURRENT_PHOTO_ANALYSIS_VERSION = 1;

export function isAnalysisVersionOutdated(
  storedVersion: number | undefined,
  currentVersion: number
) {
  return !Number.isInteger(storedVersion) || (storedVersion || 0) < currentVersion;
}
