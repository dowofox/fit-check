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
  createMergedPilot,
} = require("./fashion-expert-pilot-test-fixture.cjs");

function packetInput(fixture) {
  return {
    dataset: fixture.mergedDataset,
    batchLock: fixture.batchLock,
    assignmentManifest: fixture.assignmentManifest,
    mergeProvenance: fixture.provenance,
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function test(name, run) {
  return Promise.resolve().then(run).then(() => console.log(`PASS ${name}`));
}

async function main() {
  await test("verified pilot sources create a deterministic review-only packet", () => {
    const fixture = createMergedPilot();
    const input = packetInput(fixture);
    const packet = createCalibrationReviewPacket(input);
    assert.equal(packet.schemaVersion, REVIEW_PACKET_SCHEMA_VERSION);
    assert.equal(packet.status, "ready_for_human_calibration_review");
    assert.equal(packet.source.batchId, fixture.batchLock.batchId);
    assert.equal(packet.expertValidated, false);
    assert.equal(packet.productionEligible, false);
    assert.equal(packet.packetDigestSha256.length, 64);
    assert.equal(packet.summary.reviewersPerOutfit, 2);
    assert.deepEqual(createCalibrationReviewPacket(input), packet);
    assert.doesNotMatch(
      JSON.stringify(packet),
      /(?:notes|productName|brandName|imageUri|token|base64|[A-Z]:\\)/i
    );
  });

  await test("tampered sources and incomplete assignment coverage cannot create a packet", () => {
    const fixture = createMergedPilot();
    const incomplete = structuredClone(fixture.mergedDataset);
    incomplete.absoluteEvaluations.pop();
    assert.throws(() => createCalibrationReviewPacket({
      ...packetInput(fixture),
      dataset: incomplete,
    }), /not eligible/);

    const changedBatch = structuredClone(fixture.provenance);
    changedBatch.batchId = "tampered-batch";
    assert.throws(() => createCalibrationReviewPacket({
      ...packetInput(fixture),
      mergeProvenance: changedBatch,
    }), /not eligible/);
  });

  await test("markdown keeps the review agenda readable without granting approval", () => {
    const packet = createCalibrationReviewPacket(packetInput(createMergedPilot()));
    const markdown = renderCalibrationReviewPacketMarkdown(packet);
    assert.match(markdown, /Dimension review order/);
    assert.match(markdown, /Human calibration review only/);
    assert.match(markdown, /does not grant expert validation or production approval/);
  });

  await test("CLI recomputes readiness from four sources and rejects a readiness shortcut", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-calibration-packet-"));
    try {
      const fixture = createMergedPilot();
      const datasetPath = path.join(directory, "merged.json");
      const batchLockPath = path.join(directory, "batch-lock.json");
      const assignmentPath = path.join(directory, "assignment.json");
      const provenancePath = path.join(directory, "merge-provenance.json");
      const jsonPath = path.join(directory, "packet.json");
      const markdownPath = path.join(directory, "packet.md");
      writeJson(datasetPath, fixture.mergedDataset);
      writeJson(batchLockPath, fixture.batchLock);
      writeJson(assignmentPath, fixture.assignmentManifest);
      writeJson(provenancePath, fixture.provenance);
      const commonArguments = [
        "--dataset", datasetPath,
        "--batch-lock", batchLockPath,
        "--assignment", assignmentPath,
        "--merge-provenance", provenancePath,
      ];

      const jsonResult = createCalibrationReviewPacketFile(parseArguments([
        ...commonArguments,
        "--format", "json",
        "--output", jsonPath,
      ]));
      assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath, "utf8")), jsonResult.packet);

      createCalibrationReviewPacketFile(parseArguments([
        ...commonArguments,
        "--format", "markdown",
        "--output", markdownPath,
      ]));
      assert.match(fs.readFileSync(markdownPath, "utf8"), /calibration review packet/);
      assert.throws(() => parseArguments([
        "--readiness", path.join(directory, "readiness.json"),
      ]), /Invalid calibration review packet arguments/);
      assert.throws(() => parseArguments([
        ...commonArguments,
        "--output", datasetPath,
      ]), /different from all inputs/);
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
