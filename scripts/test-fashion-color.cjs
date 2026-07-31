const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
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
  deltaE76,
  deltaE2000,
  hueAngleDifference,
  labToLch,
  srgbToLabD65,
} = require("../utils/fashionCompatibility/color/colorMath.ts");
const {
  getNamedColorRecord,
} = require("../utils/fashionCompatibility/color/namedColorCatalog.ts");
const {
  buildGarmentColorProfile,
  normalizeColorProportions,
} = require("../utils/fashionCompatibility/color/colorProfiles.ts");
const {
  buildOutfitColorFeatures,
} = require("../utils/fashionCompatibility/color/colorFeatures.ts");
const {
  evaluateColorShadowComparison,
} = require("../utils/fashionCompatibility/color/colorShadowEvaluator.ts");

function closeTo(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} +/- ${tolerance}, received ${actual}`
  );
}

function item(id, color, overrides = {}) {
  return {
    id,
    imageUri: `file:///${id}.png`,
    category: "상의",
    color,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

test("sRGB black and white convert to expected D65 Lab endpoints", () => {
  const black = srgbToLabD65({ r: 0, g: 0, b: 0 });
  const white = srgbToLabD65({ r: 255, g: 255, b: 255 });
  closeTo(black.l, 0, 1e-10, "black L");
  closeTo(white.l, 100, 1e-10, "white L");
  closeTo(white.a, 0, 1e-10, "white a");
  closeTo(white.b, 0, 1e-10, "white b");
});

test("neutral gray remains approximately achromatic", () => {
  const gray = srgbToLabD65({ r: 128, g: 128, b: 128 });
  closeTo(gray.a, 0, 1e-10, "gray a");
  closeTo(gray.b, 0, 1e-10, "gray b");
  assert.equal(labToLch({ l: 50, a: 0, b: 0 }).h, undefined);
});

test("Delta E functions are zero for identical colors and symmetric", () => {
  const first = { l: 50, a: 20, b: -30 };
  const second = { l: 65, a: -5, b: 12 };
  assert.equal(deltaE76(first, first), 0);
  assert.equal(deltaE2000(first, first), 0);
  closeTo(deltaE76(first, second), deltaE76(second, first), 1e-12, "Delta E 76 symmetry");
  closeTo(deltaE2000(first, second), deltaE2000(second, first), 1e-12, "Delta E 00 symmetry");
});

test("CIEDE2000 matches Sharma-Wu-Dalal reference pairs", () => {
  const pairs = [
    [{ l: 50, a: 2.6772, b: -79.7751 }, { l: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ l: 50, a: 3.1571, b: -77.2803 }, { l: 50, a: 0, b: -82.7485 }, 2.8615],
    [{ l: 50, a: 2.8361, b: -74.02 }, { l: 50, a: 0, b: -82.7485 }, 3.4412],
    [{ l: 50, a: -1.3802, b: -84.2814 }, { l: 50, a: 0, b: -82.7485 }, 1],
    [{ l: 50, a: -1.1848, b: -84.8006 }, { l: 50, a: 0, b: -82.7485 }, 1],
    [{ l: 50, a: -0.9009, b: -85.5211 }, { l: 50, a: 0, b: -82.7485 }, 1],
  ];
  for (const [first, second, expected] of pairs) {
    closeTo(deltaE2000(first, second), expected, 0.0001, "CIEDE2000 reference");
  }
});

test("hue differences wrap around and invalid inputs are rejected", () => {
  assert.equal(hueAngleDifference(359, 1), 2);
  assert.equal(hueAngleDifference(undefined, 20), undefined);
  assert.throws(() => srgbToLabD65({ r: -1, g: 0, b: 0 }), RangeError);
  assert.throws(() => srgbToLabD65({ r: Number.NaN, g: 0, b: 0 }), RangeError);
  assert.throws(() => deltaE2000({ l: 50, a: Infinity, b: 0 }, { l: 50, a: 0, b: 0 }), RangeError);
});

