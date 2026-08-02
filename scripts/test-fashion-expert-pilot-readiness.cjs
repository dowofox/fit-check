const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  READINESS_SCHEMA_VERSION,
  assessPilotCalibrationFiles,
  assessPilotCalibrationReadiness,
  parseArguments,
} = require("./fashion-expert-pilot-readiness.cjs");
const {
  buildPilotAbsoluteEvaluation,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");
const {
  createMergedPilot,
  lockPath,
  safeEvaluation,
} = require("./fashion-expert-pilot-test-fixture.cjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function test(name, run) {
  return Promise.resolve().then(run).then(() => console.log(`PASS ${name}`));
}

async function main() {
  await test("validated assigned merge is ready only for calibration review", () => {
    const fixture = createMergedPilot();
    const result = assessPilotCalibrationReadiness({
      dataset: fixture.mergedDataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance: fixture.provenance,
    });
    assert.equal(result.schemaVersion, READINESS_SCHEMA_VERSION);
    assert.equal(result.ready, true);
    assert.equal(result.status, "ready_for_calibration_review");
    assert.equal(result.decisionScope, "calibration_review_only");
    assert.equal(result.expertValidated, false);
    assert.equal(result.productionEligible, false);
    assert.equal(result.counts.expectedAssignedEvaluations, 10);
    assert.equal(result.counts.actualAssignedEvaluations, 10);
    assert.equal(result.checks.every((entry) => entry.passed), true);
    assert.equal(Object.values(result.diagnostics.coverageByDimension).every((value) => value === 0), true);
    assert.deepEqual(result.diagnostics.highDisagreementOutfitIds, []);
    assert.doesNotMatch(
      JSON.stringify(result),
      /(?:[A-Z]:\\|file:|token|base64|notes|productName|brandName)/i
    );
    assert.deepEqual(
      assessPilotCalibrationReadiness({
        dataset: fixture.mergedDataset,
        batchLock: fixture.batchLock,
        assignmentManifest: fixture.assignmentManifest,
        mergeProvenance: fixture.provenance,
      }),
      result
    );
  });

  await test("missing assigned evaluation blocks readiness without inventing a quality threshold", () => {
    const fixture = createMergedPilot();
    const dataset = structuredClone(fixture.mergedDataset);
    const evaluatorId = fixture.assignmentManifest.evaluators[0].evaluatorId;
    const index = dataset.absoluteEvaluations.findIndex(
      (entry) => entry.evaluatorId === evaluatorId
    );
    dataset.absoluteEvaluations.splice(index, 1);
    const result = assessPilotCalibrationReadiness({
      dataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance: fixture.provenance,
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, "blocked");
    assert.equal(
      result.checks.find((entry) => entry.id === "assignment_coverage_complete").passed,
      false
    );
  });

  await test("unassigned evaluations block coverage without polluting assigned diagnostics", () => {
    const fixture = createMergedPilot([
      "readiness-reviewer-a",
      "readiness-reviewer-b",
      "readiness-reviewer-c",
    ]);
    const dataset = structuredClone(fixture.mergedDataset);
    const assignment = fixture.assignmentManifest.evaluators.find(
      (entry) => entry.outfitIds.length < dataset.snapshots.length
    );
    const unassignedOutfitId = dataset.snapshots.find(
      (snapshot) => !assignment.outfitIds.includes(snapshot.outfitId)
    ).outfitId;
    dataset.absoluteEvaluations.push(buildPilotAbsoluteEvaluation({
      dataset,
      evaluatorId: assignment.evaluatorId,
      evaluatorGroup: "pilot",
      outfitId: unassignedOutfitId,
      evaluation: safeEvaluation(),
      now: "2026-08-02T00:30:00.000Z",
    }));

    const result = assessPilotCalibrationReadiness({
      dataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance: fixture.provenance,
    });
    assert.equal(result.ready, false);
    assert.equal(
      result.checks.find((entry) => entry.id === "assignment_coverage_complete").passed,
      false
    );
    assert.equal(
      result.counts.actualAssignedEvaluations,
      result.counts.expectedAssignedEvaluations
    );
  });

  await test("tampered identities, snapshots, and provenance shape are rejected or blocked", () => {
    const fixture = createMergedPilot();
    const wrongAssignment = structuredClone(fixture.provenance);
    wrongAssignment.assignmentDigestSha256 = "0".repeat(64);
    const assignmentResult = assessPilotCalibrationReadiness({
      dataset: fixture.mergedDataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance: wrongAssignment,
    });
    assert.equal(assignmentResult.ready, false);

    const changedDataset = structuredClone(fixture.mergedDataset);
    changedDataset.snapshots[0].colorFeatures.averageLightness += 1;
    const snapshotResult = assessPilotCalibrationReadiness({
      dataset: changedDataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance: fixture.provenance,
    });
    assert.equal(snapshotResult.ready, false);
    assert.equal(
      snapshotResult.checks.find((entry) => entry.id === "batch_identity_matches").passed,
      false
    );

    const unknownField = structuredClone(fixture.provenance);
    unknownField.ready = true;
    assert.throws(
      () => assessPilotCalibrationReadiness({
        dataset: fixture.mergedDataset,
        batchLock: fixture.batchLock,
        assignmentManifest: fixture.assignmentManifest,
        mergeProvenance: unknownField,
      }),
      /unknown or missing fields/
    );
  });

  await test("CLI paths are explicit and optional output writes the same report", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-readiness-"));
    try {
      const fixture = createMergedPilot();
      const datasetPath = path.join(directory, "merged.json");
      const assignmentPath = path.join(directory, "assignment.json");
      const provenancePath = path.join(directory, "merge-provenance.json");
      const outputPath = path.join(directory, "readiness.json");
      writeJson(datasetPath, fixture.mergedDataset);
      writeJson(assignmentPath, fixture.assignmentManifest);
      writeJson(provenancePath, fixture.provenance);
      const options = parseArguments([
        "--dataset", datasetPath,
        "--batch-lock", lockPath,
        "--assignment", assignmentPath,
        "--merge-provenance", provenancePath,
        "--output", outputPath,
      ]);
      const result = assessPilotCalibrationFiles(options);
      assert.equal(result.ready, true);
      assert.equal(JSON.stringify(readJson(outputPath)), JSON.stringify(result));
      assert.throws(() => parseArguments([
        "--dataset", datasetPath,
        "--batch-lock", lockPath,
        "--assignment", assignmentPath,
        "--merge-provenance", provenancePath,
        "--output", datasetPath,
      ]), /different from all inputs/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  console.log("Fashion expert pilot readiness tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
