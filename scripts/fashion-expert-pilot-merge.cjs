const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { validateInputDataset } = require("./run-fashion-expert-pilot.cjs");
const {
  canonicalJson,
  getDatasetSnapshotDigest,
  getExpertPilotProtocolDigest,
  getOrderedOutfitIdsDigest,
  getOutputProvenancePath,
  validateBatchLock,
  validateOutputProvenance,
} = require("./fashion-expert-pilot-provenance.cjs");
const {
  getDeterministicOutfitOrder,
  getExpertPilotProtocolPayload,
  getPilotEvaluationId,
  validatePilotOutput,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");

const MERGE_PROVENANCE_SCHEMA_VERSION = "expert-pilot-merge-provenance-v1";
const ABSOLUTE_EVALUATION_KEYS = new Set([
  "schemaVersion", "evaluationId", "outfitId", "rubricVersion", "evaluatorId",
  "evaluatorGroup", "dimensions", "overallCompatibility", "evaluatorConfidence",
  "createdAt", "durationSeconds", "datasetSplit",
]);
const DIMENSION_KEYS = new Set([
  "dimension", "availability", "rating", "confidence", "supportingEvidenceCodes",
  "conflictingEvidenceCodes", "notes",
]);
const FORBIDDEN_MERGE_KEYS = new Set([
  "base64", "path", "professionalScore", "scoreDifference", "token",
].map((key) => key.toLowerCase()));

function fail(message) {
  throw new Error(message);
}

function digest(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function valuesFor(argv, name) {
  const values = [];
  argv.forEach((value, index) => {
    if (value === name) values.push(argv[index + 1]);
  });
  return values;
}

function oneValue(argv, name) {
  const values = valuesFor(argv, name);
  if (values.length !== 1 || !values[0] || values[0].startsWith("--")) {
    fail(`Expected exactly one ${name} path.`);
  }
  return values[0];
}

function parseMergeArguments(argv) {
  const allowed = new Set(["--dataset", "--batch-lock", "--input", "--output"]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index]) || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      fail("Invalid merge arguments.");
    }
  }
  const datasetPath = path.resolve(oneValue(argv, "--dataset"));
  const batchLockPath = path.resolve(oneValue(argv, "--batch-lock"));
  const outputPath = path.resolve(oneValue(argv, "--output"));
  const inputPaths = valuesFor(argv, "--input").map((value) => path.resolve(value));
  if (inputPaths.length < 2) fail("At least two --input paths are required.");
  if (new Set(inputPaths.map((value) => value.toLowerCase())).size !== inputPaths.length) {
    fail("Duplicate --input paths are not allowed.");
  }
  const provenancePath = `${outputPath}.pilot-merge-provenance.json`;
  const protectedPaths = [
    datasetPath,
    batchLockPath,
    ...inputPaths,
    ...inputPaths.map(getOutputProvenancePath),
  ];
  if (protectedPaths.some((value) => samePath(value, outputPath))) {
    fail("--output must be different from source and input files.");
  }
  if (protectedPaths.some((value) => samePath(value, provenancePath))) {
    fail("Merge provenance path conflicts with a source or input file.");
  }
  if (fs.existsSync(outputPath) || fs.existsSync(provenancePath)) {
    fail("Merge output already exists.");
  }
  return { datasetPath, batchLockPath, inputPaths, outputPath, provenancePath };
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`${label} is missing.`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    fail(`${label} is not valid JSON.`);
  }
}

function sortEvaluations(evaluations) {
  return [...evaluations].sort(
    (left, right) =>
      left.evaluatorId.localeCompare(right.evaluatorId) ||
      left.outfitId.localeCompare(right.outfitId) ||
      left.evaluationId.localeCompare(right.evaluationId)
  );
}

function normalizeDimension(dimension) {
  return {
    ...dimension,
    supportingEvidenceCodes: [...dimension.supportingEvidenceCodes].sort(),
    conflictingEvidenceCodes: [...dimension.conflictingEvidenceCodes].sort(),
  };
}