test("named catalog resolves Korean and English aliases", () => {
  assert.equal(getNamedColorRecord("검정").canonicalName, "블랙");
  assert.equal(getNamedColorRecord("BLACK").canonicalName, "블랙");
  assert.equal(getNamedColorRecord("gray").canonicalName, "그레이");
  assert.equal(getNamedColorRecord("grey").canonicalName, "그레이");
  assert.equal(getNamedColorRecord("off-white").canonicalName, "아이보리");
  assert.equal(getNamedColorRecord("not-a-color"), undefined);
  assert.ok(getNamedColorRecord("데님").confidence < 0.3);
});

test("profile honors semantic source precedence without overstating measurement confidence", () => {
  const user = buildGarmentColorProfile(
    item("user", "베이지", { userEditedClassificationFields: ["color"] })
  );
  const official = buildGarmentColorProfile(
    item("official", "블루", {
      confirmedProduct: {
        brand: "Example",
        productName: "Top",
        productColor: "Navy",
        confirmedAt: "2026-07-01T00:00:00.000Z",
      },
    })
  );
  const ai = buildGarmentColorProfile(
    item("ai", "레드", { confidence: { color: 90 } })
  );
  const legacy = buildGarmentColorProfile(item("legacy", "화이트"));
  assert.equal(user.source, "user_confirmed");
  assert.equal(official.source, "official_product");
  assert.equal(official.swatches[0].canonicalName, "네이비");
  assert.equal(ai.source, "ai_color_name");
  assert.equal(legacy.source, "legacy_color_name");
  assert.ok(user.confidence < 0.5);
  assert.equal(user.usedFallback, true);
});

test("explicit official sRGB hex stays higher confidence than named fallback", () => {
  const profile = buildGarmentColorProfile(
    item("official-hex", "블루", {
      confirmedProduct: {
        brand: "Example",
        productName: "Top",
        productColor: "#123ABC",
        confirmedAt: "2026-07-01T00:00:00.000Z",
      },
    })
  );
  assert.equal(profile.source, "official_product");
  assert.equal(profile.swatches[0].canonicalName, "#123ABC");
  assert.deepEqual(profile.swatches[0].srgb, { r: 18, g: 58, b: 188 });
  assert.equal(profile.confidence, 0.9);
  assert.equal(profile.usedFallback, false);
});

test("profile normalizes aliases, removes duplicates, and records assumptions", () => {
  const profile = buildGarmentColorProfile(item("multi", "블랙 / white / 검정"));
  assert.equal(profile.swatches.length, 2);
  closeTo(profile.swatches[0].proportion, 0.5, 1e-12, "first proportion");
  closeTo(profile.swatches[1].proportion, 0.5, 1e-12, "second proportion");
  closeTo(
    profile.swatches.reduce((sum, swatch) => sum + swatch.proportion, 0),
    1,
    1e-12,
    "proportion sum"
  );
  assert.equal(profile.diagnostics.assumedEqualProportions, true);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.swatches), true);
});

test("profile accepts runtime arrays and normalizes valid or invalid proportions", () => {
  const profile = buildGarmentColorProfile(
    item("array", ["블랙", "화이트"]),
    { proportions: [1, 3] }
  );
  assert.equal(profile.swatches[0].proportion, 0.25);
  assert.equal(profile.swatches[1].proportion, 0.75);
  assert.equal(profile.dominantSwatchId, profile.swatches[1].id);
  assert.equal(profile.diagnostics.assumedEqualProportions, false);
  assert.deepEqual(normalizeColorProportions([-1, Number.NaN], 2), {
    values: [0.5, 0.5],
    usedFallback: true,
  });
});

test("profile safely handles unresolved and empty colors", () => {
  const unresolved = buildGarmentColorProfile(item("unknown", "mystery / 블랙"));
  const empty = buildGarmentColorProfile(item("empty", undefined));
  assert.deepEqual(unresolved.diagnostics.unresolvedLabels, ["mystery"]);
  assert.equal(unresolved.swatches.length, 1);
  assert.equal(empty.source, "unknown");
  assert.equal(empty.swatches.length, 0);
  assert.equal(empty.confidence, 0);
  assert.equal(empty.averageLightness, undefined);
});

