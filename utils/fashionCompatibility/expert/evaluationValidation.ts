import {
  EXPERT_DATASET_SCHEMA_VERSION,
  EXPERT_EVALUATION_SCHEMA_VERSION,
  EXPERT_PAIRWISE_SCHEMA_VERSION,
  EXPERT_RUBRIC_VERSION,
  type DatasetSplit,
  type DatasetStatistics,
  type DatasetValidationIssue,
  type DatasetValidationResult,
  type EvaluationAvailability,
  type ExpertAbsoluteEvaluation,
  type ExpertDimension,
  type ExpertDimensionEvaluation,
  type ExpertEvaluationDataset,
  type ExpertPairwiseEvaluation,
  type ExpertOutfitSnapshot,
  type ExpertRating,
  type OutfitEvaluationContext,
  type PairwisePreference,
} from "@/utils/fashionCompatibility/expert/types";
import {
  REQUIRED_EXPERT_DIMENSIONS,
  getExpertEvidenceDefinition,
  getExpertRubricDimension,
  isKnownExpertEvidenceCode,
} from "@/utils/fashionCompatibility/expert/rubricRegistry";
import {
  COLOR_FEATURE_VERSION,
  COLOR_PROFILE_VERSION,
} from "@/utils/fashionCompatibility/color/types";
import {
  SHAPE_FEATURE_VERSION,
  SHAPE_PROFILE_VERSION,
} from "@/utils/fashionCompatibility/shape/types";

const MAX_NOTES_LENGTH = 1_000;
const MIN_REASONABLE_DURATION_SECONDS = 5;
const MAX_REASONABLE_DURATION_SECONDS = 7_200;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/;
const RATINGS = new Set([1, 2, 3, 4, 5]);
const AVAILABILITIES = new Set<EvaluationAvailability>([
  "rated",
  "not_enough_information",
  "not_applicable",
  "abstained",
]);
const SPLITS = new Set<DatasetSplit>(["unassigned", "train", "validation", "test"]);
const PAIRWISE_PREFERENCES = new Set<PairwisePreference>([
  "a",
  "b",
  "tie",
  "not_comparable",
]);
const EVALUATOR_GROUPS = new Set([
  "stylist",
  "fashion_student",
  "trained_reviewer",
  "pilot",
  "unknown",
]);
const DATASET_SOURCES = new Set([
  "synthetic_test",
  "expert_pilot",
  "expert_validated",
  "unknown",
]);
const STYLE_INTENTS = new Set([
  "minimal", "casual", "street", "formal", "classic", "preppy", "sporty",
  "gorpcore", "techwear", "romantic", "experimental", "mixed", "unknown",
]);
const OCCASIONS = new Set([
  "daily", "date", "office", "formal_event", "travel", "outdoor", "exercise", "unknown",
]);
const CONTEXT_AVAILABILITY = new Set(["available", "not_available", "not_applicable", "unknown"]);
const PREFERENCE_CONTEXT_AVAILABILITY = new Set(["available", "not_available", "unknown"]);
const RAIN_CONTEXTS = new Set(["none", "light", "moderate", "heavy", "unknown"]);
const WIND_CONTEXTS = new Set(["calm", "light", "moderate", "strong", "unknown"]);
const PROHIBITED_KEYS = new Set([
  "productname",
  "brand",
  "imageuri",
  "cleanimageuri",
  "producturl",
  "username",
  "height",
  "shoulderwidth",
  "chestcircumference",
  "waistcircumference",
  "hipcircumference",
  "armlength",
  "inseam",
  "thighcircumference",
  "preferredpantstotallength",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type EvidenceFeatureAvailability = {
  color: boolean;
  shape: boolean;
  materialObservation: boolean;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function getContextFingerprint(context: OutfitEvaluationContext) {
  return JSON.stringify(canonicalize(context));
}

export function getStablePairEvaluationKey(input: {
  outfitIdA: string;
  outfitIdB: string;
  rubricVersion: string;
  contextFingerprint: string;
}) {
  return `${getStablePairKey(input.outfitIdA, input.outfitIdB)}::${input.rubricVersion}::${input.contextFingerprint}`;
}

function isRating(value: unknown): value is ExpertRating {
  return typeof value === "number" && RATINGS.has(value);
}

function issue(
  severity: DatasetValidationIssue["severity"],
  code: string,
  path: string,
  message: string
): DatasetValidationIssue {
  return { severity, code, path, message };
}

function validateIdentifier(
  value: unknown,
  path: string,
  issues: DatasetValidationIssue[]
) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    issues.push(issue("error", "invalid_id", path, "Expected a non-empty pseudonymous identifier."));
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  issues: DatasetValidationIssue[]
) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    issues.push(issue("error", "invalid_timestamp", path, "Expected a valid ISO timestamp."));
    return;
  }
  if (Date.parse(value) > Date.now() + 5 * 60_000) {
    issues.push(issue("warning", "future_timestamp", path, "Timestamp is unexpectedly in the future."));
  }
}

function validateNotes(value: unknown, path: string, issues: DatasetValidationIssue[]) {
  if (value === undefined) return;
  if (typeof value !== "string") {
    issues.push(issue("error", "invalid_notes", path, "Notes must be plain text."));
    return;
  }
  if (value.length > MAX_NOTES_LENGTH) {
    issues.push(issue("error", "notes_too_long", path, `Notes must not exceed ${MAX_NOTES_LENGTH} characters.`));
  }
  if (/<\/?[a-z][^>]*>|javascript:|<script/i.test(value)) {
    issues.push(issue("error", "unsafe_notes", path, "HTML or executable content is not allowed in notes."));
  }
}

