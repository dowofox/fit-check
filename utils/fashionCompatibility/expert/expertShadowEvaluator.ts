import { aggregateDimensionEvaluations } from "@/utils/fashionCompatibility/expert/agreementMetrics";
import { REQUIRED_EXPERT_DIMENSIONS } from "@/utils/fashionCompatibility/expert/rubricRegistry";
import type {
  ExpertAbsoluteEvaluation,
  ExpertCompatibilityShadowResult,
  ExpertOutfitSnapshot,
} from "@/utils/fashionCompatibility/expert/types";

type EvaluateExpertShadowInput = {
  mode?: ExpertCompatibilityShadowResult["mode"];
  legacy: ExpertCompatibilityShadowResult["legacy"];
  featureSnapshot?: ExpertOutfitSnapshot;
  expertEvaluations?: readonly ExpertAbsoluteEvaluation[];
};

export function evaluateExpertCompatibilityShadow(
  input: EvaluateExpertShadowInput
): ExpertCompatibilityShadowResult {
  const mode = input.mode || "legacy-only";
  const warnings: string[] = [];
  if (mode !== "legacy-only" && !input.featureSnapshot) {
    warnings.push("expert-feature-snapshot-unavailable");
  }
  const matchingEvaluations = input.featureSnapshot
    ? (input.expertEvaluations || []).filter(
        (evaluation) => evaluation.outfitId === input.featureSnapshot?.outfitId
      )
    : [];
  if (mode === "expert-label-comparison" && matchingEvaluations.length === 0) {
    warnings.push("expert-labels-unavailable");
  }
  const aggregatedDimensions = Object.fromEntries(
    REQUIRED_EXPERT_DIMENSIONS.map((dimension) => {
      const aggregate = aggregateDimensionEvaluations(matchingEvaluations, dimension);
      return [
        dimension,
        {
          median: aggregate.median,
          confidence: aggregate.averageConfidence,
          disagreement: aggregate.disagreementSpan,
        },
      ];
    })
  );
  return {
    mode,
    legacy: input.legacy,
    featureSnapshot: mode === "legacy-only" ? undefined : input.featureSnapshot,
    expertLabels:
      mode === "expert-label-comparison" && matchingEvaluations.length
        ? {
            rubricVersion: matchingEvaluations[0].rubricVersion,
            evaluationCount: matchingEvaluations.length,
            aggregatedDimensions,
          }
        : undefined,
    warnings,
  };
}
