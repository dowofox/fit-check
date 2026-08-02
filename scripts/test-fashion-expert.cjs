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

test("rubric registry is complete, unique, and unvalidated", () => {
  assert.equal(new Set(EXPERT_RUBRIC_REGISTRY.map((entry) => entry.id)).size, 13);
  assert.deepEqual(EXPERT_RUBRIC_REGISTRY.map((entry) => entry.id), [...REQUIRED_EXPERT_DIMENSIONS]);
  assert.equal(new Set(EXPERT_EVIDENCE_CODES).size, EXPERT_EVIDENCE_CODES.length);
  for (const entry of EXPERT_RUBRIC_REGISTRY) {
    assert.equal(entry.version, "expert-rubric-draft-v0.2");
    assert.equal(entry.status, "draft");
    assert.deepEqual(entry.reviewedBy, []);
    assert.deepEqual(entry.sourceReferences, []);
    assert.deepEqual(Object.keys(entry.anchors), ["1", "2", "3", "4", "5"]);
    assert.ok(Object.values(entry.anchors).every((anchor) => anchor.trim().length > 0));
    assert.deepEqual(entry.anchors, EXPERT_DIMENSION_ANCHORS[entry.id]);
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
    rubricVersion: "expert-rubric-draft-v0.2",
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
  assert.deepEqual(validateAbsoluteRecordForTest(dataset.absoluteEvaluations[0], dataset.snapshots), []);
  const missing = clone(dataset.absoluteEvaluations[0]);
  missing.dimensions.pop();
  assert.ok(validateAbsoluteRecordForTest(missing, dataset.snapshots).some((entry) => entry.code === "missing_required_dimension"));
  const duplicateDimension = clone(dataset.absoluteEvaluations[0]);
  duplicateDimension.dimensions[1] = clone(duplicateDimension.dimensions[0]);
  assert.ok(validateAbsoluteRecordForTest(duplicateDimension, dataset.snapshots).some((entry) => entry.code === "duplicate_dimension"));
  const invalidRubric = { ...dataset.absoluteEvaluations[0], rubricVersion: "not-registered" };
  assert.ok(validateAbsoluteRecordForTest(invalidRubric, dataset.snapshots).some((entry) => entry.code === "unknown_rubric_version"));
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
  assert.equal(result.statistics.outfits, 4);
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
  assert.equal(silhouette.ratingCount, 2);
  assert.equal(silhouette.median, 3);
  assert.equal(silhouette.mean, 3);
  assert.equal(silhouette.disagreementSpan, 4);
  assert.equal(silhouette.consensusStatus, "low");
  const color = aggregateDimensionEvaluations(dataset.absoluteEvaluations, "color_harmony");
  assert.equal(color.ratingCount, 1);
  assert.equal(color.unavailableCount, 1);
  assert.equal(color.consensusStatus, "insufficient");
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
  assert.equal(report.counts.outfits, 4);
  assert.equal(report.coverageByDimension.color_harmony, 0.5);
  assert.equal(report.rubricVersion, "expert-rubric-draft-v0.2");
  assert.equal(report.pairwiseExcludedContextMismatchCount, 1);
  assert.equal(report.pairwiseExcludedUnknownContextCount, 1);
  assert.ok(report.materialEvidenceUsageCount >= 1);
  assert.deepEqual(report.highDisagreementOutfitIds, ["outfit-001"]);
  const markdown = renderExpertDatasetReportMarkdown(report);
  assert.match(markdown, /Dimension coverage/);
  assert.doesNotMatch(markdown, /Synthetic records for schema/);
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
  assert.equal(buildExpertBenchmarkCases(dataset).length, 4);
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
