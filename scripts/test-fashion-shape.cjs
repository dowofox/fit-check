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
  createShapeMeasurementValue,
  getCompatibleMeasurementDifference,
  getCompatibleRatio,
  getFlatWidthCircumferenceEase,
  parsePositiveMeasurement,
} = require("../utils/fashionCompatibility/shape/measurementSemantics.ts");
const {
  buildGarmentShapeProfile,
  getSelectedProductMeasurement,
} = require("../utils/fashionCompatibility/shape/shapeProfiles.ts");
const {
  buildOutfitShapeFeatures,
} = require("../utils/fashionCompatibility/shape/shapeFeatures.ts");
const {
  buildPersonalFitFeatures,
} = require("../utils/fashionCompatibility/shape/personalFitFeatures.ts");
const {
  evaluateShapeShadowComparison,
} = require("../utils/fashionCompatibility/shape/shapeShadowEvaluator.ts");

function item(id, category, overrides = {}) {
  return {
    id,
    imageUri: `file:///${id}.png`,
    category,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function withGuide(baseItem, size, measurements, unit = "cm") {
  return {
    ...baseItem,
    size,
    confirmedProduct: {
      brand: "Example",
      productName: "Example product",
      confirmedAt: "2026-07-01T00:00:00.000Z",
      productSizeGuide: {
        unit,
        sizes: [measurements],
      },
    },
  };
}

test("official selected-size measurements build upper and lower profiles", () => {
  const top = withGuide(item("top", "상의"), "L", {
    size: "L",
    totalLength: 70,
    shoulder: 48,
    chest: 56,
    sleeve: 61,
  });
  const bottom = withGuide(item("bottom", "하의"), "XL", {
    size: "XL",
    totalLength: 105,
    waist: 43,
    hip: 55,
    thigh: 34,
    rise: 31,
    hem: 24,
  });
  const topProfile = buildGarmentShapeProfile(top, { userHeightCm: 175 });
  const bottomProfile = buildGarmentShapeProfile(bottom);

  assert.equal(topProfile.source, "official_measurement");
  assert.equal(topProfile.measurements.chest.semantics, "flat_width");
  assert.equal(topProfile.measurements.shoulder.semantics, "linear_length");
  assert.equal(topProfile.derived.lengthToHeightRatio, 0.4);
  assert.equal(bottomProfile.measurements.waist.value, 43);
  assert.ok(bottomProfile.diagnostics.ambiguousMeasurementSemantics.includes("rise-subtype-unspecified"));
  assert.equal(Object.isFrozen(topProfile), true);
  assert.equal(Object.isFrozen(topProfile.measurements), true);
});

test("profile source precedence distinguishes image, style, text, and user labels", () => {
  const image = buildGarmentShapeProfile(item("image", "상의", {
    garmentProfile: {
      silhouette: "oversized",
      lengthBalance: "long",
      volume: 8,
      visualWeight: 7,
      pointLevel: 4,
      structure: "stiff",
      drape: "low",
    },
  }));
  const style = buildGarmentShapeProfile(item("style", "상의", {
    styleProfile: { silhouette: "semi oversized", lengthType: "regular" },
  }));
  const text = buildGarmentShapeProfile(item("text", "하의", {
    detailCategory: "와이드 팬츠",
  }));
  const user = buildGarmentShapeProfile(item("user", "상의", {
    garmentProfile: { silhouette: "slim" },
  }), { confirmedFitLabel: "세미 오버핏" });

  assert.equal(image.source, "image_impression");
  assert.equal(image.silhouetteClass, "oversized");
  assert.equal(image.structure, 8);
  assert.equal(style.source, "style_profile");
  assert.equal(style.silhouetteClass, "semi_oversized");
  assert.equal(text.source, "text_inference");
  assert.equal(text.silhouetteClass, "wide");
  assert.equal(user.source, "user_confirmed_label");
  assert.equal(user.silhouetteClass, "semi_oversized");
});

test("empty, invalid, conflicting, and unmatched inputs remain conservative", () => {
  const empty = buildGarmentShapeProfile(item("empty", "상의"));
  const invalid = withGuide(item("invalid", "상의"), "L", {
    size: "L",
    chest: Number.NaN,
    totalLength: Infinity,
  });
  const unmatched = withGuide(item("unmatched", "상의"), "M", {
    size: "L",
    chest: 55,
  });
  const conflict = buildGarmentShapeProfile(item("conflict", "상의", {
    detailCategory: "레귤러 셔츠",
    garmentProfile: { silhouette: "slim" },
    styleProfile: { silhouette: "wide" },
  }));

  assert.equal(empty.source, "unknown");
  assert.equal(empty.silhouetteClass, "unknown");
  assert.equal(buildGarmentShapeProfile(invalid).source, "unknown");
  assert.equal(getSelectedProductMeasurement(unmatched), undefined);
  assert.deepEqual(buildGarmentShapeProfile(unmatched).measurements, {});
  assert.ok(conflict.diagnostics.conflictingSources.includes("silhouette-source-conflict"));
});

test("measurements without a declared unit are not treated as centimeters", () => {
  const noUnit = {
    ...item("no-unit", "상의"),
    size: "L",
    confirmedProduct: {
      brand: "Example",
      productName: "Example product",
      confirmedAt: "2026-07-01T00:00:00.000Z",
      productSizeGuide: { sizes: [{ size: "L", chest: 55 }] },
    },
  };
  const profile = buildGarmentShapeProfile(noUnit);
  assert.equal(profile.measurements.chest, undefined);
  assert.ok(profile.diagnostics.ambiguousMeasurementSemantics.includes("product-size-guide-unit-unknown"));
});

test("measurement semantics allow only explicit compatible operations", () => {
  const flat = createShapeMeasurementValue(50, "flat_width", "official_product", 0.9);
  const circumference = createShapeMeasurementValue(96, "circumference", "user_confirmed", 0.9);
  const lengthA = createShapeMeasurementValue(72, "linear_length", "official_product", 0.9);
  const lengthB = createShapeMeasurementValue(70, "linear_length", "reference_clothing", 0.9);
  const unknown = createShapeMeasurementValue(10, "unknown", "text_inference", 0.2);

  assert.equal(getCompatibleMeasurementDifference(flat, circumference), undefined);
  assert.equal(getFlatWidthCircumferenceEase(flat, circumference), 4);
  assert.equal(getCompatibleMeasurementDifference(lengthA, lengthB), 2);
  assert.equal(getFlatWidthCircumferenceEase(lengthA, circumference), undefined);
  assert.equal(getCompatibleRatio(lengthA, lengthB), 72 / 70);
  assert.equal(unknown, undefined);
  assert.equal(parsePositiveMeasurement("170"), 170);
  assert.equal(parsePositiveMeasurement("170cm"), undefined);
  assert.equal(parsePositiveMeasurement("not-a-number"), undefined);
  assert.equal(parsePositiveMeasurement(Number.NaN), undefined);
});

function impression(id, category, silhouette, lengthBalance, volume, visualWeight, extras = {}) {
  return item(id, category, {
    garmentProfile: {
      silhouette,
      lengthBalance,
      volume,
      visualWeight,
      structure: "normal",
      drape: "medium",
      ...extras,
    },
  });
}

test("outfit features observe volume and length relations without quality scoring", () => {
  const croppedWide = buildOutfitShapeFeatures([
    impression("cropped", "상의", "cropped", "short", 4, 4),
    impression("wide", "하의", "wide", "long", 8, 6),
  ]);
  const regular = buildOutfitShapeFeatures([
    impression("regular-top", "상의", "regular", "regular", 4, 5),
    impression("regular-bottom", "하의", "regular", "regular", 4, 5),
  ]);
  const oversizedSlim = buildOutfitShapeFeatures([
    impression("oversized", "상의", "oversized", "long", 9, 8),
    impression("slim", "하의", "slim", "regular", 2, 3),
  ]);
  const longLong = buildOutfitShapeFeatures([
    impression("long-top", "상의", "long", "long", 6, 6),
    impression("long-bottom", "하의", "long", "long", 6, 6),
  ]);

  assert.equal(croppedWide.topBottomLengthRelation, "short-top-long-bottom");
  assert.ok(croppedWide.observedRelations.includes("short-top-long-bottom"));
  assert.ok(regular.observedRelations.includes("low-volume-difference"));
  assert.ok(oversizedSlim.observedRelations.includes("high-volume-difference"));
  assert.equal(oversizedSlim.visualWeightCenter, "upper");
  assert.ok(longLong.observedRelations.includes("long-top-long-bottom"));
  assert.equal("score" in croppedWide, false);
});

test("outfit features include outer layers and only measured shoe impressions", () => {
  const base = [
    impression("top", "상의", "regular", "regular", 4, 4),
    impression("bottom", "하의", "regular", "regular", 4, 4),
  ];
  const noOuter = buildOutfitShapeFeatures(base);
  const withOuter = buildOutfitShapeFeatures([
    ...base,
    impression("outer", "아우터", "oversized", "long", 8, 9),
    impression("shoe", "신발", "regular", "regular", 3, 7),
  ]);
  const unknownShoe = buildOutfitShapeFeatures([
    ...base,
    item("unknown-shoe", "신발"),
  ]);

  assert.equal(noOuter.layerCount, 1);
  assert.equal(withOuter.layerCount, 2);
  assert.ok(withOuter.outerDominance > 2);
  assert.ok(withOuter.observedRelations.includes("outer-dominant"));
  assert.equal(withOuter.lowerVisualWeight, 5.5);
  assert.equal(unknownShoe.lowerVisualWeight, 4);
});

test("personal fit uses explicit flat-width ease and long-sleeve semantics", () => {
  const top = withGuide(item("fit-top", "상의", {
    detailCategory: "긴팔 셔츠",
  }), "L", {
    size: "L",
    totalLength: 72,
    shoulder: 46,
    chest: 55,
    sleeve: 61,
  });
  const bottom = withGuide(item("fit-bottom", "하의"), "L", {
    size: "L",
    totalLength: 104,
    waist: 42,
    hip: 53,
  });
  const features = buildPersonalFitFeatures([top, bottom], {
    chestCircumference: "100",
    waistCircumference: "80",
    hipCircumference: "100",
    shoulderWidth: "44",
    armLength: "60",
    inseam: "78",
    preferredPantsTotalLength: 102,
  });

  assert.equal(features.chestEaseCm, 10);
  assert.equal(features.waistEaseCm, 4);
  assert.equal(features.hipEaseCm, 6);
  assert.equal(features.shoulderDifferenceCm, 2);
  assert.equal(features.sleeveDifferenceCm, 1);
  assert.equal(features.totalLengthDifferenceCm, 2);
  assert.equal(features.inseamDifferenceCm, undefined);
  assert.ok(features.unavailableReasons.includes("garment-inseam-unavailable"));
});

test("short sleeves do not compare against full arm length", () => {
  const top = withGuide(item("short-top", "상의", {
    detailCategory: "반팔 티셔츠",
  }), "M", {
    size: "M",
    chest: 52,
    sleeve: 22,
  });
  const features = buildPersonalFitFeatures([top], {
    chestCircumference: "96",
    armLength: "61",
  });
  assert.equal(features.sleeveDifferenceCm, undefined);
  assert.ok(!features.comparableMeasurements.includes("sleeve"));
});

test("personal fit compares only selected-size reference measurements", () => {
  const current = withGuide(item("current", "하의"), "L", {
    size: "L",
    totalLength: 104,
    waist: 42,
  });
  const reference = {
    ...withGuide(item("reference", "하의"), "L", {
      size: "L",
      totalLength: 102,
      waist: 41,
    }),
    confirmedProduct: {
      ...withGuide(item("reference-base", "하의"), "L", {
        size: "L",
        totalLength: 102,
        waist: 41,
      }).confirmedProduct,
      productSizeGuide: {
        unit: "cm",
        sizes: [
          { size: "M", totalLength: 98, waist: 38 },
          { size: "L", totalLength: 102, waist: 41 },
        ],
      },
    },
  };
  const features = buildPersonalFitFeatures([current], {
    referenceClothing: { bottomItemId: "reference" },
  }, { referenceItems: [reference] });

  assert.equal(features.referenceClothingDifferences["하의:totalLength"], 2);
  assert.equal(features.referenceClothingDifferences["하의:waist"], 1);
  assert.equal(features.usedFallback, true);
});

test("personal fit safely reports unavailable data and exposes no raw profile", () => {
  const features = buildPersonalFitFeatures([item("empty-fit", "상의")], undefined);
  assert.equal(features.confidence, 0);
  assert.ok(features.unavailableReasons.includes("user-profile-unavailable"));
  assert.equal("profile" in features, false);
  assert.equal("userMeasurements" in features, false);
});

test("shape shadow is disabled by default, scoreless, and opt-in", () => {
  const legacy = {
    silhouetteScore: 27,
    wearFitScore: 18,
    pointBalanceScore: 10,
    appliedRuleIds: ["shape.balance"],
  };
  const guardedItems = new Proxy([], {
    get() {
      throw new Error("disabled shadow must not inspect items");
    },
  });
  const guardedProfile = new Proxy({}, {
    get() {
      throw new Error("disabled shadow must not inspect profile");
    },
  });
  const disabled = evaluateShapeShadowComparison(guardedItems, guardedProfile, legacy);
  assert.equal(disabled.mode, "legacy-only");
  assert.equal(disabled.professional, undefined);
  assert.deepEqual(legacy.appliedRuleIds, ["shape.balance"]);

  const enabled = evaluateShapeShadowComparison([
    impression("shadow-top", "상의", "regular", "regular", 4, 4),
    impression("shadow-bottom", "하의", "wide", "long", 7, 6),
  ], {}, legacy, { enabled: true });
  assert.equal(enabled.mode, "shadow");
  assert.equal("score" in enabled.professional, false);
  assert.equal("scoreDifference" in enabled, false);
  assert.equal(enabled.professional.outfitFeatures.itemCount, 2);
  assert.deepEqual(legacy.appliedRuleIds, ["shape.balance"]);
});