function normalizeAbsoluteEvaluation(evaluation) {
  return {
    ...evaluation,
    dimensions: evaluation.dimensions
      .map(normalizeDimension)
      .sort((left, right) => left.dimension.localeCompare(right.dimension)),
    ...(evaluation.overallCompatibility
      ? { overallCompatibility: normalizeDimension(evaluation.overallCompatibility) }
      : {}),
  };
}

function normalizePairwiseEvaluation(evaluation) {
  return {
    ...evaluation,
    dimensions: [...evaluation.dimensions]
      .map((dimension) => ({
        ...dimension,
        evidenceCodes: [...dimension.evidenceCodes].sort(),
      }))
      .sort((left, right) => left.dimension.localeCompare(right.dimension)),
  };
}

function getSemanticDatasetPayload(dataset) {
  return {
    ...dataset,
    snapshots: [...dataset.snapshots].sort((left, right) => left.outfitId.localeCompare(right.outfitId)),
    absoluteEvaluations: sortEvaluations(dataset.absoluteEvaluations).map(normalizeAbsoluteEvaluation),
    pairwiseEvaluations: [...dataset.pairwiseEvaluations]
      .sort((left, right) => left.evaluationId.localeCompare(right.evaluationId))
      .map(normalizePairwiseEvaluation),
  };
}

function assertSameKeys(actual, expected, label) {
  if (canonicalJson(Object.keys(actual).sort()) !== canonicalJson(Object.keys(expected).sort())) {
    fail(`${label} fields differ from the source dataset.`);
  }
}

function assertKnownEvaluationShape(evaluation) {
  for (const key of Object.keys(evaluation)) {
    if (!ABSOLUTE_EVALUATION_KEYS.has(key)) fail("Absolute evaluation contains an unknown field.");
  }
  for (const dimension of [
    ...evaluation.dimensions,
    ...(evaluation.overallCompatibility ? [evaluation.overallCompatibility] : []),
  ]) {
    for (const key of Object.keys(dimension)) {
      if (!DIMENSION_KEYS.has(key)) fail("Dimension evaluation contains an unknown field.");
    }
  }
}

function assertNoForbiddenMergeFields(value) {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenMergeFields);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_MERGE_KEYS.has(key.toLowerCase())) {
      fail("Pilot merge input contains a prohibited field.");
    }
    assertNoForbiddenMergeFields(entry);
  }
}

function getBaseDatasetPayload(dataset) {
  const { absoluteEvaluations: _absolute, metadata, ...base } = getSemanticDatasetPayload(dataset);
  return {
    ...base,
    metadata: {
      ...metadata,
      evaluatorCount: undefined,
      outfitCount: undefined,
    },
  };
}

function evaluationKey(evaluation) {
  return `${evaluation.evaluatorId}\u001f${evaluation.outfitId}\u001f${evaluation.rubricVersion}`;
}

function assertSourceAndBatch(sourceDataset, batchLock) {
  validateInputDataset(sourceDataset, "Source dataset");
  assertNoForbiddenMergeFields(sourceDataset);
  sourceDataset.absoluteEvaluations.forEach(assertKnownEvaluationShape);
  validateBatchLock(batchLock);
  if (
    batchLock.dataset.datasetId !== sourceDataset.datasetId ||
    batchLock.dataset.datasetVersion !== sourceDataset.datasetVersion ||
    batchLock.dataset.rubricVersion !== sourceDataset.rubricVersion
  ) {
    fail("Batch lock dataset identity does not match the source dataset.");
  }
  if (batchLock.dataset.snapshotDigestSha256 !== getDatasetSnapshotDigest(sourceDataset)) {
    fail("Batch lock snapshot digest does not match the source dataset.");
  }
  const sourceOutfitIds = sourceDataset.snapshots.map((entry) => entry.outfitId).sort();
  const lockedOutfitIds = batchLock.outfits.map((entry) => entry.outfitId).sort();
  if (canonicalJson(sourceOutfitIds) !== canonicalJson(lockedOutfitIds)) {
    fail("Batch lock outfit set does not match the source dataset.");
  }
  const currentProtocol = getExpertPilotProtocolPayload();
  if (
    batchLock.protocol.rubricVersion !== currentProtocol.rubricVersion ||
    batchLock.protocol.protocolDigestSha256 !== getExpertPilotProtocolDigest(currentProtocol)
  ) {
    fail("Batch lock annotation protocol does not match the current protocol.");
  }
}

