import {
  EXPERT_RUBRIC_VERSION,
  type ExpertContextRequirement,
  type ExpertDimension,
  type ExpertEvidenceDefinition,
  type ExpertEvidenceOrigin,
  type ExpertObservationRequirement,
  type ExpertObservationSignal,
  type ExpertRating,
  type ExpertRubricDimensionDefinition,
} from "@/utils/fashionCompatibility/expert/types";

const ALL_DIMENSIONS: ExpertDimension[] = [
  "color_harmony",
  "silhouette_balance",
  "proportion_coherence",
  "material_compatibility",
  "style_coherence",
  "occasion_suitability",
  "body_fit_suitability",
  "fit_preference_suitability",
  "exposure_preference_suitability",
  "temperature_suitability",
  "rain_suitability",
  "wind_suitability",
  "season_suitability",
];

function evidence(
  code: string,
  origin: ExpertEvidenceOrigin,
  allowedDimensions: ExpertDimension[],
  description: string,
  polarity: ExpertEvidenceDefinition["polarity"] = "neutral_observation"
): ExpertEvidenceDefinition {
  return {
    code,
    label: code.split(".").at(-1)?.replaceAll("_", " ") || code,
    description,
    origin,
    allowedDimensions,
    polarity,
    status: "draft",
  };
}

const COLOR_DIMENSIONS: ExpertDimension[] = ["color_harmony", "style_coherence"];
const SHAPE_DIMENSIONS: ExpertDimension[] = [
  "silhouette_balance",
  "proportion_coherence",
  "body_fit_suitability",
  "fit_preference_suitability",
  "style_coherence",
];

export const EXPERT_EVIDENCE_REGISTRY = Object.freeze([
  evidence("color.achromatic_palette", "derived_color_feature", COLOR_DIMENSIONS, "The derived palette is predominantly achromatic."),
  evidence("color.low_lightness_contrast", "derived_color_feature", COLOR_DIMENSIONS, "Derived lightness contrast is low."),
  evidence("color.high_lightness_contrast", "derived_color_feature", COLOR_DIMENSIONS, "Derived lightness contrast is high."),
  evidence("color.similar_hue", "derived_color_feature", COLOR_DIMENSIONS, "Derived hues are similar."),
  evidence("color.opposing_hue", "derived_color_feature", COLOR_DIMENSIONS, "Derived hues are opposed."),
  evidence("color.mixed_temperature", "derived_color_feature", COLOR_DIMENSIONS, "Derived color temperatures are mixed."),
  evidence("color.accent_candidate_present", "derived_color_feature", COLOR_DIMENSIONS, "A derived accent candidate is present."),
  evidence("color.input_confidence_low", "derived_color_feature", COLOR_DIMENSIONS, "Derived color input confidence is low."),
  evidence("shape.short_top_long_bottom", "derived_shape_feature", SHAPE_DIMENSIONS, "The derived length relation is short top to long bottom."),
  evidence("shape.long_top_long_bottom", "derived_shape_feature", SHAPE_DIMENSIONS, "The derived length relation is long top to long bottom."),
  evidence("shape.high_volume_difference", "derived_shape_feature", SHAPE_DIMENSIONS, "Derived garment volume differs substantially."),
  evidence("shape.low_volume_difference", "derived_shape_feature", SHAPE_DIMENSIONS, "Derived garment volume is similar."),
  evidence("shape.upper_visual_weight", "derived_shape_feature", SHAPE_DIMENSIONS, "Derived visual weight is concentrated above."),
  evidence("shape.lower_visual_weight", "derived_shape_feature", SHAPE_DIMENSIONS, "Derived visual weight is concentrated below."),
  evidence("shape.outer_dominant", "derived_shape_feature", SHAPE_DIMENSIONS, "The derived outer layer dominates the silhouette."),
  evidence("shape.measurement_coverage_low", "derived_shape_feature", SHAPE_DIMENSIONS, "Derived shape measurement coverage is low."),
  evidence("material.similar_surface", "human_observed_material", ["material_compatibility"], "Observed surfaces appear similar; this does not imply compatibility."),
  evidence("material.mixed_surface", "human_observed_material", ["material_compatibility"], "Observed surfaces appear mixed; this does not imply incompatibility."),
  evidence("material.similar_structure", "human_observed_material", ["material_compatibility"], "Observed structures appear similar."),
  evidence("material.mixed_structure", "human_observed_material", ["material_compatibility"], "Observed structures appear mixed."),
  evidence("material.similar_drape", "human_observed_material", ["material_compatibility"], "Observed drape appears similar."),
  evidence("material.mixed_drape", "human_observed_material", ["material_compatibility"], "Observed drape appears mixed."),
  evidence("material.weight_contrast", "human_observed_material", ["material_compatibility"], "An observed material-weight contrast is present."),
  evidence("material.layering_weight_difference_observed", "human_observed_material", ["material_compatibility"], "A visible difference in layering material weight was observed; the observation itself does not determine compatibility."),
  evidence("material.seasonal_context_present", "human_observed_material", ["material_compatibility"], "Seasonal material context was available to the evaluator."),
  evidence("material.input_confidence_low", "human_observed_material", ["material_compatibility"], "The evaluator had low confidence in visible material cues."),
  evidence("material.not_visually_assessable", "human_observed_material", ["material_compatibility"], "Material qualities were not visually assessable."),
  evidence("supports_declared_intent", "context_interpretation", ALL_DIMENSIONS, "The observation supports the declared context.", "context_direction"),
  evidence("conflicts_with_declared_intent", "context_interpretation", ALL_DIMENSIONS, "The observation conflicts with the declared context.", "context_direction"),
  evidence("neutral_for_declared_intent", "context_interpretation", ALL_DIMENSIONS, "The observation is neutral for the declared context.", "context_direction"),
  evidence("insufficient_context", "context_interpretation", ALL_DIMENSIONS, "The available context is insufficient to rate.", "context_direction"),
] satisfies readonly ExpertEvidenceDefinition[]);

