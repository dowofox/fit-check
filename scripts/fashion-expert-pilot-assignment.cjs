const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { atomicWriteJson, readJson } = require("./run-fashion-expert-pilot.cjs");
const {
  canonicalJson,
  validateBatchLock,
} = require("./fashion-expert-pilot-provenance.cjs");

const ASSIGNMENT_SCHEMA_VERSION = "expert-pilot-assignment-v1";
const PSEUDONYMOUS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,63}$/;

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function combinations(values, size, start = 0, prefix = [], result = []) {
  if (prefix.length === size) {
    result.push(prefix);
    return result;
  }
  for (let index = start; index <= values.length - (size - prefix.length); index += 1) {
    combinations(values, size, index + 1, [...prefix, values[index]], result);
  }
  return result;
}

function pairKeys(evaluatorIds) {
  return combinations([...evaluatorIds].sort(), 2).map((pair) => pair.join("\0"));
}

function createAssignmentManifest(lock, { evaluatorIds, seed, reviewersPerOutfit = 2 }) {
  validateBatchLock(lock);
  if (typeof seed !== "string" || !PSEUDONYMOUS_ID_PATTERN.test(seed)) {
    fail("Assignment seed must be a stable pseudonymous identifier.");
  }
  if (!Array.isArray(evaluatorIds)) fail("Evaluator IDs are required.");
  const evaluators = evaluatorIds.map((value) => typeof value === "string" ? value.trim() : value);
  if (evaluators.some((value) => typeof value !== "string" || !PSEUDONYMOUS_ID_PATTERN.test(value))) {
    fail("Evaluator IDs must be stable pseudonymous identifiers.");
  }
  if (new Set(evaluators).size !== evaluators.length) fail("Evaluator IDs must be unique.");
  if (!Number.isInteger(reviewersPerOutfit) || reviewersPerOutfit < 2) {
    fail("Each outfit must be assigned to at least two evaluators.");
  }
  if (evaluators.length < reviewersPerOutfit) {
    fail("Not enough evaluators for the requested reviewers per outfit.");
  }

  const namespace = `${lock.batchFingerprintSha256}\0${seed}`;
  const orderedEvaluators = [...evaluators].sort((left, right) =>
    sha256(`${namespace}\0evaluator\0${left}`).localeCompare(
      sha256(`${namespace}\0evaluator\0${right}`)
    ) || left.localeCompare(right)
  );
  const orderedOutfits = lock.outfits.map((entry) => entry.outfitId).sort((left, right) =>
    sha256(`${namespace}\0outfit\0${left}`).localeCompare(
      sha256(`${namespace}\0outfit\0${right}`)
    ) || left.localeCompare(right)
  );
  const candidateGroups = combinations(orderedEvaluators, reviewersPerOutfit);
  const evaluatorLoads = new Map(orderedEvaluators.map((id) => [id, 0]));
  const overlapCounts = new Map(pairKeys(orderedEvaluators).map((key) => [key, 0]));
  const outfitAssignments = new Map();

  for (const outfitId of orderedOutfits) {
    const ranked = candidateGroups.map((group) => {
      const projectedLoads = orderedEvaluators.map((id) =>
        evaluatorLoads.get(id) + (group.includes(id) ? 1 : 0)
      );
      const groupPairs = new Set(pairKeys(group));
      const projectedOverlaps = [...overlapCounts].map(([key, count]) =>
        count + (groupPairs.has(key) ? 1 : 0)
      );
      return {
        group,
        score: [
          Math.max(...projectedLoads),
          projectedLoads.reduce((sum, value) => sum + value ** 2, 0),
          Math.max(0, ...projectedOverlaps),
          projectedOverlaps.reduce((sum, value) => sum + value ** 2, 0),
          sha256(`${namespace}\0${outfitId}\0${group.join("\0")}`),
        ],
      };
    }).sort((left, right) => {
      for (let index = 0; index < left.score.length; index += 1) {
        if (left.score[index] < right.score[index]) return -1;
        if (left.score[index] > right.score[index]) return 1;
      }
      return 0;
    });
    const selected = ranked[0].group;
    outfitAssignments.set(outfitId, [...selected].sort());
    selected.forEach((id) => evaluatorLoads.set(id, evaluatorLoads.get(id) + 1));
    pairKeys(selected).forEach((key) => overlapCounts.set(key, overlapCounts.get(key) + 1));
  }

  const payload = {
    schemaVersion: ASSIGNMENT_SCHEMA_VERSION,
    batchId: lock.batchId,
    batchFingerprintSha256: lock.batchFingerprintSha256,
    datasetId: lock.dataset.datasetId,
    datasetVersion: lock.dataset.datasetVersion,
    rubricVersion: lock.dataset.rubricVersion,
    seed,
    reviewersPerOutfit,
    evaluators: [...evaluators].sort().map((evaluatorId) => ({
      evaluatorId,
      outfitIds: [...outfitAssignments]
        .filter(([, assigned]) => assigned.includes(evaluatorId))
        .map(([outfitId]) => outfitId)
        .sort(),
    })),
    outfits: [...outfitAssignments]
      .map(([outfitId, assignedEvaluatorIds]) => ({
        outfitId,
        evaluatorIds: assignedEvaluatorIds,
      }))
      .sort((left, right) => left.outfitId.localeCompare(right.outfitId)),
  };
  return {
    ...payload,
    assignmentDigestSha256: sha256(canonicalJson(payload)),
  };
}

