const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
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

const {
  EXPERT_EVIDENCE_CODES,
  EXPERT_EVIDENCE_REGISTRY,
  EXPERT_DIMENSION_ANCHORS,
  EXPERT_RUBRIC_REGISTRY,
  REQUIRED_EXPERT_DIMENSIONS,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");
const {
  getStablePairKey,
  getContextFingerprint,
  getStablePairEvaluationKey,
  validateAbsoluteRecordForTest,
  validateDimensionRecordForTest,
  validateExpertEvaluationDataset,
  validatePairwiseRecordForTest,
} = require("../utils/fashionCompatibility/expert/evaluationValidation.ts");
const {
  aggregateDimensionEvaluations,
  calculateAgreementByDimension,
  calculatePairwiseAgreement,
} = require("../utils/fashionCompatibility/expert/agreementMetrics.ts");
const {
  createExpertDatasetReport,
  renderExpertDatasetReportMarkdown,
} = require("../utils/fashionCompatibility/expert/evaluationDataset.ts");
const {
  buildExpertBenchmarkCases,
  createExpertOutfitSnapshot,
} = require("../utils/fashionCompatibility/expert/benchmarkCases.ts");
const {
  evaluateExpertCompatibilityShadow,
} = require("../utils/fashionCompatibility/expert/expertShadowEvaluator.ts");

const fixturePath = path.join(__dirname, "fixtures", "fashion-expert-synthetic-valid.json");
const invalidFixturePath = path.join(__dirname, "fixtures", "fashion-expert-synthetic-invalid.json");
const readFixture = (filePath = fixturePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const OBSERVATION_SIGNALS = new Set([
  "image_available",
  "color_features_available",
  "shape_features_available",
  "material_context_available",
  "body_fit_context_available",
  "fit_preference_context_available",
  "exposure_preference_context_available",
]);

function makeAbsoluteEvaluation(dataset, dimension, availability = "rated", outfitId = dataset.snapshots[0].outfitId) {
  const evaluation = clone(dataset.absoluteEvaluations[0]);
  evaluation.evaluationId = `test-${dimension}`;
  evaluation.outfitId = outfitId;
  delete evaluation.overallCompatibility;
  evaluation.dimensions = REQUIRED_EXPERT_DIMENSIONS.map((candidate) =>
    candidate === dimension
      ? {
          dimension: candidate,
          availability,
          ...(availability === "rated" ? { rating: 3 } : {}),
          confidence: 3,
          supportingEvidenceCodes: availability === "rated" ? ["neutral_for_declared_intent"] : [],
          conflictingEvidenceCodes: availability === "rated" ? [] : ["insufficient_context"],
        }
      : {
          dimension: candidate,
          availability: "not_enough_information",
          confidence: 2,
          supportingEvidenceCodes: [],
          conflictingEvidenceCodes: ["insufficient_context"],
        }
  );
  return evaluation;
}

function setFeatureAvailability(snapshot, feature, available) {
  const key = `${feature}Features`;
  snapshot.inputAvailability[`${feature}FeaturesAvailable`] = available;
  if (!available) {
    delete snapshot[key];
    delete snapshot.featureVersions[`${feature}ProfileVersion`];
    delete snapshot.featureVersions[`${feature}FeatureVersion`];
  }
}

function makePairwiseEvaluation(dataset, dimension = "color_harmony", preferred = "a") {
  const evaluation = clone(dataset.pairwiseEvaluations[0]);
  evaluation.evaluationId = `test-pair-${dimension}`;
  evaluation.preferred = "not_comparable";
  evaluation.dimensions = [{
    dimension,
    preferred,
    confidence: 3,
    evidenceCodes: preferred === "not_comparable" ? ["insufficient_context"] : ["neutral_for_declared_intent"],
  }];
  return evaluation;
}

test("rubric registry is complete, unique, and unvalidated", () => {
  assert.equal(new Set(EXPERT_RUBRIC_REGISTRY.map((entry) => entry.id)).size, 13);
  assert.deepEqual(EXPERT_RUBRIC_REGISTRY.map((entry) => entry.id), [...REQUIRED_EXPERT_DIMENSIONS]);
  assert.equal(new Set(EXPERT_EVIDENCE_CODES).size, EXPERT_EVIDENCE_CODES.length);
  for (const entry of EXPERT_RUBRIC_REGISTRY) {
    assert.equal(entry.version, "expert-rubric-draft-v0.3");
    assert.equal(entry.status, "draft");
    assert.deepEqual(entry.reviewedBy, []);
    assert.deepEqual(entry.sourceReferences, []);
    assert.deepEqual(Object.keys(entry.anchors), ["1", "2", "3", "4", "5"]);
    assert.ok(Object.values(entry.anchors).every((anchor) => anchor.trim().length > 0));
    assert.deepEqual(entry.anchors, EXPERT_DIMENSION_ANCHORS[entry.id]);
    assert.ok(entry.observationRequirements.length > 0);
    for (const requirement of entry.observationRequirements) {
      assert.ok(["required", "recommended"].includes(requirement.policy));
      assert.ok(requirement.groups.length > 0);
      assert.ok(requirement.rationale.length > 0);
      for (const group of requirement.groups) {
        assert.ok(["any_of", "all_of"].includes(group.mode));
        assert.ok(group.signals.length > 0);
        assert.ok(group.signals.every((signal) => OBSERVATION_SIGNALS.has(signal)));
      }
    }
  }
  assert.equal(new Set(EXPERT_RUBRIC_REGISTRY.map((entry) => entry.anchors)).size, 13);
});

test("dimension validation separates unavailable responses from rating 3", () => {
  const rated = {
    dimension: "color_harmony",
    availability: "rated",
    rating: 3,
    confidence: 4,
    supportingEvidenceCodes: ["neutral_for_declared_intent"],
    conflictingEvidenceCodes: [],
  };
  assert.deepEqual(validateDimensionRecordForTest(rated), []);
  assert.ok(validateDimensionRecordForTest({ ...rated, rating: undefined }).some((entry) => entry.code === "missing_rating"));
  assert.ok(validateDimensionRecordForTest({ ...rated, availability: "abstained" }).some((entry) => entry.code === "unexpected_rating"));
  assert.ok(validateDimensionRecordForTest({ ...rated, confidence: 7 }).some((entry) => entry.code === "invalid_confidence"));
  assert.ok(validateDimensionRecordForTest({ ...rated, rating: 6 }).some((entry) => entry.code === "missing_rating"));
  assert.ok(validateDimensionRecordForTest({ ...rated, supportingEvidenceCodes: ["invented.rule"] }).some((entry) => entry.code === "unknown_evidence_code"));
});

test("evidence metadata keeps origins and neutral material observations explicit", () => {
  assert.equal(new Set(EXPERT_EVIDENCE_REGISTRY.map((entry) => entry.code)).size, EXPERT_EVIDENCE_REGISTRY.length);
  const material = EXPERT_EVIDENCE_REGISTRY.filter((entry) => entry.code.startsWith("material."));
  assert.ok(material.length >= 10);
  assert.ok(material.every((entry) => entry.origin === "human_observed_material"));
  assert.ok(material.every((entry) => entry.allowedDimensions.includes("material_compatibility")));
  assert.ok(material.every((entry) => !/(good|bad|harmony|conflict)/i.test(entry.code)));
  assert.ok(EXPERT_EVIDENCE_REGISTRY.filter((entry) => entry.code.startsWith("color.")).every((entry) => entry.origin === "derived_color_feature"));
  assert.ok(EXPERT_EVIDENCE_REGISTRY.filter((entry) => entry.code.startsWith("shape.")).every((entry) => entry.origin === "derived_shape_feature"));
  const weightDifference = EXPERT_EVIDENCE_REGISTRY.find((entry) => entry.code === "material.layering_weight_difference_observed");
  assert.equal(weightDifference.origin, "human_observed_material");
  assert.equal(weightDifference.polarity, "neutral_observation");
  assert.deepEqual(weightDifference.allowedDimensions, ["material_compatibility"]);
  assert.equal(EXPERT_EVIDENCE_REGISTRY.some((entry) => entry.code === "material.layering_weight_mismatch_observed"), false);
  const materialEvaluation = {
    dimension: "material_compatibility",
    availability: "rated",
    rating: 3,
    confidence: 3,
    supportingEvidenceCodes: ["material.layering_weight_difference_observed"],
    conflictingEvidenceCodes: [],
  };
  assert.deepEqual(validateDimensionRecordForTest(materialEvaluation), []);
  assert.ok(validateDimensionRecordForTest({ ...materialEvaluation, dimension: "color_harmony" }).some((entry) => entry.code === "unknown_evidence_code"));
  assert.ok(validateDimensionRecordForTest({ ...materialEvaluation, supportingEvidenceCodes: ["material.layering_weight_mismatch_observed"] }).some((entry) => entry.code === "unknown_evidence_code"));
});

test("absolute ratings enforce minimum observation inputs independently from evidence", () => {
  const dataset = readFixture();
  const imageSnapshot = clone(dataset.snapshots[0]);
  setFeatureAvailability(imageSnapshot, "color", false);
  setFeatureAvailability(imageSnapshot, "shape", false);
  imageSnapshot.inputAvailability.materialContextAvailable = false;

  for (const dimension of ["color_harmony", "silhouette_balance", "proportion_coherence", "material_compatibility"]) {
    const evaluation = makeAbsoluteEvaluation(dataset, dimension, "rated", imageSnapshot.outfitId);
    assert.equal(validateAbsoluteRecordForTest(evaluation, [imageSnapshot]).some((entry) => entry.code === "rated_without_observation_input"), false, dimension);
  }

  const featureSnapshot = clone(dataset.snapshots[4]);
  for (const dimension of ["color_harmony", "silhouette_balance", "proportion_coherence", "material_compatibility"]) {
    const evaluation = makeAbsoluteEvaluation(dataset, dimension, "rated", featureSnapshot.outfitId);
    assert.equal(validateAbsoluteRecordForTest(evaluation, [featureSnapshot]).some((entry) => entry.code === "rated_without_observation_input"), false, dimension);
  }

  const emptySnapshot = clone(featureSnapshot);
  setFeatureAvailability(emptySnapshot, "color", false);
  setFeatureAvailability(emptySnapshot, "shape", false);
  emptySnapshot.inputAvailability.materialContextAvailable = false;
  for (const dimension of ["color_harmony", "silhouette_balance", "proportion_coherence", "material_compatibility", "style_coherence", "occasion_suitability", "temperature_suitability", "rain_suitability", "wind_suitability", "season_suitability"]) {
    const evaluation = makeAbsoluteEvaluation(dataset, dimension, "rated", emptySnapshot.outfitId);
    assert.ok(validateAbsoluteRecordForTest(evaluation, [emptySnapshot]).some((entry) => entry.code === "rated_without_observation_input"), dimension);
  }

  const personalSnapshot = clone(featureSnapshot);
  personalSnapshot.context.bodyFitContext = "available";
  personalSnapshot.context.fitPreferenceContext = "available";
  personalSnapshot.context.exposurePreferenceContext = "available";
  personalSnapshot.inputAvailability.bodyFitContextAvailable = true;
  for (const dimension of ["body_fit_suitability", "fit_preference_suitability"]) {
    const evaluation = makeAbsoluteEvaluation(dataset, dimension, "rated", personalSnapshot.outfitId);
    assert.equal(validateAbsoluteRecordForTest(evaluation, [personalSnapshot]).some((entry) => entry.code === "rated_without_observation_input"), false, dimension);
  }
  assert.ok(validateAbsoluteRecordForTest(makeAbsoluteEvaluation(dataset, "exposure_preference_suitability", "rated", personalSnapshot.outfitId), [personalSnapshot]).some((entry) => entry.code === "rated_without_observation_input"));
  personalSnapshot.inputAvailability.imageAvailable = true;
  assert.equal(validateAbsoluteRecordForTest(makeAbsoluteEvaluation(dataset, "exposure_preference_suitability", "rated", personalSnapshot.outfitId), [personalSnapshot]).some((entry) => entry.code === "rated_without_observation_input"), false);

  const missingBody = clone(personalSnapshot);
  missingBody.context.bodyFitContext = "not_available";
  missingBody.inputAvailability.bodyFitContextAvailable = false;
  assert.ok(validateAbsoluteRecordForTest(makeAbsoluteEvaluation(dataset, "body_fit_suitability", "rated", missingBody.outfitId), [missingBody]).some((entry) => entry.code === "rated_without_observation_input"));
  const missingFitPreference = clone(personalSnapshot);
  missingFitPreference.context.fitPreferenceContext = "not_available";
  assert.ok(validateAbsoluteRecordForTest(makeAbsoluteEvaluation(dataset, "fit_preference_suitability", "rated", missingFitPreference.outfitId), [missingFitPreference]).some((entry) => entry.code === "rated_without_observation_input"));

  const unavailable = makeAbsoluteEvaluation(dataset, "style_coherence", "not_enough_information", emptySnapshot.outfitId);
  assert.equal(validateAbsoluteRecordForTest(unavailable, [emptySnapshot]).some((entry) => entry.code === "rated_without_observation_input"), false);
});

test("empty evidence warns but cannot bypass observation requirements", () => {
  const dataset = readFixture();
  const evaluation = makeAbsoluteEvaluation(dataset, "color_harmony");
  const color = evaluation.dimensions.find((entry) => entry.dimension === "color_harmony");
  color.supportingEvidenceCodes = [];
  const withInput = validateAbsoluteRecordForTest(evaluation, [dataset.snapshots[0]]);
  assert.ok(withInput.some((entry) => entry.code === "rated_without_structured_evidence" && entry.severity === "warning"));
  assert.equal(withInput.some((entry) => entry.code === "rated_without_observation_input"), false);

  const withoutInput = clone(dataset.snapshots[4]);
  setFeatureAvailability(withoutInput, "color", false);
  evaluation.outfitId = withoutInput.outfitId;
  const withoutInputIssues = validateAbsoluteRecordForTest(evaluation, [withoutInput]);
  assert.equal(withoutInputIssues.filter((entry) => entry.code === "rated_without_observation_input").length, 1);
  assert.equal(withoutInputIssues.filter((entry) => entry.code === "rated_without_structured_evidence").length, 1);
});

test("overall compatibility requires an image only when rated", () => {
  const dataset = readFixture();
  const evaluation = clone(dataset.absoluteEvaluations[0]);
  const snapshot = clone(dataset.snapshots[0]);
  snapshot.inputAvailability.imageAvailable = false;
  assert.ok(validateAbsoluteRecordForTest(evaluation, [snapshot]).some((entry) => entry.code === "rated_without_observation_input" && entry.path.endsWith("overallCompatibility")));
  evaluation.overallCompatibility.availability = "not_enough_information";
  delete evaluation.overallCompatibility.rating;
  assert.equal(validateAbsoluteRecordForTest(evaluation, [snapshot]).some((entry) => entry.code === "rated_without_observation_input" && entry.path.endsWith("overallCompatibility")), false);
  delete evaluation.overallCompatibility;
  assert.equal(validateAbsoluteRecordForTest(evaluation, [snapshot]).some((entry) => entry.path.endsWith("overallCompatibility")), false);
});

test("pairwise dimension observation inputs are checked for A and B independently", () => {
  const dataset = readFixture();
  const baseA = clone(dataset.snapshots[0]);
  const baseB = clone(dataset.snapshots[1]);
  const evaluation = makePairwiseEvaluation(dataset);
  const baseIssues = validatePairwiseRecordForTest(evaluation, [baseA, baseB]);
  assert.equal(baseIssues.some((entry) => entry.code === "pairwise_dimension_without_observation_input"), false);
  assert.ok(baseIssues.some((entry) => entry.code === "dimension_preference_with_not_comparable_overall"));

  const missingA = clone(baseA);
  missingA.inputAvailability.imageAvailable = false;
  setFeatureAvailability(missingA, "color", false);
  let issues = validatePairwiseRecordForTest(evaluation, [missingA, baseB]);
  assert.equal(issues.filter((entry) => entry.code === "pairwise_dimension_without_observation_input").length, 1);
  assert.match(issues.find((entry) => entry.code === "pairwise_dimension_without_observation_input").message, /outfit A/);

  const missingB = clone(baseB);
  missingB.inputAvailability.imageAvailable = false;
  issues = validatePairwiseRecordForTest(evaluation, [baseA, missingB]);
  assert.equal(issues.filter((entry) => entry.code === "pairwise_dimension_without_observation_input").length, 1);
  assert.match(issues.find((entry) => entry.code === "pairwise_dimension_without_observation_input").message, /outfit B/);

  issues = validatePairwiseRecordForTest(evaluation, [missingA, missingB]);
  assert.equal(issues.filter((entry) => entry.code === "pairwise_dimension_without_observation_input").length, 2);

  const tie = clone(evaluation);
  tie.dimensions[0].preferred = "tie";
  assert.equal(validatePairwiseRecordForTest(tie, [missingA, baseB]).filter((entry) => entry.code === "pairwise_dimension_without_observation_input").length, 1);
  const notComparable = clone(evaluation);
  notComparable.dimensions[0].preferred = "not_comparable";
  assert.equal(validatePairwiseRecordForTest(notComparable, [missingA, missingB]).some((entry) => entry.code === "pairwise_dimension_without_observation_input"), false);

  const colorA = clone(dataset.snapshots[0]);
  const colorB = clone(dataset.snapshots[0]);
  colorB.outfitId = "outfit-002";
  colorA.inputAvailability.imageAvailable = false;
  colorB.inputAvailability.imageAvailable = false;
  assert.equal(validatePairwiseRecordForTest(evaluation, [colorA, colorB]).some((entry) => entry.code === "pairwise_dimension_without_observation_input"), false);

  const shapeEvaluation = makePairwiseEvaluation(dataset, "silhouette_balance");
  const shapeA = clone(colorA);
  const shapeB = clone(colorB);
  setFeatureAvailability(shapeA, "color", false);
  setFeatureAvailability(shapeB, "color", false);
  assert.equal(validatePairwiseRecordForTest(shapeEvaluation, [shapeA, shapeB]).some((entry) => entry.code === "pairwise_dimension_without_observation_input"), false);
});

test("pairwise overall preference requires images for both outfits", () => {
  const dataset = readFixture();
  const pair = clone(dataset.pairwiseEvaluations[0]);
  pair.dimensions = [];
  const snapshotA = clone(dataset.snapshots[0]);
  const snapshotB = clone(dataset.snapshots[1]);
  for (const preferred of ["a", "b", "tie"]) {
    pair.preferred = preferred;
    assert.equal(validatePairwiseRecordForTest(pair, [snapshotA, snapshotB]).some((entry) => entry.code === "pairwise_preference_without_observation_input"), false, preferred);
  }

  snapshotA.inputAvailability.imageAvailable = false;
  pair.preferred = "a";
  assert.equal(validatePairwiseRecordForTest(pair, [snapshotA, snapshotB]).filter((entry) => entry.code === "pairwise_preference_without_observation_input").length, 1);
  snapshotB.inputAvailability.imageAvailable = false;
  assert.equal(validatePairwiseRecordForTest(pair, [snapshotA, snapshotB]).filter((entry) => entry.code === "pairwise_preference_without_observation_input").length, 2);
  pair.preferred = "not_comparable";
  assert.equal(validatePairwiseRecordForTest(pair, [snapshotA, snapshotB]).some((entry) => entry.code === "pairwise_preference_without_observation_input"), false);
});

test("required context blocks ratings while recommended context warns", () => {
  const dataset = readFixture();
  const evaluation = clone(dataset.absoluteEvaluations[0]);
  const snapshot = clone(dataset.snapshots[0]);
  snapshot.context.occasion = "unknown";
  assert.ok(validateAbsoluteRecordForTest(evaluation, [snapshot]).some((entry) => entry.code === "rated_without_required_context"));

  const temperatureSnapshot = clone(dataset.snapshots[0]);
  delete temperatureSnapshot.context.temperatureContext;
  assert.ok(validateAbsoluteRecordForTest(evaluation, [temperatureSnapshot]).some((entry) => entry.path.includes("temperature_suitability") || entry.code === "rated_without_required_context"));

  const rainEvaluation = clone(evaluation);
  const rain = rainEvaluation.dimensions.find((entry) => entry.dimension === "rain_suitability");
  rain.availability = "rated";
  rain.rating = 3;
  const rainSnapshot = clone(dataset.snapshots[0]);
  rainSnapshot.context.weatherContext.rain = "unknown";
  assert.ok(validateAbsoluteRecordForTest(rainEvaluation, [rainSnapshot]).some((entry) => entry.code === "rated_without_required_context"));

  const fitEvaluation = clone(evaluation);
  const fit = fitEvaluation.dimensions.find((entry) => entry.dimension === "fit_preference_suitability");
  fit.availability = "rated";
  fit.rating = 3;
  assert.ok(validateAbsoluteRecordForTest(fitEvaluation, [snapshot]).some((entry) => entry.code === "rated_without_required_context"));

  const unavailable = clone(evaluation);
  const occasion = unavailable.dimensions.find((entry) => entry.dimension === "occasion_suitability");
  occasion.availability = "not_enough_information";
  delete occasion.rating;
  assert.equal(validateAbsoluteRecordForTest(unavailable, [snapshot]).some((entry) => entry.code === "rated_without_required_context" && entry.path.includes("occasion_suitability")), false);

  const recommendedSnapshot = clone(dataset.snapshots[0]);
  recommendedSnapshot.context.styleIntent = "unknown";
  assert.ok(validateAbsoluteRecordForTest(evaluation, [recommendedSnapshot]).some((entry) => entry.code === "rated_without_recommended_context"));
});

test("context fingerprints and pair evaluation keys are canonical", () => {
  const context = readFixture().snapshots[0].context;
  const reordered = {
    weatherContext: { wind: context.weatherContext.wind, rain: context.weatherContext.rain },
    stylingState: {
      closureState: context.stylingState.closureState,
      outerWorn: context.stylingState.outerWorn,
      topTucked: context.stylingState.topTucked,
    },
    exposurePreferenceContext: context.exposurePreferenceContext,
    fitPreferenceContext: context.fitPreferenceContext,
    bodyFitContext: context.bodyFitContext,
    temperatureContext: context.temperatureContext,
    season: context.season,
    occasion: context.occasion,
    styleIntent: context.styleIntent,
  };
  assert.equal(getContextFingerprint(context), getContextFingerprint(reordered));
  const base = {
    outfitIdA: "outfit-a",
    outfitIdB: "outfit-b",
    rubricVersion: "expert-rubric-draft-v0.3",
    contextFingerprint: getContextFingerprint(context),
  };
  assert.equal(getStablePairEvaluationKey(base), getStablePairEvaluationKey({ ...base, outfitIdA: "outfit-b", outfitIdB: "outfit-a" }));
  assert.notEqual(getStablePairEvaluationKey(base), getStablePairEvaluationKey({ ...base, rubricVersion: "expert-rubric-draft-v0.1" }));
  assert.notEqual(getStablePairEvaluationKey(base), getStablePairEvaluationKey({ ...base, contextFingerprint: getContextFingerprint({ ...context, occasion: "date" }) }));
  assert.notEqual(getStablePairEvaluationKey(base), getStablePairEvaluationKey({ ...base, contextFingerprint: getContextFingerprint({ ...context, styleIntent: "formal" }) }));
});

test("derived evidence requires matching features while human observations remain valid", () => {
  const dataset = readFixture();
  const evaluation = clone(dataset.absoluteEvaluations[0]);
  evaluation.outfitId = "outfit-002";
  evaluation.dimensions.forEach((entry) => {
    entry.supportingEvidenceCodes = [];
    entry.conflictingEvidenceCodes = [];
  });
  evaluation.dimensions.find((entry) => entry.dimension === "color_harmony").supportingEvidenceCodes = ["color.similar_hue"];
  assert.ok(validateAbsoluteRecordForTest(evaluation, [dataset.snapshots[1]]).some((entry) => entry.code === "evidence_without_feature"));

  evaluation.dimensions.find((entry) => entry.dimension === "color_harmony").supportingEvidenceCodes = [];
  evaluation.dimensions.find((entry) => entry.dimension === "silhouette_balance").supportingEvidenceCodes = ["shape.upper_visual_weight"];
  assert.ok(validateAbsoluteRecordForTest(evaluation, [dataset.snapshots[1]]).some((entry) => entry.code === "evidence_without_feature"));

  evaluation.dimensions.find((entry) => entry.dimension === "silhouette_balance").supportingEvidenceCodes = [];
  evaluation.dimensions.find((entry) => entry.dimension === "material_compatibility").supportingEvidenceCodes = ["material.mixed_surface"];
  assert.equal(validateAbsoluteRecordForTest(evaluation, [dataset.snapshots[1]]).some((entry) => entry.code === "evidence_without_feature"), false);
  const noObservationInput = clone(dataset.snapshots[1]);
  noObservationInput.inputAvailability.imageAvailable = false;
  noObservationInput.inputAvailability.materialContextAvailable = false;
  assert.ok(validateAbsoluteRecordForTest(evaluation, [noObservationInput]).some((entry) => entry.code === "evidence_without_observation_input"));
  assert.ok(validateDimensionRecordForTest({
    dimension: "color_harmony",
    availability: "rated",
    rating: 3,
    confidence: 3,
    supportingEvidenceCodes: ["material.mixed_surface"],
    conflictingEvidenceCodes: [],
  }).some((entry) => entry.code === "unknown_evidence_code"));
});

test("absolute and pairwise records enforce completeness and stable pairs", () => {
  const dataset = readFixture();
  const baseIssues = validateAbsoluteRecordForTest(dataset.absoluteEvaluations[0], dataset.snapshots);
  assert.equal(baseIssues.some((entry) => entry.severity === "error"), false);
  assert.deepEqual(baseIssues.map((entry) => entry.code), ["rated_without_structured_evidence"]);
  const missing = clone(dataset.absoluteEvaluations[0]);
  missing.dimensions.pop();
  assert.ok(validateAbsoluteRecordForTest(missing, dataset.snapshots).some((entry) => entry.code === "missing_required_dimension"));
  const duplicateDimension = clone(dataset.absoluteEvaluations[0]);
  duplicateDimension.dimensions[1] = clone(duplicateDimension.dimensions[0]);
  assert.ok(validateAbsoluteRecordForTest(duplicateDimension, dataset.snapshots).some((entry) => entry.code === "duplicate_dimension"));
  const invalidRubric = { ...dataset.absoluteEvaluations[0], rubricVersion: "not-registered" };
  assert.ok(validateAbsoluteRecordForTest(invalidRubric, dataset.snapshots).some((entry) => entry.code === "unknown_rubric_version"));
  const previousRubric = { ...dataset.absoluteEvaluations[0], rubricVersion: "expert-rubric-draft-v0.2" };
  assert.ok(validateAbsoluteRecordForTest(previousRubric, dataset.snapshots).some((entry) => entry.code === "unknown_rubric_version"));
  const invalidEvaluator = { ...dataset.absoluteEvaluations[0], evaluatorId: "" };
  assert.ok(validateAbsoluteRecordForTest(invalidEvaluator, dataset.snapshots).some((entry) => entry.code === "invalid_id"));
  assert.equal(getStablePairKey("outfit-001", "outfit-002"), getStablePairKey("outfit-002", "outfit-001"));
  assert.ok(validatePairwiseRecordForTest({ ...dataset.pairwiseEvaluations[0], outfitIdB: "outfit-001" }, dataset.snapshots).some((entry) => entry.code === "same_pair_outfit"));
  assert.equal(validatePairwiseRecordForTest(dataset.pairwiseEvaluations[2], dataset.snapshots).some((entry) => entry.code === "pair_context_mismatch"), true);
  const falseSameContext = { ...dataset.pairwiseEvaluations[0], outfitIdB: "outfit-003" };
  assert.ok(validatePairwiseRecordForTest(falseSameContext, dataset.snapshots).some((entry) => entry.severity === "error" && entry.code === "pair_context_mismatch"));
  const falseDifferentContext = { ...dataset.pairwiseEvaluations[0], contextCompatibility: "different_context" };
  assert.ok(validatePairwiseRecordForTest(falseDifferentContext, dataset.snapshots).some((entry) => entry.code === "pair_context_declared_different_but_equal"));
  assert.equal(dataset.pairwiseEvaluations[2].preferred, "tie");
  assert.equal(dataset.pairwiseEvaluations[3].preferred, "not_comparable");
});

test("synthetic dataset validates while preserving warnings and disagreement", () => {
  const result = validateExpertEvaluationDataset(readFixture());
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((entry) => entry.code === "pair_context_mismatch"));
  assert.ok(result.warnings.some((entry) => entry.code === "rated_without_structured_evidence"));
  assert.equal(result.statistics.outfits, 5);
  assert.equal(result.statistics.evaluators, 3);
});

test("snapshot validation aligns payloads, versions, and declared availability", () => {
  const personalVersion = readFixture();
  personalVersion.snapshots[0].featureVersions.personalFitFeatureVersion = "personal-fit-features-v1";
  assert.ok(validateExpertEvaluationDataset(personalVersion).errors.some((entry) => entry.code === "personal_fit_version_without_feature"));

  const missingColorPayload = readFixture();
  delete missingColorPayload.snapshots[0].colorFeatures;
  assert.ok(validateExpertEvaluationDataset(missingColorPayload).errors.some((entry) => entry.code === "feature_version_payload_mismatch"));
  assert.ok(validateExpertEvaluationDataset(missingColorPayload).errors.some((entry) => entry.code === "input_availability_mismatch"));
});

test("dataset validation catches duplicates, leakage, and source contradictions", () => {
  const duplicate = readFixture();
  duplicate.absoluteEvaluations.push(clone(duplicate.absoluteEvaluations[0]));
  const duplicateResult = validateExpertEvaluationDataset(duplicate);
  assert.ok(duplicateResult.errors.some((entry) => entry.code === "duplicate_evaluation_id"));
  assert.ok(duplicateResult.errors.some((entry) => entry.code === "duplicate_evaluator_outfit"));

  const leakage = readFixture();
  leakage.absoluteEvaluations[1].datasetSplit = "test";
  assert.ok(validateExpertEvaluationDataset(leakage).errors.some((entry) => entry.code === "dataset_split_leakage"));

  const credentials = readFixture();
  credentials.absoluteEvaluations[0].evaluatorGroup = "stylist";
  assert.ok(validateExpertEvaluationDataset(credentials).errors.some((entry) => entry.code === "synthetic_expert_claim"));

  const reversedPair = readFixture();
  const duplicatePair = clone(reversedPair.pairwiseEvaluations[0]);
  duplicatePair.evaluationId = "pairwise-duplicate";
  duplicatePair.outfitIdA = reversedPair.pairwiseEvaluations[0].outfitIdB;
  duplicatePair.outfitIdB = reversedPair.pairwiseEvaluations[0].outfitIdA;
  reversedPair.pairwiseEvaluations.push(duplicatePair);
  assert.ok(validateExpertEvaluationDataset(reversedPair).errors.some((entry) => entry.code === "duplicate_pairwise_evaluation"));
});

test("privacy scanner blocks prohibited fields, URLs, paths, email, and raw measurements", () => {
  const invalid = validateExpertEvaluationDataset(readFixture(invalidFixturePath));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((entry) => entry.code === "prohibited_private_field"));
  assert.ok(invalid.errors.some((entry) => entry.code === "unknown_rubric_version"));
  assert.ok(invalid.errors.some((entry) => entry.code === "rated_without_observation_input"));
  assert.ok(invalid.errors.some((entry) => entry.code === "pairwise_dimension_without_observation_input"));
  assert.ok(invalid.errors.some((entry) => entry.code === "pairwise_preference_without_observation_input"));
  assert.ok(invalid.errors.some((entry) => entry.code === "unknown_evidence_code" && entry.path.includes("dimensions[3]")));

  const samples = [
    ["https://example.test/look", "url_detected"],
    ["file:///tmp/look.png", "file_uri_detected"],
    ["C:\\Users\\person\\look.png", "windows_path_detected"],
    ["/home/person/look.png", "unix_path_detected"],
    ["person@example.test", "email_detected"],
  ];
  for (const [value, code] of samples) {
    const dataset = readFixture();
    dataset.metadata.notes = value;
    assert.ok(validateExpertEvaluationDataset(dataset).errors.some((entry) => entry.code === code), code);
  }
  const measurement = readFixture();
  measurement.waistCircumference = 80;
  assert.ok(validateExpertEvaluationDataset(measurement).errors.some((entry) => entry.code === "prohibited_private_field"));
  const imageField = readFixture();
  imageField.snapshots[0].imageUri = "local-look.png";
  assert.ok(validateExpertEvaluationDataset(imageField).errors.some((entry) => entry.code === "prohibited_private_field"));
  const htmlNotes = readFixture();
  htmlNotes.metadata.notes = "<script>alert('x')</script>";
  assert.ok(validateExpertEvaluationDataset(htmlNotes).errors.some((entry) => entry.code === "unsafe_notes"));
});