function assertInputBase(sourceDataset, inputDataset) {
  validateInputDataset(inputDataset, "Evaluator output");
  assertNoForbiddenMergeFields(inputDataset);
  assertSameKeys(inputDataset, sourceDataset, "Dataset");
  assertSameKeys(inputDataset.metadata, sourceDataset.metadata, "Metadata");
  if (canonicalJson(getBaseDatasetPayload(inputDataset)) !== canonicalJson(getBaseDatasetPayload(sourceDataset))) {
    fail("Evaluator output changed the source dataset contract.");
  }
}

function validateEvaluatorInput({ sourceDataset, inputDataset, provenance, batchLock }) {
  validateOutputProvenance(provenance);
  for (const [key, expected] of Object.entries({
    batchId: batchLock.batchId,
    batchFingerprintSha256: batchLock.batchFingerprintSha256,
    datasetId: sourceDataset.datasetId,
    datasetVersion: sourceDataset.datasetVersion,
    rubricVersion: sourceDataset.rubricVersion,
  })) {
    if (provenance[key] !== expected) fail(`Pilot output provenance ${key} does not match the batch.`);
  }
  const orderedOutfitIds = getDeterministicOutfitOrder({
    datasetId: sourceDataset.datasetId,
    evaluatorId: provenance.evaluatorId,
    seed: provenance.seed,
    outfitIds: sourceDataset.snapshots.map((snapshot) => snapshot.outfitId),
  });
  if (provenance.orderedOutfitIdsDigestSha256 !== getOrderedOutfitIdsDigest(orderedOutfitIds)) {
    fail("Pilot output provenance order digest is invalid.");
  }
  assertInputBase(sourceDataset, inputDataset);

  const sourceByKey = new Map(sourceDataset.absoluteEvaluations.map((entry) => [evaluationKey(entry), entry]));
  const inputByKey = new Map();
  for (const evaluation of inputDataset.absoluteEvaluations) {
    assertKnownEvaluationShape(evaluation);
    const key = evaluationKey(evaluation);
    if (inputByKey.has(key)) fail("Evaluator output contains a duplicate evaluator/outfit record.");
    inputByKey.set(key, evaluation);
    if (evaluation.evaluatorId !== provenance.evaluatorId) {
      const sourceEvaluation = sourceByKey.get(key);
      if (!sourceEvaluation || canonicalJson(normalizeAbsoluteEvaluation(evaluation)) !== canonicalJson(normalizeAbsoluteEvaluation(sourceEvaluation))) {
        fail("Evaluator output changed another evaluator's record.");
      }
    }
  }
  for (const [key, sourceEvaluation] of sourceByKey) {
    const actual = inputByKey.get(key);
    if (!actual) fail("Evaluator output deleted a source evaluation.");
    if (
      sourceEvaluation.evaluatorId !== provenance.evaluatorId &&
      canonicalJson(normalizeAbsoluteEvaluation(actual)) !== canonicalJson(normalizeAbsoluteEvaluation(sourceEvaluation))
    ) {
      fail("Evaluator output changed another evaluator's record.");
    }
  }

  const evaluatorEntries = inputDataset.absoluteEvaluations.filter(
    (entry) => entry.evaluatorId === provenance.evaluatorId
  );
  if (evaluatorEntries.length !== sourceDataset.snapshots.length) {
    fail("Evaluator output is incomplete.");
  }
  const snapshotIds = new Set(sourceDataset.snapshots.map((entry) => entry.outfitId));
  const covered = new Set();
  for (const evaluation of evaluatorEntries) {
    if (!snapshotIds.has(evaluation.outfitId)) fail("Evaluator output references an unknown outfit.");
    if (covered.has(evaluation.outfitId)) fail("Evaluator output evaluates an outfit more than once.");
    covered.add(evaluation.outfitId);
    if (evaluation.rubricVersion !== sourceDataset.rubricVersion) {
      fail("Evaluator output rubric does not match the source dataset.");
    }
    const expectedId = getPilotEvaluationId({
      datasetId: sourceDataset.datasetId,
      evaluatorId: provenance.evaluatorId,
      outfitId: evaluation.outfitId,
      rubricVersion: sourceDataset.rubricVersion,
    });
    if (evaluation.evaluationId !== expectedId) fail("Evaluator output has a non-deterministic evaluation ID.");
    const sourceEvaluation = sourceByKey.get(evaluationKey(evaluation));
    if (
      sourceEvaluation &&
      (sourceEvaluation.evaluationId !== evaluation.evaluationId ||
        sourceEvaluation.createdAt !== evaluation.createdAt)
    ) {
      fail("Evaluator output cannot replace a source evaluation identity or creation time.");
    }
  }
  const expectedEvaluatorCount = new Set([
    ...inputDataset.absoluteEvaluations.map((entry) => entry.evaluatorId),
    ...inputDataset.pairwiseEvaluations.map((entry) => entry.evaluatorId),
  ]).size;
  if (
    inputDataset.metadata.outfitCount !== inputDataset.snapshots.length ||
    inputDataset.metadata.evaluatorCount !== expectedEvaluatorCount
  ) {
    fail("Evaluator output metadata counts are invalid.");
  }
  return evaluatorEntries;
}

