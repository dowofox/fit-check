const crypto = require("node:crypto");
const fs = require("node:fs");

const BATCH_LOCK_SCHEMA_VERSION = "expert-pilot-batch-lock-v1";
const OUTPUT_PROVENANCE_SCHEMA_VERSION = "expert-pilot-output-provenance-v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getDatasetSnapshotPayload(dataset) {
  return {
    datasetId: dataset.datasetId,
    datasetVersion: dataset.datasetVersion,
    rubricVersion: dataset.rubricVersion,
    // Snapshot order is identity-independent; item and feature array order remains semantic.
    snapshots: [...dataset.snapshots]
      .sort((left, right) => left.outfitId.localeCompare(right.outfitId))
      .map((snapshot) => ({
        outfitId: snapshot.outfitId,
        outfitGroupId: snapshot.outfitGroupId,
        compositionGroupKey: snapshot.compositionGroupKey,
        itemRefs: snapshot.itemRefs,
        context: snapshot.context,
        featureVersions: snapshot.featureVersions,
        inputAvailability: snapshot.inputAvailability,
        colorFeatures: snapshot.colorFeatures,
        shapeFeatures: snapshot.shapeFeatures,
      })),
  };
}

function getDatasetSnapshotDigest(dataset) {
  return sha256(canonicalJson(getDatasetSnapshotPayload(dataset)));
}

function getBatchFingerprintPayload(lock) {
  return {
    schemaVersion: lock.schemaVersion,
    batchId: lock.batchId,
    dataset: lock.dataset,
    outfits: lock.outfits,
  };
}

function createBatchLock({ dataset, assets, batchId }) {
  if (typeof batchId !== "string" || !batchId.trim()) fail("Batch ID is required.");
  const outfits = [...dataset.snapshots]
    .sort((left, right) => left.outfitId.localeCompare(right.outfitId))
    .map((snapshot) => {
      const assetEntries = (assets.assetIdsByOutfit.get(snapshot.outfitId) || []).map((assetId) => {
        const asset = assets.assetsById.get(assetId);
        if (!asset) fail(`Validated asset is missing for ${snapshot.outfitId}.`);
        const bytes = fs.readFileSync(asset.path);
        return {
          sha256: sha256(bytes),
          byteLength: bytes.length,
          mimeType: asset.mimeType,
        };
      });
      return {
        outfitId: snapshot.outfitId,
        assets: assetEntries,
        orderedAssetsDigestSha256: sha256(canonicalJson(assetEntries)),
      };
    });
  const lock = {
    schemaVersion: BATCH_LOCK_SCHEMA_VERSION,
    batchId: batchId.trim(),
    dataset: {
      datasetId: dataset.datasetId,
      datasetVersion: dataset.datasetVersion,
      rubricVersion: dataset.rubricVersion,
      snapshotDigestSha256: getDatasetSnapshotDigest(dataset),
    },
    outfits,
  };
  return {
    ...lock,
    batchFingerprintSha256: sha256(canonicalJson(lock)),
  };
}

function validateBatchLock(lock) {
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) fail("Batch lock must be an object.");
  if (lock.schemaVersion !== BATCH_LOCK_SCHEMA_VERSION) fail("Batch lock uses an unsupported schema.");
  if (typeof lock.batchId !== "string" || !lock.batchId.trim()) fail("Batch lock has no batch ID.");
  if (!lock.dataset || typeof lock.dataset !== "object") fail("Batch lock dataset is invalid.");
  for (const key of ["datasetId", "datasetVersion", "rubricVersion"]) {
    if (typeof lock.dataset[key] !== "string" || !lock.dataset[key]) {
      fail(`Batch lock dataset ${key} is invalid.`);
    }
  }
  if (!SHA256_PATTERN.test(lock.dataset.snapshotDigestSha256 || "")) {
    fail("Batch lock snapshot digest is invalid.");
  }
  if (!Array.isArray(lock.outfits)) fail("Batch lock outfits are invalid.");
  const seenOutfits = new Set();
  for (const outfit of lock.outfits) {
    if (!outfit || typeof outfit.outfitId !== "string" || seenOutfits.has(outfit.outfitId)) {
      fail("Batch lock outfit identity is invalid.");
    }
    seenOutfits.add(outfit.outfitId);
    if (!Array.isArray(outfit.assets)) fail(`Batch lock assets are invalid for ${outfit.outfitId}.`);
    for (const asset of outfit.assets) {
      if (
        !SHA256_PATTERN.test(asset?.sha256 || "") ||
        !Number.isInteger(asset?.byteLength) ||
        asset.byteLength <= 0 ||
        !["image/jpeg", "image/png", "image/webp"].includes(asset?.mimeType)
      ) {
        fail(`Batch lock asset metadata is invalid for ${outfit.outfitId}.`);
      }
    }
    if (outfit.orderedAssetsDigestSha256 !== sha256(canonicalJson(outfit.assets))) {
      fail(`Batch lock asset order digest is invalid for ${outfit.outfitId}.`);
    }
  }
  if (lock.batchFingerprintSha256 !== sha256(canonicalJson(getBatchFingerprintPayload(lock)))) {
    fail("Batch lock fingerprint is invalid.");
  }
  return lock;
}