test("aggregation keeps ordinal median, unavailable count, and disagreement", () => {
  const dataset = readFixture();
  const silhouette = aggregateDimensionEvaluations(dataset.absoluteEvaluations, "silhouette_balance");
  assert.equal(silhouette.ratingCount, 3);
  assert.equal(silhouette.median, 4);
  assert.equal(silhouette.mean, 10 / 3);
  assert.equal(silhouette.disagreementSpan, 4);
  assert.equal(silhouette.consensusStatus, "low");
  const color = aggregateDimensionEvaluations(dataset.absoluteEvaluations, "color_harmony");
  assert.equal(color.ratingCount, 2);
  assert.equal(color.unavailableCount, 1);
  assert.equal(color.consensusStatus, "moderate");
});

test("agreement metrics handle exact, adjacent, missing, ties, and not comparable", () => {
  const dataset = readFixture();
  const agreement = calculateAgreementByDimension(dataset.absoluteEvaluations);
  assert.equal(agreement.silhouette_balance.exactAgreement, 0);
  assert.equal(agreement.silhouette_balance.adjacentAgreement, 0);
  assert.equal(agreement.silhouette_balance.meanAbsoluteDifference, 4);
  assert.equal(agreement.color_harmony.comparisonCount, 0);
  const pairwise = calculatePairwiseAgreement(dataset.pairwiseEvaluations, dataset.snapshots);
  assert.equal(pairwise.agreement, 1);
  assert.equal(pairwise.tieRate, 0.25);
  assert.equal(pairwise.notComparableRate, 0.25);
  assert.equal(pairwise.excludedContextMismatchCount, 1);
  assert.equal(pairwise.excludedUnknownContextCount, 1);
});

