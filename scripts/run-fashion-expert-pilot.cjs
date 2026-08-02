const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};
require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

const {
  buildPilotAbsoluteEvaluation,
  createExpertPilotSession,
  findPilotEvaluation,
  getPilotCompletion,
  getPilotRubricView,
  upsertPilotEvaluation,
  validatePilotOutput,
} = require("../utils/fashionCompatibility/expert/pilotSession.ts");
const {
  EXPERT_EVIDENCE_REGISTRY,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");
const {
  EXPERT_DATASET_SCHEMA_VERSION,
  EXPERT_RUBRIC_VERSION,
} = require("../utils/fashionCompatibility/expert/types.ts");
const {
  validateExpertEvaluationDataset,
} = require("../utils/fashionCompatibility/expert/evaluationValidation.ts");
const {
  assertBatchLockMatches,
  assertOutputProvenanceMatches,
  createBatchLock,
  createOutputProvenance,
  getOutputProvenancePath,
} = require("./fashion-expert-pilot-provenance.cjs");

const HOST = "127.0.0.1";
const DEFAULT_PORT = 4317;
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const MAX_REQUEST_BYTES = 256 * 1024;
const ASSET_SCHEMA_VERSION = "expert-pilot-assets-v1";
const EVALUATOR_GROUPS = new Set([
  "stylist",
  "fashion_student",
  "trained_reviewer",
  "pilot",
  "unknown",
]);
const MIME_BY_EXTENSION = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/;
const UI_DIR = path.join(__dirname, "expert-pilot-ui");

function fail(message) {
  throw new Error(message);
}

function argumentValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parsePilotArguments(argv) {
  const dataset = argumentValue(argv, "--dataset");
  const assets = argumentValue(argv, "--assets");
  const batchLock = argumentValue(argv, "--batch-lock");
  const evaluatorId = argumentValue(argv, "--evaluator-id");
  const output = argumentValue(argv, "--output");
  if (!dataset) fail("Missing required --dataset path.");
  if (!assets) fail("Missing required --assets path.");
  if (!batchLock) fail("Missing required --batch-lock path.");
  if (!evaluatorId) fail("Missing required --evaluator-id.");
  if (!output) fail("Missing required --output path.");
  if (!ID_PATTERN.test(evaluatorId)) {
    fail("--evaluator-id must be a pseudonymous identifier, not a name or email.");
  }
  if (evaluatorId.includes("@")) fail("Email addresses are not allowed as evaluator IDs.");

  const evaluatorGroup = argumentValue(argv, "--evaluator-group") || "unknown";
  if (!EVALUATOR_GROUPS.has(evaluatorGroup)) fail("Invalid --evaluator-group.");
  const portSource = argumentValue(argv, "--port");
  const port = portSource === undefined ? DEFAULT_PORT : Number(portSource);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail("--port must be an integer from 1 to 65535.");
  }

  const datasetPath = path.resolve(dataset);
  const assetsPath = path.resolve(assets);
  const batchLockPath = path.resolve(batchLock);
  const outputPath = path.resolve(output);
  if (datasetPath.toLowerCase() === outputPath.toLowerCase()) {
    fail("--output must be different from --dataset.");
  }
  return {
    datasetPath,
    assetsPath,
    batchLockPath,
    outputPath,
    evaluatorId,
    evaluatorGroup,
    seed: argumentValue(argv, "--seed") || "pilot-v1",
    port,
  };
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`${label} file not found: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function validateInputDataset(dataset, label = "Dataset") {
  const result = validateExpertEvaluationDataset(dataset);
  if (!result.valid) {
    const summary = result.errors
      .slice(0, 8)
      .map((entry) => `${entry.path}: ${entry.message}`)
      .join("\n");
    fail(`${label} failed expert dataset validation.\n${summary}`);
  }
  if (dataset.schemaVersion !== EXPERT_DATASET_SCHEMA_VERSION) {
    fail(`${label} uses an unsupported dataset schema.`);
  }
  if (dataset.rubricVersion !== EXPERT_RUBRIC_VERSION) {
    fail(`${label} uses an unsupported rubric version.`);
  }
  return result;
}

function opaqueAssetId(outfitId, index, filePath) {
  return crypto
    .createHash("sha256")
    .update(`${outfitId}\u001f${index}\u001f${filePath}`)
    .digest("hex")
    .slice(0, 24);
}

function detectImageMime(filePath) {
  const descriptor = fs.openSync(filePath, "r");
  const signature = Buffer.alloc(12);
  try {
    fs.readSync(descriptor, signature, 0, signature.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (signature.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return "image/png";
  }
  if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    signature.subarray(0, 4).toString("ascii") === "RIFF" &&
    signature.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function validateAssetManifest(manifest, manifestPath, dataset) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    fail("Asset manifest must be an object.");
  }
  if (manifest.schemaVersion !== ASSET_SCHEMA_VERSION) {
    fail(`Asset manifest schema must be ${ASSET_SCHEMA_VERSION}.`);
  }
  if (!manifest.outfits || typeof manifest.outfits !== "object" || Array.isArray(manifest.outfits)) {
    fail("Asset manifest outfits must be an object.");
  }

  const snapshotById = new Map(dataset.snapshots.map((snapshot) => [snapshot.outfitId, snapshot]));
  const manifestDir = path.dirname(manifestPath);
  const seenPaths = new Set();
  const assetsById = new Map();
  const assetIdsByOutfit = new Map();

  for (const [outfitId, entry] of Object.entries(manifest.outfits)) {
    const snapshot = snapshotById.get(outfitId);
    if (!snapshot) fail(`Asset manifest references unknown outfit ${outfitId}.`);
    if (!entry || typeof entry !== "object" || !Array.isArray(entry.images)) {
      fail(`Asset manifest entry ${outfitId} must contain an images array.`);
    }
    if (entry.images.length === 0) fail(`Asset manifest entry ${outfitId} has no images.`);
    if (!snapshot.inputAvailability.imageAvailable) {
      fail(`Asset manifest entry ${outfitId} has images while imageAvailable is false.`);
    }

    const ids = [];
    entry.images.forEach((sourcePath, index) => {
      if (typeof sourcePath !== "string" || !sourcePath.trim()) {
        fail(`Asset manifest entry ${outfitId} contains an empty image path.`);
      }
      const resolved = path.isAbsolute(sourcePath)
        ? path.resolve(sourcePath)
        : path.resolve(manifestDir, sourcePath);
      if (!path.isAbsolute(sourcePath)) {
        const relative = path.relative(projectRoot, resolved);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          fail(`Asset manifest entry ${outfitId} escapes the project directory.`);
        }
      }
      const pathKey = process.platform === "win32" ? resolved.toLowerCase() : resolved;
      if (seenPaths.has(pathKey)) fail(`Asset path is registered more than once for ${outfitId}.`);
      seenPaths.add(pathKey);
      if (!fs.existsSync(resolved)) fail(`Asset file does not exist for ${outfitId}.`);
      const stat = fs.lstatSync(resolved);
      if (stat.isSymbolicLink()) fail(`Symbolic links are not allowed for ${outfitId}.`);
      if (!stat.isFile()) fail(`Asset path is not a regular file for ${outfitId}.`);
      if (stat.size <= 0 || stat.size > MAX_ASSET_BYTES) {
        fail(`Asset file size is invalid for ${outfitId}.`);
      }
      const extension = path.extname(resolved).toLowerCase();
      const mimeType = MIME_BY_EXTENSION.get(extension);
      if (!mimeType) fail(`Asset extension is not allowed for ${outfitId}.`);
      if (detectImageMime(resolved) !== mimeType) {
        fail(`Asset MIME type does not match its extension for ${outfitId}.`);
      }
      const id = opaqueAssetId(outfitId, index, resolved);
      ids.push(id);
      assetsById.set(id, { path: resolved, mimeType, size: stat.size });
    });
    assetIdsByOutfit.set(outfitId, ids);
  }

  for (const snapshot of dataset.snapshots) {
    if (
      snapshot.inputAvailability.imageAvailable &&
      !assetIdsByOutfit.get(snapshot.outfitId)?.length
    ) {
      fail(`Snapshot ${snapshot.outfitId} declares imageAvailable but has no registered asset.`);
    }
  }
  return { assetsById, assetIdsByOutfit };
}

function loadResumeDataset(sourceDataset, outputPath) {
  if (!fs.existsSync(outputPath)) return structuredClone(sourceDataset);
  const output = readJson(outputPath, "Output dataset");
  validateInputDataset(output, "Output dataset");
  if (
    output.datasetId !== sourceDataset.datasetId ||
    output.datasetVersion !== sourceDataset.datasetVersion ||
    output.rubricVersion !== sourceDataset.rubricVersion
  ) {
    fail("Output dataset does not match the input dataset identity.");
  }
  if (JSON.stringify(output.snapshots) !== JSON.stringify(sourceDataset.snapshots)) {
    fail("Output dataset snapshots do not match the input dataset.");
  }
  return output;
}

function atomicWriteJson(outputPath, value) {
  const directory = path.dirname(outputPath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(outputPath)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`
  );
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx");
    fs.writeFileSync(descriptor, serialized, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, outputPath);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function securityHeaders(contentType) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "Content-Type": contentType,
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, securityHeaders("application/json; charset=utf-8"));
  response.end(JSON.stringify(value));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function isAllowedHost(value) {
  return /^127\.0\.0\.1:\d{1,5}$/.test(String(value || ""));
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    const contentType = String(request.headers["content-type"] || "");
    if (!contentType.toLowerCase().startsWith("application/json")) {
      reject(Object.assign(new Error("Content-Type must be application/json."), { statusCode: 415 }));
      return;
    }
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES && !tooLarge) {
        tooLarge = true;
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Request body is not valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function publicEvaluation(evaluation) {
  if (!evaluation) return undefined;
  return {
    dimensions: evaluation.dimensions,
    overallCompatibility: evaluation.overallCompatibility,
    evaluatorConfidence: evaluation.evaluatorConfidence,
    durationSeconds: evaluation.durationSeconds,
    datasetSplit: evaluation.datasetSplit,
  };
}

function createPilotServer(options) {
  if (!options.batchLockPath) fail("Missing required batch lock path.");
  const sourceDataset = readJson(options.datasetPath, "Dataset");
  validateInputDataset(sourceDataset);
  const manifest = readJson(options.assetsPath, "Asset manifest");
  const assets = validateAssetManifest(manifest, options.assetsPath, sourceDataset);
  const batchLock = readJson(options.batchLockPath, "Batch lock");
  const currentBatchLock = createBatchLock({
    dataset: sourceDataset,
    assets,
    batchId: batchLock.batchId,
  });
  assertBatchLockMatches(batchLock, currentBatchLock);
  const lockedOutfitById = new Map(batchLock.outfits.map((outfit) => [outfit.outfitId, outfit]));
  for (const [outfitId, assetIds] of assets.assetIdsByOutfit) {
    const lockedAssets = lockedOutfitById.get(outfitId)?.assets || [];
    assetIds.forEach((assetId, index) => {
      assets.assetsById.get(assetId).sha256 = lockedAssets[index].sha256;
    });
  }
  let dataset = loadResumeDataset(sourceDataset, options.outputPath);
  const token = crypto.randomBytes(24).toString("hex");
  const session = createExpertPilotSession({
    dataset,
    evaluatorId: options.evaluatorId,
    evaluatorGroup: options.evaluatorGroup,
    seed: options.seed,
  });
  const provenancePath = getOutputProvenancePath(options.outputPath);
  const expectedProvenance = createOutputProvenance({ lock: batchLock, session });
  if (fs.existsSync(options.outputPath) && !fs.existsSync(provenancePath)) {
    fail("Existing pilot output is missing its provenance sidecar.");
  }
  let provenance;
  if (fs.existsSync(provenancePath)) {
    provenance = readJson(provenancePath, "Pilot output provenance");
    assertOutputProvenanceMatches(provenance, expectedProvenance);
  } else {
    provenance = expectedProvenance;
    atomicWriteJson(provenancePath, provenance);
  }
  const snapshotById = new Map(dataset.snapshots.map((snapshot) => [snapshot.outfitId, snapshot]));
  const saveDelayMs = Number.isFinite(options.saveDelayMs) ? Math.max(0, options.saveDelayMs) : 0;
  let saveRequestCount = 0;

  function getCase(caseNumber) {
    if (!Number.isInteger(caseNumber) || caseNumber < 1 || caseNumber > session.orderedOutfitIds.length) {
      return undefined;
    }
    const outfitId = session.orderedOutfitIds[caseNumber - 1];
    const snapshot = snapshotById.get(outfitId);
    if (!snapshot) return undefined;
    return { outfitId, snapshot };
  }

  function assertMutationRequest(request) {
    const expectedOrigin = `http://${request.headers.host}`;
    if (request.headers.origin !== expectedOrigin) {
      fail("Request origin is not allowed.");
    }
    if (request.headers["x-pilot-token"] !== token) {
      fail("Pilot session token is invalid.");
    }
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (!isAllowedHost(request.headers.host)) {
        return sendError(response, 403, "Request host is not allowed.");
      }
      const url = new URL(request.url || "/", `http://${request.headers.host}`);
      if (url.pathname === "/" && request.method === "GET") {
        const html = fs.readFileSync(path.join(UI_DIR, "index.html"));
        response.writeHead(200, securityHeaders("text/html; charset=utf-8"));
        response.end(html);
        return;
      }
      if (url.pathname === "/app.js" && request.method === "GET") {
        response.writeHead(200, securityHeaders("text/javascript; charset=utf-8"));
        response.end(fs.readFileSync(path.join(UI_DIR, "app.js")));
        return;
      }
      if (url.pathname === "/draftState.js" && request.method === "GET") {
        response.writeHead(200, securityHeaders("text/javascript; charset=utf-8"));
        response.end(fs.readFileSync(path.join(UI_DIR, "draftState.js")));
        return;
      }
      if (url.pathname === "/styles.css" && request.method === "GET") {
        response.writeHead(200, securityHeaders("text/css; charset=utf-8"));
        response.end(fs.readFileSync(path.join(UI_DIR, "styles.css")));
        return;
      }
      if (url.pathname === "/api/session" && request.method === "GET") {
        const completion = getPilotCompletion(dataset, options.evaluatorId);
        sendJson(response, 200, {
          token,
          session: {
            sessionVersion: session.sessionVersion,
            datasetId: session.datasetId,
            datasetVersion: session.datasetVersion,
            rubricVersion: session.rubricVersion,
            evaluatorId: session.evaluatorId,
            evaluatorGroup: session.evaluatorGroup,
            seed: session.seed,
            batchId: batchLock.batchId,
            batchFingerprintPrefix: batchLock.batchFingerprintSha256.slice(0, 12),
            totalCases: session.orderedOutfitIds.length,
            completedCaseNumbers: session.orderedOutfitIds
              .map((outfitId, index) =>
                completion.completedOutfitIds.includes(outfitId) ? index + 1 : undefined
              )
              .filter(Boolean),
          },
        });
        return;
      }
      const outfitMatch = url.pathname.match(/^\/api\/outfits\/(\d+)$/);
      if (outfitMatch && request.method === "GET") {
        const caseNumber = Number(outfitMatch[1]);
        const currentCase = getCase(caseNumber);
        if (!currentCase) return sendError(response, 404, "Case not found.");
        sendJson(response, 200, {
          caseNumber,
          totalCases: session.orderedOutfitIds.length,
          rubricVersion: dataset.rubricVersion,
          context: currentCase.snapshot.context,
          featureVersions: currentCase.snapshot.featureVersions,
          inputAvailability: currentCase.snapshot.inputAvailability,
          featureAvailability: {
            color: Boolean(currentCase.snapshot.colorFeatures),
            shape: Boolean(currentCase.snapshot.shapeFeatures),
          },
          images: (assets.assetIdsByOutfit.get(currentCase.outfitId) || []).map(
            (assetId) => `/api/assets/${assetId}`
          ),
          rubric: getPilotRubricView(currentCase.snapshot),
          evidence: EXPERT_EVIDENCE_REGISTRY.map((entry) => ({
            code: entry.code,
            label: entry.label,
          })),
          existingEvaluation: publicEvaluation(
            findPilotEvaluation(dataset, options.evaluatorId, currentCase.outfitId)
          ),
        });
        return;
      }
      const assetMatch = url.pathname.match(/^\/api\/assets\/([a-f0-9]{24})$/);
      if (assetMatch && request.method === "GET") {
        const asset = assets.assetsById.get(assetMatch[1]);
        if (!asset) return sendError(response, 404, "Asset not found.");
        const bytes = fs.readFileSync(asset.path);
        const digest = crypto.createHash("sha256").update(bytes).digest("hex");
        if (bytes.length !== asset.size || digest !== asset.sha256) {
          return sendError(response, 409, "Pilot asset changed after batch verification.");
        }
        response.writeHead(200, {
          ...securityHeaders(asset.mimeType),
          "Content-Length": bytes.length,
        });
        response.end(bytes);
        return;
      }
      const evaluationMatch = url.pathname.match(/^\/api\/evaluations\/(\d+)$/);
      if (evaluationMatch && request.method === "POST") {
        saveRequestCount += 1;
        assertMutationRequest(request);
        const caseNumber = Number(evaluationMatch[1]);
        const currentCase = getCase(caseNumber);
        if (!currentCase) return sendError(response, 404, "Case not found.");
        const body = await readRequestJson(request);
        if (saveDelayMs) await new Promise((resolve) => setTimeout(resolve, saveDelayMs));
        const existing = findPilotEvaluation(dataset, options.evaluatorId, currentCase.outfitId);
        const evaluation = buildPilotAbsoluteEvaluation({
          dataset,
          evaluatorId: options.evaluatorId,
          evaluatorGroup: options.evaluatorGroup,
          outfitId: currentCase.outfitId,
          evaluation: body,
          existing,
        });
        const candidate = upsertPilotEvaluation(dataset, evaluation);
        const validation = validatePilotOutput(candidate);
        atomicWriteJson(options.outputPath, candidate);
        provenance = createOutputProvenance({
          lock: batchLock,
          session,
          createdAt: provenance.createdAt,
        });
        atomicWriteJson(provenancePath, provenance);
        dataset = candidate;
        sendJson(response, 200, {
          saved: true,
          warnings: validation.warnings.map((entry) => ({
            code: entry.code,
            path: entry.path,
            message: entry.message,
          })),
          completion: getPilotCompletion(dataset, options.evaluatorId),
        });
        return;
      }
      if (url.pathname === "/api/complete" && request.method === "POST") {
        assertMutationRequest(request);
        await readRequestJson(request);
        const completion = getPilotCompletion(dataset, options.evaluatorId);
        if (!completion.complete) {
          return sendJson(response, 409, {
            error: "All cases must be evaluated before completion.",
            completion,
          });
        }
        const validation = validatePilotOutput(dataset);
        sendJson(response, 200, {
          complete: true,
          warnings: validation.warnings.length,
          statistics: validation.statistics,
        });
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        response.setHeader("Allow", "GET, POST");
        return sendError(response, request.method === "GET" ? 404 : 405, "Route or method not allowed.");
      }
      sendError(response, 404, "Not found.");
    } catch (error) {
      const statusCode = Number(error?.statusCode) || (/origin|token/i.test(String(error?.message)) ? 403 : 400);
      sendError(
        response,
        statusCode,
        error instanceof Error ? error.message.split("\n")[0] : "Request failed."
      );
    }
  });

  return {
    server,
    session,
    batchLock,
    provenancePath,
    getDataset: () => dataset,
    getSaveRequestCount: () => saveRequestCount,
    listen(port = options.port) {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, HOST, () => {
          const address = server.address();
          resolve(typeof address === "object" && address ? address.port : port);
        });
      });
    },
    close() {
      return new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}

async function main() {
  const options = parsePilotArguments(process.argv.slice(2));
  const pilot = createPilotServer(options);
  const port = await pilot.listen();
  console.log(`NAES expert pilot running at http://${HOST}:${port}`);
  console.log(`Output: ${options.outputPath}`);
  const shutdown = async () => {
    await pilot.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  ASSET_SCHEMA_VERSION,
  HOST,
  MAX_ASSET_BYTES,
  MAX_REQUEST_BYTES,
  atomicWriteJson,
  createPilotServer,
  loadResumeDataset,
  parsePilotArguments,
  readJson,
  validateAssetManifest,
  validateInputDataset,
};
