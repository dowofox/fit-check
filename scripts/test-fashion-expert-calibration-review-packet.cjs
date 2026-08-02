const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  REVIEW_PACKET_SCHEMA_VERSION,
  createCalibrationReviewPacket,
  createCalibrationReviewPacketFile,
  parseArguments,
  renderCalibrationReviewPacketMarkdown,
} = require("./fashion-expert-calibration-review-packet.cjs");
const {
  READINESS_CHECK_IDS,
  READINESS_SCHEMA_VERSION,
} = require("./fashion-expert-pilot-readiness.cjs");
const {
  REQUIRED_EXPERT_DIMENSIONS,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");

function dimensionRecord(makeValue) {
  return Object.fromEntries(REQUIRED_EXPERT_DIMENSIONS.map((dimension, index) => [
    dimension,
    makeValue(dimension, index),
  ]));
}

function validReadiness() {
  return {
    schemaVersion: READINESS_SCHEMA_VERSION,
    ready: true,
    status: "ready_for_calibration_review",
    decisionScope: "calibration_review_only",
    expertValidated: false,
    productionEligible: false,
    batchId: "pilot-batch-001",
    batchFingerprintSha256: "1".repeat(64),
    assignmentDigestSha256: "2".repeat(64),
    mergedDatasetDigestSha256: "3".repeat(64),
    counts: {
      outfits: 5,
      assignedEvaluators: 2,
      expectedAssignedEvaluations: 10,
      actualAssignedEvaluations: 10,
      validationErrors: 0,
      validationWarnings: 1,
    },
    checks: READINESS_CHECK_IDS.map((id) => ({ id, passed: true })),
    diagnostics: {
      coverageByDimension: dimensionRecord((_, index) => index === 0 ? 0.5 : 1),
      unavailableRateByDimension: dimensionRecord((_, index) => index === 0 ? 0.5 : 0),
      confidenceByDimension: dimensionRecord(() => 3),
      agreementByDimension: dimensionRecord(() => ({
        responseCount: 10,
        comparisonCount: 5,
        exactAgreement: 0.8,
        adjacentAgreement: 1,
        meanAbsoluteDifference: 0.2,
      })),
      highDisagreementOutfitIds: ["outfit-003", "outfit-001", "outfit-003"],
    },
  };
}

function test(name, run) {
  return Promise.resolve().then(run).then(() => console.log(`PASS ${name}`));
}

async function main() {
  await test("ready input creates a deterministic review-only packet", () => {
    const readiness = validReadiness();
    readiness.rawNotes = "must not leak";
    const packet = createCalibrationReviewPacket(readiness);
    assert.equal(packet.schemaVersion, REVIEW_PACKET_SCHEMA_VERSION);
    assert.equal(packet.status, "ready_for_human_calibration_review");
    assert.equal(packet.expertValidated, false);
    assert.equal(packet.productionEligible, false);
    assert.equal(packet.packetDigestSha256.length, 64);
    assert.deepEqual(packet.reviewQueue.highDisagreementOutfitIds, [
      "outfit-001",
      "outfit-003",
    ]);
    assert.equal(packet.dimensions[0].coverage, 0.5);
    assert.deepEqual(createCalibrationReviewPacket(readiness), packet);
    assert.doesNotMatch(JSON.stringify(packet), /must not leak|rawNotes/);
  });

  await test("blocked, incomplete, and malformed readiness cannot create a packet", () => {
    const blocked = validReadiness();
    blocked.ready = false;
    blocked.status = "blocked";
    assert.throws(() => createCalibrationReviewPacket(blocked), /not eligible/);

    const failedCheck = validReadiness();
    failedCheck.checks[0].passed = false;
    assert.throws(() => createCalibrationReviewPacket(failedCheck), /must have passed/);

    const incomplete = validReadiness();
    incomplete.counts.actualAssignedEvaluations = 9;
    assert.throws(() => createCalibrationReviewPacket(incomplete), /coverage is incomplete/);

    const missingDimension = validReadiness();
    delete missingDimension.diagnostics.coverageByDimension[REQUIRED_EXPERT_DIMENSIONS[0]];
    assert.throws(() => createCalibrationReviewPacket(missingDimension), /do not match the rubric/);

    const missingCheck = validReadiness();
    missingCheck.checks.pop();
    assert.throws(() => createCalibrationReviewPacket(missingCheck), /required gate checks/);
  });

  await test("markdown keeps the review agenda readable without granting approval", () => {
    const markdown = renderCalibrationReviewPacketMarkdown(
      createCalibrationReviewPacket(validReadiness())
    );
    assert.match(markdown, /Dimension review order/);
    assert.match(markdown, /outfit-001/);
    assert.match(markdown, /Human calibration review only/);
    assert.match(markdown, /does not grant expert validation or production approval/);
  });

  await test("CLI writes deterministic JSON or Markdown to a distinct path", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-calibration-packet-"));
    try {
      const readinessPath = path.join(directory, "readiness.json");
      const jsonPath = path.join(directory, "packet.json");
      const markdownPath = path.join(directory, "packet.md");
      fs.writeFileSync(readinessPath, `${JSON.stringify(validReadiness(), null, 2)}\n`);

      const jsonOptions = parseArguments([
        "--readiness", readinessPath,
        "--format", "json",
        "--output", jsonPath,
      ]);
      const jsonResult = createCalibrationReviewPacketFile(jsonOptions);
      assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath, "utf8")), jsonResult.packet);

      const markdownOptions = parseArguments([
        "--readiness", readinessPath,
        "--format", "markdown",
        "--output", markdownPath,
      ]);
      createCalibrationReviewPacketFile(markdownOptions);
      assert.match(fs.readFileSync(markdownPath, "utf8"), /calibration review packet/);
      assert.throws(() => parseArguments([
        "--readiness", readinessPath,
        "--output", readinessPath,
      ]), /different from --readiness/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  console.log("Fashion expert calibration review packet tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
