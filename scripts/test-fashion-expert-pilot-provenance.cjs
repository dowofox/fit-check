const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createPilotServer,
  validateAssetManifest,
} = require("./run-fashion-expert-pilot.cjs");
const {
  assertBatchLockMatches,
  assertOutputProvenanceMatches,
  canonicalJson,
  createBatchLock,
  createOutputProvenance,
  getDatasetSnapshotDigest,
  getExpertPilotProtocolDigest,
  validateBatchLock,
} = require("./fashion-expert-pilot-provenance.cjs");
const { freezeBatch } = require("./freeze-fashion-expert-pilot.cjs");
const {
  createExpertPilotSession,
  getExpertPilotProtocolPayload,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");
const {
  EXPERT_EVALUATION_CONTRACT,
  EXPERT_EVIDENCE_REGISTRY,
  EXPERT_RUBRIC_REGISTRY,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");

const datasetPath = path.join(__dirname, "fixtures", "fashion-expert-synthetic-valid.json");
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, entry]) => [key, reverseObjectKeys(entry)])
  );
}

function createAssets(directory, dataset, options = {}) {
  const outfits = {};
  for (const [index, snapshot] of dataset.snapshots.entries()) {
    if (!snapshot.inputAvailability.imageAvailable) continue;
    const first = path.join(directory, `${options.prefix || "asset"}-${index}.png`);
    const firstBytes = index === 0 && options.mutateFirst
      ? Buffer.concat([onePixelPng, Buffer.from([1])])
      : onePixelPng;
    fs.writeFileSync(first, firstBytes);
    const images = [first];
    if (index === 0 && options.extraFirst) {
      const second = path.join(directory, `${options.prefix || "asset"}-${index}-extra.png`);
      fs.writeFileSync(second, Buffer.concat([onePixelPng, Buffer.from([2])]));
      images.push(second);
      if (options.reverseFirst) images.reverse();
    }
    outfits[snapshot.outfitId] = { images };
  }
  const manifestPath = path.join(directory, `${options.prefix || "assets"}.json`);
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ schemaVersion: "expert-pilot-assets-v1", outfits }, null, 2)
  );
  return manifestPath;
}

function buildLock(dataset, manifestPath, batchId = "batch-v1") {
  const assets = validateAssetManifest(readJson(manifestPath), manifestPath, dataset);
  return createBatchLock({
    dataset,
    assets,
    batchId,
    protocol: getExpertPilotProtocolPayload(),
  });
}

function test(name, run) {
  return Promise.resolve().then(run).then(() => console.log(`PASS ${name}`));
}

