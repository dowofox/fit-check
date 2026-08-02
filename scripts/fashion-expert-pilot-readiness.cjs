const crypto = require("node:crypto");
const path = require("node:path");

const { atomicWriteJson, readJson } = require("./run-fashion-expert-pilot.cjs");
const {
  canonicalJson,
  getDatasetSnapshotDigest,
  getOutputProvenancePath,
  validateBatchLock,
} = require("./fashion-expert-pilot-provenance.cjs");
const {
  validateAssignmentManifest,
} = require("./fashion-expert-pilot-assignment.cjs");
const {
  MERGE_PROVENANCE_SCHEMA_VERSION,
  getSemanticDatasetPayload,
  mergePilotDatasets,
} = require("./fashion-expert-pilot-merge.cjs");
const {
  createExpertDatasetReport,
} = require("../utils/fashionCompatibility/expert/evaluationDataset.ts");
const {
  validatePilotOutput,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");

const READINESS_SCHEMA_VERSION = "expert-pilot-calibration-readiness-v2";
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

function validateMergeProvenance(provenance) {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    fail("Merge provenance must be an object.");
  }
  const expectedKeys = [
    "schemaVersion", "batchId", "batchFingerprintSha256", "assignmentDigestSha256",
    "datasetId", "datasetVersion", "rubricVersion", "sourceDatasetDigestSha256", "snapshotDigestSha256",
    "protocolDigestSha256", "evaluators", "mergedDatasetDigestSha256", "createdAt",
  ];
  if (!sameValues(Object.keys(provenance), expectedKeys)) {
    fail("Merge provenance contains unknown or missing fields.");
  }
  if (provenance.schemaVersion !== MERGE_PROVENANCE_SCHEMA_VERSION) {
    fail("Merge provenance uses an unsupported schema.");
  }
  for (const key of [
    "batchFingerprintSha256", "assignmentDigestSha256", "sourceDatasetDigestSha256", "snapshotDigestSha256",
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

function mergeSourcesMatch({
  sourceDataset, evaluatorInputs, mergeProvenance, dataset, batchLock, assignmentManifest,
}) {
  try {
    const recomputed = mergePilotDatasets({
      sourceDataset,
      batchLock,
      assignmentManifest,
      inputs: evaluatorInputs,
      now: mergeProvenance.createdAt,
    });
    return mergeProvenance.sourceDatasetDigestSha256 ===
        digest(getSemanticDatasetPayload(sourceDataset)) &&
      canonicalJson(recomputed.provenance) === canonicalJson(mergeProvenance) &&
      digest(getSemanticDatasetPayload(recomputed.mergedDataset)) ===
        digest(getSemanticDatasetPayload(dataset));
  } catch {
    return false;
  }
}

function assessPilotCalibrationReadiness({
  dataset,
  batchLock,
  assignmentManifest,
  mergeProvenance,
  evaluatorInputs,
  sourceDataset,
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
        mergeProvenance.sourceDatasetDigestSha256 ===
          digest(getSemanticDatasetPayload(sourceDataset)) &&
        mergeProvenance.snapshotDigestSha256 === batchLock.dataset.snapshotDigestSha256 &&
        mergeProvenance.protocolDigestSha256 === batchLock.protocol.protocolDigestSha256,
    },
    {
      id: "merge_input_digests_match",
      passed: mergeSourcesMatch({
        sourceDataset, evaluatorInputs, mergeProvenance, dataset, batchLock, assignmentManifest,
      }),
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
    "--dataset", "--source-dataset", "--batch-lock", "--assignment", "--merge-provenance", "--input", "--output",
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index]) || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      fail("Invalid readiness arguments.");
    }
  }
  const options = {
    datasetPath: path.resolve(valueFor(argv, "--dataset")),
    sourceDatasetPath: path.resolve(valueFor(argv, "--source-dataset")),
    batchLockPath: path.resolve(valueFor(argv, "--batch-lock")),
    assignmentPath: path.resolve(valueFor(argv, "--assignment")),
    mergeProvenancePath: path.resolve(valueFor(argv, "--merge-provenance")),
    inputPaths: argv.flatMap((value, index) =>
      value === "--input" ? [path.resolve(argv[index + 1])] : []
    ),
  };
  if (options.datasetPath.toLowerCase() === options.sourceDatasetPath.toLowerCase()) {
    fail("--source-dataset must be different from --dataset.");
  }
  if (options.inputPaths.length < 2) fail("At least two --input paths are required.");
  if (new Set(options.inputPaths.map((value) => value.toLowerCase())).size !== options.inputPaths.length) {
    fail("Duplicate --input paths are not allowed.");
  }
  const output = valueFor(argv, "--output", false);
  if (output) options.outputPath = path.resolve(output);
  if (
    options.outputPath &&
    [options.datasetPath, options.sourceDatasetPath, options.batchLockPath, options.assignmentPath, options.mergeProvenancePath,
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
    sourceDataset: readJson(options.sourceDatasetPath, "Source dataset"),
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
