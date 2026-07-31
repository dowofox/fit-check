import { buildOutfitShapeFeatures } from "@/utils/fashionCompatibility/shape/shapeFeatures";
import { buildPersonalFitFeatures } from "@/utils/fashionCompatibility/shape/personalFitFeatures";
import { buildGarmentShapeProfile } from "@/utils/fashionCompatibility/shape/shapeProfiles";
import {
  SHAPE_FEATURE_VERSION,
  SHAPE_PROFILE_VERSION,
  type LegacyShapeResult,
  type ShapeShadowComparison,
} from "@/utils/fashionCompatibility/shape/types";
import type { ClosetItem, UserProfile } from "@/utils/storage";

export type ShapeShadowOptions = {
  enabled?: boolean;
  referenceItems?: readonly ClosetItem[];
};

export function evaluateShapeShadowComparison(
  items: readonly ClosetItem[],
  userProfile: UserProfile | null | undefined,
  legacy: LegacyShapeResult,
  options: ShapeShadowOptions = {}
): ShapeShadowComparison {
  const legacySnapshot = {
    ...legacy,
    appliedRuleIds: [...legacy.appliedRuleIds],
  };
  if (options.enabled !== true) {
    return {
      mode: "legacy-only",
      legacy: legacySnapshot,
      disagreementReasons: [],
    };
  }

  const profiles = items.map((item) =>
    buildGarmentShapeProfile(item, { userHeightCm: userProfile?.height })
  );
  const outfitFeatures = buildOutfitShapeFeatures(items, profiles);
  const personalFitFeatures = userProfile
    ? buildPersonalFitFeatures(items, userProfile, {
        profiles,
        referenceItems: options.referenceItems,
      })
    : undefined;
  const confidenceValues = [
    outfitFeatures.profileConfidence,
    personalFitFeatures?.confidence,
  ].filter((value): value is number => value !== undefined);
  const confidence =
    confidenceValues.reduce((sum, value) => sum + value, 0) /
    Math.max(1, confidenceValues.length);
  const disagreementReasons: string[] = [];
  if (outfitFeatures.availableMeasurementRatio < 0.5) {
    disagreementReasons.push("professional-shape-measurement-coverage-low");
  }
  if (outfitFeatures.usedFallback) {
    disagreementReasons.push("professional-shape-fallback-used");
  }

  return {
    mode: "shadow",
    legacy: legacySnapshot,
    professional: {
      confidence,
      shapeProfileVersion: SHAPE_PROFILE_VERSION,
      shapeFeatureVersion: SHAPE_FEATURE_VERSION,
      outfitFeatures,
      personalFitFeatures,
    },
    disagreementReasons,
  };
}