function validateEvidenceCodes(
  codes: unknown,
  dimension: ExpertDimension,
  path: string,
  issues: DatasetValidationIssue[],
  features?: EvidenceFeatureAvailability
) {
  if (!Array.isArray(codes)) {
    issues.push(issue("error", "invalid_evidence", path, "Evidence codes must be an array."));
    return;
  }
  const allowed = new Set(getExpertRubricDimension(dimension)?.allowedEvidenceCodes || []);
  for (const [index, code] of codes.entries()) {
    if (typeof code !== "string" || !isKnownExpertEvidenceCode(code) || !allowed.has(code)) {
      issues.push(issue("error", "unknown_evidence_code", `${path}[${index}]`, "Evidence code is not allowed for this rubric dimension."));
      continue;
    }
    const definition = getExpertEvidenceDefinition(code);
    if (
      features &&
      ((definition?.origin === "derived_color_feature" && !features.color) ||
        (definition?.origin === "derived_shape_feature" && !features.shape))
    ) {
      issues.push(issue("error", "evidence_without_feature", `${path}[${index}]`, "Derived evidence requires its corresponding snapshot feature payload."));
    } else if (features && definition?.origin === "human_observed_material" && !features.materialObservation) {
      issues.push(issue("error", "evidence_without_observation_input", `${path}[${index}]`, "Material evidence requires an available image or approved material context."));
    }
  }
}

function validateAnyEvidenceCodes(
  codes: unknown,
  path: string,
  issues: DatasetValidationIssue[],
  features?: EvidenceFeatureAvailability
) {
  if (!Array.isArray(codes)) {
    issues.push(issue("error", "invalid_evidence", path, "Evidence codes must be an array."));
    return;
  }
  codes.forEach((code, index) => {
    if (typeof code !== "string" || !isKnownExpertEvidenceCode(code)) {
      issues.push(issue("error", "unknown_evidence_code", `${path}[${index}]`, "Evidence code is not registered."));
      return;
    }
    const definition = getExpertEvidenceDefinition(code);
    if (
      features &&
      ((definition?.origin === "derived_color_feature" && !features.color) ||
        (definition?.origin === "derived_shape_feature" && !features.shape))
    ) {
      issues.push(issue("error", "evidence_without_feature", `${path}[${index}]`, "Derived evidence requires its corresponding snapshot feature payload."));
    } else if (features && definition?.origin === "human_observed_material" && !features.materialObservation) {
      issues.push(issue("error", "evidence_without_observation_input", `${path}[${index}]`, "Material evidence requires an available image or approved material context."));
    }
  });
}

function validateDimensionEvaluation(
  evaluation: unknown,
  path: string,
  issues: DatasetValidationIssue[],
  allowOverall = false,
  features?: EvidenceFeatureAvailability
): ExpertDimension | "overall_compatibility" | undefined {
  if (!isRecord(evaluation)) {
    issues.push(issue("error", "invalid_dimension_evaluation", path, "Expected a dimension evaluation object."));
    return undefined;
  }
  const dimension = evaluation.dimension;
  if (
    typeof dimension !== "string" ||
    (!getExpertRubricDimension(dimension as ExpertDimension) && !(allowOverall && dimension === "overall_compatibility"))
  ) {
    issues.push(issue("error", "unknown_dimension", `${path}.dimension`, "Unknown expert rubric dimension."));
    return undefined;
  }
  const availability = evaluation.availability;
  if (typeof availability !== "string" || !AVAILABILITIES.has(availability as EvaluationAvailability)) {
    issues.push(issue("error", "invalid_availability", `${path}.availability`, "Unknown evaluation availability."));
  } else if (availability === "rated" && !isRating(evaluation.rating)) {
    issues.push(issue("error", "missing_rating", `${path}.rating`, "Rated dimensions require a rating from 1 to 5."));
  } else if (availability !== "rated" && evaluation.rating !== undefined) {
    issues.push(issue("error", "unexpected_rating", `${path}.rating`, "Unavailable dimensions must not contain a rating."));
  }
  if (!isRating(evaluation.confidence)) {
    issues.push(issue("error", "invalid_confidence", `${path}.confidence`, "Confidence must be from 1 to 5."));
  }
  if (dimension !== "overall_compatibility") {
    validateEvidenceCodes(evaluation.supportingEvidenceCodes, dimension as ExpertDimension, `${path}.supportingEvidenceCodes`, issues, features);
    validateEvidenceCodes(evaluation.conflictingEvidenceCodes, dimension as ExpertDimension, `${path}.conflictingEvidenceCodes`, issues, features);
  } else {
    validateAnyEvidenceCodes(evaluation.supportingEvidenceCodes, `${path}.supportingEvidenceCodes`, issues, features);
    validateAnyEvidenceCodes(evaluation.conflictingEvidenceCodes, `${path}.conflictingEvidenceCodes`, issues, features);
  }
  validateNotes(evaluation.notes, `${path}.notes`, issues);
  return dimension as ExpertDimension | "overall_compatibility";
}

function validateSplit(value: unknown, path: string, issues: DatasetValidationIssue[]) {
  if (value !== undefined && (typeof value !== "string" || !SPLITS.has(value as DatasetSplit))) {
    issues.push(issue("error", "invalid_dataset_split", path, "Unknown dataset split."));
  }
}

function getContextRequirementValue(
  context: OutfitEvaluationContext,
  field: NonNullable<ReturnType<typeof getExpertRubricDimension>>["contextRequirements"][number]["field"]
) {
  switch (field) {
    case "rainContext":
      return context.weatherContext?.rain;
    case "windContext":
      return context.weatherContext?.wind;
    case "stylingState.topTucked":
      return context.stylingState.topTucked;
    case "stylingState.outerWorn":
      return context.stylingState.outerWorn;
    case "stylingState.closureState":
      return context.stylingState.closureState;
    default:
      return context[field];
  }
}

