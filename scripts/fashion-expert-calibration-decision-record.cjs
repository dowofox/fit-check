const crypto = require("node:crypto");
const path = require("node:path");

const { atomicWriteJson, readJson } = require("./run-fashion-expert-pilot.cjs");
const {
  canonicalJson,
  getOutputProvenancePath,
} = require("./fashion-expert-pilot-provenance.cjs");
const {
  createCalibrationReviewPacket,
} = require("./fashion-expert-calibration-review-packet.cjs");

const DECISION_INPUT_SCHEMA_VERSION = "expert-pilot-calibration-decision-input-v1";
const DECISION_RECORD_SCHEMA_VERSION = "expert-pilot-calibration-decision-record-v1";
const DECISIONS = new Set([
  "proceed_to_next_pilot",
  "revise_protocol",
  "collect_more_evaluations",
]);
const DIMENSION_ACTIONS = new Set(["retain", "clarify", "retest"]);
const RATIONALE_CODES = new Set([
  "coverage_reviewed",
  "agreement_reviewed",
  "unavailable_rate_reviewed",
  "high_disagreement_reviewed",
  "protocol_clarification_needed",
  "additional_evaluations_needed",
]);
const DECISION_RATIONALE_RULES = {
  proceed_to_next_pilot: {
    required: [],
    forbidden: ["protocol_clarification_needed", "additional_evaluations_needed"],
  },
  revise_protocol: {
    required: ["protocol_clarification_needed"],
    forbidden: ["additional_evaluations_needed"],
  },
  collect_more_evaluations: {
    required: ["additional_evaluations_needed"],
    forbidden: ["protocol_clarification_needed"],
  },
};

function fail(message) {
  throw new Error(message);
}

function digest(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sameValues(left, right) {
  return canonicalJson([...left].sort()) === canonicalJson([...right].sort());
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !sameValues(Object.keys(value), keys)) {
    fail(`${label} contains unknown or missing fields.`);
  }
}

function validateDecisionInput(input, packet) {
  exactKeys(input, [
    "schemaVersion", "reviewerId", "decidedAt", "decision", "rationaleCodes",
    "dimensionActions", "reviewedHighDisagreementOutfitIds",
  ], "Calibration decision");
  if (input.schemaVersion !== DECISION_INPUT_SCHEMA_VERSION) {
    fail("Calibration decision uses an unsupported schema.");
  }
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/i.test(input.reviewerId || "")) {
    fail("Calibration decision reviewerId is invalid.");
  }
  const decidedAt = new Date(input.decidedAt);
  if (!Number.isFinite(decidedAt.getTime()) || decidedAt.toISOString() !== input.decidedAt) {
    fail("Calibration decision decidedAt is invalid.");
  }
  if (!DECISIONS.has(input.decision)) fail("Calibration decision is invalid.");
  if (!Array.isArray(input.rationaleCodes) || !input.rationaleCodes.length ||
      new Set(input.rationaleCodes).size !== input.rationaleCodes.length ||
      input.rationaleCodes.some((code) => !RATIONALE_CODES.has(code))) {
    fail("Calibration decision rationale codes are invalid.");
  }
  const rationaleCodes = new Set(input.rationaleCodes);
  const rationaleRule = DECISION_RATIONALE_RULES[input.decision];
  if (rationaleRule.required.some((code) => !rationaleCodes.has(code)) ||
      rationaleRule.forbidden.some((code) => rationaleCodes.has(code))) {
    fail("Calibration decision rationale codes conflict with its disposition.");
  }
  if (!Array.isArray(input.dimensionActions)) {
    fail("Calibration decision dimension actions are invalid.");
  }
  const actions = new Map();
  input.dimensionActions.forEach((entry) => {
    exactKeys(entry, ["dimension", "action"], "Dimension action");
    if (actions.has(entry.dimension) || !DIMENSION_ACTIONS.has(entry.action)) {
      fail("Calibration decision dimension action is invalid.");
    }
    actions.set(entry.dimension, entry.action);
  });
  const packetDimensions = packet.dimensions.map((entry) => entry.dimension);
  if (!sameValues(actions.keys(), packetDimensions)) {
    fail("Calibration decision must cover every packet dimension exactly once.");
  }
  if (!Array.isArray(input.reviewedHighDisagreementOutfitIds) ||
      new Set(input.reviewedHighDisagreementOutfitIds).size !==
        input.reviewedHighDisagreementOutfitIds.length ||
      !sameValues(
        input.reviewedHighDisagreementOutfitIds,
        packet.reviewQueue.highDisagreementOutfitIds
      )) {
    fail("Calibration decision must review every high-disagreement outfit.");
  }
  if (input.decision === "proceed_to_next_pilot" &&
      [...actions.values()].some((action) => action !== "retain")) {
    fail("Proceed decisions require every dimension to be retained.");
  }
  if (input.decision === "revise_protocol" &&
      (![...actions.values()].includes("clarify") ||
       [...actions.values()].includes("retest"))) {
    fail("Protocol revision requires clarification without retesting.");
  }
  if (input.decision === "collect_more_evaluations" &&
      (![...actions.values()].includes("retest") ||
       [...actions.values()].includes("clarify"))) {
    fail("Additional evaluation decisions require retesting without clarification.");
  }
  return {
    ...input,
    rationaleCodes: [...input.rationaleCodes].sort(),
    dimensionActions: [...input.dimensionActions].sort((left, right) =>
      left.dimension.localeCompare(right.dimension)
    ),
    reviewedHighDisagreementOutfitIds:
      [...input.reviewedHighDisagreementOutfitIds].sort(),
  };
}

