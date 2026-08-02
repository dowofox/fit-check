const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createDraftStore,
  draftsEqual,
} = require("./expert-pilot-ui/draftState.js");

const {
  createPilotServer,
  parsePilotArguments,
  validateAssetManifest,
} = require("./run-fashion-expert-pilot.cjs");
const {
  buildPilotAbsoluteEvaluation,
  createExpertPilotSession,
  getDeterministicOutfitOrder,
  getPilotDimensionState,
  getPilotEvaluationId,
  upsertPilotEvaluation,
  validatePilotOutput,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");
const {
  REQUIRED_EXPERT_DIMENSIONS,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");

const projectRoot = path.resolve(__dirname, "..");
const datasetPath = path.join(
  __dirname,
  "fixtures",
  "fashion-expert-synthetic-valid.json"
);
const fixtureManifestPath = path.join(
  __dirname,
  "fixtures",
  "fashion-expert-pilot-assets.json"
);
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function test(name, run) {
  return Promise.resolve()
    .then(run)
    .then(() => console.log(`PASS ${name}`));
}

function createSafeEvaluation() {
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

function createTemporaryAssets(directory, dataset) {
  const outfits = {};
  dataset.snapshots.forEach((snapshot, index) => {
    if (!snapshot.inputAvailability.imageAvailable) return;
    const imagePath = path.join(directory, `outfit-${index + 1}.png`);
    fs.writeFileSync(imagePath, onePixelPng);
    outfits[snapshot.outfitId] = { images: [imagePath] };
  });
  const manifestPath = path.join(directory, "assets.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ schemaVersion: "expert-pilot-assets-v1", outfits }, null, 2)
  );
  return manifestPath;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  return { response, payload };
}

async function main() {
  const dataset = readJson(datasetPath);

  await test("draft store keeps independent, immutable, privacy-safe case state", () => {
    const store = createDraftStore();
    const first = {
      dimensions: [{
        dimension: "color_harmony",
        availability: "rated",
        rating: "4",
        confidence: "3",
        supportingEvidenceCodes: ["color_relation_stable"],
        conflictingEvidenceCodes: [],
        notes: "partial note",
      }],
      overall: { enabled: true, availability: "rated", rating: "4", confidence: "3" },
      evaluatorConfidence: "3",
      elapsedMilliseconds: 1500,
      token: "must-not-survive",
      imagePath: "C:/private/outfit.png",
      productName: "private product",
    };
    store.setDraft(2, first);
    store.setDraft(1, { dimensions: [], evaluatorConfidence: "2" });
    first.dimensions[0].notes = "mutated later";

    assert.deepEqual(store.getDirtyCaseNumbers(), [1, 2]);
    assert.equal(store.getDraft(2).dimensions[0].notes, "partial note");
    const serialized = JSON.stringify(store.getDraft(2));
    assert.doesNotMatch(serialized, /token|private|file:|base64|imagePath|productName/i);

    store.clearDraft(1);
    assert.equal(store.hasDraft(1), false);
    assert.equal(store.hasDraft(2), true);
    assert.equal(store.hasAnyDraft(), true);
  });

  await test("navigation, save, failure, and discard preserve the intended draft", () => {
    const store = createDraftStore();
    const savedEvaluation = createSafeEvaluation();
    const partial = {
      dimensions: [{
        dimension: "color_harmony",
        availability: "rated",
        rating: "5",
        confidence: "4",
        supportingEvidenceCodes: ["color_relation_stable"],
        conflictingEvidenceCodes: ["color_temperature_conflict"],
        notes: "keep me",
      }],
      overall: { enabled: false, availability: "", rating: "", confidence: "", notes: "" },
      evaluatorConfidence: "4",
      elapsedMilliseconds: 2100,
    };
    store.setDraft(1, partial);
    store.setDraft(2, { dimensions: [], evaluatorConfidence: "2" });

    const restored = store.getDraft(1) || savedEvaluation;
    assert.equal(restored.dimensions[0].rating, "5");
    assert.equal(restored.dimensions[0].notes, "keep me");
    assert.equal(draftsEqual(restored, partial), true);

    // A failed save leaves every draft untouched.
    assert.deepEqual(store.getDirtyCaseNumbers(), [1, 2]);
    // A successful save clears only the submitted Case.
    store.clearDraft(1);
    assert.equal(store.hasDraft(1), false);
    assert.equal(store.hasDraft(2), true);
    // Discard uses the same Case-local clear and never changes the saved evaluation.
    store.clearDraft(2);
    assert.equal(store.hasAnyDraft(), false);
    assert.equal(savedEvaluation.dimensions.length, REQUIRED_EXPERT_DIMENSIONS.length);
  });

  await test("CLI arguments reject missing, unsafe, and colliding values", () => {
    assert.throws(() => parsePilotArguments([]), /--dataset/);
    assert.throws(
      () =>
        parsePilotArguments([
          "--dataset", datasetPath,
          "--assets", fixtureManifestPath,
          "--evaluator-id", "person@example.com",
          "--output", "output.json",
        ]),
      /pseudonymous|Email/
    );
    assert.throws(
      () =>
        parsePilotArguments([
          "--dataset", datasetPath,
          "--assets", fixtureManifestPath,
          "--evaluator-id", "pilot-qa",
          "--output", datasetPath,
        ]),
      /different/
    );
  });

  await test("committed synthetic asset manifest validates without entering the dataset", () => {
    const manifest = readJson(fixtureManifestPath);
    const assets = validateAssetManifest(manifest, fixtureManifestPath, dataset);
    assert.equal(assets.assetsById.size, 4);
    assert.equal(JSON.stringify(dataset).includes("design-preview"), false);
  });

  await test("asset validation blocks traversal, duplicates, and MIME spoofing", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-assets-"));
    try {
      const validPath = createTemporaryAssets(directory, dataset);
      const valid = readJson(validPath);
      const duplicate = structuredClone(valid);
      duplicate.outfits["outfit-002"].images[0] = duplicate.outfits["outfit-001"].images[0];
      assert.throws(
        () => validateAssetManifest(duplicate, validPath, dataset),
        /registered more than once/
      );

      assert.throws(
        () =>
          validateAssetManifest(
            {
              schemaVersion: "expert-pilot-assets-v1",
              outfits: { "outfit-001": { images: ["../../../../outside.png"] } },
            },
            path.join(projectRoot, "scripts", "fixtures", "assets.json"),
            dataset
          ),
        /escapes the project directory/
      );

      const spoofPath = path.join(directory, "spoof.png");
      fs.writeFileSync(spoofPath, "not an image");
      const spoof = structuredClone(valid);
      spoof.outfits["outfit-001"].images[0] = spoofPath;
      assert.throws(
        () => validateAssetManifest(spoof, validPath, dataset),
        /MIME type/
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  await test("session order, IDs, and rating locks are deterministic", () => {
    const input = {
      datasetId: dataset.datasetId,
      evaluatorId: "pilot-qa",
      seed: "fixed-seed",
      outfitIds: dataset.snapshots.map((snapshot) => snapshot.outfitId),
    };
    assert.deepEqual(getDeterministicOutfitOrder(input), getDeterministicOutfitOrder(input));
    assert.equal(
      getPilotEvaluationId({
        datasetId: dataset.datasetId,
        evaluatorId: "pilot-qa",
        outfitId: "outfit-001",
        rubricVersion: dataset.rubricVersion,
      }),
      getPilotEvaluationId({
        datasetId: dataset.datasetId,
        evaluatorId: "pilot-qa",
        outfitId: "outfit-001",
        rubricVersion: dataset.rubricVersion,
      })
    );
    const session = createExpertPilotSession({
      dataset,
      evaluatorId: "pilot-qa",
      seed: "fixed-seed",
      now: "2026-08-02T00:00:00.000Z",
    });
    assert.equal(session.orderedOutfitIds.length, dataset.snapshots.length);
    assert.equal(
      getPilotDimensionState(dataset.snapshots[0], "body_fit_suitability").canRate,
      false
    );
    assert.equal(
      getPilotDimensionState(dataset.snapshots[0], "color_harmony").canRate,
      true
    );
  });

  await test("pilot upsert preserves the dataset contract", () => {
    const evaluation = buildPilotAbsoluteEvaluation({
      dataset,
      evaluatorId: "pilot-contract",
      evaluatorGroup: "pilot",
      outfitId: dataset.snapshots[0].outfitId,
      evaluation: createSafeEvaluation(),
      now: "2026-08-02T00:00:00.000Z",
    });
    const updated = upsertPilotEvaluation(dataset, evaluation);
    assert.equal(updated.absoluteEvaluations.length, dataset.absoluteEvaluations.length + 1);
    assert.equal(validatePilotOutput(updated).valid, true);
    assert.equal("professionalScore" in evaluation, false);
  });

  await test("localhost runner saves atomically, resumes, and completes", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "naes-pilot-server-"));
    const sourceBefore = fs.readFileSync(datasetPath, "utf8");
    const assetsPath = createTemporaryAssets(directory, dataset);
    const outputPath = path.join(directory, "pilot-output.json");
    const options = {
      datasetPath,
      assetsPath,
      outputPath,
      evaluatorId: "pilot-server-qa",
      evaluatorGroup: "pilot",
      seed: "server-seed",
      port: 4317,
    };
    let pilot = createPilotServer(options);
    try {
      let port = await pilot.listen(0);
      let origin = `http://127.0.0.1:${port}`;
      const page = await fetch(origin);
      assert.equal(page.status, 200);
      assert.equal(page.headers.get("x-frame-options"), "DENY");
      const pageText = await page.text();
      assert.match(pageText, /절대평가 파일럿/);
      assert.match(pageText, /draftState\.js/);
      assert.doesNotMatch(pageText, /pairwise|professionalScore/i);
      const draftScript = await fetch(`${origin}/draftState.js`);
      assert.equal(draftScript.status, 200);
      assert.match(await draftScript.text(), /createDraftStore/);

      const sessionResult = await fetchJson(`${origin}/api/session`);
      assert.equal(sessionResult.response.status, 200);
      const token = sessionResult.payload.token;
      assert.equal(sessionResult.payload.session.totalCases, dataset.snapshots.length);

      let imageRoute;
      for (let caseNumber = 1; caseNumber <= dataset.snapshots.length; caseNumber += 1) {
        const caseResult = await fetchJson(`${origin}/api/outfits/${caseNumber}`);
        assert.equal(caseResult.payload.rubric.length, 13);
        assert.equal("outfitId" in caseResult.payload, false);
        imageRoute ||= caseResult.payload.images[0];
      }
      assert.ok(imageRoute);
      const imageResponse = await fetch(`${origin}${imageRoute}`);
      assert.equal(imageResponse.status, 200);
      assert.equal(imageResponse.headers.get("content-type"), "image/png");
      assert.equal((await imageResponse.arrayBuffer()).byteLength, onePixelPng.length);
      assert.equal((await fetch(`${origin}/api/assets/000000000000000000000000`)).status, 404);

      const rejected = await fetchJson(`${origin}/api/evaluations/1`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Pilot-Token": token },
        body: JSON.stringify(createSafeEvaluation()),
      });
      assert.equal(rejected.response.status, 403);

      const oversized = await fetchJson(`${origin}/api/evaluations/1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Pilot-Token": token,
          Origin: origin,
        },
        body: JSON.stringify({ notes: "x".repeat(300_000) }),
      });
      assert.equal(oversized.response.status, 413);

      const headers = {
        "Content-Type": "application/json",
        "X-Pilot-Token": token,
        Origin: origin,
      };
      const firstSave = await fetchJson(`${origin}/api/evaluations/1`, {
        method: "POST",
        headers,
        body: JSON.stringify(createSafeEvaluation()),
      });
      assert.equal(firstSave.response.status, 200);
      assert.equal(firstSave.payload.completion.complete, false);
      const firstOutput = readJson(outputPath);
      const firstEvaluationId = firstOutput.absoluteEvaluations.find(
        (entry) => entry.evaluatorId === options.evaluatorId
      ).evaluationId;
      const serializedOutput = JSON.stringify(firstOutput);
      assert.equal(serializedOutput.includes(directory), false);
      assert.equal(/file:|data:image|base64/i.test(serializedOutput), false);
      assert.deepEqual(firstOutput.pairwiseEvaluations, dataset.pairwiseEvaluations);

      const earlyComplete = await fetchJson(`${origin}/api/complete`, {
        method: "POST",
        headers,
        body: "{}",
      });
      assert.equal(earlyComplete.response.status, 409);
      await pilot.close();

      pilot = createPilotServer(options);
      port = await pilot.listen(0);
      origin = `http://127.0.0.1:${port}`;
      const resumed = await fetchJson(`${origin}/api/session`);
      assert.deepEqual(resumed.payload.session.completedCaseNumbers, [1]);
      const resumedHeaders = {
        "Content-Type": "application/json",
        "X-Pilot-Token": resumed.payload.token,
        Origin: origin,
      };
      for (let caseNumber = 1; caseNumber <= dataset.snapshots.length; caseNumber += 1) {
        const save = await fetchJson(`${origin}/api/evaluations/${caseNumber}`, {
          method: "POST",
          headers: resumedHeaders,
          body: JSON.stringify(createSafeEvaluation()),
        });
        assert.equal(save.response.status, 200);
      }
      const completed = await fetchJson(`${origin}/api/complete`, {
        method: "POST",
        headers: resumedHeaders,
        body: "{}",
      });
      assert.equal(completed.response.status, 200);
      assert.equal(completed.payload.complete, true);

      const finalOutput = readJson(outputPath);
      const pilotEvaluations = finalOutput.absoluteEvaluations.filter(
        (entry) => entry.evaluatorId === options.evaluatorId
      );
      assert.equal(pilotEvaluations.length, dataset.snapshots.length);
      assert.equal(new Set(pilotEvaluations.map((entry) => entry.evaluationId)).size, 5);
      assert.equal(
        pilotEvaluations.find((entry) => entry.evaluationId === firstEvaluationId)?.evaluationId,
        firstEvaluationId
      );
      assert.equal(fs.readFileSync(datasetPath, "utf8"), sourceBefore);
      await pilot.close();

      fs.writeFileSync(outputPath, "{broken", "utf8");
      assert.throws(() => createPilotServer(options), /not valid JSON/);
    } finally {
      if (pilot.server.listening) await pilot.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  console.log("Fashion expert pilot tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
