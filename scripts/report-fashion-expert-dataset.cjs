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

const { createExpertDatasetReport, renderExpertDatasetReportMarkdown } = require("../utils/fashionCompatibility/expert/evaluationDataset.ts");
const { validateExpertEvaluationDataset } = require("../utils/fashionCompatibility/expert/evaluationValidation.ts");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseJson(source) {
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
  const inputPath = process.argv[2];
  if (!inputPath || inputPath.startsWith("--")) throw new Error("Usage: npm run fashion:expert:report -- <dataset.json> [--format json|markdown] [--output file]");
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) throw new Error(`Dataset file not found: ${resolved}`);
  const dataset = parseJson(fs.readFileSync(resolved, "utf8"));
  const validation = validateExpertEvaluationDataset(dataset);
  const report = createExpertDatasetReport(dataset);
  const format = argumentValue("--format") || "markdown";
  if (!new Set(["json", "markdown"]).has(format)) throw new Error("--format must be json or markdown");
  const output = format === "json" ? JSON.stringify(report, null, 2) : renderExpertDatasetReportMarkdown(report);
  const outputPath = argumentValue("--output");
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), `${output}\n`, "utf8");
  else console.log(output);
  if (!validation.valid) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