test("all-black and black-white outfits expose measured contrast features", () => {
  const allBlack = buildOutfitColorFeatures([
    item("black-a", "블랙"),
    item("black-b", "black", { category: "하의" }),
  ]);
  assert.equal(allBlack.pairwiseDeltaE00[0].deltaE00, 0);
  assert.equal(allBlack.achromaticRatio, 1);
  assert.ok(allBlack.possibleRelations.includes("achromatic"));
  assert.ok(allBlack.possibleRelations.includes("low-contrast"));

  const blackWhite = buildOutfitColorFeatures([
    item("black", "블랙"),
    item("white", "화이트", { category: "하의" }),
  ]);
  assert.ok(blackWhite.lightnessRange > 80);
  assert.ok(blackWhite.possibleRelations.includes("high-lightness-contrast"));
  assert.equal(blackWhite.dominantColorCount, 2);
});

test("named outfit examples remain measurements rather than quality judgments", () => {
  const navyBlack = buildOutfitColorFeatures([
    item("navy", "네이비"),
    item("black", "블랙", { category: "하의" }),
  ]);
  const beigeIvory = buildOutfitColorFeatures([
    item("beige", "베이지"),
    item("ivory", "아이보리", { category: "하의" }),
  ]);
  const redGreen = buildOutfitColorFeatures([
    item("red", "레드"),
    item("green", "그린", { category: "하의" }),
  ]);
  const blues = buildOutfitColorFeatures([
    item("blue", "블루"),
    item("sky", "스카이블루", { category: "하의" }),
  ]);
  assert.ok(Number.isFinite(navyBlack.meanDeltaE00));
  assert.ok(beigeIvory.pairwiseDeltaE00[0].hueDifference < 30);
  assert.ok(redGreen.pairwiseDeltaE00[0].deltaE00 > 40);
  assert.ok(blues.possibleRelations.includes("similar-hue"));
  assert.equal("score" in redGreen, false);
});

test("accent counts and fallback confidence are observable without scoring harmony", () => {
  const oneAccent = buildOutfitColorFeatures([
    item("gray", "그레이"),
    item("red", "레드", { category: "하의" }),
  ]);
  const manyAccents = buildOutfitColorFeatures([
    item("red", "레드"),
    item("green", "그린", { category: "하의" }),
    item("purple", "퍼플", { category: "신발" }),
  ]);
  assert.equal(oneAccent.accentCandidateCount, 1);
  assert.ok(manyAccents.accentCandidateCount >= 2);
  assert.equal(oneAccent.usedFallback, true);
  assert.ok(oneAccent.confidence < 0.5);
  assert.ok(oneAccent.warnings.includes("named-color-fallback"));
  assert.ok(oneAccent.warnings.includes("low-color-confidence"));
});

test("shadow mode is opt-in, scoreless, and does not mutate legacy input", () => {
  const legacy = { score: 14, maxScore: 20, appliedRuleIds: ["color.neutral"] };
  const guardedItem = item("guarded", "블랙");
  Object.defineProperty(guardedItem, "color", {
    get() {
      throw new Error("disabled shadow must not inspect color");
    },
  });
  const disabled = evaluateColorShadowComparison([guardedItem], legacy);
  assert.equal(disabled.mode, "legacy-only");
  assert.equal(disabled.professional, undefined);
  assert.deepEqual(legacy.appliedRuleIds, ["color.neutral"]);

  const enabled = evaluateColorShadowComparison(
    [item("top", "블랙"), item("bottom", "화이트", { category: "하의" })],
    legacy,
    { enabled: true }
  );
  assert.equal(enabled.mode, "shadow");
  assert.equal("score" in enabled.professional, false);
  assert.equal(enabled.scoreDifference, undefined);
  assert.equal(enabled.professional.features.itemCount, 2);
  assert.deepEqual(legacy.appliedRuleIds, ["color.neutral"]);
});
