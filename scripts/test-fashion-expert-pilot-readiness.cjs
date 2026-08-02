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
  createMergeProvenance,
} = require("./fashion-expert-pilot-merge.cjs");
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
      evaluatorInputs: fixture.inputs,
      sourceDataset: fixture.sourceDataset,
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
        evaluatorInputs: fixture.inputs,
        sourceDataset: fixture.sourceDataset,
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
      evaluatorInputs: fixture.inputs,
      sourceDataset: fixture.sourceDataset,
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
      evaluatorInputs: fixture.inputs,
      sourceDataset: fixture.sourceDataset,
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
      evaluatorInputs: fixture.inputs,
      sourceDataset: fixture.sourceDataset,
    });
    assert.equal(assignmentResult.ready, false);

    const changedDataset = structuredClone(fixture.mergedDataset);
    changedDataset.snapshots[0].colorFeatures.averageLightness += 1;
    const snapshotResult = assessPilotCalibrationReadiness({
      dataset: changedDataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance: fixture.provenance,
      evaluatorInputs: fixture.inputs,
      sourceDataset: fixture.sourceDataset,
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
        evaluatorInputs: fixture.inputs,
        sourceDataset: fixture.sourceDataset,
      }),
      /unknown or missing fields/
    );
  });

  await test("tampered merge input digests block readiness", () => {
    const fixture = createMergedPilot();
    const provenance = structuredClone(fixture.provenance);
    provenance.evaluators[0].inputDatasetDigestSha256 = "0".repeat(64);
    const result = assessPilotCalibrationReadiness({
      dataset: fixture.mergedDataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance: provenance,
      evaluatorInputs: fixture.inputs,
      sourceDataset: fixture.sourceDataset,
    });
    assert.equal(result.ready, false);
    assert.equal(
      result.checks.find((entry) => entry.id === "merge_input_digests_match").passed,
      false
    );
  });

  await test("non-owner evaluation tampering is rejected even with refreshed input digests", () => {
    const fixture = createMergedPilot();
    const evaluatorInputs = structuredClone(fixture.inputs);
    const changed = evaluatorInputs[0].dataset.absoluteEvaluations.find(
      (evaluation) => evaluation.evaluatorId !== evaluatorInputs[0].provenance.evaluatorId
    );
    changed.durationSeconds += 1;
    const mergeProvenance = createMergeProvenance({
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      sourceDataset: fixture.sourceDataset,
      inputs: evaluatorInputs,
      mergedDataset: fixture.mergedDataset,
      now: fixture.provenance.createdAt,
    });
    const result = assessPilotCalibrationReadiness({
      dataset: fixture.mergedDataset,
      sourceDataset: fixture.sourceDataset,
      batchLock: fixture.batchLock,
      assignmentManifest: fixture.assignmentManifest,
      mergeProvenance,
      evaluatorInputs,
    });
    assert.equal(result.ready, false);
    assert.equal(
      result.checks.find((entry) => entry.id === "merge_input_digests_match").passed,
      false
    );
  });

  await test("CLI paths are explicit and optional output writes the same report", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-readiness-"));
    try {
      const fixture = createMergedPilot();
      const datasetPath = path.join(directory, "merged.json");
      const sourceDatasetPath = path.join(directory, "source.json");
      const assignmentPath = path.join(directory, "assignment.json");
      const provenancePath = path.join(directory, "merge-provenance.json");
      const outputPath = path.join(directory, "readiness.json");
      const inputPaths = fixture.inputs.map((input, index) => {
        const inputPath = path.join(directory, `reviewer-${index + 1}.json`);
        writeJson(inputPath, input.dataset);
        writeJson(`${inputPath}.pilot-provenance.json`, input.provenance);
        return inputPath;
      });
      writeJson(datasetPath, fixture.mergedDataset);
      writeJson(sourceDatasetPath, fixture.sourceDataset);
      writeJson(assignmentPath, fixture.assignmentManifest);
      writeJson(provenancePath, fixture.provenance);
      const options = parseArguments([
        "--dataset", datasetPath,
        "--source-dataset", sourceDatasetPath,
        "--batch-lock", lockPath,
        "--assignment", assignmentPath,
        "--merge-provenance", provenancePath,
        ...inputPaths.flatMap((inputPath) => ["--input", inputPath]),
        "--output", outputPath,
      ]);
      const result = assessPilotCalibrationFiles(options);
      assert.equal(result.ready, true);
      assert.equal(JSON.stringify(readJson(outputPath)), JSON.stringify(result));
      assert.throws(() => parseArguments([
        "--dataset", datasetPath,
        "--source-dataset", sourceDatasetPath,
        "--batch-lock", lockPath,
        "--assignment", assignmentPath,
        "--merge-provenance", provenancePath,
        ...inputPaths.flatMap((inputPath) => ["--input", inputPath]),
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