function createMergeProvenance({ batchLock, sourceDataset, inputs, mergedDataset, now }) {
  return {
    schemaVersion: MERGE_PROVENANCE_SCHEMA_VERSION,
    batchId: batchLock.batchId,
    batchFingerprintSha256: batchLock.batchFingerprintSha256,
    datasetId: sourceDataset.datasetId,
    datasetVersion: sourceDataset.datasetVersion,
    rubricVersion: sourceDataset.rubricVersion,
    snapshotDigestSha256: batchLock.dataset.snapshotDigestSha256,
    protocolDigestSha256: batchLock.protocol.protocolDigestSha256,
    evaluators: [...inputs]
      .sort((left, right) => left.provenance.evaluatorId.localeCompare(right.provenance.evaluatorId))
      .map((input) => ({
        evaluatorId: input.provenance.evaluatorId,
        inputDatasetDigestSha256: digest(getSemanticDatasetPayload(input.dataset)),
        inputProvenanceDigestSha256: digest(input.provenance),
      })),
    mergedDatasetDigestSha256: digest(getSemanticDatasetPayload(mergedDataset)),
    createdAt: now || new Date().toISOString(),
  };
}

function mergePilotDatasets({ sourceDataset, batchLock, inputs, now }) {
  if (!Array.isArray(inputs) || inputs.length < 2) fail("At least two evaluator inputs are required.");
  assertSourceAndBatch(sourceDataset, batchLock);
  const seenEvaluators = new Set();
  const evaluationsByKey = new Map(
    sourceDataset.absoluteEvaluations.map((entry) => [evaluationKey(entry), entry])
  );
  inputs.forEach((input, index) => {
    try {
      const evaluatorId = input.provenance?.evaluatorId;
      if (seenEvaluators.has(evaluatorId)) fail("Duplicate evaluator input is not allowed.");
      const evaluations = validateEvaluatorInput({
        sourceDataset,
        batchLock,
        inputDataset: input.dataset,
        provenance: input.provenance,
      });
      seenEvaluators.add(evaluatorId);
      evaluations.forEach((evaluation) => evaluationsByKey.set(evaluationKey(evaluation), evaluation));
    } catch (error) {
      throw new Error(`Input ${index + 1}: ${error instanceof Error ? error.message : error}`);
    }
  });
  const absoluteEvaluations = sortEvaluations([...evaluationsByKey.values()]);
  const evaluatorIds = new Set([
    ...absoluteEvaluations.map((entry) => entry.evaluatorId),
    ...sourceDataset.pairwiseEvaluations.map((entry) => entry.evaluatorId),
  ]);
  const mergedDataset = {
    ...structuredClone(sourceDataset),
    absoluteEvaluations,
    metadata: {
      ...sourceDataset.metadata,
      evaluatorCount: evaluatorIds.size,
      outfitCount: sourceDataset.snapshots.length,
    },
  };
  const validation = validatePilotOutput(mergedDataset);
  return {
    mergedDataset,
    provenance: createMergeProvenance({ batchLock, sourceDataset, inputs, mergedDataset, now }),
    validation,
  };
}

