const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { readJson } = require("./run-fashion-expert-pilot.cjs");
const { canonicalJson } = require("./fashion-expert-pilot-provenance.cjs");
const {
  READINESS_CHECK_IDS,
  READINESS_SCHEMA_VERSION,
} = require("./fashion-expert-pilot-readiness.cjs");
const {
  REQUIRED_EXPERT_DIMENSIONS,
} = require("../utils/fashionCompatibility/expert/rubricRegistry.ts");

const REVIEW_PACKET_SCHEMA_VERSION = "expert-pilot-calibration-review-packet-v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REVIEW_CHECKLIST = Object.freeze([
  "Review dimensions in the provided coverage order.",
  "Resolve high-disagreement outfits without changing source evaluations.",
  "Record calibration decisions outside this packet.",
  "Do not treat this packet as expert validation or production approval.",
]);

function fail(message) {
  throw new Error(message);
}

function digest(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertRate(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(`${label} must be a rate between 0 and 1.`);
  }
}

function assertOptionalRate(value, label) {
  if (value !== undefined) assertRate(value, label);
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${label} must be a non-negative integer.`);
  }
}

function validateReadinessForReview(readiness) {
  if (!isRecord(readiness)) fail("Readiness result must be an object.");
  if (readiness.schemaVersion !== READINESS_SCHEMA_VERSION) {
    fail("Readiness result uses an unsupported schema.");
  }
  if (
    readiness.ready !== true ||
    readiness.status !== "ready_for_calibration_review" ||
    readiness.decisionScope !== "calibration_review_only" ||
    readiness.expertValidated !== false ||
    readiness.productionEligible !== false
  ) {
    fail("Readiness result is not eligible for calibration review.");
  }
  for (const key of [
    "batchFingerprintSha256",
    "assignmentDigestSha256",
    "mergedDatasetDigestSha256",
  ]) {
    if (!SHA256_PATTERN.test(readiness[key] || "")) fail(`Readiness ${key} is invalid.`);
  }
  if (!Array.isArray(readiness.checks) || !readiness.checks.length) {
    fail("Readiness checks are missing.");
  }
  readiness.checks.forEach((check) => {
    if (!isRecord(check) || typeof check.id !== "string" || check.passed !== true) {
      fail("Every readiness check must have passed.");
    }
  });
  if (
    canonicalJson(readiness.checks.map((check) => check.id).sort()) !==
    canonicalJson([...READINESS_CHECK_IDS].sort())
  ) {
    fail("Readiness checks do not match the required gate checks.");
  }
  if (!isRecord(readiness.counts) || !isRecord(readiness.diagnostics)) {
    fail("Readiness counts or diagnostics are missing.");
  }
  if (readiness.counts.validationErrors !== 0) {
    fail("Readiness result contains validation errors.");
  }
  if (
    readiness.counts.actualAssignedEvaluations !==
    readiness.counts.expectedAssignedEvaluations
  ) {
    fail("Assigned evaluation coverage is incomplete.");
  }
  const diagnostics = readiness.diagnostics;
  for (const key of [
    "coverageByDimension",
    "unavailableRateByDimension",
    "confidenceByDimension",
    "agreementByDimension",
  ]) {
    if (!isRecord(diagnostics[key])) fail(`Readiness ${key} is missing.`);
  }
  if (!Array.isArray(diagnostics.highDisagreementOutfitIds)) {
    fail("Readiness high-disagreement outfits are invalid.");
  }
  const dimensions = [...REQUIRED_EXPERT_DIMENSIONS].sort();
  for (const key of [
    "coverageByDimension",
    "unavailableRateByDimension",
    "confidenceByDimension",
    "agreementByDimension",
  ]) {
    if (canonicalJson(Object.keys(diagnostics[key]).sort()) !== canonicalJson(dimensions)) {
      fail(`Readiness ${key} dimensions do not match the rubric.`);
    }
  }
  dimensions.forEach((dimension) => {
    assertRate(diagnostics.coverageByDimension[dimension], `${dimension} coverage`);
    assertRate(diagnostics.unavailableRateByDimension[dimension], `${dimension} unavailable rate`);
    const confidence = diagnostics.confidenceByDimension[dimension];
    if (
      typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 5
    ) {
      fail(`${dimension} confidence is invalid.`);
    }
    const agreement = diagnostics.agreementByDimension[dimension];
    if (!isRecord(agreement)) {
      fail(`${dimension} agreement is missing.`);
    }
    assertNonNegativeInteger(agreement.responseCount, `${dimension} response count`);
    assertNonNegativeInteger(agreement.comparisonCount, `${dimension} comparison count`);
    assertOptionalRate(agreement.exactAgreement, `${dimension} exact agreement`);
    assertOptionalRate(agreement.adjacentAgreement, `${dimension} adjacent agreement`);
    if (
      agreement.meanAbsoluteDifference !== undefined &&
      (
        typeof agreement.meanAbsoluteDifference !== "number" ||
        !Number.isFinite(agreement.meanAbsoluteDifference) ||
        agreement.meanAbsoluteDifference < 0 ||
        agreement.meanAbsoluteDifference > 4
      )
    ) {
      fail(`${dimension} mean absolute difference is invalid.`);
    }
  });
  return dimensions;
}

function createCalibrationReviewPacket(readiness) {
  const dimensions = validateReadinessForReview(readiness);
  const payload = {
    schemaVersion: REVIEW_PACKET_SCHEMA_VERSION,
    status: "ready_for_human_calibration_review",
    decisionScope: "human_calibration_review_only",
    expertValidated: false,
    productionEligible: false,
    source: {
      readinessSchemaVersion: readiness.schemaVersion,
      readinessDigestSha256: digest(readiness),
      batchId: readiness.batchId,
      batchFingerprintSha256: readiness.batchFingerprintSha256,
      assignmentDigestSha256: readiness.assignmentDigestSha256,
      mergedDatasetDigestSha256: readiness.mergedDatasetDigestSha256,
    },
    summary: {
      outfits: readiness.counts.outfits,
      assignedEvaluators: readiness.counts.assignedEvaluators,
      expectedAssignedEvaluations: readiness.counts.expectedAssignedEvaluations,
      actualAssignedEvaluations: readiness.counts.actualAssignedEvaluations,
      validationErrors: readiness.counts.validationErrors,
      validationWarnings: readiness.counts.validationWarnings,
    },
    integrityChecks: readiness.checks.map((check) => check.id).sort(),
    dimensions: dimensions
      .map((dimension) => ({
        dimension,
        coverage: readiness.diagnostics.coverageByDimension[dimension],
        unavailableRate: readiness.diagnostics.unavailableRateByDimension[dimension],
        averageConfidence: readiness.diagnostics.confidenceByDimension[dimension],
        agreement: {
          responseCount: readiness.diagnostics.agreementByDimension[dimension].responseCount,
          comparisonCount: readiness.diagnostics.agreementByDimension[dimension].comparisonCount,
          exactAgreement: readiness.diagnostics.agreementByDimension[dimension].exactAgreement,
          adjacentAgreement: readiness.diagnostics.agreementByDimension[dimension].adjacentAgreement,
          meanAbsoluteDifference:
            readiness.diagnostics.agreementByDimension[dimension].meanAbsoluteDifference,
        },
      }))
      .sort((left, right) =>
        left.coverage - right.coverage || (left.dimension < right.dimension ? -1 : 1)
      ),
    reviewQueue: {
      highDisagreementOutfitIds: [...new Set(
        readiness.diagnostics.highDisagreementOutfitIds
      )].sort(),
    },
    reviewChecklist: [...REVIEW_CHECKLIST],
  };
  return {
    ...payload,
    packetDigestSha256: digest(payload),
  };
}

function percentage(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function renderCalibrationReviewPacketMarkdown(packet) {
  const rows = packet.dimensions.map(({ dimension, coverage, unavailableRate, averageConfidence, agreement }) =>
    `| ${dimension} | ${percentage(coverage)} | ${percentage(unavailableRate)} | ${averageConfidence.toFixed(2)} | ${agreement.exactAgreement === undefined ? "n/a" : percentage(agreement.exactAgreement)} | ${agreement.adjacentAgreement === undefined ? "n/a" : percentage(agreement.adjacentAgreement)} |`
  );
  return [
    "# Expert pilot calibration review packet",
    "",
    `- Batch: ${packet.source.batchId}`,
    `- Status: ${packet.status}`,
    `- Outfits: ${packet.summary.outfits}`,
    `- Assigned evaluators: ${packet.summary.assignedEvaluators}`,
    `- Assigned evaluations: ${packet.summary.actualAssignedEvaluations}`,
    `- Packet digest: ${packet.packetDigestSha256}`,
    "",
    "## Dimension review order",
    "",
    "| Dimension | Coverage | Unavailable | Avg confidence | Exact agreement | Adjacent agreement |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "## High-disagreement outfits",
    "",
    packet.reviewQueue.highDisagreementOutfitIds.length
      ? packet.reviewQueue.highDisagreementOutfitIds.map((id) => `- ${id}`).join("\n")
      : "None recorded.",
    "",
    "## Review checklist",
    "",
    ...packet.reviewChecklist.map((item) => `- ${item}`),
    "",
    "> Human calibration review only. This packet does not grant expert validation or production approval.",
  ].join("\n");
}

function parseArguments(argv) {
  const allowed = new Set(["--readiness", "--format", "--output"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith("--") || values[key]) {
      fail("Invalid calibration review packet arguments.");
    }
    values[key] = value;
  }
  if (!values["--readiness"]) fail("--readiness is required.");
  const format = values["--format"] || "markdown";
  if (!new Set(["json", "markdown"]).has(format)) {
    fail("--format must be json or markdown.");
  }
  const readinessPath = path.resolve(values["--readiness"]);
  const outputPath = values["--output"] ? path.resolve(values["--output"]) : undefined;
  if (outputPath?.toLowerCase() === readinessPath.toLowerCase()) {
    fail("--output must be different from --readiness.");
  }
  return { readinessPath, format, outputPath };
}

function createCalibrationReviewPacketFile(options) {
  const packet = createCalibrationReviewPacket(readJson(options.readinessPath, "Readiness result"));
  const output = options.format === "json"
    ? `${JSON.stringify(packet, null, 2)}\n`
    : `${renderCalibrationReviewPacketMarkdown(packet)}\n`;
  if (options.outputPath) fs.writeFileSync(options.outputPath, output, "utf8");
  return { output, packet };
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = createCalibrationReviewPacketFile(options);
    if (!options.outputPath) process.stdout.write(result.output);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  REVIEW_PACKET_SCHEMA_VERSION,
  createCalibrationReviewPacket,
  createCalibrationReviewPacketFile,
  parseArguments,
  renderCalibrationReviewPacketMarkdown,
  validateReadinessForReview,
};