test("dataset report omits raw notes and surfaces coverage and disagreement", () => {
  const report = createExpertDatasetReport(readFixture());
  assert.equal(report.counts.outfits, 5);
  assert.equal(report.coverageByDimension.color_harmony, 2 / 3);
  assert.equal(report.rubricVersion, "expert-rubric-draft-v0.3");
  assert.equal(report.pairwiseExcludedContextMismatchCount, 1);
  assert.equal(report.pairwiseExcludedUnknownContextCount, 1);
  assert.ok(report.materialEvidenceUsageCount >= 1);
  assert.equal(report.ratedWithoutObservationInputCount, 0);
  assert.equal(report.pairwiseDimensionWithoutObservationInputCount, 0);
  assert.equal(report.pairwiseOverallWithoutObservationInputCount, 0);
  assert.equal(report.ratedWithoutStructuredEvidenceCount, 1);
  assert.deepEqual(report.highDisagreementOutfitIds, ["outfit-001"]);
  const markdown = renderExpertDatasetReportMarkdown(report);
  assert.match(markdown, /Dimension coverage/);
  assert.match(markdown, /Rated without observation input: 0/);
  assert.match(markdown, /Rated without structured evidence: 1/);
  assert.doesNotMatch(markdown, /Synthetic records for schema/);

  const invalidReport = createExpertDatasetReport(readFixture(invalidFixturePath));
  assert.ok(invalidReport.ratedWithoutObservationInputCount >= 1);
  assert.ok(invalidReport.pairwiseDimensionWithoutObservationInputCount >= 1);
  assert.ok(invalidReport.pairwiseOverallWithoutObservationInputCount >= 1);
  assert.ok(invalidReport.ratedWithoutStructuredEvidenceCount >= 1);
});

