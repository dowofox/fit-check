const path = require("node:path");
const fs = require("node:fs");

const {
  createAssignmentManifest,
} = require("./fashion-expert-pilot-assignment.cjs");
const {
  mergePilotDatasets,
} = require("./fashion-expert-pilot-merge.cjs");
const {
  createOutputProvenance,
} = require("./fashion-expert-pilot-provenance.cjs");
const {
  buildPilotAbsoluteEvaluation,
  createExpertPilotSession,
  upsertPilotEvaluation,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");
const {
  REQUIRED_EXPERT_DIMENSIONS,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");

const sourcePath = path.join(__dirname, "fixtures", "fashion-expert-synthetic-valid.json");
const lockPath = path.join(__dirname, "fixtures", "fashion-expert-pilot-batch-lock.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeEvaluation() {
  return {
    dimensions: REQUIRED_EXPERT_DIMENSIONS.map((dimension) => ({
      dimension,
      availability: "not_enough_information",
      confidence: 3,
      supportingEvidenceCodes: [],
      conflictingEvidenceCodes: [],
    })),
    evaluatorConfidence: 3,
    durationSeconds: 30,
  };
}

function createMergedPilot(evaluatorIds = ["readiness-reviewer-a", "readiness-reviewer-b"]) {
  const sourceDataset = readJson(sourcePath);
  const batchLock = readJson(lockPath);
  const assignmentManifest = createAssignmentManifest(batchLock, {
    evaluatorIds,
    seed: "readiness-v1",
  });
  const inputs = evaluatorIds.map((evaluatorId) => {
    const outfitIds = assignmentManifest.evaluators.find(
      (entry) => entry.evaluatorId === evaluatorId
    ).outfitIds;
    const session = createExpertPilotSession({
      dataset: sourceDataset,
      evaluatorId,
      evaluatorGroup: "pilot",
      seed: assignmentManifest.seed,
      outfitIds,
      now: "2026-08-02T00:00:00.000Z",
    });
    let dataset = structuredClone(sourceDataset);
    outfitIds.forEach((outfitId) => {
      dataset = upsertPilotEvaluation(dataset, buildPilotAbsoluteEvaluation({
        dataset,
        evaluatorId,
        evaluatorGroup: "pilot",
        outfitId,
        evaluation: safeEvaluation(),
        now: "2026-08-02T00:00:00.000Z",
      }));
    });
    return {
      dataset,
      provenance: createOutputProvenance({
        lock: batchLock,
        session,
        assignmentDigestSha256: assignmentManifest.assignmentDigestSha256,
        now: "2026-08-02T00:00:00.000Z",
        completedAt: "2026-08-02T00:00:00.000Z",
      }),
    };
  });
  const merged = mergePilotDatasets({
    sourceDataset,
    batchLock,
    assignmentManifest,
    inputs,
    now: "2026-08-02T01:00:00.000Z",
  });
  return { batchLock, assignmentManifest, sourceDataset, inputs, ...merged };
}

module.exports = {
  createMergedPilot,
  lockPath,
  safeEvaluation,
  sourcePath,
};