function validateAssignmentManifest(manifest, lock) {
  validateBatchLock(lock);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    fail("Assignment manifest must be an object.");
  }
  const expectedKeys = [
    "schemaVersion", "batchId", "batchFingerprintSha256", "datasetId",
    "datasetVersion", "rubricVersion", "seed", "reviewersPerOutfit",
    "evaluators", "outfits", "assignmentDigestSha256",
  ].sort();
  if (canonicalJson(Object.keys(manifest).sort()) !== canonicalJson(expectedKeys)) {
    fail("Assignment manifest contains unknown or missing fields.");
  }
  if (!Array.isArray(manifest.evaluators)) fail("Assignment evaluators are invalid.");
  const evaluatorIds = manifest.evaluators.map((entry) => entry?.evaluatorId);
  const expected = createAssignmentManifest(lock, {
    evaluatorIds,
    seed: manifest.seed,
    reviewersPerOutfit: manifest.reviewersPerOutfit,
  });
  if (canonicalJson(manifest) !== canonicalJson(expected)) {
    fail("Assignment manifest does not match its batch and deterministic assignment.");
  }
  return manifest;
}

function valuesFor(argv, name) {
  const values = [];
  argv.forEach((value, index) => {
    if (value === name) values.push(argv[index + 1]);
  });
  return values;
}

function oneValue(argv, name, required = true) {
  const values = valuesFor(argv, name);
  if ((!required && values.length === 0)) return undefined;
  if (values.length !== 1 || !values[0] || values[0].startsWith("--")) {
    fail(`Expected exactly one ${name} value.`);
  }
  return values[0];
}

function parseArguments(argv) {
  const allowed = new Set([
    "--batch-lock", "--evaluator", "--seed", "--reviewers-per-outfit", "--output",
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index]) || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      fail("Invalid assignment arguments.");
    }
  }
  const batchLockPath = path.resolve(oneValue(argv, "--batch-lock"));
  const outputPath = path.resolve(oneValue(argv, "--output"));
  if (batchLockPath.toLowerCase() === outputPath.toLowerCase()) {
    fail("--output must be different from the batch lock.");
  }
  const reviewersValue = oneValue(argv, "--reviewers-per-outfit", false);
  const reviewersPerOutfit = reviewersValue === undefined ? 2 : Number(reviewersValue);
  const evaluatorIds = valuesFor(argv, "--evaluator");
  if (evaluatorIds.length < reviewersPerOutfit) {
    fail("Not enough evaluators for the requested reviewers per outfit.");
  }
  return {
    batchLockPath,
    outputPath,
    evaluatorIds,
    seed: oneValue(argv, "--seed"),
    reviewersPerOutfit,
  };
}

function createAssignmentPack(options) {
  if (fs.existsSync(options.outputPath)) fail("Assignment output already exists.");
  const lock = readJson(options.batchLockPath, "Batch lock");
  const manifest = createAssignmentManifest(lock, options);
  validateAssignmentManifest(manifest, lock);
  atomicWriteJson(options.outputPath, manifest);
  return validateAssignmentManifest(readJson(options.outputPath, "Saved assignment manifest"), lock);
}

function main() {
  try {
    const manifest = createAssignmentPack(parseArguments(process.argv.slice(2)));
    console.log(`Assigned ${manifest.outfits.length} outfits to ${manifest.evaluators.length} evaluators.`);
    console.log(`Reviewers per outfit: ${manifest.reviewersPerOutfit}`);
    console.log(`Assignment digest: ${manifest.assignmentDigestSha256}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  ASSIGNMENT_SCHEMA_VERSION,
  createAssignmentManifest,
  createAssignmentPack,
  parseArguments,
  validateAssignmentManifest,
};