test("snapshot adapter requires anonymization and strips private item fields", () => {
  const context = {
    styleIntent: "minimal",
    occasion: "daily",
    bodyFitContext: "not_available",
    fitPreferenceContext: "not_available",
    exposurePreferenceContext: "not_available",
    stylingState: { topTucked: "unknown", outerWorn: "no", closureState: "unknown" },
  };
  const items = [
    {
      id: "private-top-id",
      imageUri: "file:///private/top.png",
      category: "상의",
      detailCategory: "private product name",
      brand: "private brand",
      color: "블랙",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "private-bottom-id",
      imageUri: "https://example.test/private.png",
      category: "하의",
      color: "화이트",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
  ];
  assert.throws(() => createExpertOutfitSnapshot({ outfitId: "snapshot-001", items, context }), /anonymization/);
  assert.throws(() => createExpertOutfitSnapshot({ outfitId: "snapshot-001", items, context, anonymizeItemId: (id) => id }), /source item ID/);
  const snapshot = createExpertOutfitSnapshot({
    outfitId: "snapshot-001",
    items,
    context,
    anonymizeItemId: (id) => `anon-${id === "private-top-id" ? "1" : "2"}`,
    includeColorFeatures: true,
    includeShapeFeatures: true,
    inputAvailability: {
      imageAvailable: true,
      colorFeaturesAvailable: true,
      shapeFeaturesAvailable: true,
      materialContextAvailable: false,
      bodyFitContextAvailable: false,
    },
    createdAt: "2026-07-01T00:00:00.000Z",
  });
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /private-top-id|private-bottom-id|private product name|private brand|file:\/\/|https:\/\//);
  assert.equal(snapshot.featureVersions.colorFeatureVersion, "color-features-v1");
  assert.equal(snapshot.featureVersions.shapeFeatureVersion, "shape-features-v1");
  assert.equal("personalFitFeatureVersion" in snapshot.featureVersions, false);
  assert.equal("height" in snapshot, false);
  assert.equal("userProfile" in snapshot, false);
  assert.equal("professionalScore" in snapshot, false);
});

test("benchmark and shadow paths remain explicit and scoreless", () => {
  const dataset = readFixture();
  assert.equal(buildExpertBenchmarkCases(dataset).length, 5);
  const legacy = { totalScore: 70, colorScore: 15, silhouetteScore: 20, wearFitScore: 15 };
  const legacyOnly = evaluateExpertCompatibilityShadow({ legacy });
  assert.equal(legacyOnly.mode, "legacy-only");
  assert.equal(legacyOnly.featureSnapshot, undefined);
  assert.equal(legacyOnly.professionalScore, undefined);
  const compared = evaluateExpertCompatibilityShadow({
    mode: "expert-label-comparison",
    legacy,
    featureSnapshot: dataset.snapshots[0],
    expertEvaluations: dataset.absoluteEvaluations,
  });
  assert.equal(compared.expertLabels.evaluationCount, 2);
  assert.equal(compared.professionalScore, undefined);
  assert.equal(compared.scoreDifference, undefined);
});
