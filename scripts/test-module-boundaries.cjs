const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const utilsRoot = path.join(projectRoot, "utils");

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
}

function hasRuntimeImport(importClause) {
  if (!importClause || importClause.isTypeOnly) return false;
  if (importClause.name) return true;
  if (!importClause.namedBindings) return true;
  if (ts.isNamespaceImport(importClause.namedBindings)) return true;

  return importClause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function resolveUtilsImport(sourceFile, importPath) {
  const candidateBase = importPath.startsWith("@/utils/")
    ? path.join(utilsRoot, importPath.slice("@/utils/".length))
    : importPath.startsWith(".")
      ? path.resolve(path.dirname(sourceFile), importPath)
      : null;

  if (!candidateBase || !candidateBase.startsWith(utilsRoot)) return null;

  return [candidateBase, `${candidateBase}.ts`, `${candidateBase}.tsx`].find((candidate) =>
    fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  ) || null;
}

function buildRuntimeImportGraph() {
  const graph = new Map();

  collectSourceFiles(utilsRoot).forEach((filePath) => {
    const sourceText = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );
    const dependencies = [];

    sourceFile.statements.forEach((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !hasRuntimeImport(statement.importClause)
      ) {
        return;
      }

      const dependency = resolveUtilsImport(
        filePath,
        statement.moduleSpecifier.text
      );
      if (dependency) dependencies.push(dependency);
    });

    graph.set(filePath, dependencies);
  });

  return graph;
}

function findRuntimeImportCycle(graph) {
  const visited = new Set();
  const active = new Set();
  const stack = [];

  function visit(filePath) {
    if (active.has(filePath)) {
      const cycleStart = stack.indexOf(filePath);
      return [...stack.slice(cycleStart), filePath];
    }
    if (visited.has(filePath)) return null;

    visited.add(filePath);
    active.add(filePath);
    stack.push(filePath);

    for (const dependency of graph.get(filePath) || []) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }

    stack.pop();
    active.delete(filePath);
    return null;
  }

  for (const filePath of graph.keys()) {
    const cycle = visit(filePath);
    if (cycle) return cycle;
  }

  return null;
}

test("utils runtime imports do not contain circular dependencies", () => {
  const cycle = findRuntimeImportCycle(buildRuntimeImportGraph());

  assert.equal(
    cycle,
    null,
    cycle?.map((filePath) => path.relative(projectRoot, filePath)).join(" -> ")
  );
});

test("profile route keeps a default export", () => {
  const profileSource = fs.readFileSync(path.join(projectRoot, "app", "profile.tsx"), "utf8");
  const sourceFile = ts.createSourceFile(
    "profile.tsx",
    profileSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const hasDefaultExport = sourceFile.statements.some((statement) =>
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword
    )
  );

  assert.equal(hasDefaultExport, true);
});

test("document picker is declared as an application dependency", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")
  );

  assert.equal(
    typeof packageJson.dependencies?.["expo-document-picker"],
    "string"
  );
});