export const EXPERT_EVIDENCE_CODES = Object.freeze(
  EXPERT_EVIDENCE_REGISTRY.map((entry) => entry.code)
);

export const EXPERT_DIMENSION_ANCHORS: Record<
  ExpertDimension,
  Record<ExpertRating, string>
> = {
  color_harmony: { 1: "Repeated color relationships conflict with the declared intent.", 2: "Some colors connect, but a prominent relationship remains difficult in context.", 3: "Color relationships are acceptable without a strong conflict or connection.", 4: "Most colors connect clearly within the declared intent.", 5: "Base, supporting, and accent colors form an intentional relationship in context." },
  silhouette_balance: { 1: "Volume or visual weight conflicts at several points in the declared styling state.", 2: "The silhouette has a useful connection but remains noticeably unbalanced.", 3: "The silhouette is usable without a strong imbalance or emphasis.", 4: "Volume and visual weight are mostly balanced for the intent.", 5: "Volume and visual weight support the declared silhouette intentionally." },
  proportion_coherence: { 1: "Lengths and divisions repeatedly disrupt the intended proportion.", 2: "One important length or division weakens the overall proportion.", 3: "Proportions are serviceable without a clear advantage or conflict.", 4: "Most lengths and divisions support the intended proportion.", 5: "Lengths, divisions, and styling state create a deliberate proportion." },
  material_compatibility: { 1: "Observed surface, structure, drape, or weight relationships repeatedly conflict in context.", 2: "Some material qualities connect, but an important mismatch remains.", 3: "No clear material conflict or strong material connection is observed.", 4: "Most observed material qualities relate coherently in context.", 5: "Observed material qualities intentionally reinforce the declared styling context." },
  style_coherence: { 1: "Several elements contradict the declared style intent.", 2: "The intent is partly visible, but a major element pulls away from it.", 3: "The outfit is stylistically usable but not strongly directed.", 4: "Most elements consistently express the declared intent.", 5: "The outfit expresses the declared intent with deliberate, connected choices." },
  occasion_suitability: { 1: "Several elements are clearly unsuitable for the declared occasion.", 2: "The outfit is partly usable, but one major occasion requirement is missed.", 3: "The outfit is acceptable for the occasion without a clear strength.", 4: "Most elements suit the declared occasion well.", 5: "The outfit fully and intentionally supports the declared occasion." },
  body_fit_suitability: { 1: "Available non-sensitive fit context indicates several major suitability conflicts.", 2: "Available fit context indicates an important mismatch despite some workable elements.", 3: "Available fit context indicates a neutral, usable result.", 4: "Available fit context indicates generally suitable balance.", 5: "Available fit context strongly supports the outfit's fit balance." },
  fit_preference_suitability: { 1: "The observed fit repeatedly conflicts with the declared fit preference context.", 2: "The fit partly aligns, but an important preference mismatch remains.", 3: "The fit is neutral relative to the declared preference.", 4: "Most fit choices align with the declared preference.", 5: "The fit consistently and intentionally expresses the declared preference." },
  exposure_preference_suitability: { 1: "The outfit clearly conflicts with the declared exposure preference context.", 2: "A notable exposure preference mismatch remains.", 3: "Exposure is neutral relative to the declared preference.", 4: "The outfit mostly aligns with the declared exposure preference.", 5: "The outfit consistently supports the declared exposure preference." },
  temperature_suitability: { 1: "The outfit is repeatedly unsuitable for the recorded temperature context.", 2: "A major warmth or breathability mismatch remains.", 3: "The outfit is usable for the recorded temperature without a clear advantage.", 4: "Most elements suit the recorded temperature.", 5: "Layering and material choices strongly support the recorded temperature." },
  rain_suitability: { 1: "The outfit has several clear conflicts with the recorded rain context.", 2: "One important rain-related suitability issue remains.", 3: "The outfit is usable without a clear rain advantage or conflict.", 4: "Most choices suit the recorded rain context.", 5: "The outfit intentionally addresses the recorded rain context." },
  wind_suitability: { 1: "The outfit has several clear conflicts with the recorded wind context.", 2: "One important wind-related suitability issue remains.", 3: "The outfit is usable without a clear wind advantage or conflict.", 4: "Most choices suit the recorded wind context.", 5: "The outfit intentionally addresses the recorded wind context." },
  season_suitability: { 1: "Several elements clearly conflict with the recorded season context.", 2: "A major seasonal mismatch remains despite some suitable elements.", 3: "The outfit is seasonally usable without a clear advantage.", 4: "Most elements suit the recorded season.", 5: "The outfit intentionally expresses and supports the recorded season." },
};

