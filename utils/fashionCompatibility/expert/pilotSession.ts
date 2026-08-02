import {
  EXPERT_EVALUATION_SCHEMA_VERSION,
  EXPERT_RUBRIC_VERSION,
  type ExpertAbsoluteEvaluation,
  type ExpertConfidence,
  type ExpertDimension,
  type ExpertDimensionEvaluation,
  type ExpertEvaluationDataset,
  type ExpertObservationSignal,
  type ExpertOutfitSnapshot,
  type OverallCompatibilityEvaluation,
} from "@/utils/fashionCompatibility/expert/types";
import {
  EXPERT_EVALUATION_CONTRACT,
  EXPERT_EVIDENCE_REGISTRY,
  EXPERT_RUBRIC_REGISTRY,
  REQUIRED_EXPERT_DIMENSIONS,
  getExpertRubricDimension,
} from "@/utils/fashionCompatibility/expert/rubricRegistry";
import { validateExpertEvaluationDataset } from "@/utils/fashionCompatibility/expert/evaluationValidation";

export const EXPERT_PILOT_SESSION_VERSION = "expert-pilot-session-v1" as const;

export type ExpertPilotEvaluatorGroup =
  | "stylist"
  | "fashion_student"
  | "trained_reviewer"
  | "pilot"
  | "unknown";

export type ExpertPilotSession = {
  sessionVersion: typeof EXPERT_PILOT_SESSION_VERSION;
  datasetId: string;
  datasetVersion: string;
  rubricVersion: string;
  evaluatorId: string;
  evaluatorGroup: ExpertPilotEvaluatorGroup;
  seed: string;
  orderedOutfitIds: string[];
  completedOutfitIds: string[];
  startedAt: string;
  updatedAt: string;
};

export type ExpertPilotDimensionState = {
  dimension: ExpertDimension;
  canRate: boolean;
  missingRequiredContext: string[];
  missingRecommendedContext: string[];
  missingRequiredObservation: string[];
  missingRecommendedObservation: string[];
};

export type ExpertPilotEvaluationInput = {
  dimensions: ExpertDimensionEvaluation[];
  overallCompatibility?: OverallCompatibilityEvaluation;
  evaluatorConfidence: ExpertConfidence;
  durationSeconds?: number;
  datasetSplit?: ExpertAbsoluteEvaluation["datasetSplit"];
};

