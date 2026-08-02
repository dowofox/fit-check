const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/") ? path.join(projectRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};
require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

const { validateExpertEvaluationDataset } = require("../utils/fashionCompatibility/expert/evaluationValidation.ts");

function readJson(filePath) {
  if (!filePath) throw new Error("Usage: npm run fashion:expert:validate -- <dataset.json>");
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error(`Dataset file not found: ${resolved}`);
  const source = fs.readFileSync(resolved, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    const position = Number(String(error.message).match(/position (\d+)/)?.[1]);
    if (Number.isFinite(position)) {
      const before = source.slice(0, position);
      const line = before.split("\n").length;
      const column = position - before.lastIndexOf("\n");
      throw new Error(`Invalid JSON at line ${line}, column ${column}: ${error.message}`);
    }
    throw error;
  }
}

try {
  const result = validateExpertEvaluationDataset(readJson(process.argv[2]));
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
