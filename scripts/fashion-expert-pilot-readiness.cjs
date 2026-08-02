const crypto = require("node:crypto");
const path = require("node:path");

const { atomicWriteJson, readJson } = require("./run-fashion-expert-pilot.cjs");
const {
  canonicalJson,
  getDatasetSnapshotDigest,
  validateBatchLock,
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
  validatePilotOutput,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");

const READINESS_SCHEMA_VERSION = "expert-pilot-calibration-readiness-v1";
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

function assessPilotCalibrationReadiness({
  dataset,
  batchLock,
  assignmentManifest,
  mergeProvenance,
}) {
  validateBatchLock(batchLock);
  validateAssignmentManifest(assignmentManifest, batchLock);
  validateMergeProvenance(mergeProvenance);

  const validation = validatePilotOutput(dataset);
  const expectedEvaluatorIds = assignmentManifest.evaluators
    .filter((entry) => entry.outfitIds.length > 0)
    .map((entry) => entry.evaluatorId);
  const expectedEvaluatorIdSet = new Set(expectedEvaluatorIds);
  const assignedEvaluations = dataset.absoluteEvaluations.filter(
    (evaluation) => expectedEvaluatorIdSet.has(evaluation.evaluatorId)
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
    "--dataset", "--batch-lock", "--assignment", "--merge-provenance", "--output",
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
  };
  const output = valueFor(argv, "--output", false);
  if (output) options.outputPath = path.resolve(output);
  if (
    options.outputPath &&
    [options.datasetPath, options.batchLockPath, options.assignmentPath, options.mergeProvenancePath]
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
  READINESS_SCHEMA_VERSION,
  assessPilotCalibrationFiles,
  assessPilotCalibrationReadiness,
  parseArguments,
  validateMergeProvenance,
};