function validateDimensionContext(
  evaluation: Record<string, unknown>,
  dimension: ExpertDimension,
  context: OutfitEvaluationContext | undefined,
  path: string,
  issues: DatasetValidationIssue[]
) {
  if (evaluation.availability !== "rated") return;
  const definition = getExpertRubricDimension(dimension);
  for (const requirement of definition?.contextRequirements || []) {
    const value = context ? getContextRequirementValue(context, requirement.field) : undefined;
    const unavailable =
      value === undefined ||
      value === null ||
      value === "" ||
      requirement.unavailableValues?.includes(String(value));
    if (!unavailable) continue;
    const required = requirement.policy === "required";
    issues.push(
      issue(
        required ? "error" : "warning",
        required ? "rated_without_required_context" : "rated_without_recommended_context",
        path,
        `Rated ${dimension} requires ${requirement.policy} context field ${requirement.field}.`
      )
    );
  }
}

function validateAbsoluteEvaluation(
  evaluation: unknown,
  path: string,
  snapshots: Map<string, ExpertOutfitSnapshot>,
  issues: DatasetValidationIssue[]
) {
  if (!isRecord(evaluation)) {
    issues.push(issue("error", "invalid_absolute_evaluation", path, "Expected an absolute evaluation object."));
    return;
  }
  if (evaluation.schemaVersion !== EXPERT_EVALUATION_SCHEMA_VERSION) {
    issues.push(issue("error", "invalid_evaluation_schema", `${path}.schemaVersion`, "Unsupported absolute evaluation schema version."));
  }
  validateIdentifier(evaluation.evaluationId, `${path}.evaluationId`, issues);
  validateIdentifier(evaluation.evaluatorId, `${path}.evaluatorId`, issues);
  const snapshot = typeof evaluation.outfitId === "string" ? snapshots.get(evaluation.outfitId) : undefined;
  if (!snapshot) {
    issues.push(issue("error", "unknown_outfit_reference", `${path}.outfitId`, "Absolute evaluation references an unknown outfit."));
  }
  if (evaluation.rubricVersion !== EXPERT_RUBRIC_VERSION) {
    issues.push(issue("error", "unknown_rubric_version", `${path}.rubricVersion`, "Rubric version is not registered."));
  }
  if (evaluation.evaluatorGroup !== undefined && !EVALUATOR_GROUPS.has(evaluation.evaluatorGroup as string)) {
    issues.push(issue("error", "invalid_evaluator_group", `${path}.evaluatorGroup`, "Unknown evaluator group."));
  }
  if (!Array.isArray(evaluation.dimensions)) {
    issues.push(issue("error", "invalid_dimensions", `${path}.dimensions`, "Dimensions must be an array."));
  } else {
    const seen = new Set<string>();
    const features = {
      color: Boolean(snapshot?.colorFeatures),
      shape: Boolean(snapshot?.shapeFeatures),
      materialObservation: Boolean(
        snapshot?.inputAvailability?.imageAvailable ||
          snapshot?.inputAvailability?.materialContextAvailable
      ),
    };
    evaluation.dimensions.forEach((dimension, index) => {
      const dimensionPath = `${path}.dimensions[${index}]`;
      const id = validateDimensionEvaluation(dimension, dimensionPath, issues, false, features);
      if (!id) return;
      if (seen.has(id)) {
        issues.push(issue("error", "duplicate_dimension", `${path}.dimensions[${index}]`, `Dimension ${id} appears more than once.`));
      }
      seen.add(id);
      if (id !== "overall_compatibility" && isRecord(dimension)) {
        validateDimensionContext(dimension, id, snapshot?.context, dimensionPath, issues);
      }
    });
    for (const dimension of REQUIRED_EXPERT_DIMENSIONS) {
      if (!seen.has(dimension)) {
        issues.push(issue("error", "missing_required_dimension", `${path}.dimensions`, `Required dimension ${dimension} is missing.`));
      }
    }
  }
  if (evaluation.overallCompatibility !== undefined) {
    validateDimensionEvaluation(
      evaluation.overallCompatibility,
      `${path}.overallCompatibility`,
      issues,
      true,
      {
        color: Boolean(snapshot?.colorFeatures),
        shape: Boolean(snapshot?.shapeFeatures),
        materialObservation: Boolean(
          snapshot?.inputAvailability?.imageAvailable ||
            snapshot?.inputAvailability?.materialContextAvailable
        ),
      }
    );
  }
  if (!isRating(evaluation.evaluatorConfidence)) {
    issues.push(issue("error", "invalid_evaluator_confidence", `${path}.evaluatorConfidence`, "Evaluator confidence must be from 1 to 5."));
  }
  validateTimestamp(evaluation.createdAt, `${path}.createdAt`, issues);
  validateSplit(evaluation.datasetSplit, `${path}.datasetSplit`, issues);
  if (evaluation.durationSeconds !== undefined) {
    if (typeof evaluation.durationSeconds !== "number" || !Number.isFinite(evaluation.durationSeconds) || evaluation.durationSeconds <= 0) {
      issues.push(issue("error", "invalid_duration", `${path}.durationSeconds`, "Duration must be a positive finite number."));
    } else if (evaluation.durationSeconds < MIN_REASONABLE_DURATION_SECONDS) {
      issues.push(issue("warning", "very_short_duration", `${path}.durationSeconds`, "Evaluation duration is unusually short."));
    } else if (evaluation.durationSeconds > MAX_REASONABLE_DURATION_SECONDS) {
      issues.push(issue("warning", "very_long_duration", `${path}.durationSeconds`, "Evaluation duration is unusually long."));
    }
  }
}

