import {
  type OutfitRecommendation,
} from "@/utils/outfitRecommend";
import { getOutfitFeedbackRankingAdjustment } from "@/utils/outfitFeedback";

export type OutfitSituation = {
  id: string;
  label: string;
  keywords: readonly string[];
  reason?: string;
};

function getRecommendationSearchText(recommendation: OutfitRecommendation) {
  return [
    recommendation.title,
    ...recommendation.tags,
    ...recommendation.reasons,
    ...recommendation.items.flatMap((item) => [
      item.category,
      item.subCategory,
      item.detailCategory,
      item.style,
      ...(item.styleTags || []),
      item.material,
      item.color,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSituationMatchScore(
  recommendation: OutfitRecommendation,
  keywords: readonly string[]
) {
  const searchText = getRecommendationSearchText(recommendation);

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    const matches = searchText.split(normalizedKeyword).length - 1;

    return score + matches;
  }, 0);
}

export function applyOutfitSituationRanking(
  recommendations: OutfitRecommendation[],
  situation?: OutfitSituation
) {
  if (!situation || situation.id === "all") return recommendations;

  const rankedRecommendations: (OutfitRecommendation & {
    situationMatchScore: number;
  })[] = [];

  recommendations.forEach((recommendation) => {
    const situationMatchScore = getSituationMatchScore(
      recommendation,
      situation.keywords
    );
    if (situationMatchScore <= 0) return;

    const reasons =
      situation.reason && !recommendation.reasons.includes(situation.reason)
        ? [situation.reason, ...recommendation.reasons]
        : recommendation.reasons;
    const alternatives = (recommendation.alternatives || [])
      .filter(
        (alternative) =>
          getSituationMatchScore(alternative, situation.keywords) > 0
      )
      .map((alternative) => ({
        ...alternative,
        tags: Array.from(new Set([situation.label, ...alternative.tags])).slice(0, 3),
      }));

    rankedRecommendations.push({
      ...recommendation,
      reasons,
      tags: Array.from(new Set([situation.label, ...recommendation.tags])).slice(0, 3),
      alternatives,
      alternativeCount: alternatives.length,
      situationMatchScore,
    });
  });

  return rankedRecommendations
    .sort((first, second) =>
      second.situationMatchScore - first.situationMatchScore ||
      getOutfitFeedbackRankingAdjustment(second.feedbackPreference) -
        getOutfitFeedbackRankingAdjustment(first.feedbackPreference) ||
      (second.feedbackTrendAdjustment || 0) -
        (first.feedbackTrendAdjustment || 0) ||
      second.score - first.score
    )
    .map(({ situationMatchScore, ...recommendation }) => recommendation);
}
