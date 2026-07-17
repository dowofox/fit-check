import { getRecommendationRevisionKey } from "@/utils/homeRecommendationIndex";
import type { RecommendationRevisionState } from "@/utils/homeRecommendationIndex";

export function canReuseHomeDashboardData(
  cachedDataKey: string | undefined,
  revisions: RecommendationRevisionState
) {
  return Boolean(
    cachedDataKey && cachedDataKey === getRecommendationRevisionKey(revisions)
  );
}
