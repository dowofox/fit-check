import {
  aggregateDimensionEvaluations,
  calculateAgreementByDimension,
  calculateEvaluatorBias,
  calculatePairwiseAgreement,
} from "@/utils/fashionCompatibility/expert/agreementMetrics";
import { validateExpertEvaluationDataset } from "@/utils/fashionCompatibility/expert/evaluationValidation";
import { REQUIRED_EXPERT_DIMENSIONS } from "@/utils/fashionCompatibility/expert/rubricRegistry";
import type {
  ExpertDatasetReport,
  ExpertDimension,
  ExpertEvaluationDataset,
} from "@/utils/fashionCompatibility/expert/types";

function average(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function createExpertDatasetReport(dataset: ExpertEvaluationDataset): ExpertDatasetReport {
  const validation = validateExpertEvaluationDataset(dataset);
  const agreementByDimension = calculateAgreementByDimension(dataset.absoluteEvaluations);
  const pairwise = calculatePairwiseAgreement(dataset.pairwiseEvaluations);
  const coverageByDimension: Record<string, number> = {};
  const unavailableRateByDimension: Record<string, number> = {};
  const confidenceByDimension: Record<string, number> = {};

  REQUIRED_EXPERT_DIMENSIONS.forEach((dimension) => {
    const entries = dataset.absoluteEvaluations.flatMap((evaluation) =>
      evaluation.dimensions.filter((entry) => entry.dimension === dimension)
    );
    const rated = entries.filter((entry) => entry.availability === "rated");
    coverageByDimension[dimension] = dataset.absoluteEvaluations.length
      ? rated.length / dataset.absoluteEvaluations.length
      : 0;
    unavailableRateByDimension[dimension] = entries.length
      ? (entries.length - rated.length) / entries.length
      : 0;
    confidenceByDimension[dimension] = average(entries.map((entry) => entry.confidence));
  });

  const evaluationsByOutfit = new Map<string, typeof dataset.absoluteEvaluations>();
  dataset.absoluteEvaluations.forEach((evaluation) => {
    const entries = evaluationsByOutfit.get(evaluation.outfitId) || [];
    entries.push(evaluation);
    evaluationsByOutfit.set(evaluation.outfitId, entries);
  });
  const highDisagreementOutfitIds = [...evaluationsByOutfit]
    .filter(([, evaluations]) =>
      REQUIRED_EXPERT_DIMENSIONS.some(
        (dimension) =>
          (aggregateDimensionEvaluations(evaluations, dimension).disagreementSpan ?? 0) >= 3
      )
    )
    .map(([outfitId]) => outfitId)
    .sort();
  const evaluatorIds = new Set([
    ...dataset.absoluteEvaluations.map((evaluation) => evaluation.evaluatorId),
    ...dataset.pairwiseEvaluations.map((evaluation) => evaluation.evaluatorId),
  ]);

  return {
    datasetId: dataset.datasetId,
    datasetVersion: dataset.datasetVersion,
    valid: validation.valid,
    counts: {
      outfits: dataset.snapshots.length,
      evaluators: evaluatorIds.size,
      absoluteEvaluations: dataset.absoluteEvaluations.length,
      pairwiseEvaluations: dataset.pairwiseEvaluations.length,
    },
    coverageByDimension,
    unavailableRateByDimension,
    confidenceByDimension,
    agreementByDimension,
    pairwiseAgreement: pairwise.agreement,
    pairwiseTieRate: pairwise.tieRate,
    pairwiseNotComparableRate: pairwise.notComparableRate,
    evaluatorBias: calculateEvaluatorBias(dataset.absoluteEvaluations),
    highDisagreementOutfitIds,
    validationErrors: validation.errors.length,
    validationWarnings: validation.warnings.length,
  };
}

function percentage(value: number | undefined) {
  return value === undefined ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

export function renderExpertDatasetReportMarkdown(report: ExpertDatasetReport) {
  const dimensionRows = REQUIRED_EXPERT_DIMENSIONS.map((dimension: ExpertDimension) => {
    const agreement = report.agreementByDimension[dimension];
    return `| ${dimension} | ${percentage(report.coverageByDimension[dimension])} | ${percentage(report.unavailableRateByDimension[dimension])} | ${report.confidenceByDimension[dimension].toFixed(2)} | ${percentage(agreement.exactAgreement)} | ${percentage(agreement.adjacentAgreement)} |`;
  });
  return [
    `# Expert dataset report: ${report.datasetId}`,
    "",
    `- Dataset version: ${report.datasetVersion}`,
    `- Valid: ${report.valid ? "yes" : "no"}`,
    `- Outfits: ${report.counts.outfits}`,
    `- Evaluators: ${report.counts.evaluators}`,
    `- Absolute evaluations: ${report.counts.absoluteEvaluations}`,
    `- Pairwise evaluations: ${report.counts.pairwiseEvaluations}`,
    `- Validation errors: ${report.validationErrors}`,
    `- Validation warnings: ${report.validationWarnings}`,
    "",
    "## Dimension coverage",
    "",
    "| Dimension | Rated coverage | Unavailable | Avg confidence | Exact agreement | Adjacent agreement |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...dimensionRows,
    "",
    "## Pairwise",
    "",
    `- Agreement: ${percentage(report.pairwiseAgreement)}`,
    `- Tie rate: ${percentage(report.pairwiseTieRate)}`,
    `- Not comparable rate: ${percentage(report.pairwiseNotComparableRate)}`,
    "",
    "## High disagreement outfits",
    "",
    report.highDisagreementOutfitIds.length
      ? report.highDisagreementOutfitIds.map((id) => `- ${id}`).join("\n")
      : "None detected by the draft span threshold.",
    "",
    "> Draft offline quality report. It does not contain raw notes and is not a production scoring policy.",
  ].join("\n");
}
