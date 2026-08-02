import type { OutfitColorFeatures } from "@/utils/fashionCompatibility/color/types";
import type { OutfitShapeFeatures } from "@/utils/fashionCompatibility/shape/types";

export const EXPERT_RUBRIC_VERSION = "expert-rubric-draft-v0.1" as const;
export const EXPERT_EVALUATION_SCHEMA_VERSION = "expert-evaluation-v1" as const;
export const EXPERT_PAIRWISE_SCHEMA_VERSION = "expert-pairwise-v1" as const;
export const EXPERT_DATASET_SCHEMA_VERSION = "expert-dataset-v1" as const;

export type ExpertRating = 1 | 2 | 3 | 4 | 5;
export type ExpertConfidence = ExpertRating;

export type EvaluationAvailability =
  | "rated"
  | "not_enough_information"
  | "not_applicable"
  | "abstained";

export type ExpertDimension =
  | "color_harmony"
  | "silhouette_balance"
  | "proportion_coherence"
  | "material_compatibility"
  | "style_coherence"
  | "occasion_suitability"
  | "body_fit_suitability"
  | "fit_preference_suitability"
  | "exposure_preference_suitability"
  | "temperature_suitability"
  | "rain_suitability"
  | "wind_suitability"
  | "season_suitability";

export type ExpertDimensionEvaluation = {
  dimension: ExpertDimension;
  availability: EvaluationAvailability;
  rating?: ExpertRating;
  confidence: ExpertConfidence;
  supportingEvidenceCodes: string[];
  conflictingEvidenceCodes: string[];
  notes?: string;
};

export type OverallCompatibilityEvaluation = Omit<
  ExpertDimensionEvaluation,
  "dimension"
> & {
  dimension: "overall_compatibility";
};

export type ExpertRubricDimensionDefinition = {
  id: ExpertDimension;
  label: string;
  description: string;
  anchors: Record<ExpertRating, string>;
  requiredContext: string[];
  allowedEvidenceCodes: string[];
  version: typeof EXPERT_RUBRIC_VERSION;
  status: "draft" | "expert_review" | "validated" | "retired";
  reviewedBy: string[];
  sourceReferences: string[];
};

export type OutfitEvaluationContext = {
  styleIntent:
    | "minimal"
    | "casual"
    | "street"
    | "formal"
    | "classic"
    | "preppy"
    | "sporty"
    | "gorpcore"
    | "techwear"
    | "romantic"
    | "experimental"
    | "mixed"
    | "unknown";
  occasion:
    | "daily"
    | "date"
    | "office"
    | "formal_event"
    | "travel"
    | "outdoor"
    | "exercise"
    | "unknown";
  season?: string;
  temperatureContext?: string;
  stylingState: {
    topTucked: "tucked" | "untucked" | "partial" | "not_applicable" | "unknown";
    outerWorn: "yes" | "no" | "unknown";
    closureState: "open" | "closed" | "mixed" | "unknown";
  };
};

export type SanitizedOutfitColorFeatures = Omit<
  OutfitColorFeatures,
  "version" | "pairwiseDeltaE00"
> & {
  pairwiseDeltaE00: Array<{
    anonymousItemIdA: string;
    anonymousItemIdB: string;
    deltaE00: number;
    lightnessDifference: number;
    chromaDifference: number;
    hueDifference?: number;
  }>;
};

export type SanitizedOutfitShapeFeatures = Omit<OutfitShapeFeatures, "version">;

export type ExpertOutfitSnapshot = {
  outfitId: string;
  outfitGroupId?: string;
  compositionGroupKey?: string;
  itemRefs: Array<{ anonymousItemId: string; category: string }>;
  context: OutfitEvaluationContext;
  featureVersions: {
    colorProfileVersion?: string;
    colorFeatureVersion?: string;
    shapeProfileVersion?: string;
    shapeFeatureVersion?: string;
    personalFitFeatureVersion?: string;
  };
  colorFeatures?: SanitizedOutfitColorFeatures;
  shapeFeatures?: SanitizedOutfitShapeFeatures;
  createdAt: string;
};

export type DatasetSplit = "unassigned" | "train" | "validation" | "test";