async function main() {
  const dataset = readJson(datasetPath);

  await test("canonical snapshot digest ignores formatting, evaluations, and snapshot order", () => {
    const reordered = reverseObjectKeys(structuredClone(dataset));
    reordered.snapshots.reverse();
    reordered.absoluteEvaluations = [{ ignored: true }];
    reordered.pairwiseEvaluations = [{ ignored: true }];
    reordered.metadata.evaluatorCount = 999;
    assert.equal(getDatasetSnapshotDigest(dataset), getDatasetSnapshotDigest(reordered));

    const contextChanged = structuredClone(dataset);
    contextChanged.snapshots[0].context.occasion = "formal";
    assert.notEqual(getDatasetSnapshotDigest(dataset), getDatasetSnapshotDigest(contextChanged));
    const featureChanged = structuredClone(dataset);
    featureChanged.snapshots[0].colorFeatures.averageLightness += 1;
    assert.notEqual(getDatasetSnapshotDigest(dataset), getDatasetSnapshotDigest(featureChanged));
  });

  await test("annotation protocol digest canonicalizes registries and binds evaluator-visible policy", () => {
    const protocol = getExpertPilotProtocolPayload();
    const reordered = getExpertPilotProtocolPayload({
      rubricRegistry: [...EXPERT_RUBRIC_REGISTRY].reverse(),
      evidenceRegistry: [...EXPERT_EVIDENCE_REGISTRY].reverse(),
      evaluationContract: reverseObjectKeys(structuredClone(EXPERT_EVALUATION_CONTRACT)),
    });
    assert.equal(
      getExpertPilotProtocolDigest(protocol),
      getExpertPilotProtocolDigest(reverseObjectKeys(reordered))
    );

    const expectChange = (mutate) => {
      const changed = structuredClone(protocol);
      mutate(changed);
      assert.notEqual(
        getExpertPilotProtocolDigest(protocol),
        getExpertPilotProtocolDigest(changed)
      );
    };
    expectChange((value) => { value.dimensions[0].label += " changed"; });
    expectChange((value) => { value.dimensions[0].anchors[4] += " changed"; });
    expectChange((value) => { value.dimensions[0].description += " changed"; });
    expectChange((value) => { value.dimensions[0].contextRequirements[0].policy = "required"; });
    expectChange((value) => { value.dimensions[0].observationRequirements[0].rationale += " changed"; });
    expectChange((value) => { value.dimensions[0].allowedEvidenceCodes.pop(); });
    expectChange((value) => { value.evidence[0].description += " changed"; });
    expectChange((value) => { value.evidence[0].label += " changed"; });
    expectChange((value) => { value.evidence[0].origin = "context_interpretation"; });
    expectChange((value) => { value.evidence[0].polarity = "context_direction"; });
    expectChange((value) => { value.evaluationContract.requiredDimensions.reverse(); });
    expectChange((value) => { value.evaluationContract.ratingScale.pop(); });
    expectChange((value) => { value.evaluationContract.availabilityValues.pop(); });
    expectChange((value) => {
      value.evaluationContract.overallCompatibility.requiresImageWhenRated = false;
    });
    assert.doesNotMatch(JSON.stringify(protocol), /reviewedBy|sourceReferences/);
  });

  await test("batch fingerprint is path-independent and binds bytes, count, and order", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-lock-"));
    try {
      const firstDir = path.join(root, "first");
      const secondDir = path.join(root, "second");
      fs.mkdirSync(firstDir);
      fs.mkdirSync(secondDir);
      const first = buildLock(dataset, createAssets(firstDir, dataset, { prefix: "one" }));
      const sameBytesDifferentPath = buildLock(
        dataset,
        createAssets(secondDir, dataset, { prefix: "two" })
      );
      assert.equal(first.batchFingerprintSha256, sameBytesDifferentPath.batchFingerprintSha256);
      assert.equal(first.schemaVersion, "expert-pilot-batch-lock-v2");
      assert.equal("dimensions" in first.protocol, false);
      assert.equal(
        first.protocol.protocolDigestSha256,
        getExpertPilotProtocolDigest(getExpertPilotProtocolPayload())
      );

      const changed = buildLock(
        dataset,
        createAssets(secondDir, dataset, { prefix: "changed", mutateFirst: true })
      );
      assert.notEqual(first.batchFingerprintSha256, changed.batchFingerprintSha256);

      const withExtra = buildLock(
        dataset,
        createAssets(secondDir, dataset, { prefix: "extra", extraFirst: true })
      );
      const reversed = buildLock(
        dataset,
        createAssets(secondDir, dataset, {
          prefix: "reverse",
          extraFirst: true,
          reverseFirst: true,
        })
      );
      assert.notEqual(first.batchFingerprintSha256, withExtra.batchFingerprintSha256);
      assert.notEqual(withExtra.batchFingerprintSha256, reversed.batchFingerprintSha256);
      assert.doesNotMatch(JSON.stringify(withExtra), new RegExp(root.replace(/\\/g, "\\\\"), "i"));
      assert.doesNotMatch(JSON.stringify(withExtra), /file:|base64|assetId|token/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await test("freeze writes a self-validating pathless lock", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-freeze-"));
    try {
      const assetsPath = createAssets(directory, dataset);
      const outputPath = path.join(directory, "batch-lock.json");
      const lock = freezeBatch({
        datasetPath,
        assetsPath,
        batchId: "freeze-v1",
        outputPath,
      });
      validateBatchLock(readJson(outputPath));
      assert.equal(lock.batchId, "freeze-v1");
      assert.match(lock.batchFingerprintSha256, /^[a-f0-9]{64}$/);

      const unsupported = structuredClone(lock);
      unsupported.schemaVersion = "expert-pilot-batch-lock-v1";
      assert.throws(() => validateBatchLock(unsupported), /unsupported schema/);
      const wrongBatch = structuredClone(lock);
      wrongBatch.batchId = "other-batch";
      assert.throws(() => validateBatchLock(wrongBatch), /fingerprint is invalid/);

      const changedIdentity = structuredClone(dataset);
      changedIdentity.datasetVersion = "2.0.0";
      const changedLock = buildLock(changedIdentity, assetsPath, "freeze-v1");
      assert.throws(() => assertBatchLockMatches(lock, changedLock), /does not match/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  await test("runner rejects changed stimulus bytes before listening", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-run-lock-"));
    try {
      const assetsPath = createAssets(directory, dataset);
      const lock = buildLock(dataset, assetsPath);
      const lockPath = path.join(directory, "batch-lock.json");
      fs.writeFileSync(lockPath, JSON.stringify(lock));
      const manifest = readJson(assetsPath);
      const firstPath = manifest.outfits[dataset.snapshots[0].outfitId].images[0];
      fs.appendFileSync(firstPath, Buffer.from([9]));
      assert.throws(
        () => createPilotServer({
          datasetPath,
          assetsPath,
          batchLockPath: lockPath,
          outputPath: path.join(directory, "output.json"),
          evaluatorId: "lock-reviewer",
          evaluatorGroup: "pilot",
          seed: "seed-v1",
          port: 4317,
        }),
        /does not match/
      );
      assert.equal(fs.existsSync(path.join(directory, "output.json")), false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  await test("runner rejects a different annotation protocol before writing output", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-protocol-"));
    try {
      const assetsPath = createAssets(directory, dataset);
      const assets = validateAssetManifest(readJson(assetsPath), assetsPath, dataset);
      const changedProtocol = structuredClone(getExpertPilotProtocolPayload());
      changedProtocol.dimensions[0].anchors[4] += " changed";
      const lockPath = path.join(directory, "batch-lock.json");
      fs.writeFileSync(lockPath, JSON.stringify(createBatchLock({
        dataset,
        assets,
        batchId: "protocol-v2",
        protocol: changedProtocol,
      })));
      const outputPath = path.join(directory, "output.json");
      assert.throws(
        () => createPilotServer({
          datasetPath,
          assetsPath,
          batchLockPath: lockPath,
          outputPath,
          evaluatorId: "protocol-reviewer",
          evaluatorGroup: "pilot",
          seed: "seed-v1",
          port: 4317,
        }),
        /Annotation protocol does not match/
      );
      assert.equal(fs.existsSync(outputPath), false);
      assert.equal(fs.existsSync(`${outputPath}.pilot-provenance.json`), false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  await test("output provenance locks evaluator, seed, and deterministic order", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-sidecar-"));
    try {
      const lock = buildLock(dataset, createAssets(directory, dataset));
      const session = createExpertPilotSession({
        dataset,
        evaluatorId: "reviewer-v1",
        seed: "seed-v1",
        now: "2026-08-02T00:00:00.000Z",
      });
      const provenance = createOutputProvenance({
        lock,
        session,
        now: "2026-08-02T00:00:00.000Z",
      });
      assertOutputProvenanceMatches(provenance, provenance);
      assert.throws(
        () => assertOutputProvenanceMatches(
          provenance,
          createOutputProvenance({
            lock,
            session: { ...session, seed: "other-seed" },
            now: "2026-08-02T00:00:00.000Z",
          })
        ),
        /does not match/
      );
      assert.doesNotMatch(JSON.stringify(provenance), /file:|base64|assetId|token|product|brand/i);
      assert.equal("pilotProvenance" in dataset, false);
      assert.equal(canonicalJson(provenance).includes(directory), false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  console.log("Fashion expert pilot provenance tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
