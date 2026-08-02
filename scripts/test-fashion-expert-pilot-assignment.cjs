const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createAssignmentManifest,
  createAssignmentPack,
  parseArguments,
  validateAssignmentManifest,
} = require("./fashion-expert-pilot-assignment.cjs");

const lockPath = path.join(__dirname, "fixtures", "fashion-expert-pilot-batch-lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const evaluatorIds = ["reviewer-01", "reviewer-02", "reviewer-03"];

function test(name, run) {
  return Promise.resolve().then(run).then(() => console.log(`PASS ${name}`));
}

async function main() {
  await test("assignment arguments require pseudonymous evaluators and safe distinct paths", () => {
    const base = ["--batch-lock", lockPath, "--seed", "seed-v1", "--output", "assign.json"];
    assert.throws(() => parseArguments(base), /Evaluator IDs are required|Not enough evaluators/);
    assert.throws(
      () => createAssignmentManifest(lock, { evaluatorIds: ["person@example.com", "reviewer-02"], seed: "seed-v1" }),
      /pseudonymous/
    );
    assert.throws(
      () => parseArguments([
        "--batch-lock", lockPath, "--evaluator", "reviewer-01", "--evaluator", "reviewer-02",
        "--seed", "seed-v1", "--output", lockPath,
      ]),
      /different/
    );
  });

  await test("every outfit has two reviewers with balanced workload and overlap", () => {
    const manifest = createAssignmentManifest(lock, { evaluatorIds, seed: "seed-v1" });
    validateAssignmentManifest(manifest, lock);
    assert.equal(manifest.outfits.length, lock.outfits.length);
    assert.ok(manifest.outfits.every((entry) => entry.evaluatorIds.length === 2));
    const loads = manifest.evaluators.map((entry) => entry.outfitIds.length);
    assert.ok(Math.max(...loads) - Math.min(...loads) <= 1);

    const overlaps = new Map();
    manifest.outfits.forEach(({ evaluatorIds: assigned }) => {
      const key = [...assigned].sort().join("+");
      overlaps.set(key, (overlaps.get(key) || 0) + 1);
    });
    assert.equal(overlaps.size, 3);
    assert.ok(Math.max(...overlaps.values()) - Math.min(...overlaps.values()) <= 1);
  });

  await test("the same batch, seed, and evaluators produce byte-identical packs", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-assignment-"));
    try {
      const firstPath = path.join(directory, "first.json");
      const secondPath = path.join(directory, "second.json");
      const options = {
        batchLockPath: lockPath,
        evaluatorIds,
        seed: "seed-v1",
        reviewersPerOutfit: 2,
      };
      createAssignmentPack({ ...options, outputPath: firstPath });
      createAssignmentPack({ ...options, outputPath: secondPath });
      assert.equal(fs.readFileSync(firstPath, "utf8"), fs.readFileSync(secondPath, "utf8"));
      assert.doesNotMatch(
        fs.readFileSync(firstPath, "utf8"),
        /(?:[A-Z]:\\|file:|https?:|@|base64|image|email|personName)/i
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  await test("assignment validation rejects tampering and a different batch", () => {
    const manifest = createAssignmentManifest(lock, { evaluatorIds, seed: "seed-v1" });
    const tampered = structuredClone(manifest);
    tampered.outfits[0].evaluatorIds.reverse();
    assert.throws(() => validateAssignmentManifest(tampered, lock), /does not match/);

    const changedLock = structuredClone(lock);
    changedLock.batchId = "changed";
    assert.throws(() => validateAssignmentManifest(manifest, changedLock));
  });

  console.log("Fashion expert pilot assignment tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
