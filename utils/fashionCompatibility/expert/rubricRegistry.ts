import {
  EXPERT_RUBRIC_VERSION,
  type ExpertDimension,
  type ExpertRating,
  type ExpertRubricDimensionDefinition,
} from "@/utils/fashionCompatibility/expert/types";

export const EXPERT_EVIDENCE_CODES = Object.freeze([
  "color.achromatic_palette",
  "color.low_lightness_contrast",
  "color.high_lightness_contrast",
  "color.similar_hue",
  "color.opposing_hue",
  "color.mixed_temperature",
  "color.accent_candidate_present",
  "color.input_confidence_low",
  "shape.short_top_long_bottom",
  "shape.long_top_long_bottom",
  "shape.high_volume_difference",
  "shape.low_volume_difference",
  "shape.upper_visual_weight",
  "shape.lower_visual_weight",
  "shape.outer_dominant",
  "shape.measurement_coverage_low",
  "supports_declared_intent",
  "conflicts_with_declared_intent",
  "neutral_for_declared_intent",
  "insufficient_context",
] as const);

const SHARED_ANCHORS: Record<ExpertRating, string> = Object.freeze({
  1: "Multiple clear conflicts exist within the declared intent or occasion.",
  2: "Some elements connect, but an important mismatch remains.",
  3: "A neutral, acceptable result with neither a major conflict nor a strong advantage.",
  4: "Most elements are consistent within the declared intent.",
  5: "Multiple elements connect intentionally and show high overall completion.",
});

const COLOR_EVIDENCE = EXPERT_EVIDENCE_CODES.filter(
  (code) => code.startsWith("color.") || !code.includes(".")
);
const SHAPE_EVIDENCE = EXPERT_EVIDENCE_CODES.filter(
  (code) => code.startsWith("shape.") || !code.includes(".")
);
const CONTEXT_EVIDENCE = EXPERT_EVIDENCE_CODES.filter((code) => !code.includes("."));

function definition(
  id: ExpertDimension,
  label: string,
  description: string,
  requiredContext: string[],
  allowedEvidenceCodes: readonly string[]
): ExpertRubricDimensionDefinition {
  return Object.freeze({
    id,
    label,
    description,
    anchors: SHARED_ANCHORS,
    requiredContext: Object.freeze([...requiredContext]) as string[],
    allowedEvidenceCodes: Object.freeze([...allowedEvidenceCodes]) as string[],
    version: EXPERT_RUBRIC_VERSION,
    status: "draft",
    reviewedBy: [],
    sourceReferences: [],
  });
}

export const EXPERT_RUBRIC_REGISTRY = Object.freeze([
  definition("color_harmony", "Color harmony", "Color relationships within the declared styling intent.", ["styleIntent"], COLOR_EVIDENCE),
  definition("silhouette_balance", "Silhouette balance", "The distribution of garment volume and visual weight.", ["stylingState"], SHAPE_EVIDENCE),
  definition("proportion_coherence", "Proportion coherence", "How garment lengths and proportions relate as a whole.", ["stylingState"], SHAPE_EVIDENCE),
  definition("material_compatibility", "Material compatibility", "How visible material qualities relate within the outfit.", ["styleIntent"], CONTEXT_EVIDENCE),
  definition("style_coherence", "Style coherence", "Consistency with the declared style intent.", ["styleIntent"], EXPERT_EVIDENCE_CODES),
  definition("occasion_suitability", "Occasion suitability", "Suitability for the declared occasion.", ["occasion"], CONTEXT_EVIDENCE),
  definition("body_fit_suitability", "Body fit suitability", "Fit suitability when sufficient body and garment context exists.", ["stylingState"], SHAPE_EVIDENCE),
  definition("fit_preference_suitability", "Fit preference suitability", "Alignment with a separately declared fit preference.", ["styleIntent"], SHAPE_EVIDENCE),
  definition("exposure_preference_suitability", "Exposure preference suitability", "Alignment with separately declared exposure preferences.", ["stylingState"], CONTEXT_EVIDENCE),
  definition("temperature_suitability", "Temperature suitability", "Suitability for the recorded temperature context without replacing operational weather rules.", ["temperatureContext"], CONTEXT_EVIDENCE),
  definition("rain_suitability", "Rain suitability", "Suitability for explicitly recorded rain context.", ["occasion"], CONTEXT_EVIDENCE),
  definition("wind_suitability", "Wind suitability", "Suitability for explicitly recorded wind context.", ["occasion"], CONTEXT_EVIDENCE),
  definition("season_suitability", "Season suitability", "Suitability for the recorded season context.", ["season"], CONTEXT_EVIDENCE),
] satisfies readonly ExpertRubricDimensionDefinition[]);

export const REQUIRED_EXPERT_DIMENSIONS = Object.freeze(
  EXPERT_RUBRIC_REGISTRY.map((definition) => definition.id)
) as readonly ExpertDimension[];

export function getExpertRubricDimension(dimension: ExpertDimension) {
  return EXPERT_RUBRIC_REGISTRY.find((definition) => definition.id === dimension);
}

export function isKnownExpertEvidenceCode(value: string) {
  return (EXPERT_EVIDENCE_CODES as readonly string[]).includes(value);
}
