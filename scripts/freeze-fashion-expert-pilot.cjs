const path = require("node:path");
const {
  atomicWriteJson,
  readJson,
  validateAssetManifest,
  validateInputDataset,
} = require("./run-fashion-expert-pilot.cjs");
const {
  assertBatchLockMatches,
  createBatchLock,
} = require("./fashion-expert-pilot-provenance.cjs");

function argumentValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseArguments(argv) {
  const dataset = argumentValue(argv, "--dataset");
  const assets = argumentValue(argv, "--assets");
  const batchId = argumentValue(argv, "--batch-id");
  const output = argumentValue(argv, "--output");
  if (!dataset) throw new Error("Missing required --dataset path.");
  if (!assets) throw new Error("Missing required --assets path.");
  if (!batchId) throw new Error("Missing required --batch-id.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(batchId)) {
    throw new Error("--batch-id must be a stable pseudonymous identifier.");
  }
  if (!output) throw new Error("Missing required --output path.");
  const datasetPath = path.resolve(dataset);
  const assetsPath = path.resolve(assets);
  const outputPath = path.resolve(output);
  if ([datasetPath, assetsPath].some((inputPath) => inputPath.toLowerCase() === outputPath.toLowerCase())) {
    throw new Error("--output must be different from the dataset and asset manifest.");
  }
  return {
    datasetPath,
    assetsPath,
    batchId,
    outputPath,
  };
}

function freezeBatch(options) {
  const dataset = readJson(options.datasetPath, "Dataset");
  validateInputDataset(dataset);
  const manifest = readJson(options.assetsPath, "Asset manifest");
  const assets = validateAssetManifest(manifest, options.assetsPath, dataset);
  const lock = createBatchLock({ dataset, assets, batchId: options.batchId });
  atomicWriteJson(options.outputPath, lock);
  const saved = readJson(options.outputPath, "Saved batch lock");
  assertBatchLockMatches(saved, lock);
  return saved;
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const lock = freezeBatch(options);
    console.log(`Frozen expert pilot batch ${lock.batchId}.`);
    console.log(`Fingerprint: ${lock.batchFingerprintSha256}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { freezeBatch, parseArguments };