function atomicWriteJsonPair(outputPath, outputValue, provenancePath, provenanceValue) {
  if (fs.existsSync(outputPath) || fs.existsSync(provenancePath)) {
    fail("Merge output already exists.");
  }
  const outputText = `${JSON.stringify(outputValue, null, 2)}\n`;
  const provenanceText = `${JSON.stringify(provenanceValue, null, 2)}\n`;
  const directory = path.dirname(outputPath);
  fs.mkdirSync(directory, { recursive: true });
  const suffix = `${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const outputTemp = path.join(directory, `.${path.basename(outputPath)}.${suffix}`);
  const provenanceTemp = path.join(directory, `.${path.basename(provenancePath)}.${suffix}`);
  const writeTemp = (filePath, value) => {
    const descriptor = fs.openSync(filePath, "wx");
    try {
      fs.writeFileSync(descriptor, value, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  };
  try {
    writeTemp(outputTemp, outputText);
    writeTemp(provenanceTemp, provenanceText);
    fs.renameSync(provenanceTemp, provenancePath);
    try {
      fs.renameSync(outputTemp, outputPath);
    } catch (error) {
      fs.rmSync(provenancePath, { force: true });
      throw error;
    }
  } finally {
    fs.rmSync(outputTemp, { force: true });
    fs.rmSync(provenanceTemp, { force: true });
  }
}

function mergePilotFiles(options) {
  if (fs.existsSync(options.outputPath) || fs.existsSync(options.provenancePath)) {
    fail("Merge output already exists.");
  }
  const sourceDataset = readJson(options.datasetPath, "Source dataset");
  const batchLock = readJson(options.batchLockPath, "Batch lock");
  const inputs = options.inputPaths.map((inputPath, index) => ({
    dataset: readJson(inputPath, `Input ${index + 1} dataset`),
    provenance: readJson(getOutputProvenancePath(inputPath), `Input ${index + 1} provenance`),
  }));
  const result = mergePilotDatasets({ sourceDataset, batchLock, inputs, now: options.now });
  atomicWriteJsonPair(
    options.outputPath,
    result.mergedDataset,
    options.provenancePath,
    result.provenance
  );
  return result;
}

function main() {
  try {
    const options = parseMergeArguments(process.argv.slice(2));
    const result = mergePilotFiles(options);
    console.log(`Batch ID: ${result.provenance.batchId}`);
    console.log(`Batch fingerprint: ${result.provenance.batchFingerprintSha256.slice(0, 12)}`);
    console.log(`Evaluators merged: ${result.provenance.evaluators.length}`);
    console.log(`Outfits: ${result.mergedDataset.snapshots.length}`);
    console.log(`Absolute evaluations: ${result.mergedDataset.absoluteEvaluations.length}`);
    console.log(`Validation warnings: ${result.validation.warnings.length}`);
    console.log(`Output: ${options.outputPath}`);
    console.log(`Merge provenance: ${options.provenancePath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  MERGE_PROVENANCE_SCHEMA_VERSION,
  atomicWriteJsonPair,
  createMergeProvenance,
  getSemanticDatasetPayload,
  mergePilotDatasets,
  mergePilotFiles,
  parseMergeArguments,
};
