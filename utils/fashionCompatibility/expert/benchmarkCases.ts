import { buildOutfitColorFeatures } from "@/utils/fashionCompatibility/color/colorFeatures";
import {
  COLOR_FEATURE_VERSION,
  COLOR_PROFILE_VERSION,
} from "@/utils/fashionCompatibility/color/types";
import { buildOutfitShapeFeatures } from "@/utils/fashionCompatibility/shape/shapeFeatures";
import {
  PERSONAL_FIT_FEATURE_VERSION,
  SHAPE_FEATURE_VERSION,
  SHAPE_PROFILE_VERSION,
} from "@/utils/fashionCompatibility/shape/types";
import type {
  ExpertAbsoluteEvaluation,
  ExpertEvaluationDataset,
  ExpertOutfitSnapshot,
  OutfitEvaluationContext,
  SanitizedOutfitColorFeatures,
  SanitizedOutfitShapeFeatures,
} from "@/utils/fashionCompatibility/expert/types";
import type { ClosetItem } from "@/utils/storage";

export type ExpertBenchmarkCase = {
  snapshot: ExpertOutfitSnapshot;
  absoluteEvaluations: ExpertAbsoluteEvaluation[];
  pairwiseEvaluationIds: string[];
};

type CreateSnapshotInput = {
  outfitId: string;
  items: readonly ClosetItem[];
  context: OutfitEvaluationContext;
  outfitGroupId?: string;
  compositionGroupKey?: string;
  includeColorFeatures?: boolean;
  includeShapeFeatures?: boolean;
  anonymizeItemId?: (itemId: string) => string;
  syntheticMode?: boolean;
  createdAt?: string;
};

function sanitizeColorFeatures(
  items: readonly ClosetItem[],
  anonymize: (itemId: string) => string
): SanitizedOutfitColorFeatures {
  const { version: _version, pairwiseDeltaE00, ...features } = buildOutfitColorFeatures(items);
  return {
    ...features,
    pairwiseDeltaE00: pairwiseDeltaE00.map(({ itemIdA, itemIdB, ...pair }) => ({
      anonymousItemIdA: anonymize(itemIdA),
      anonymousItemIdB: anonymize(itemIdB),
      ...pair,
    })),
  };
}

function sanitizeShapeFeatures(items: readonly ClosetItem[]): SanitizedOutfitShapeFeatures {
  const { version: _version, ...features } = buildOutfitShapeFeatures(items);
  return features;
}

export function createExpertOutfitSnapshot(input: CreateSnapshotInput): ExpertOutfitSnapshot {
  if (!input.syntheticMode && !input.anonymizeItemId) {
    throw new Error("An item anonymization callback is required outside synthetic mode.");
  }
  const anonymize = input.anonymizeItemId || ((itemId: string) => itemId);
  const anonymousIds = input.items.map((item) => anonymize(item.id));
  if (
    !input.syntheticMode &&
    anonymousIds.some((anonymousId, index) => anonymousId === input.items[index].id)
  ) {
    throw new Error("Item anonymization must not export a source item ID unchanged.");
  }
  if (new Set(anonymousIds).size !== anonymousIds.length) {
    throw new Error("Item anonymization must produce unique IDs within an outfit.");
  }
  return {
    outfitId: input.outfitId,
    outfitGroupId: input.outfitGroupId,
    compositionGroupKey: input.compositionGroupKey,
    itemRefs: input.items.map((item, index) => ({
      anonymousItemId: anonymousIds[index],
      category: item.category,
    })),
    context: input.context,
    featureVersions: {
      colorProfileVersion: input.includeColorFeatures ? COLOR_PROFILE_VERSION : undefined,
      colorFeatureVersion: input.includeColorFeatures ? COLOR_FEATURE_VERSION : undefined,
      shapeProfileVersion: input.includeShapeFeatures ? SHAPE_PROFILE_VERSION : undefined,
      shapeFeatureVersion: input.includeShapeFeatures ? SHAPE_FEATURE_VERSION : undefined,
      personalFitFeatureVersion: input.includeShapeFeatures
        ? PERSONAL_FIT_FEATURE_VERSION
        : undefined,
    },
    colorFeatures: input.includeColorFeatures
      ? sanitizeColorFeatures(input.items, anonymize)
      : undefined,
    shapeFeatures: input.includeShapeFeatures
      ? sanitizeShapeFeatures(input.items)
      : undefined,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function buildExpertBenchmarkCases(
  dataset: ExpertEvaluationDataset
): ExpertBenchmarkCase[] {
  return dataset.snapshots.map((snapshot) => ({
    snapshot,
    absoluteEvaluations: dataset.absoluteEvaluations.filter(
      (evaluation) => evaluation.outfitId === snapshot.outfitId
    ),
    pairwiseEvaluationIds: dataset.pairwiseEvaluations
      .filter(
        (evaluation) =>
          evaluation.outfitIdA === snapshot.outfitId ||
          evaluation.outfitIdB === snapshot.outfitId
      )
      .map((evaluation) => evaluation.evaluationId),
  }));
}