function createCalibrationDecisionRecord({ decisionInput, ...pilotSources }) {
  const packet = createCalibrationReviewPacket(pilotSources);
  const decision = validateDecisionInput(decisionInput, packet);
  const payload = {
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
    status: "recorded_for_calibration_follow_up",
    decisionScope: "calibration_follow_up_only",
    expertValidated: false,
    productionEligible: false,
    source: {
      packetSchemaVersion: packet.schemaVersion,
      packetDigestSha256: packet.packetDigestSha256,
      batchId: packet.source.batchId,
      batchFingerprintSha256: packet.source.batchFingerprintSha256,
      assignmentDigestSha256: packet.source.assignmentDigestSha256,
      mergedDatasetDigestSha256: packet.source.mergedDatasetDigestSha256,
    },
    decision,
  };
  return { ...payload, recordDigestSha256: digest(payload) };
}

function valuesFor(argv, name) {
  return argv.flatMap((value, index) => value === name ? [argv[index + 1]] : []);
}

function oneValue(argv, name) {
  const values = valuesFor(argv, name);
  if (values.length !== 1 || !values[0] || values[0].startsWith("--")) {
    fail(`Expected exactly one ${name} path.`);
  }
  return values[0];
}

function parseArguments(argv) {
  const allowed = new Set([
    "--dataset", "--source-dataset", "--batch-lock", "--assignment",
    "--merge-provenance", "--input", "--decision", "--output",
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index]) || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      fail("Invalid calibration decision record arguments.");
    }
  }
  const inputPaths = valuesFor(argv, "--input").map((value) => path.resolve(value));
  if (inputPaths.length < 2) fail("At least two --input paths are required.");
  if (new Set(inputPaths.map((value) => value.toLowerCase())).size !== inputPaths.length) {
    fail("Duplicate --input paths are not allowed.");
  }
  const options = {
    datasetPath: path.resolve(oneValue(argv, "--dataset")),
    sourceDatasetPath: path.resolve(oneValue(argv, "--source-dataset")),
    batchLockPath: path.resolve(oneValue(argv, "--batch-lock")),
    assignmentPath: path.resolve(oneValue(argv, "--assignment")),
    mergeProvenancePath: path.resolve(oneValue(argv, "--merge-provenance")),
    inputPaths,
    decisionPath: path.resolve(oneValue(argv, "--decision")),
    outputPath: path.resolve(oneValue(argv, "--output")),
  };
  const protectedPaths = [
    options.datasetPath,
    options.sourceDatasetPath,
    options.batchLockPath,
    options.assignmentPath,
    options.mergeProvenancePath,
    options.decisionPath,
    ...inputPaths,
    ...inputPaths.map(getOutputProvenancePath),
  ];
  if (protectedPaths.some((value) => value.toLowerCase() === options.outputPath.toLowerCase())) {
    fail("--output must be different from all inputs.");
  }
  if (options.datasetPath.toLowerCase() === options.sourceDatasetPath.toLowerCase()) {
    fail("--source-dataset must be different from --dataset.");
  }
  return options;
}

function createCalibrationDecisionRecordFile(options) {
  const evaluatorInputs = options.inputPaths.map((inputPath, index) => ({
    dataset: readJson(inputPath, `Input ${index + 1} dataset`),
    provenance: readJson(getOutputProvenancePath(inputPath), `Input ${index + 1} provenance`),
  }));
  const record = createCalibrationDecisionRecord({
    dataset: readJson(options.datasetPath, "Merged dataset"),
    sourceDataset: readJson(options.sourceDatasetPath, "Source dataset"),
    batchLock: readJson(options.batchLockPath, "Batch lock"),
    assignmentManifest: readJson(options.assignmentPath, "Assignment manifest"),
    mergeProvenance: readJson(options.mergeProvenancePath, "Merge provenance"),
    evaluatorInputs,
    decisionInput: readJson(options.decisionPath, "Calibration decision"),
  });
  atomicWriteJson(options.outputPath, record);
  return record;
}

function main() {
  try {
    const result = createCalibrationDecisionRecordFile(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  DECISION_INPUT_SCHEMA_VERSION,
  DECISION_RECORD_SCHEMA_VERSION,
  createCalibrationDecisionRecord,
  createCalibrationDecisionRecordFile,
  parseArguments,
  validateDecisionInput,
};