function sortStrings(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function getExpertPilotProtocolPayload(input?: {
  rubricRegistry?: typeof EXPERT_RUBRIC_REGISTRY;
  evidenceRegistry?: typeof EXPERT_EVIDENCE_REGISTRY;
  evaluationContract?: typeof EXPERT_EVALUATION_CONTRACT;
}) {
  const rubricRegistry = input?.rubricRegistry || EXPERT_RUBRIC_REGISTRY;
  const evidenceRegistry = input?.evidenceRegistry || EXPERT_EVIDENCE_REGISTRY;
  const evaluationContract = input?.evaluationContract || EXPERT_EVALUATION_CONTRACT;
  const dimensionOrder = new Map(
    evaluationContract.requiredDimensions.map((dimension, index) => [dimension, index])
  );

  return {
    rubricVersion: EXPERT_RUBRIC_VERSION,
    dimensions: [...rubricRegistry]
      .sort(
        (left, right) =>
          (dimensionOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (dimensionOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
          left.id.localeCompare(right.id)
      )
      .map((definition) => ({
        id: definition.id,
        label: definition.label,
        description: definition.description,
        anchors: { ...definition.anchors },
        contextRequirements: definition.contextRequirements
          .map((requirement) => ({
            field: requirement.field,
            policy: requirement.policy,
            ...(requirement.unavailableValues
              ? { unavailableValues: sortStrings(requirement.unavailableValues) }
              : {}),
          }))
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
        observationRequirements: definition.observationRequirements
          .map((requirement) => ({
            policy: requirement.policy,
            groups: requirement.groups
              .map((group) => ({ mode: group.mode, signals: sortStrings(group.signals) }))
              .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
            rationale: requirement.rationale,
          }))
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
        allowedEvidenceCodes: sortStrings(definition.allowedEvidenceCodes),
        version: definition.version,
        status: definition.status,
      })),
    evidence: [...evidenceRegistry]
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((definition) => ({
        code: definition.code,
        label: definition.label,
        description: definition.description,
        origin: definition.origin,
        allowedDimensions: sortStrings(definition.allowedDimensions),
        polarity: definition.polarity,
        status: definition.status,
      })),
    evaluationContract: {
      requiredDimensions: [...evaluationContract.requiredDimensions],
      ratingScale: [...evaluationContract.ratingScale],
      availabilityValues: [...evaluationContract.availabilityValues],
      overallCompatibility: { ...evaluationContract.overallCompatibility },
    },
  };
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function getContextValue(
  snapshot: ExpertOutfitSnapshot,
  field: NonNullable<ReturnType<typeof getExpertRubricDimension>>["contextRequirements"][number]["field"]
) {
  switch (field) {
    case "rainContext":
      return snapshot.context.weatherContext?.rain;
    case "windContext":
      return snapshot.context.weatherContext?.wind;
    case "stylingState.topTucked":
      return snapshot.context.stylingState.topTucked;
    case "stylingState.outerWorn":
      return snapshot.context.stylingState.outerWorn;
    case "stylingState.closureState":
      return snapshot.context.stylingState.closureState;
    default:
      return snapshot.context[field];
  }
}

function getObservationSignals(
  snapshot: ExpertOutfitSnapshot
): Record<ExpertObservationSignal, boolean> {
  return {
    image_available: snapshot.inputAvailability.imageAvailable,
    color_features_available:
      snapshot.inputAvailability.colorFeaturesAvailable && Boolean(snapshot.colorFeatures),
    shape_features_available:
      snapshot.inputAvailability.shapeFeaturesAvailable && Boolean(snapshot.shapeFeatures),
    material_context_available: snapshot.inputAvailability.materialContextAvailable,
    body_fit_context_available:
      snapshot.inputAvailability.bodyFitContextAvailable &&
      snapshot.context.bodyFitContext === "available",
    fit_preference_context_available:
      snapshot.context.fitPreferenceContext === "available",
    exposure_preference_context_available:
      snapshot.context.exposurePreferenceContext === "available",
  };
}

function getMissingObservationGroups(
  snapshot: ExpertOutfitSnapshot,
  dimension: ExpertDimension,
  policy: "required" | "recommended"
) {
  const signals = getObservationSignals(snapshot);
  return (getExpertRubricDimension(dimension)?.observationRequirements || [])
    .filter((requirement) => requirement.policy === policy)
    .flatMap((requirement) =>
      requirement.groups
        .filter((group) =>
          group.mode === "all_of"
            ? group.signals.some((signal) => !signals[signal])
            : group.signals.every((signal) => !signals[signal])
        )
        .map((group) => group.signals.join(group.mode === "all_of" ? " and " : " or "))
    );
}

export function getPilotDimensionState(
  snapshot: ExpertOutfitSnapshot,
  dimension: ExpertDimension
): ExpertPilotDimensionState {
  const definition = getExpertRubricDimension(dimension);
  const missingContext = (policy: "required" | "recommended") =>
    (definition?.contextRequirements || [])
      .filter((requirement) => requirement.policy === policy)
      .filter((requirement) => {
        const value = getContextValue(snapshot, requirement.field);
        return (
          value === undefined ||
          value === null ||
          value === "" ||
          requirement.unavailableValues?.includes(String(value))
        );
      })
      .map((requirement) => requirement.field);

  const missingRequiredContext = missingContext("required");
  const missingRecommendedContext = missingContext("recommended");
  const missingRequiredObservation = getMissingObservationGroups(
    snapshot,
    dimension,
    "required"
  );
  const missingRecommendedObservation = getMissingObservationGroups(
    snapshot,
    dimension,
    "recommended"
  );

  return {
    dimension,
    canRate:
      missingRequiredContext.length === 0 &&
      missingRequiredObservation.length === 0,
    missingRequiredContext,
    missingRecommendedContext,
    missingRequiredObservation,
    missingRecommendedObservation,
  };
}

export function getPilotRubricView(snapshot: ExpertOutfitSnapshot) {
  return EXPERT_RUBRIC_REGISTRY.map((definition) => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    anchors: definition.anchors,
    allowedEvidenceCodes: definition.allowedEvidenceCodes,
    state: getPilotDimensionState(snapshot, definition.id),
  }));
}

export function getPilotEvaluationId(input: {
  datasetId: string;
  evaluatorId: string;
  outfitId: string;
  rubricVersion: string;
}) {
  const source = [
    input.datasetId,
    input.evaluatorId,
    input.outfitId,
    input.rubricVersion,
  ].join("\u001f");
  return `pilot-${stableHash(source)}-${stableHash(source.split("").reverse().join(""))}`;
}

export function getDeterministicOutfitOrder(input: {
  datasetId: string;
  evaluatorId: string;
  seed: string;
  outfitIds: readonly string[];
}) {
  return [...input.outfitIds].sort((left, right) => {
    const leftKey = stableHash(`${input.datasetId}|${input.evaluatorId}|${input.seed}|${left}`);
    const rightKey = stableHash(`${input.datasetId}|${input.evaluatorId}|${input.seed}|${right}`);
    return leftKey.localeCompare(rightKey) || left.localeCompare(right);
  });
}

export function findPilotEvaluation(
  dataset: ExpertEvaluationDataset,
  evaluatorId: string,
  outfitId: string
) {
  return dataset.absoluteEvaluations.find(
    (evaluation) =>
      evaluation.evaluatorId === evaluatorId &&
      evaluation.outfitId === outfitId &&
      evaluation.rubricVersion === dataset.rubricVersion
  );
}

export function createExpertPilotSession(input: {
  dataset: ExpertEvaluationDataset;
  evaluatorId: string;
  evaluatorGroup?: ExpertPilotEvaluatorGroup;
  seed?: string;
  now?: string;
}): ExpertPilotSession {
  const now = input.now || new Date().toISOString();
  const orderedOutfitIds = getDeterministicOutfitOrder({
    datasetId: input.dataset.datasetId,
    evaluatorId: input.evaluatorId,
    seed: input.seed || "pilot-v1",
    outfitIds: input.dataset.snapshots.map((snapshot) => snapshot.outfitId),
  });
  return {
    sessionVersion: EXPERT_PILOT_SESSION_VERSION,
    datasetId: input.dataset.datasetId,
    datasetVersion: input.dataset.datasetVersion,
    rubricVersion: input.dataset.rubricVersion,
    evaluatorId: input.evaluatorId,
    evaluatorGroup: input.evaluatorGroup || "unknown",
    seed: input.seed || "pilot-v1",
    orderedOutfitIds,
    completedOutfitIds: orderedOutfitIds.filter((outfitId) =>
      Boolean(findPilotEvaluation(input.dataset, input.evaluatorId, outfitId))
    ),
    startedAt: now,
    updatedAt: now,
  };
}

function assertCompleteDimensionSet(dimensions: readonly ExpertDimensionEvaluation[]) {
  const ids = new Set(dimensions.map((entry) => entry.dimension));
  if (
    dimensions.length !== REQUIRED_EXPERT_DIMENSIONS.length ||
    REQUIRED_EXPERT_DIMENSIONS.some((dimension) => !ids.has(dimension))
  ) {
    throw new Error("All 13 expert dimensions must be submitted exactly once.");
  }
}

export function buildPilotAbsoluteEvaluation(input: {
  dataset: ExpertEvaluationDataset;
  evaluatorId: string;
  evaluatorGroup: ExpertPilotEvaluatorGroup;
  outfitId: string;
  evaluation: ExpertPilotEvaluationInput;
  existing?: ExpertAbsoluteEvaluation;
  now?: string;
}) {
  assertCompleteDimensionSet(input.evaluation.dimensions);
  const now = input.now || new Date().toISOString();
  return {
    schemaVersion: EXPERT_EVALUATION_SCHEMA_VERSION,
    evaluationId: getPilotEvaluationId({
      datasetId: input.dataset.datasetId,
      evaluatorId: input.evaluatorId,
      outfitId: input.outfitId,
      rubricVersion: input.dataset.rubricVersion,
    }),
    outfitId: input.outfitId,
    rubricVersion: input.dataset.rubricVersion,
    evaluatorId: input.evaluatorId,
    evaluatorGroup: input.evaluatorGroup,
    dimensions: input.evaluation.dimensions.map((dimension) => ({
      ...dimension,
      supportingEvidenceCodes: [...dimension.supportingEvidenceCodes],
      conflictingEvidenceCodes: [...dimension.conflictingEvidenceCodes],
    })),
    overallCompatibility: input.evaluation.overallCompatibility
      ? {
          ...input.evaluation.overallCompatibility,
          supportingEvidenceCodes: [
            ...input.evaluation.overallCompatibility.supportingEvidenceCodes,
          ],
          conflictingEvidenceCodes: [
            ...input.evaluation.overallCompatibility.conflictingEvidenceCodes,
          ],
        }
      : undefined,
    evaluatorConfidence: input.evaluation.evaluatorConfidence,
    createdAt: input.existing?.createdAt || now,
    durationSeconds: input.evaluation.durationSeconds,
    datasetSplit: input.evaluation.datasetSplit,
  } satisfies ExpertAbsoluteEvaluation;
}

export function upsertPilotEvaluation(
  dataset: ExpertEvaluationDataset,
  evaluation: ExpertAbsoluteEvaluation
) {
  const absoluteEvaluations = dataset.absoluteEvaluations.filter(
    (entry) =>
      !(
        entry.evaluatorId === evaluation.evaluatorId &&
        entry.outfitId === evaluation.outfitId &&
        entry.rubricVersion === evaluation.rubricVersion
      )
  );
  absoluteEvaluations.push(evaluation);
  const evaluatorIds = new Set([
    ...absoluteEvaluations.map((entry) => entry.evaluatorId),
    ...dataset.pairwiseEvaluations.map((entry) => entry.evaluatorId),
  ]);
  return {
    ...dataset,
    absoluteEvaluations,
    metadata: {
      ...dataset.metadata,
      evaluatorCount: evaluatorIds.size,
      outfitCount: dataset.snapshots.length,
    },
  } satisfies ExpertEvaluationDataset;
}

export function validatePilotOutput(dataset: ExpertEvaluationDataset) {
  const result = validateExpertEvaluationDataset(dataset);
  if (!result.valid) {
    const summary = result.errors
      .slice(0, 5)
      .map((entry) => `${entry.path}: ${entry.message}`)
      .join("\n");
    throw new Error(`Expert dataset validation failed.\n${summary}`);
  }
  return result;
}

export function getPilotCompletion(
  dataset: ExpertEvaluationDataset,
  evaluatorId: string
) {
  const completedOutfitIds = dataset.snapshots
    .filter((snapshot) =>
      Boolean(findPilotEvaluation(dataset, evaluatorId, snapshot.outfitId))
    )
    .map((snapshot) => snapshot.outfitId);
  return {
    complete: completedOutfitIds.length === dataset.snapshots.length,
    completedOutfitIds,
    remaining: dataset.snapshots.length - completedOutfitIds.length,
  };
}
