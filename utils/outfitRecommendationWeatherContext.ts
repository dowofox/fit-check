import type { OutfitRecommendationWeather } from "@/utils/outfitRecommend";
import { getCachedWeatherRecommendationResult } from "@/utils/weather";

export type OutfitRecommendationWeatherContext = {
  weather: OutfitRecommendationWeather | null;
  source: "cache" | "season_only";
};

export async function getOutfitRecommendationWeatherContext(): Promise<OutfitRecommendationWeatherContext> {
  const cachedResult = await getCachedWeatherRecommendationResult();

  return {
    weather: cachedResult.weather,
    source: cachedResult.weather ? "cache" : "season_only",
  };
}
