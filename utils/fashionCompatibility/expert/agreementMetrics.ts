import type {
  AggregatedDimensionEvaluation,
  DimensionAgreement,
  ExpertAbsoluteEvaluation,
  ExpertDimension,
  ExpertPairwiseEvaluation,
  ExpertRating,
  PairwisePreference,
} from "@/utils/fashionCompatibility/expert/types";
import { REQUIRED_EXPERT_DIMENSIONS } from "@/utils/fashionCompatibility/expert/rubricRegistry";
import { getStablePairKey } from "@/utils/fashionCompatibility/expert/evaluationValidation";

function average(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function median(values: readonly number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function consensusStatus(ratingCount: number, span: number | undefined): AggregatedDimensionEvaluation["consensusStatus"] {
  if (ratingCount < 2) return "insufficient";
  if (span === 0) return "high";
  if ((span ?? Infinity) <= 1) return "moderate";
  return "low";
}

export function aggregateDimensionEvaluations(
  evaluations: readonly ExpertAbsoluteEvaluation[],
  dimension: ExpertDimension
): AggregatedDimensionEvaluation {
  const entries = evaluations
    .flatMap((evaluation) => evaluation.dimensions)
    .filter((entry) => entry.dimension === dimension);
  const rated = entries.filter(
    (entry): entry is typeof entry & { rating: ExpertRating } =>
      entry.availability === "rated" && entry.rating !== undefined
  );
  const ratings = rated.map((entry) => entry.rating);
  const min = ratings.length ? Math.min(...ratings) : undefined;
  const max = ratings.length ? Math.max(...ratings) : undefined;
  const span = min !== undefined && max !== undefined ? max - min : undefined;
  return {
    dimension,
    ratingCount: ratings.length,
    unavailableCount: entries.length - ratings.length,
    median: median(ratings),
    mean: average(ratings),
    min,
    max,
    disagreementSpan: span,
    averageConfidence: average(entries.map((entry) => entry.confidence)),
    consensusStatus: consensusStatus(ratings.length, span),
  };
}

export function calculateAgreementByDimension(
  evaluations: readonly ExpertAbsoluteEvaluation[]
): Record<ExpertDimension, DimensionAgreement> {
  return Object.fromEntries(
    REQUIRED_EXPERT_DIMENSIONS.map((dimension) => {
      const ratingsByOutfit = new Map<string, number[]>();
      let responseCount = 0;
      for (const evaluation of evaluations) {
        const entry = evaluation.dimensions.find((candidate) => candidate.dimension === dimension);
        if (entry?.availability !== "rated" || entry.rating === undefined) continue;
        responseCount += 1;
        const ratings = ratingsByOutfit.get(evaluation.outfitId) || [];
        ratings.push(entry.rating);
        ratingsByOutfit.set(evaluation.outfitId, ratings);
      }
      let comparisons = 0;
      let exact = 0;
      let adjacent = 0;
      let differenceTotal = 0;
      for (const ratings of ratingsByOutfit.values()) {
        for (let first = 0; first < ratings.length; first += 1) {
          for (let second = first + 1; second < ratings.length; second += 1) {
            const difference = Math.abs(ratings[first] - ratings[second]);
            comparisons += 1;
            differenceTotal += difference;
            if (difference === 0) exact += 1;
            if (difference <= 1) adjacent += 1;
          }
        }
      }
      return [
        dimension,
        {
          responseCount,
          comparisonCount: comparisons,
          exactAgreement: comparisons ? exact / comparisons : undefined,
          adjacentAgreement: comparisons ? adjacent / comparisons : undefined,
          meanAbsoluteDifference: comparisons ? differenceTotal / comparisons : undefined,
        },
      ];
    })
  ) as Record<ExpertDimension, DimensionAgreement>;
}

function normalizePreference(evaluation: ExpertPairwiseEvaluation): PairwisePreference {
  if (evaluation.preferred === "tie" || evaluation.preferred === "not_comparable") return evaluation.preferred;
  const normalOrder = evaluation.outfitIdA <= evaluation.outfitIdB;
  if (normalOrder) return evaluation.preferred;
  return evaluation.preferred === "a" ? "b" : "a";
}

export function calculatePairwiseAgreement(evaluations: readonly ExpertPairwiseEvaluation[]) {
  const grouped = new Map<string, PairwisePreference[]>();
  let ties = 0;
  let notComparable = 0;
  evaluations.forEach((evaluation) => {
    const normalized = normalizePreference(evaluation);
    if (normalized === "tie") ties += 1;
    if (normalized === "not_comparable") {
      notComparable += 1;
      return;
    }
    const key = getStablePairKey(evaluation.outfitIdA, evaluation.outfitIdB);
    const preferences = grouped.get(key) || [];
    preferences.push(normalized);
    grouped.set(key, preferences);
  });
  let comparisons = 0;
  let agreements = 0;
  for (const preferences of grouped.values()) {
    for (let first = 0; first < preferences.length; first += 1) {
      for (let second = first + 1; second < preferences.length; second += 1) {
        comparisons += 1;
        if (preferences[first] === preferences[second]) agreements += 1;
      }
    }
  }
  return {
    agreement: comparisons ? agreements / comparisons : undefined,
    comparisonCount: comparisons,
    tieRate: evaluations.length ? ties / evaluations.length : 0,
    notComparableRate: evaluations.length ? notComparable / evaluations.length : 0,
  };
}

export function calculateEvaluatorBias(evaluations: readonly ExpertAbsoluteEvaluation[]) {
  const allRatings = evaluations.flatMap((evaluation) =>
    evaluation.dimensions
      .filter((entry) => entry.availability === "rated" && entry.rating !== undefined)
      .map((entry) => entry.rating as number)
  );
  const overallMean = average(allRatings);
  if (overallMean === undefined) return {};
  const ratingsByEvaluator = new Map<string, number[]>();
  evaluations.forEach((evaluation) => {
    const ratings = ratingsByEvaluator.get(evaluation.evaluatorId) || [];
    evaluation.dimensions.forEach((entry) => {
      if (entry.availability === "rated" && entry.rating !== undefined) ratings.push(entry.rating);
    });
    ratingsByEvaluator.set(evaluation.evaluatorId, ratings);
  });
  return Object.fromEntries(
    [...ratingsByEvaluator].map(([evaluatorId, ratings]) => [
      evaluatorId,
      (average(ratings) ?? overallMean) - overallMean,
    ])
  );
}
