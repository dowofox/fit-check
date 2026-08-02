const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  DECISION_INPUT_SCHEMA_VERSION,
  DECISION_RECORD_SCHEMA_VERSION,
  createCalibrationDecisionRecord,
  createCalibrationDecisionRecordFile,
  parseArguments,
} = require("./fashion-expert-calibration-decision-record.cjs");
const {
  createMergedPilot,
} = require("./fashion-expert-pilot-test-fixture.cjs");
const {
  REQUIRED_EXPERT_DIMENSIONS,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");

function decisionInput(overrides = {}) {
  return {
    schemaVersion: DECISION_INPUT_SCHEMA_VERSION,
    reviewerId: "calibration-lead-01",
    decidedAt: "2026-08-02T02:00:00.000Z",
    decision: "proceed_to_next_pilot",
    rationaleCodes: [
      "coverage_reviewed",
      "agreement_reviewed",
      "unavailable_rate_reviewed",
    ],
    dimensionActions: REQUIRED_EXPERT_DIMENSIONS.map((dimension) => ({
      dimension,
      action: "retain",
    })),
    reviewedHighDisagreementOutfitIds: [],
    ...overrides,
  };
}

function recordInput(fixture, decision = decisionInput()) {
  return {
    dataset: fixture.mergedDataset,
    sourceDataset: fixture.sourceDataset,
    batchLock: fixture.batchLock,
    assignmentManifest: fixture.assignmentManifest,
    mergeProvenance: fixture.provenance,
    evaluatorInputs: fixture.inputs,
    decisionInput: decision,
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function test(name, run) {
  return Promise.resolve().then(run).then(() => console.log(`PASS ${name}`));
}

async function main() {
  await test("verified packet sources bind a deterministic human decision record", () => {
    const fixture = createMergedPilot();
    const input = recordInput(fixture);
    const record = createCalibrationDecisionRecord(input);
    assert.equal(record.schemaVersion, DECISION_RECORD_SCHEMA_VERSION);
    assert.equal(record.status, "recorded_for_calibration_follow_up");
    assert.equal(record.decisionScope, "calibration_follow_up_only");
    assert.equal(record.expertValidated, false);
    assert.equal(record.productionEligible, false);
    assert.equal(record.source.batchId, fixture.batchLock.batchId);
    assert.equal(record.recordDigestSha256.length, 64);
    assert.deepEqual(createCalibrationDecisionRecord(input), record);
    assert.doesNotMatch(
      JSON.stringify(record),
      /(?:notes|productName|brandName|imageUri|token|base64|[A-Z]:\\)/i
    );
  });

  await test("decision input covers every dimension and uses a consistent disposition", () => {
    const fixture = createMergedPilot();
    assert.throws(() => createCalibrationDecisionRecord(recordInput(
      fixture,
      decisionInput({ dimensionActions: [] })
    )), /cover every packet dimension/);
    const actions = decisionInput().dimensionActions;
    actions[0] = { ...actions[0], action: "clarify" };
    assert.throws(() => createCalibrationDecisionRecord(recordInput(
      fixture,
      decisionInput({ dimensionActions: actions })
    )), /Proceed decisions require/);
    assert.doesNotThrow(() => createCalibrationDecisionRecord(recordInput(
      fixture,
      decisionInput({
        decision: "revise_protocol",
        rationaleCodes: ["protocol_clarification_needed"],
        dimensionActions: actions,
      })
    )));
  });

  await test("decision rationale codes agree with the recorded disposition", () => {
    const fixture = createMergedPilot();
    const clarifyActions = decisionInput().dimensionActions;
    clarifyActions[0] = { ...clarifyActions[0], action: "clarify" };
    const retestActions = decisionInput().dimensionActions;
    retestActions[0] = { ...retestActions[0], action: "retest" };

    assert.throws(() => createCalibrationDecisionRecord(recordInput(
      fixture,
      decisionInput({ rationaleCodes: ["coverage_reviewed", "protocol_clarification_needed"] })
    )), /rationale codes conflict/);
    assert.throws(() => createCalibrationDecisionRecord(recordInput(
      fixture,
      decisionInput({
        decision: "revise_protocol",
        rationaleCodes: ["additional_evaluations_needed"],
        dimensionActions: clarifyActions,
      })
    )), /rationale codes conflict/);
    assert.throws(() => createCalibrationDecisionRecord(recordInput(
      fixture,
      decisionInput({
        decision: "collect_more_evaluations",
        rationaleCodes: ["protocol_clarification_needed"],
        dimensionActions: retestActions,
      })
    )), /rationale codes conflict/);
    assert.doesNotThrow(() => createCalibrationDecisionRecord(recordInput(
      fixture,
      decisionInput({
        decision: "collect_more_evaluations",
        rationaleCodes: ["additional_evaluations_needed"],
        dimensionActions: retestActions,
      })
    )));
  });

  await test("tampered pilot sources cannot create a decision record", () => {
    const fixture = createMergedPilot();
    const provenance = structuredClone(fixture.provenance);
    provenance.mergedDatasetDigestSha256 = "0".repeat(64);
    assert.throws(() => createCalibrationDecisionRecord({
      ...recordInput(fixture),
      mergeProvenance: provenance,
    }), /not eligible/);
  });

  await test("CLI writes the same record and protects every input", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-calibration-decision-"));
    try {
      const fixture = createMergedPilot();
      const paths = {
        dataset: path.join(directory, "merged.json"),
        source: path.join(directory, "source.json"),
        lock: path.join(directory, "batch-lock.json"),
        assignment: path.join(directory, "assignment.json"),
        provenance: path.join(directory, "merge-provenance.json"),
        decision: path.join(directory, "decision.json"),
        output: path.join(directory, "decision-record.json"),
      };
      writeJson(paths.dataset, fixture.mergedDataset);
      writeJson(paths.source, fixture.sourceDataset);
      writeJson(paths.lock, fixture.batchLock);
      writeJson(paths.assignment, fixture.assignmentManifest);
      writeJson(paths.provenance, fixture.provenance);
      writeJson(paths.decision, decisionInput());
      const inputPaths = fixture.inputs.map((input, index) => {
        const inputPath = path.join(directory, `reviewer-${index + 1}.json`);
        writeJson(inputPath, input.dataset);
        writeJson(`${inputPath}.pilot-provenance.json`, input.provenance);
        return inputPath;
      });
      const common = [
        "--dataset", paths.dataset,
        "--source-dataset", paths.source,
        "--batch-lock", paths.lock,
        "--assignment", paths.assignment,
        "--merge-provenance", paths.provenance,
        ...inputPaths.flatMap((inputPath) => ["--input", inputPath]),
        "--decision", paths.decision,
      ];
      const record = createCalibrationDecisionRecordFile(parseArguments([
        ...common,
        "--output", paths.output,
      ]));
      assert.deepEqual(JSON.parse(fs.readFileSync(paths.output, "utf8")), record);
      assert.throws(() => parseArguments([
        ...common,
        "--output", paths.decision,
      ]), /different from all inputs/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  console.log("Fashion expert calibration decision record tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
