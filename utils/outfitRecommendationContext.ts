import type {
  OutfitRecommendationWeather,
} from "@/utils/outfitRecommend";
import {
  getCurrentSeasonForReadiness,
  getOutfitRecommendationReadiness,
  type OutfitRecommendationReadiness,
} from "@/utils/outfitRecommendationReadiness";
import type { OutfitRecommendationFeedback } from "@/utils/outfitFeedback";
import {
  getSavedOutfitItemIds,
  toRecommendationInputItems,
} from "@/utils/recommendationInput";
import type {
  ClosetItem,
  SavedOutfit,
  UserProfile,
} from "@/utils/storage";

export const OUTFIT_RECOMMENDATION_READINESS_POLICY_VERSION = 1;

export type OutfitRecommendationContext = {
  items: ClosetItem[];
  recommendationItems: ClosetItem[];
  profile: UserProfile | null;
  currentSeason: string;
  weather: OutfitRecommendationWeather | null;
  readiness: OutfitRecommendationReadiness;
  feedbacks: OutfitRecommendationFeedback[];
  savedOutfitItemIds: string[][];
  preferredItemIds?: string[];
};

type CreateOutfitRecommendationContextInput = {
  items: ClosetItem[];
  recommendationItems?: ClosetItem[];
  profile?: UserProfile | null;
  currentSeason?: string;
  weather?: OutfitRecommendationWeather | null;
  feedbacks?: OutfitRecommendationFeedback[];
  savedOutfits?: SavedOutfit[];
  savedOutfitItemIds?: string[][];
  preferredItemIds?: string[];
};

export function getOutfitRecommendationContextCacheKey(
  revisionKey: string,
  currentSeason = getCurrentSeasonForReadiness()
) {
  return [
    revisionKey,
    `readiness${OUTFIT_RECOMMENDATION_READINESS_POLICY_VERSION}`,
    `season:${currentSeason}`,
  ].join("|");
}

export function createOutfitRecommendationContext({
  items,
  recommendationItems = toRecommendationInputItems(items),
  profile = null,
  currentSeason = getCurrentSeasonForReadiness(),
  weather = null,
  feedbacks = [],
  savedOutfits = [],
  savedOutfitItemIds,
  preferredItemIds,
}: CreateOutfitRecommendationContextInput): OutfitRecommendationContext {
  return {
    items,
    recommendationItems,
    profile,
    currentSeason,
    weather,
    readiness: getOutfitRecommendationReadiness(
      items,
      currentSeason,
      weather
    ),
    feedbacks,
    savedOutfitItemIds:
      savedOutfitItemIds ?? getSavedOutfitItemIds(savedOutfits, items),
    preferredItemIds,
  };
}