export function getStablePairKey(outfitIdA: string, outfitIdB: string) {
  return [outfitIdA, outfitIdB].sort().join("::");
}

export function getPairwiseContextFingerprint(
  evaluation: Pick<
    ExpertPairwiseEvaluation,
    "outfitIdA" | "outfitIdB" | "contextCompatibility"
  >,
  snapshots: Map<string, ExpertOutfitSnapshot>
) {
  const sortedIds = [evaluation.outfitIdA, evaluation.outfitIdB].sort();
  if (evaluation.contextCompatibility === "same_context") {
    const context = snapshots.get(sortedIds[0])?.context;
    return context ? getContextFingerprint(context) : "missing-context";
  }
  return JSON.stringify(
    canonicalize({
      contextCompatibility: evaluation.contextCompatibility,
      contexts: sortedIds.map((outfitId) => snapshots.get(outfitId)?.context || null),
    })
  );
}

function validatePairwiseEvaluation(
  evaluation: unknown,
  path: string,
  snapshots: Map<string, ExpertEvaluationDataset["snapshots"][number]>,
  issues: DatasetValidationIssue[]
) {
  if (!isRecord(evaluation)) {
    issues.push(issue("error", "invalid_pairwise_evaluation", path, "Expected a pairwise evaluation object."));
    return;
  }
  if (evaluation.schemaVersion !== EXPERT_PAIRWISE_SCHEMA_VERSION) {
    issues.push(issue("error", "invalid_pairwise_schema", `${path}.schemaVersion`, "Unsupported pairwise evaluation schema version."));
  }
  validateIdentifier(evaluation.evaluationId, `${path}.evaluationId`, issues);
  validateIdentifier(evaluation.evaluatorId, `${path}.evaluatorId`, issues);
  const outfitIdA = typeof evaluation.outfitIdA === "string" ? evaluation.outfitIdA : "";
  const outfitIdB = typeof evaluation.outfitIdB === "string" ? evaluation.outfitIdB : "";
  if (!snapshots.has(outfitIdA)) issues.push(issue("error", "unknown_outfit_reference", `${path}.outfitIdA`, "Pairwise evaluation references an unknown outfit."));
  if (!snapshots.has(outfitIdB)) issues.push(issue("error", "unknown_outfit_reference", `${path}.outfitIdB`, "Pairwise evaluation references an unknown outfit."));
  if (outfitIdA && outfitIdA === outfitIdB) {
    issues.push(issue("error", "same_pair_outfit", path, "A pairwise evaluation must compare two different outfits."));
  }
  if (evaluation.rubricVersion !== EXPERT_RUBRIC_VERSION) {
    issues.push(issue("error", "unknown_rubric_version", `${path}.rubricVersion`, "Rubric version is not registered."));
  }
  if (typeof evaluation.preferred !== "string" || !PAIRWISE_PREFERENCES.has(evaluation.preferred as PairwisePreference)) {
    issues.push(issue("error", "invalid_pairwise_preference", `${path}.preferred`, "Unknown pairwise preference."));
  }
  if (!new Set(["same_context", "different_context", "unknown"]).has(evaluation.contextCompatibility as string)) {
    issues.push(issue("error", "invalid_context_compatibility", `${path}.contextCompatibility`, "Unknown pairwise context compatibility."));
  }
  const features = {
    color: Boolean(snapshots.get(outfitIdA)?.colorFeatures && snapshots.get(outfitIdB)?.colorFeatures),
    shape: Boolean(snapshots.get(outfitIdA)?.shapeFeatures && snapshots.get(outfitIdB)?.shapeFeatures),
    materialObservation: [snapshots.get(outfitIdA), snapshots.get(outfitIdB)].every(
      (snapshot) =>
        Boolean(
          snapshot?.inputAvailability?.imageAvailable ||
            snapshot?.inputAvailability?.materialContextAvailable
        )
    ),
  };
  if (!Array.isArray(evaluation.dimensions)) {
    issues.push(issue("error", "invalid_pairwise_dimensions", `${path}.dimensions`, "Pairwise dimensions must be an array."));
  } else {
    const seen = new Set<string>();
    evaluation.dimensions.forEach((entry, index) => {
      const entryPath = `${path}.dimensions[${index}]`;
      if (!isRecord(entry) || typeof entry.dimension !== "string" || !getExpertRubricDimension(entry.dimension as ExpertDimension)) {
        issues.push(issue("error", "unknown_dimension", `${entryPath}.dimension`, "Unknown pairwise rubric dimension."));
        return;
      }
      if (seen.has(entry.dimension)) issues.push(issue("error", "duplicate_dimension", entryPath, `Dimension ${entry.dimension} appears more than once.`));
      seen.add(entry.dimension);
      if (typeof entry.preferred !== "string" || !PAIRWISE_PREFERENCES.has(entry.preferred as PairwisePreference)) {
        issues.push(issue("error", "invalid_pairwise_preference", `${entryPath}.preferred`, "Unknown dimension preference."));
      }
      if (!isRating(entry.confidence)) issues.push(issue("error", "invalid_confidence", `${entryPath}.confidence`, "Confidence must be from 1 to 5."));
      validateEvidenceCodes(entry.evidenceCodes, entry.dimension as ExpertDimension, `${entryPath}.evidenceCodes`, issues, features);
    });
  }
  validateTimestamp(evaluation.createdAt, `${path}.createdAt`, issues);
  validateSplit(evaluation.datasetSplit, `${path}.datasetSplit`, issues);
  const contextA = snapshots.get(outfitIdA)?.context;
  const contextB = snapshots.get(outfitIdB)?.context;
  const contextsMatch =
    contextA && contextB && getContextFingerprint(contextA) === getContextFingerprint(contextB);
  if (evaluation.contextCompatibility === "same_context" && contextA && contextB && !contextsMatch) {
    issues.push(issue("error", "pair_context_mismatch", path, "same_context pairwise evaluations require identical snapshot contexts."));
  } else if (evaluation.contextCompatibility === "different_context" && contextsMatch) {
    issues.push(issue("warning", "pair_context_declared_different_but_equal", path, "Pairwise contexts are identical despite different_context declaration."));
  } else if (evaluation.contextCompatibility === "different_context") {
    issues.push(issue("warning", "pair_context_mismatch", path, "Pairwise outfits use different evaluation contexts and will be excluded from agreement."));
  }
}