function assertBatchLockMatches(lock, current) {
  validateBatchLock(lock);
  validateBatchLock(current);
  if (canonicalJson(lock) !== canonicalJson(current)) {
    fail("Batch lock does not match the current dataset and assets.");
  }
}

function getOrderedOutfitIdsDigest(orderedOutfitIds) {
  return sha256(canonicalJson(orderedOutfitIds));
}

function createOutputProvenance({ lock, session, now, createdAt }) {
  const timestamp = now || new Date().toISOString();
  return {
    schemaVersion: OUTPUT_PROVENANCE_SCHEMA_VERSION,
    batchId: lock.batchId,
    batchFingerprintSha256: lock.batchFingerprintSha256,
    datasetId: lock.dataset.datasetId,
    datasetVersion: lock.dataset.datasetVersion,
    rubricVersion: lock.dataset.rubricVersion,
    evaluatorId: session.evaluatorId,
    seed: session.seed,
    orderedOutfitIdsDigestSha256: getOrderedOutfitIdsDigest(session.orderedOutfitIds),
    createdAt: createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function validateOutputProvenance(provenance) {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    fail("Pilot output provenance must be an object.");
  }
  if (provenance.schemaVersion !== OUTPUT_PROVENANCE_SCHEMA_VERSION) {
    fail("Pilot output provenance uses an unsupported schema.");
  }
  for (const key of [
    "batchId",
    "datasetId",
    "datasetVersion",
    "rubricVersion",
    "evaluatorId",
    "seed",
    "createdAt",
    "updatedAt",
  ]) {
    if (typeof provenance[key] !== "string" || !provenance[key]) {
      fail(`Pilot output provenance ${key} is invalid.`);
    }
  }
  for (const key of ["batchFingerprintSha256", "orderedOutfitIdsDigestSha256"]) {
    if (!SHA256_PATTERN.test(provenance[key] || "")) {
      fail(`Pilot output provenance ${key} is invalid.`);
    }
  }
  return provenance;
}

function assertOutputProvenanceMatches(actual, expected) {
  validateOutputProvenance(actual);
  validateOutputProvenance(expected);
  const identityKeys = [
    "batchId",
    "batchFingerprintSha256",
    "datasetId",
    "datasetVersion",
    "rubricVersion",
    "evaluatorId",
    "seed",
    "orderedOutfitIdsDigestSha256",
  ];
  if (identityKeys.some((key) => actual[key] !== expected[key])) {
    fail("Pilot output provenance does not match this evaluation session.");
  }
}

function getOutputProvenancePath(outputPath) {
  return `${outputPath}.pilot-provenance.json`;
}

module.exports = {
  BATCH_LOCK_SCHEMA_VERSION,
  OUTPUT_PROVENANCE_SCHEMA_VERSION,
  assertBatchLockMatches,
  assertOutputProvenanceMatches,
  canonicalJson,
  createBatchLock,
  createOutputProvenance,
  getDatasetSnapshotDigest,
  getOrderedOutfitIdsDigest,
  getOutputProvenancePath,
  validateBatchLock,
  validateOutputProvenance,
};
