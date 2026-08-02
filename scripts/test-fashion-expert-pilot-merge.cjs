const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  atomicWriteJsonPair,
  getSemanticDatasetPayload,
  mergePilotFiles,
  parseMergeArguments,
} = require("./fashion-expert-pilot-merge.cjs");
const {
  canonicalJson,
  createOutputProvenance,
  getOutputProvenancePath,
} = require("./fashion-expert-pilot-provenance.cjs");
const {
  buildPilotAbsoluteEvaluation,
  createExpertPilotSession,
  upsertPilotEvaluation,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");
const {
  REQUIRED_EXPERT_DIMENSIONS,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");

const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(__dirname, "fixtures", "fashion-expert-synthetic-valid.json");
const lockPath = path.join(__dirname, "fixtures", "fashion-expert-pilot-batch-lock.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function createEvaluatorInput(directory, evaluatorId, options = {}) {
  const source = readJson(sourcePath);
  const lock = readJson(lockPath);
  const now = "2026-08-02T00:00:00.000Z";
  const session = createExpertPilotSession({
    dataset: source,
    evaluatorId,
    evaluatorGroup: "pilot",
    seed: options.seed || "pilot-v1",
    now,
  });
  let dataset = structuredClone(source);
  source.snapshots.forEach((snapshot) => {
    const evaluation = buildPilotAbsoluteEvaluation({
      dataset,
      evaluatorId,
      evaluatorGroup: "pilot",
      outfitId: snapshot.outfitId,
      evaluation: safeEvaluation(),
      now,
    });
    dataset = upsertPilotEvaluation(dataset, evaluation);
  });
  const outputPath = path.join(directory, `${evaluatorId}.json`);
  const provenance = createOutputProvenance({ lock, session, now });
  writeJson(outputPath, dataset);
  writeJson(getOutputProvenancePath(outputPath), provenance);
  return { outputPath, dataset, provenance };
}

function mergeOptions(directory, inputs, name = "merged") {
  const outputPath = path.join(directory, `${name}.json`);
  return {
    datasetPath: sourcePath,
    batchLockPath: lockPath,
    inputPaths: inputs.map((input) => input.outputPath),
    outputPath,
    provenancePath: `${outputPath}.pilot-merge-provenance.json`,
    now: "2026-08-02T01:00:00.000Z",
  };
}

function rewriteInput(input, mutateDataset, mutateProvenance) {
  const dataset = structuredClone(input.dataset);
  const provenance = structuredClone(input.provenance);
  mutateDataset?.(dataset);
  mutateProvenance?.(provenance);
  writeJson(input.outputPath, dataset);
  writeJson(getOutputProvenancePath(input.outputPath), provenance);
}

function test(name, run) {
  return Promise.resolve().then(run).then(() => console.log(`PASS ${name}`));
}

async function main() {
  await test("merge arguments require distinct source, lock, inputs, and output", () => {
    const base = ["--dataset", sourcePath, "--batch-lock", lockPath, "--output", "merged.json"];
    assert.throws(() => parseMergeArguments(base), /At least two/);
    assert.throws(() => parseMergeArguments([...base, "--input", "a.json"]), /At least two/);
    assert.doesNotThrow(() => parseMergeArguments([...base, "--input", "a.json", "--input", "b.json"]));
    assert.throws(() => parseMergeArguments([...base, "--input", "a.json", "--input", "a.json"]), /Duplicate/);
    assert.throws(() => parseMergeArguments([
      "--dataset", sourcePath, "--batch-lock", lockPath,
      "--input", "a.json", "--input", "b.json", "--output", sourcePath,
    ]), /different/);
    assert.throws(() => parseMergeArguments([
      "--dataset", sourcePath, "--batch-lock", lockPath,
      "--input", "a.json", "--input", "b.json", "--output", "a.json",
    ]), /different/);
  });

  await test("same-batch evaluator outputs merge deterministically and validate", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-merge-"));
    try {
      const reviewerA = createEvaluatorInput(directory, "pilot-reviewer-a");
      const reviewerB = createEvaluatorInput(directory, "pilot-reviewer-b");
      const before = [sourcePath, reviewerA.outputPath, reviewerB.outputPath].map((file) => fs.readFileSync(file, "utf8"));
      const first = mergePilotFiles(mergeOptions(directory, [reviewerA, reviewerB], "merged-ab"));
      const second = mergePilotFiles(mergeOptions(directory, [reviewerB, reviewerA], "merged-ba"));

      assert.equal(JSON.stringify(first.mergedDataset), JSON.stringify(second.mergedDataset));
      assert.equal(first.validation.errors.length, 0);
      assert.equal(first.mergedDataset.source, "synthetic_test");
      assert.equal(first.mergedDataset.absoluteEvaluations.length, 13);
      assert.equal(first.mergedDataset.metadata.outfitCount, 5);
      assert.equal(first.mergedDataset.metadata.evaluatorCount, 5);
      assert.deepEqual(first.provenance.evaluators.map((entry) => entry.evaluatorId), [
        "pilot-reviewer-a", "pilot-reviewer-b",
      ]);
      assert.equal(first.provenance.schemaVersion, "expert-pilot-merge-provenance-v1");
      assert.equal(
        first.provenance.mergedDatasetDigestSha256,
        require("node:crypto").createHash("sha256")
          .update(canonicalJson(getSemanticDatasetPayload(first.mergedDataset))).digest("hex")
      );
      assert.doesNotMatch(JSON.stringify(first.provenance), /(?:path|token|base64|notes|product|brand|snapshots|absoluteEvaluations)/i);
      const sourceEvaluationIds = readJson(sourcePath).absoluteEvaluations.map((entry) => entry.evaluationId);
      assert.ok(sourceEvaluationIds.every((evaluationId) =>
        first.mergedDataset.absoluteEvaluations.some((entry) => entry.evaluationId === evaluationId)
      ));
      [sourcePath, reviewerA.outputPath, reviewerB.outputPath].forEach((file, index) => {
        assert.equal(fs.readFileSync(file, "utf8"), before[index]);
      });

      execFileSync(process.execPath, [path.join(__dirname, "validate-fashion-expert-dataset.cjs"), mergeOptions(directory, [], "merged-ab").outputPath], { cwd: projectRoot });
      const report = execFileSync(process.execPath, [path.join(__dirname, "report-fashion-expert-dataset.cjs"), mergeOptions(directory, [], "merged-ab").outputPath, "--format", "json"], { cwd: projectRoot, encoding: "utf8" });
      assert.equal(JSON.parse(report).counts.evaluators, 5);

      const cliOutput = path.join(directory, "merged-cli.json");
      const cliResult = execFileSync(process.execPath, [
        path.join(__dirname, "fashion-expert-pilot-merge.cjs"),
        "--dataset", sourcePath,
        "--batch-lock", lockPath,
        "--input", reviewerB.outputPath,
        "--input", reviewerA.outputPath,
        "--output", cliOutput,
      ], { cwd: projectRoot, encoding: "utf8" });
      assert.match(cliResult, /Evaluators merged: 2/);
      assert.equal(JSON.stringify(readJson(cliOutput)), JSON.stringify(first.mergedDataset));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  await test("provenance and duplicate evaluator mismatches are rejected", () => {
    const cases = [
      ["batchId", (value) => { value.batchId = "other-batch"; }, /batchId/],
      ["fingerprint", (value) => { value.batchFingerprintSha256 = "0".repeat(64); }, /batchFingerprint/],
      ["dataset", (value) => { value.datasetVersion = "other"; }, /datasetVersion/],
      ["rubric", (value) => { value.rubricVersion = "other"; }, /rubricVersion/],
      ["order", (value) => { value.orderedOutfitIdsDigestSha256 = "0".repeat(64); }, /order digest/],
      ["unknown field", (value) => { value.token = "secret"; }, /unknown or missing fields/],
    ];
    for (const [name, mutate, pattern] of cases) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), `naes-merge-${name}-`));
      try {
        const first = createEvaluatorInput(directory, "reviewer-a");
        const second = createEvaluatorInput(directory, "reviewer-b");
        rewriteInput(first, undefined, mutate);
        assert.throws(() => mergePilotFiles(mergeOptions(directory, [first, second])), pattern);
        assert.equal(fs.existsSync(path.join(directory, "merged.json")), false);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-merge-duplicate-evaluator-"));
    try {
      const first = createEvaluatorInput(directory, "reviewer-a");
      const second = createEvaluatorInput(directory, "reviewer-b");
      rewriteInput(second, undefined, (value) => { value.evaluatorId = "reviewer-a"; });
      assert.throws(() => mergePilotFiles(mergeOptions(directory, [first, second])), /Duplicate evaluator/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  await test("missing sidecars and incomplete or malformed evaluations are rejected", () => {
    const cases = [
      ["incomplete", (dataset, reviewer) => {
        dataset.absoluteEvaluations = dataset.absoluteEvaluations.filter(
          (entry) => !(entry.evaluatorId === reviewer && entry.outfitId === dataset.snapshots[0].outfitId)
        );
      }, /incomplete/],
      ["duplicate", (dataset, reviewer) => {
        dataset.absoluteEvaluations.push(structuredClone(dataset.absoluteEvaluations.find((entry) => entry.evaluatorId === reviewer)));
      }, /validation|duplicate/i],
      ["unknown outfit", (dataset, reviewer) => {
        dataset.absoluteEvaluations.find((entry) => entry.evaluatorId === reviewer).outfitId = "unknown-outfit";
      }, /validation|unknown/i],
      ["bad ID", (dataset, reviewer) => {
        dataset.absoluteEvaluations.find((entry) => entry.evaluatorId === reviewer).evaluationId = "wrong-id";
      }, /non-deterministic/],
    ];
    for (const [name, mutate, pattern] of cases) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), `naes-merge-${name}-`));
      try {
        const first = createEvaluatorInput(directory, "reviewer-a");
        const second = createEvaluatorInput(directory, "reviewer-b");
        rewriteInput(first, (dataset) => mutate(dataset, "reviewer-a"));
        assert.throws(() => mergePilotFiles(mergeOptions(directory, [first, second])), pattern);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-merge-missing-sidecar-"));
    try {
      const first = createEvaluatorInput(directory, "reviewer-a");
      const second = createEvaluatorInput(directory, "reviewer-b");
      fs.rmSync(getOutputProvenancePath(first.outputPath));
      assert.throws(() => mergePilotFiles(mergeOptions(directory, [first, second])), /Input 1 provenance is missing/);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }

    const corruptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-merge-corrupt-sidecar-"));
    try {
      const first = createEvaluatorInput(corruptDirectory, "reviewer-a");
      const second = createEvaluatorInput(corruptDirectory, "reviewer-b");
      fs.writeFileSync(getOutputProvenancePath(first.outputPath), "{", "utf8");
      assert.throws(() => mergePilotFiles(mergeOptions(corruptDirectory, [first, second])), /Input 1 provenance is not valid JSON/);
    } finally {
      fs.rmSync(corruptDirectory, { recursive: true, force: true });
    }
  });

  await test("source snapshots, pairwise data, metadata, and other evaluator records are immutable", () => {
    const cases = [
      ["snapshot", (dataset) => { dataset.snapshots[0].context.occasion = "travel"; }],
      ["pairwise", (dataset) => { dataset.pairwiseEvaluations[0].preferred = "b"; }],
      ["split", (dataset) => { dataset.splitPolicy.seed = "changed"; }],
      ["notes", (dataset) => { dataset.metadata.notes = "changed"; }],
      ["other evaluator", (dataset) => { dataset.absoluteEvaluations[0].evaluatorConfidence = 1; }],
      ["source deletion", (dataset) => { dataset.absoluteEvaluations.splice(0, 1); }],
      ["unknown score", (dataset) => {
        const evaluation = dataset.absoluteEvaluations.find((entry) => entry.evaluatorId === "reviewer-a");
        evaluation.professionalScore = 99;
      }],
    ];
    for (const [name, mutate] of cases) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), `naes-merge-delta-${name}-`));
      try {
        const first = createEvaluatorInput(directory, "reviewer-a");
        const second = createEvaluatorInput(directory, "reviewer-b");
        rewriteInput(first, mutate);
        assert.throws(() => mergePilotFiles(mergeOptions(directory, [first, second])));
        assert.equal(fs.existsSync(path.join(directory, "merged.json")), false);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  await test("existing outputs and serialization failures leave no partial pair", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-merge-atomic-"));
    try {
      const first = createEvaluatorInput(directory, "reviewer-a");
      const second = createEvaluatorInput(directory, "reviewer-b");
      const options = mergeOptions(directory, [first, second]);
      fs.writeFileSync(options.outputPath, "keep", "utf8");
      assert.throws(() => parseMergeArguments([
        "--dataset", sourcePath, "--batch-lock", lockPath,
        "--input", first.outputPath, "--input", second.outputPath,
        "--output", options.outputPath,
      ]), /already exists/);
      assert.equal(fs.readFileSync(options.outputPath, "utf8"), "keep");

      const pairOutput = path.join(directory, "pair.json");
      const pairProvenance = `${pairOutput}.sidecar.json`;
      assert.throws(() => atomicWriteJsonPair(pairOutput, { ok: true }, pairProvenance, { invalid: 1n }));
      assert.equal(fs.existsSync(pairOutput), false);
      assert.equal(fs.existsSync(pairProvenance), false);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  console.log("Fashion expert pilot merge tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