const unavailable = ["unknown", "not_available"];
const requirements: Record<ExpertDimension, ExpertContextRequirement[]> = {
  color_harmony: [{ field: "styleIntent", policy: "recommended", unavailableValues: ["unknown"] }],
  silhouette_balance: [{ field: "stylingState.outerWorn", policy: "recommended", unavailableValues: ["unknown"] }],
  proportion_coherence: [{ field: "stylingState.topTucked", policy: "recommended", unavailableValues: ["unknown", "not_applicable"] }],
  material_compatibility: [{ field: "styleIntent", policy: "recommended", unavailableValues: ["unknown"] }],
  style_coherence: [{ field: "styleIntent", policy: "required", unavailableValues: ["unknown"] }],
  occasion_suitability: [{ field: "occasion", policy: "required", unavailableValues: ["unknown"] }],
  body_fit_suitability: [{ field: "bodyFitContext", policy: "required", unavailableValues: [...unavailable, "not_applicable"] }],
  fit_preference_suitability: [{ field: "fitPreferenceContext", policy: "required", unavailableValues: unavailable }],
  exposure_preference_suitability: [{ field: "exposurePreferenceContext", policy: "required", unavailableValues: unavailable }],
  temperature_suitability: [{ field: "temperatureContext", policy: "required", unavailableValues: ["unknown"] }],
  rain_suitability: [{ field: "rainContext", policy: "required", unavailableValues: ["unknown"] }],
  wind_suitability: [{ field: "windContext", policy: "required", unavailableValues: ["unknown"] }],
  season_suitability: [{ field: "season", policy: "required", unavailableValues: ["unknown"] }],
};

const anyOf = (...signals: ExpertObservationSignal[]) => ({ mode: "any_of" as const, signals });
const allOf = (...signals: ExpertObservationSignal[]) => ({ mode: "all_of" as const, signals });

const observationRequirements: Record<
  ExpertDimension,
  ExpertObservationRequirement[]
> = {
  color_harmony: [{ policy: "required", groups: [anyOf("image_available", "color_features_available")], rationale: "Color harmony requires a visible outfit or derived color features." }],
  silhouette_balance: [{ policy: "required", groups: [anyOf("image_available", "shape_features_available")], rationale: "Silhouette balance requires a visible outfit or derived shape features." }],
  proportion_coherence: [{ policy: "required", groups: [anyOf("image_available", "shape_features_available")], rationale: "Proportion coherence requires a visible outfit or derived shape features." }],
  material_compatibility: [{ policy: "required", groups: [anyOf("image_available", "material_context_available")], rationale: "Material compatibility requires visible material cues or approved material context." }],
  style_coherence: [{ policy: "required", groups: [allOf("image_available")], rationale: "The sanitized snapshot has no equivalent full style description." }],
  occasion_suitability: [{ policy: "required", groups: [allOf("image_available")], rationale: "Occasion suitability requires the full visible outfit." }],
  body_fit_suitability: [{ policy: "required", groups: [allOf("body_fit_context_available"), anyOf("image_available", "shape_features_available")], rationale: "Body-fit suitability needs non-sensitive fit context plus observable shape." }],
  fit_preference_suitability: [{ policy: "required", groups: [allOf("fit_preference_context_available"), anyOf("image_available", "shape_features_available")], rationale: "Fit-preference suitability needs preference availability plus observable shape." }],
  exposure_preference_suitability: [{ policy: "required", groups: [allOf("exposure_preference_context_available", "image_available")], rationale: "Exposure preference requires preference availability and a visible outfit." }],
  temperature_suitability: [{ policy: "required", groups: [allOf("image_available")], rationale: "The expert snapshot does not expose the operational temperature engine result." }],
  rain_suitability: [{ policy: "required", groups: [allOf("image_available")], rationale: "Rain suitability requires the visible outfit." }],
  wind_suitability: [{ policy: "required", groups: [allOf("image_available")], rationale: "Wind suitability requires the visible outfit." }],
  season_suitability: [{ policy: "required", groups: [allOf("image_available")], rationale: "Season suitability requires the visible outfit." }],
};

