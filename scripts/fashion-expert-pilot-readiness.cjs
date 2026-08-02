const crypto = require("node:crypto");
const path = require("node:path");

const { atomicWriteJson, readJson } = require("./run-fashion-expert-pilot.cjs");
const {
  canonicalJson,
  getDatasetSnapshotDigest,
  getOrderedOutfitIdsDigest,
  getOutputProvenancePath,
  validateBatchLock,
  validateOutputProvenance,
} = require("./fashion-expert-pilot-provenance.cjs");
const {
  validateAssignmentManifest,
} = require("./fashion-expert-pilot-assignment.cjs");
const {
  MERGE_PROVENANCE_SCHEMA_VERSION,
  getSemanticDatasetPayload,
} = require("./fashion-expert-pilot-merge.cjs");
const {
  createExpertDatasetReport,
} = require("../utils/fashionCompatibility/expert/evaluationDataset.ts");
const {
  getDeterministicOutfitOrder,
  validatePilotOutput,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");

const READINESS_SCHEMA_VERSION = "expert-pilot-calibration-readiness-v1";
const READINESS_CHECK_IDS = Object.freeze([
  "dataset_valid",
  "batch_identity_matches",
  "assignment_identity_matches",
  "merge_identity_matches",
  "merge_input_digests_match",
  "merged_dataset_digest_matches",
  "assigned_evaluators_match",
  "assignment_coverage_complete",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(message);
}

function digest(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sameValues(left, right) {
  return canonicalJson([...left].sort()) === canonicalJson([...right].sort());
}

function sortedEvaluations(evaluations) {
  return [...evaluations].sort((left, right) =>
    `${left.evaluatorId}\u001f${left.outfitId}\u001f${left.evaluationId}`.localeCompare(
      `${right.evaluatorId}\u001f${right.outfitId}\u001f${right.evaluationId}`
    )
  );
}

function validateMergeProvenance(provenance) {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    fail("Merge provenance must be an object.");
  }
  const expectedKeys = [
    "schemaVersion", "batchId", "batchFingerprintSha256", "assignmentDigestSha256",
    "datasetId", "datasetVersion", "rubricVersion", "snapshotDigestSha256",
    "protocolDigestSha256", "evaluators", "mergedDatasetDigestSha256", "createdAt",
  ];
  if (!sameValues(Object.keys(provenance), expectedKeys)) {
    fail("Merge provenance contains unknown or missing fields.");
  }
  if (provenance.schemaVersion !== MERGE_PROVENANCE_SCHEMA_VERSION) {
    fail("Merge provenance uses an unsupported schema.");
  }
  for (const key of [
    "batchFingerprintSha256", "assignmentDigestSha256", "snapshotDigestSha256",
    "protocolDigestSha256", "mergedDatasetDigestSha256",
  ]) {
    if (!SHA256_PATTERN.test(provenance[key] || "")) fail(`Merge provenance ${key} is invalid.`);
  }
  if (!Array.isArray(provenance.evaluators)) fail("Merge provenance evaluators are invalid.");
  const evaluatorIds = new Set();
  provenance.evaluators.forEach((entry) => {
    if (
      !entry || typeof entry !== "object" || Array.isArray(entry) ||
      !sameValues(Object.keys(entry), [
        "evaluatorId", "inputDatasetDigestSha256", "inputProvenanceDigestSha256",
      ]) || typeof entry.evaluatorId !== "string" ||
      !SHA256_PATTERN.test(entry.inputDatasetDigestSha256 || "") ||
      !SHA256_PATTERN.test(entry.inputProvenanceDigestSha256 || "")
    ) {
      fail("Merge provenance evaluator entry is invalid.");
    }
    if (evaluatorIds.has(entry.evaluatorId)) fail("Merge provenance repeats an evaluator.");
    evaluatorIds.add(entry.evaluatorId);
  });
  return provenance;
}

function evaluatorInputsMatch(inputs, mergeProvenance, dataset, batchLock, assignmentManifest) {
  if (!Array.isArray(inputs) || inputs.length < 2) {
    fail("At least two evaluator inputs are required.");
  }
  const inputsByEvaluator = new Map();
  inputs.forEach((input) => {
    validatePilotOutput(input.dataset);
    validateOutputProvenance(input.provenance);
    const evaluatorId = input.provenance.evaluatorId;
    if (inputsByEvaluator.has(evaluatorId)) fail("Evaluator inputs repeat an evaluator.");
    inputsByEvaluator.set(evaluatorId, input);
  });
  if (!sameValues(
    [...inputsByEvaluator.keys()],
    mergeProvenance.evaluators.map((entry) => entry.evaluatorId)
  )) return false;
  return mergeProvenance.evaluators.every((entry) => {
    const input = inputsByEvaluator.get(entry.evaluatorId);
    const assignment = assignmentManifest.evaluators.find(
      (candidate) => candidate.evaluatorId === entry.evaluatorId
    );
    if (!input || !assignment) return false;
    const expectedOrder = getDeterministicOutfitOrder({
      datasetId: dataset.datasetId,
      evaluatorId: entry.evaluatorId,
      seed: input.provenance.seed,
      outfitIds: assignment.outfitIds,
    });
    const inputEvaluations = input.dataset.absoluteEvaluations.filter(
      (evaluation) => evaluation.evaluatorId === entry.evaluatorId
    );
    const mergedEvaluations = dataset.absoluteEvaluations.filter(
      (evaluation) => evaluation.evaluatorId === entry.evaluatorId
    );
    return input.provenance.batchId === batchLock.batchId &&
      input.provenance.batchFingerprintSha256 === batchLock.batchFingerprintSha256 &&
      input.provenance.assignmentDigestSha256 === assignmentManifest.assignmentDigestSha256 &&
      input.provenance.datasetId === dataset.datasetId &&
      input.provenance.datasetVersion === dataset.datasetVersion &&
      input.provenance.rubricVersion === dataset.rubricVersion &&
      input.provenance.orderedOutfitIdsDigestSha256 === getOrderedOutfitIdsDigest(expectedOrder) &&
      getDatasetSnapshotDigest(input.dataset) === batchLock.dataset.snapshotDigestSha256 &&
      entry.inputDatasetDigestSha256 === digest(getSemanticDatasetPayload(input.dataset)) &&
      entry.inputProvenanceDigestSha256 === digest(input.provenance) &&
      canonicalJson(sortedEvaluations(inputEvaluations)) ===
        canonicalJson(sortedEvaluations(mergedEvaluations));
  });
}

function assessPilotCalibrationReadiness({
  dataset,
  batchLock,
  assignmentManifest,
  mergeProvenance,
  evaluatorInputs,
}) {
  validateBatchLock(batchLock);
  validateAssignmentManifest(assignmentManifest, batchLock);
  validateMergeProvenance(mergeProvenance);

  const validation = validatePilotOutput(dataset);
  const expectedEvaluatorIds = assignmentManifest.evaluators
    .filter((entry) => entry.outfitIds.length > 0)
    .map((entry) => entry.evaluatorId);
  const assignedOutfitIdsByEvaluator = new Map(
    assignmentManifest.evaluators.map((entry) => [
      entry.evaluatorId,
      new Set(entry.outfitIds),
    ])
  );
  const assignedEvaluations = dataset.absoluteEvaluations.filter(
    (evaluation) => assignedOutfitIdsByEvaluator
      .get(evaluation.evaluatorId)
      ?.has(evaluation.outfitId)
  );
  const provenanceEvaluatorIds = mergeProvenance.evaluators.map((entry) => entry.evaluatorId);
  const coverageComplete = assignmentManifest.evaluators.every((assignment) => {
    const actualOutfitIds = dataset.absoluteEvaluations
      .filter((evaluation) => evaluation.evaluatorId === assignment.evaluatorId)
      .map((evaluation) => evaluation.outfitId);
    return sameValues(actualOutfitIds, assignment.outfitIds);
  });
  const checks = [
    { id: "dataset_valid", passed: validation.valid },
    {
      id: "batch_identity_matches",
      passed:
        dataset.datasetId === batchLock.dataset.datasetId &&
        dataset.datasetVersion === batchLock.dataset.datasetVersion &&
        dataset.rubricVersion === batchLock.dataset.rubricVersion &&
        getDatasetSnapshotDigest(dataset) === batchLock.dataset.snapshotDigestSha256 &&
        mergeProvenance.batchId === batchLock.batchId &&
        mergeProvenance.batchFingerprintSha256 === batchLock.batchFingerprintSha256,
    },
    {
      id: "assignment_identity_matches",
      passed: mergeProvenance.assignmentDigestSha256 === assignmentManifest.assignmentDigestSha256,
    },
    {
      id: "merge_identity_matches",
      passed:
        mergeProvenance.datasetId === dataset.datasetId &&
        mergeProvenance.datasetVersion === dataset.datasetVersion &&
        mergeProvenance.rubricVersion === dataset.rubricVersion &&
        mergeProvenance.snapshotDigestSha256 === batchLock.dataset.snapshotDigestSha256 &&
        mergeProvenance.protocolDigestSha256 === batchLock.protocol.protocolDigestSha256,
    },
    {
      id: "merge_input_digests_match",
      passed: evaluatorInputsMatch(
        evaluatorInputs, mergeProvenance, dataset, batchLock, assignmentManifest
      ),
    },
    {
      id: "merged_dataset_digest_matches",
      passed:
        mergeProvenance.mergedDatasetDigestSha256 === digest(getSemanticDatasetPayload(dataset)),
    },
    { id: "assigned_evaluators_match", passed: sameValues(provenanceEvaluatorIds, expectedEvaluatorIds) },
    { id: "assignment_coverage_complete", passed: coverageComplete },
  ];
  const pilotDataset = {
    ...dataset,
    absoluteEvaluations: assignedEvaluations,
    pairwiseEvaluations: [],
    metadata: {
      ...dataset.metadata,
      evaluatorCount: expectedEvaluatorIds.length,
      outfitCount: dataset.snapshots.length,
    },
  };
  const report = createExpertDatasetReport(pilotDataset);
  const ready = checks.every((check) => check.passed);
  return {
    schemaVersion: READINESS_SCHEMA_VERSION,
    ready,
    status: ready ? "ready_for_calibration_review" : "blocked",
    decisionScope: "calibration_review_only",
    expertValidated: false,
    productionEligible: false,
    batchId: batchLock.batchId,
    batchFingerprintSha256: batchLock.batchFingerprintSha256,
    assignmentDigestSha256: assignmentManifest.assignmentDigestSha256,
    mergedDatasetDigestSha256: mergeProvenance.mergedDatasetDigestSha256,
    counts: {
      outfits: assignmentManifest.outfits.length,
      assignedEvaluators: expectedEvaluatorIds.length,
      expectedAssignedEvaluations: assignmentManifest.evaluators.reduce(
        (sum, entry) => sum + entry.outfitIds.length,
        0
      ),
      actualAssignedEvaluations: assignedEvaluations.length,
      validationErrors: validation.errors.length,
      validationWarnings: validation.warnings.length,
    },
    checks,
    diagnostics: {
      coverageByDimension: report.coverageByDimension,
      unavailableRateByDimension: report.unavailableRateByDimension,
      confidenceByDimension: report.confidenceByDimension,
      agreementByDimension: report.agreementByDimension,
      highDisagreementOutfitIds: report.highDisagreementOutfitIds,
    },
  };
}

function valueFor(argv, name, required = true) {
  const indexes = argv.flatMap((value, index) => value === name ? [index] : []);
  if (!required && indexes.length === 0) return undefined;
  if (indexes.length !== 1 || !argv[indexes[0] + 1] || argv[indexes[0] + 1].startsWith("--")) {
    fail(`Expected exactly one ${name} value.`);
  }
  return argv[indexes[0] + 1];
}

function parseArguments(argv) {
  const allowed = new Set([
    "--dataset", "--batch-lock", "--assignment", "--merge-provenance", "--input", "--output",
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index]) || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      fail("Invalid readiness arguments.");
    }
  }
  const options = {
    datasetPath: path.resolve(valueFor(argv, "--dataset")),
    batchLockPath: path.resolve(valueFor(argv, "--batch-lock")),
    assignmentPath: path.resolve(valueFor(argv, "--assignment")),
    mergeProvenancePath: path.resolve(valueFor(argv, "--merge-provenance")),
    inputPaths: argv.flatMap((value, index) =>
      value === "--input" ? [path.resolve(argv[index + 1])] : []
    ),
  };
  if (options.inputPaths.length < 2) fail("At least two --input paths are required.");
  if (new Set(options.inputPaths.map((value) => value.toLowerCase())).size !== options.inputPaths.length) {
    fail("Duplicate --input paths are not allowed.");
  }
  const output = valueFor(argv, "--output", false);
  if (output) options.outputPath = path.resolve(output);
  if (
    options.outputPath &&
    [options.datasetPath, options.batchLockPath, options.assignmentPath, options.mergeProvenancePath,
      ...options.inputPaths, ...options.inputPaths.map(getOutputProvenancePath)]
      .some((value) => value.toLowerCase() === options.outputPath.toLowerCase())
  ) {
    fail("--output must be different from all inputs.");
  }
  return options;
}

function assessPilotCalibrationFiles(options) {
  const readiness = assessPilotCalibrationReadiness({
    dataset: readJson(options.datasetPath, "Merged dataset"),
    batchLock: readJson(options.batchLockPath, "Batch lock"),
    assignmentManifest: readJson(options.assignmentPath, "Assignment manifest"),
    mergeProvenance: readJson(options.mergeProvenancePath, "Merge provenance"),
    evaluatorInputs: options.inputPaths.map((inputPath, index) => ({
      dataset: readJson(inputPath, `Input ${index + 1} dataset`),
      provenance: readJson(getOutputProvenancePath(inputPath), `Input ${index + 1} provenance`),
    })),
  });
  if (options.outputPath) {
    atomicWriteJson(options.outputPath, readiness);
  }
  return readiness;
}

function main() {
  try {
    const result = assessPilotCalibrationFiles(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  READINESS_CHECK_IDS,
  READINESS_SCHEMA_VERSION,
  assessPilotCalibrationFiles,
  assessPilotCalibrationReadiness,
  parseArguments,
  validateMergeProvenance,
};