function scanPrivacy(value: unknown, path: string, issues: DatasetValidationIssue[]) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanPrivacy(entry, `${path}[${index}]`, issues));
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      const entryPath = path ? `${path}.${key}` : key;
      if (PROHIBITED_KEYS.has(key.toLowerCase())) {
        issues.push(issue("error", "prohibited_private_field", entryPath, `Field ${key} is not allowed in an expert dataset.`));
      }
      scanPrivacy(entry, entryPath, issues);
    }
    return;
  }
  if (typeof value !== "string") return;
  if (/https?:\/\//i.test(value)) issues.push(issue("error", "url_detected", path, "Remote URLs are not allowed in expert datasets."));
  if (/file:\/\//i.test(value)) issues.push(issue("error", "file_uri_detected", path, "File URIs are not allowed in expert datasets."));
  if (/(?:^|\s)[A-Za-z]:\\[^\s]+/.test(value)) issues.push(issue("error", "windows_path_detected", path, "Windows file paths are not allowed in expert datasets."));
  if (/(?:^|\s)\/(?:Users|home|var|tmp|storage|sdcard)\/[^\s]+/.test(value)) issues.push(issue("error", "unix_path_detected", path, "Local Unix paths are not allowed in expert datasets."));
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)) issues.push(issue("error", "email_detected", path, "Email addresses are not allowed in expert datasets."));
  if (/(?:010[- ]?\d{4}[- ]?\d{4}|\+?82[- ]?10[- ]?\d{4}[- ]?\d{4})/.test(value)) issues.push(issue("warning", "phone_number_suspected", path, "A phone-number-like string was found."));
}

function validateLeakage(
  dataset: ExpertEvaluationDataset,
  snapshots: Map<string, ExpertEvaluationDataset["snapshots"][number]>,
  issues: DatasetValidationIssue[]
) {
  const groupField = dataset.splitPolicy?.groupField || "outfitId";
  const splitsByGroup = new Map<string, Set<string>>();
  const add = (outfitId: string, split: DatasetSplit | undefined) => {
    if (!split || split === "unassigned") return;
    const snapshot = snapshots.get(outfitId);
    const group =
      groupField === "outfitGroupId"
        ? snapshot?.outfitGroupId
        : groupField === "compositionGroupKey"
          ? snapshot?.compositionGroupKey
          : outfitId;
    if (!group) {
      issues.push(issue("warning", "missing_split_group", `snapshots.${outfitId}`, `Split policy requires ${groupField}.`));
      return;
    }
    const splits = splitsByGroup.get(group) || new Set<string>();
    splits.add(split);
    splitsByGroup.set(group, splits);
  };
  dataset.absoluteEvaluations.forEach((evaluation) => add(evaluation.outfitId, evaluation.datasetSplit));
  dataset.pairwiseEvaluations.forEach((evaluation) => {
    add(evaluation.outfitIdA, evaluation.datasetSplit);
    add(evaluation.outfitIdB, evaluation.datasetSplit);
  });
  for (const [group, splits] of splitsByGroup) {
    if (splits.size > 1) {
      issues.push(issue("error", "dataset_split_leakage", `splitGroups.${group}`, `Group appears in multiple splits: ${[...splits].join(", ")}.`));
    }
  }
}

function getStatistics(dataset: Partial<ExpertEvaluationDataset>): DatasetStatistics {
  const absolute = Array.isArray(dataset.absoluteEvaluations) ? dataset.absoluteEvaluations : [];
  const pairwise = Array.isArray(dataset.pairwiseEvaluations) ? dataset.pairwiseEvaluations : [];
  const evaluatorIds = new Set<string>();
  let ratedDimensions = 0;
  let unavailableDimensions = 0;
  absolute.forEach((evaluation) => {
    if (typeof evaluation.evaluatorId === "string") evaluatorIds.add(evaluation.evaluatorId);
    if (!Array.isArray(evaluation.dimensions)) return;
    evaluation.dimensions.forEach((dimension) => {
      if (dimension.availability === "rated") ratedDimensions += 1;
      else unavailableDimensions += 1;
    });
  });
  pairwise.forEach((evaluation) => {
    if (typeof evaluation.evaluatorId === "string") evaluatorIds.add(evaluation.evaluatorId);
  });
  return {
    outfits: Array.isArray(dataset.snapshots) ? dataset.snapshots.length : 0,
    evaluators: evaluatorIds.size,
    absoluteEvaluations: absolute.length,
    pairwiseEvaluations: pairwise.length,
    ratedDimensions,
    unavailableDimensions,
  };
}