function definition(
  id: ExpertDimension,
  label: string,
  description: string
): ExpertRubricDimensionDefinition {
  return Object.freeze({
    id,
    label,
    description,
    anchors: Object.freeze({ ...EXPERT_DIMENSION_ANCHORS[id] }),
    contextRequirements: requirements[id].map((entry) => ({
      ...entry,
      unavailableValues: entry.unavailableValues ? [...entry.unavailableValues] : undefined,
    })),
    observationRequirements: observationRequirements[id].map((requirement) => ({
      ...requirement,
      groups: requirement.groups.map((group) => ({ ...group, signals: [...group.signals] })),
    })),
    allowedEvidenceCodes: EXPERT_EVIDENCE_REGISTRY
      .filter((entry) => entry.allowedDimensions.includes(id))
      .map((entry) => entry.code),
    version: EXPERT_RUBRIC_VERSION,
    status: "draft",
    reviewedBy: [],
    sourceReferences: [],
  });
}

export const EXPERT_RUBRIC_REGISTRY = Object.freeze([
  definition("color_harmony", "Color harmony", "Color relationships within the declared styling intent."),
  definition("silhouette_balance", "Silhouette balance", "The distribution of garment volume and visual weight."),
  definition("proportion_coherence", "Proportion coherence", "How garment lengths and proportions relate as a whole."),
  definition("material_compatibility", "Material compatibility", "How visible material qualities relate within the outfit."),
  definition("style_coherence", "Style coherence", "Consistency with the declared style intent."),
  definition("occasion_suitability", "Occasion suitability", "Suitability for the declared occasion."),
  definition("body_fit_suitability", "Body fit suitability", "Fit suitability when sufficient non-sensitive context exists."),
  definition("fit_preference_suitability", "Fit preference suitability", "Alignment with availability of a separately declared fit preference."),
  definition("exposure_preference_suitability", "Exposure preference suitability", "Alignment with availability of separately declared exposure preferences."),
  definition("temperature_suitability", "Temperature suitability", "Suitability for the recorded temperature context without replacing operational weather rules."),
  definition("rain_suitability", "Rain suitability", "Suitability for explicitly recorded rain context."),
  definition("wind_suitability", "Wind suitability", "Suitability for explicitly recorded wind context."),
  definition("season_suitability", "Season suitability", "Suitability for the recorded season context."),
] satisfies readonly ExpertRubricDimensionDefinition[]);

export const REQUIRED_EXPERT_DIMENSIONS = Object.freeze(
  EXPERT_RUBRIC_REGISTRY.map((entry) => entry.id)
) as readonly ExpertDimension[];

export const EXPERT_EVALUATION_CONTRACT = Object.freeze({
  requiredDimensions: REQUIRED_EXPERT_DIMENSIONS,
  ratingScale: Object.freeze([1, 2, 3, 4, 5] as const),
  availabilityValues: Object.freeze([
    "rated",
    "not_enough_information",
    "not_applicable",
    "abstained",
  ] as const),
  overallCompatibility: Object.freeze({
    requiredObservationDimension: "style_coherence" as ExpertDimension,
    requiresImageWhenRated: true,
  }),
});

export function getExpertRubricDimension(dimension: ExpertDimension) {
  return EXPERT_RUBRIC_REGISTRY.find((entry) => entry.id === dimension);
}

export function getExpertEvidenceDefinition(code: string) {
  return EXPERT_EVIDENCE_REGISTRY.find((entry) => entry.code === code);
}

export function isKnownExpertEvidenceCode(value: string) {
  return Boolean(getExpertEvidenceDefinition(value));
}