export type ExpertAbsoluteEvaluation = {
  schemaVersion: typeof EXPERT_EVALUATION_SCHEMA_VERSION;
  evaluationId: string;
  outfitId: string;
  rubricVersion: string;
  evaluatorId: string;
  evaluatorGroup?:
    | "stylist"
    | "fashion_student"
    | "trained_reviewer"
    | "pilot"
    | "unknown";
  dimensions: ExpertDimensionEvaluation[];
  overallCompatibility?: OverallCompatibilityEvaluation;
  evaluatorConfidence: ExpertConfidence;
  createdAt: string;
  durationSeconds?: number;
  datasetSplit?: DatasetSplit;
};

export type PairwisePreference = "a" | "b" | "tie" | "not_comparable";

export type ExpertPairwiseEvaluation = {
  schemaVersion: typeof EXPERT_PAIRWISE_SCHEMA_VERSION;
  evaluationId: string;
  outfitIdA: string;
  outfitIdB: string;
  contextCompatibility: "same_context" | "different_context" | "unknown";
  preferred: PairwisePreference;
  dimensions: Array<{
    dimension: ExpertDimension;
    preferred: PairwisePreference;
    confidence: ExpertConfidence;
    evidenceCodes: string[];
  }>;
  evaluatorId: string;
  rubricVersion: string;
  createdAt: string;
  datasetSplit?: DatasetSplit;
};

export type ExpertEvaluationDataset = {
  schemaVersion: typeof EXPERT_DATASET_SCHEMA_VERSION;
  datasetId: string;
  datasetVersion: string;
  rubricVersion: string;
  createdAt: string;
  source: "synthetic_test" | "expert_pilot" | "expert_validated" | "unknown";
  snapshots: ExpertOutfitSnapshot[];
  absoluteEvaluations: ExpertAbsoluteEvaluation[];
  pairwiseEvaluations: ExpertPairwiseEvaluation[];
  metadata: {
    evaluatorCount: number;
    outfitCount: number;
    targetCulture?: string;
    targetAudience?: string;
    notes?: string;
  };
  splitPolicy?: {
    seed: string;
    algorithmVersion: string;
    groupField: "outfitId" | "outfitGroupId" | "compositionGroupKey";
  };
};

export type DatasetValidationIssue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
};

export type DatasetStatistics = {
  outfits: number;
  evaluators: number;
  absoluteEvaluations: number;
  pairwiseEvaluations: number;
  ratedDimensions: number;
  unavailableDimensions: number;
};

export type DatasetValidationResult = {
  valid: boolean;
  errors: DatasetValidationIssue[];
  warnings: DatasetValidationIssue[];
  statistics: DatasetStatistics;
};

export type AggregatedDimensionEvaluation = {
  dimension: ExpertDimension;
  ratingCount: number;
  unavailableCount: number;
  median?: number;
  mean?: number;
  min?: number;
  max?: number;
  disagreementSpan?: number;
  averageConfidence?: number;
  consensusStatus: "insufficient" | "low" | "moderate" | "high";
};

export type DimensionAgreement = {
  responseCount: number;
  comparisonCount: number;
  exactAgreement?: number;
  adjacentAgreement?: number;
  meanAbsoluteDifference?: number;
};

export type ExpertDatasetReport = {
  datasetId: string;
  datasetVersion: string;
  valid: boolean;
  counts: {
    outfits: number;
    evaluators: number;
    absoluteEvaluations: number;
    pairwiseEvaluations: number;
  };
  coverageByDimension: Record<string, number>;
  unavailableRateByDimension: Record<string, number>;
  confidenceByDimension: Record<string, number>;
  agreementByDimension: Record<string, DimensionAgreement>;
  pairwiseAgreement?: number;
  pairwiseTieRate: number;
  pairwiseNotComparableRate: number;
  evaluatorBias: Record<string, number>;
  highDisagreementOutfitIds: string[];
  validationErrors: number;
  validationWarnings: number;
};

export type ExpertCompatibilityShadowResult = {
  mode: "legacy-only" | "features-only" | "expert-label-comparison";
  legacy: {
    totalScore: number;
    colorScore: number;
    silhouetteScore: number;
    wearFitScore: number;
  };
  featureSnapshot?: ExpertOutfitSnapshot;
  expertLabels?: {
    rubricVersion: string;
    evaluationCount: number;
    aggregatedDimensions: Record<
      string,
      { median?: number; confidence?: number; disagreement?: number }
    >;
  };
  professionalScore?: number;
  scoreDifference?: number;
  warnings: string[];
};