export function validateExpertEvaluationDataset(input: unknown): DatasetValidationResult {
  const issues: DatasetValidationIssue[] = [];
  if (!isRecord(input)) {
    const error = issue("error", "invalid_dataset", "$", "Dataset must be a JSON object.");
    return { valid: false, errors: [error], warnings: [], statistics: getStatistics({}) };
  }
  if (input.schemaVersion !== EXPERT_DATASET_SCHEMA_VERSION) issues.push(issue("error", "invalid_dataset_schema", "schemaVersion", "Unsupported expert dataset schema version."));
  if (input.rubricVersion !== EXPERT_RUBRIC_VERSION) issues.push(issue("error", "unknown_rubric_version", "rubricVersion", "Rubric version is not registered."));
  if (typeof input.datasetVersion !== "string" || input.datasetVersion.trim() === "") issues.push(issue("error", "invalid_dataset_version", "datasetVersion", "Dataset version is required."));
  if (typeof input.source !== "string" || !DATASET_SOURCES.has(input.source)) issues.push(issue("error", "invalid_dataset_source", "source", "Unknown dataset source."));
  validateIdentifier(input.datasetId, "datasetId", issues);
  validateTimestamp(input.createdAt, "createdAt", issues);
  if (!Array.isArray(input.snapshots)) issues.push(issue("error", "invalid_snapshots", "snapshots", "Snapshots must be an array."));
  if (!Array.isArray(input.absoluteEvaluations)) issues.push(issue("error", "invalid_absolute_evaluations", "absoluteEvaluations", "Absolute evaluations must be an array."));
  if (!Array.isArray(input.pairwiseEvaluations)) issues.push(issue("error", "invalid_pairwise_evaluations", "pairwiseEvaluations", "Pairwise evaluations must be an array."));

  const dataset = input as unknown as ExpertEvaluationDataset;
  const snapshots = new Map<string, ExpertEvaluationDataset["snapshots"][number]>();
  if (Array.isArray(dataset.snapshots)) {
    dataset.snapshots.forEach((snapshot, index) => {
      const path = `snapshots[${index}]`;
      if (!isRecord(snapshot)) {
        issues.push(issue("error", "invalid_snapshot", path, "Snapshot must be an object."));
        return;
      }
      validateIdentifier(snapshot.outfitId, `${path}.outfitId`, issues);
      if (typeof snapshot.outfitId === "string") {
        if (snapshots.has(snapshot.outfitId)) issues.push(issue("error", "duplicate_outfit_id", `${path}.outfitId`, "Snapshot outfitId must be unique."));
        snapshots.set(snapshot.outfitId, snapshot as ExpertEvaluationDataset["snapshots"][number]);
      }
      validateTimestamp(snapshot.createdAt, `${path}.createdAt`, issues);
      if (!Array.isArray(snapshot.itemRefs) || snapshot.itemRefs.length === 0) {
        issues.push(issue("error", "invalid_item_refs", `${path}.itemRefs`, "Snapshot requires anonymous item references."));
      } else {
        const itemIds = new Set<string>();
        snapshot.itemRefs.forEach((itemRef, itemIndex) => {
          if (!isRecord(itemRef)) {
            issues.push(issue("error", "invalid_item_ref", `${path}.itemRefs[${itemIndex}]`, "Item reference must be an object."));
            return;
          }
          validateIdentifier(itemRef.anonymousItemId, `${path}.itemRefs[${itemIndex}].anonymousItemId`, issues);
          if (typeof itemRef.anonymousItemId === "string") {
            if (itemIds.has(itemRef.anonymousItemId)) issues.push(issue("error", "duplicate_anonymous_item_id", `${path}.itemRefs[${itemIndex}].anonymousItemId`, "Anonymous item IDs must be unique within an outfit."));
            itemIds.add(itemRef.anonymousItemId);
          }
          if (typeof itemRef.category !== "string" || !itemRef.category.trim()) issues.push(issue("error", "invalid_item_category", `${path}.itemRefs[${itemIndex}].category`, "Item category is required."));
        });
      }
      if (!isRecord(snapshot.context)) {
        issues.push(issue("error", "invalid_context", `${path}.context`, "Evaluation context is required."));
      } else {
        if (!STYLE_INTENTS.has(snapshot.context.styleIntent as string)) issues.push(issue("error", "invalid_style_intent", `${path}.context.styleIntent`, "Unknown style intent."));
        if (!OCCASIONS.has(snapshot.context.occasion as string)) issues.push(issue("error", "invalid_occasion", `${path}.context.occasion`, "Unknown occasion."));
        if (!CONTEXT_AVAILABILITY.has(snapshot.context.bodyFitContext as string)) issues.push(issue("error", "invalid_body_fit_context", `${path}.context.bodyFitContext`, "Unknown body-fit context availability."));
        if (!PREFERENCE_CONTEXT_AVAILABILITY.has(snapshot.context.fitPreferenceContext as string)) issues.push(issue("error", "invalid_fit_preference_context", `${path}.context.fitPreferenceContext`, "Unknown fit-preference context availability."));
        if (!PREFERENCE_CONTEXT_AVAILABILITY.has(snapshot.context.exposurePreferenceContext as string)) issues.push(issue("error", "invalid_exposure_preference_context", `${path}.context.exposurePreferenceContext`, "Unknown exposure-preference context availability."));
        if (snapshot.context.weatherContext !== undefined) {
          if (!isRecord(snapshot.context.weatherContext)) {
            issues.push(issue("error", "invalid_weather_context", `${path}.context.weatherContext`, "Weather context must be an object."));
          } else {
            if (!RAIN_CONTEXTS.has(snapshot.context.weatherContext.rain as string)) issues.push(issue("error", "invalid_rain_context", `${path}.context.weatherContext.rain`, "Unknown rain context."));
            if (!WIND_CONTEXTS.has(snapshot.context.weatherContext.wind as string)) issues.push(issue("error", "invalid_wind_context", `${path}.context.weatherContext.wind`, "Unknown wind context."));
          }
        }
        if (!isRecord(snapshot.context.stylingState)) {
          issues.push(issue("error", "invalid_styling_state", `${path}.context.stylingState`, "Styling state is required."));
        } else {
          if (!new Set(["tucked", "untucked", "partial", "not_applicable", "unknown"]).has(snapshot.context.stylingState.topTucked as string)) issues.push(issue("error", "invalid_top_tucked", `${path}.context.stylingState.topTucked`, "Unknown top tuck state."));
          if (!new Set(["yes", "no", "unknown"]).has(snapshot.context.stylingState.outerWorn as string)) issues.push(issue("error", "invalid_outer_worn", `${path}.context.stylingState.outerWorn`, "Unknown outer-worn state."));
          if (!new Set(["open", "closed", "mixed", "unknown"]).has(snapshot.context.stylingState.closureState as string)) issues.push(issue("error", "invalid_closure_state", `${path}.context.stylingState.closureState`, "Unknown closure state."));
        }
      }
      if (!isRecord(snapshot.featureVersions)) {
        issues.push(issue("error", "invalid_feature_versions", `${path}.featureVersions`, "Feature versions must be an object."));
      } else {
        const featureVersions = snapshot.featureVersions as Record<string, unknown>;
        const expectedVersions: Record<string, string> = {
          colorProfileVersion: COLOR_PROFILE_VERSION,
          colorFeatureVersion: COLOR_FEATURE_VERSION,
          shapeProfileVersion: SHAPE_PROFILE_VERSION,
          shapeFeatureVersion: SHAPE_FEATURE_VERSION,
        };
        Object.entries(expectedVersions).forEach(([key, expected]) => {
          const actual = featureVersions[key];
          if (actual !== undefined && actual !== expected) issues.push(issue("error", "unsupported_feature_version", `${path}.featureVersions.${key}`, `Expected ${expected}.`));
        });
        if ("personalFitFeatureVersion" in featureVersions) {
          issues.push(issue("error", "personal_fit_version_without_feature", `${path}.featureVersions.personalFitFeatureVersion`, "Personal-fit feature versions are not supported by this sanitized snapshot schema."));
        }
        const hasColorFeatures = isRecord(snapshot.colorFeatures);
        const hasShapeFeatures = isRecord(snapshot.shapeFeatures);
        const colorVersionsMatchPayload =
          hasColorFeatures === Boolean(featureVersions.colorProfileVersion) &&
          hasColorFeatures === Boolean(featureVersions.colorFeatureVersion);
        const shapeVersionsMatchPayload =
          hasShapeFeatures === Boolean(featureVersions.shapeProfileVersion) &&
          hasShapeFeatures === Boolean(featureVersions.shapeFeatureVersion);
        if (!colorVersionsMatchPayload) issues.push(issue("error", "feature_version_payload_mismatch", `${path}.featureVersions`, "Color feature payload and both versions must be present together."));
        if (!shapeVersionsMatchPayload) issues.push(issue("error", "feature_version_payload_mismatch", `${path}.featureVersions`, "Shape feature payload and both versions must be present together."));
      }
      if (!isRecord(snapshot.inputAvailability)) {
        issues.push(issue("error", "invalid_input_availability", `${path}.inputAvailability`, "Snapshot input availability is required."));
      } else {
        const fields = ["imageAvailable", "colorFeaturesAvailable", "shapeFeaturesAvailable", "materialContextAvailable", "bodyFitContextAvailable"] as const;
        fields.forEach((field) => {
          if (typeof snapshot.inputAvailability[field] !== "boolean") issues.push(issue("error", "invalid_input_availability", `${path}.inputAvailability.${field}`, "Input availability values must be boolean."));
        });
        if (snapshot.inputAvailability.colorFeaturesAvailable !== isRecord(snapshot.colorFeatures)) issues.push(issue("error", "input_availability_mismatch", `${path}.inputAvailability.colorFeaturesAvailable`, "Color feature availability must match the feature payload."));
        if (snapshot.inputAvailability.shapeFeaturesAvailable !== isRecord(snapshot.shapeFeatures)) issues.push(issue("error", "input_availability_mismatch", `${path}.inputAvailability.shapeFeaturesAvailable`, "Shape feature availability must match the feature payload."));
        if (isRecord(snapshot.context) && snapshot.inputAvailability.bodyFitContextAvailable !== (snapshot.context.bodyFitContext === "available")) issues.push(issue("error", "input_availability_mismatch", `${path}.inputAvailability.bodyFitContextAvailable`, "Body-fit availability must match the context flag."));
      }
    });
  }

  const evaluationIds = new Set<string>();
  const absoluteReviewerKeys = new Set<string>();
  if (Array.isArray(dataset.absoluteEvaluations)) {
    dataset.absoluteEvaluations.forEach((evaluation, index) => {
      const path = `absoluteEvaluations[${index}]`;
      validateAbsoluteEvaluation(evaluation, path, snapshots, issues);
      if (!isRecord(evaluation)) return;
      if (typeof evaluation.evaluationId === "string") {
        if (evaluationIds.has(evaluation.evaluationId)) issues.push(issue("error", "duplicate_evaluation_id", `${path}.evaluationId`, "Evaluation ID must be unique across the dataset."));
        evaluationIds.add(evaluation.evaluationId);
      }
      const reviewerKey = `${evaluation.evaluatorId}::${evaluation.outfitId}::${evaluation.rubricVersion}`;
      if (absoluteReviewerKeys.has(reviewerKey)) issues.push(issue("error", "duplicate_evaluator_outfit", path, "The same evaluator must not submit the same outfit and rubric twice."));
      absoluteReviewerKeys.add(reviewerKey);
    });
  }

  const pairReviewerKeys = new Set<string>();
  if (Array.isArray(dataset.pairwiseEvaluations)) {
    dataset.pairwiseEvaluations.forEach((evaluation, index) => {
      const path = `pairwiseEvaluations[${index}]`;
      validatePairwiseEvaluation(evaluation, path, snapshots, issues);
      if (!isRecord(evaluation)) return;
      if (typeof evaluation.evaluationId === "string") {
        if (evaluationIds.has(evaluation.evaluationId)) issues.push(issue("error", "duplicate_evaluation_id", `${path}.evaluationId`, "Evaluation ID must be unique across the dataset."));
        evaluationIds.add(evaluation.evaluationId);
      }
      const pair = evaluation as unknown as ExpertPairwiseEvaluation;
      const contextFingerprint = getPairwiseContextFingerprint(pair, snapshots);
      const pairKey = getStablePairEvaluationKey({
        outfitIdA: String(evaluation.outfitIdA || ""),
        outfitIdB: String(evaluation.outfitIdB || ""),
        rubricVersion: String(evaluation.rubricVersion || ""),
        contextFingerprint,
      });
      const reviewerKey = `${evaluation.evaluatorId}::${pairKey}`;
      if (pairReviewerKeys.has(reviewerKey)) issues.push(issue("error", "duplicate_pairwise_evaluation", path, "The same evaluator must not submit a reversed or duplicate pair twice."));
      pairReviewerKeys.add(reviewerKey);
    });
  }

  if (isRecord(dataset.metadata)) {
    const statistics = getStatistics(dataset);
    if (dataset.metadata.outfitCount !== statistics.outfits) issues.push(issue("warning", "metadata_outfit_count_mismatch", "metadata.outfitCount", "Metadata outfit count does not match snapshots."));
    if (dataset.metadata.evaluatorCount !== statistics.evaluators) issues.push(issue("warning", "metadata_evaluator_count_mismatch", "metadata.evaluatorCount", "Metadata evaluator count does not match unique evaluator IDs."));
    validateNotes(dataset.metadata.notes, "metadata.notes", issues);
  } else {
    issues.push(issue("error", "invalid_metadata", "metadata", "Dataset metadata is required."));
  }

  if (dataset.splitPolicy !== undefined) {
    if (!isRecord(dataset.splitPolicy)) {
      issues.push(issue("error", "invalid_split_policy", "splitPolicy", "Split policy must be an object."));
    } else {
      if (typeof dataset.splitPolicy.seed !== "string" || !dataset.splitPolicy.seed.trim()) issues.push(issue("error", "invalid_split_seed", "splitPolicy.seed", "Deterministic split seed is required."));
      if (typeof dataset.splitPolicy.algorithmVersion !== "string" || !dataset.splitPolicy.algorithmVersion.trim()) issues.push(issue("error", "invalid_split_algorithm", "splitPolicy.algorithmVersion", "Split algorithm version is required."));
      if (!new Set(["outfitId", "outfitGroupId", "compositionGroupKey"]).has(dataset.splitPolicy.groupField as string)) issues.push(issue("error", "invalid_split_group_field", "splitPolicy.groupField", "Unknown split group field."));
    }
  }

  if (dataset.source === "synthetic_test") {
    dataset.absoluteEvaluations?.forEach((evaluation, index) => {
      if (evaluation.evaluatorGroup && evaluation.evaluatorGroup !== "unknown" && evaluation.evaluatorGroup !== "pilot") {
        issues.push(issue("error", "synthetic_expert_claim", `absoluteEvaluations[${index}].evaluatorGroup`, "Synthetic fixtures must not claim verified expert credentials."));
      }
    });
  } else if (dataset.source === "expert_pilot" || dataset.source === "expert_validated") {
    dataset.absoluteEvaluations?.forEach((evaluation, index) => {
      if (!evaluation.evaluatorGroup || evaluation.evaluatorGroup === "unknown") {
        issues.push(issue("warning", "unverified_evaluator_group", `absoluteEvaluations[${index}].evaluatorGroup`, "Expert-labelled sources should document a verified evaluator group."));
      }
    });
  }

  if (Array.isArray(dataset.snapshots) && Array.isArray(dataset.absoluteEvaluations) && Array.isArray(dataset.pairwiseEvaluations)) {
    validateLeakage(dataset, snapshots, issues);
  }
  scanPrivacy(input, "$", issues);
  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warning");
  return { valid: errors.length === 0, errors, warnings, statistics: getStatistics(dataset) };
}

export function validateDimensionRecordForTest(evaluation: ExpertDimensionEvaluation) {
  const issues: DatasetValidationIssue[] = [];
  validateDimensionEvaluation(evaluation, "dimension", issues);
  return issues;
}

export function validateAbsoluteRecordForTest(
  evaluation: ExpertAbsoluteEvaluation,
  snapshots: ExpertEvaluationDataset["snapshots"]
) {
  const issues: DatasetValidationIssue[] = [];
  validateAbsoluteEvaluation(
    evaluation,
    "evaluation",
    new Map(snapshots.map((snapshot) => [snapshot.outfitId, snapshot])),
    issues
  );
  return issues;
}

export function validatePairwiseRecordForTest(evaluation: ExpertPairwiseEvaluation, snapshots: ExpertEvaluationDataset["snapshots"]) {
  const issues: DatasetValidationIssue[] = [];
  validatePairwiseEvaluation(evaluation, "evaluation", new Map(snapshots.map((snapshot) => [snapshot.outfitId, snapshot])), issues);
  return issues;
}
