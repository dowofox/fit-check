import { buildOutfitColorFeatures } from "@/utils/fashionCompatibility/color/colorFeatures";
import {
  COLOR_FEATURE_VERSION,
  COLOR_PROFILE_VERSION,
  type ColorShadowComparison,
  type LegacyColorResult,
} from "@/utils/fashionCompatibility/color/types";
import type { ClosetItem } from "@/utils/storage";

export type ColorShadowOptions = { enabled?: boolean };

export function evaluateColorShadowComparison(
  items: readonly ClosetItem[],
  legacy: LegacyColorResult,
  options: ColorShadowOptions = {}
): ColorShadowComparison {
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

  const features = buildOutfitColorFeatures(items);
  return {
    mode: "shadow",
    legacy: legacySnapshot,
    professional: {
      confidence: features.confidence,
      featureVersion: COLOR_FEATURE_VERSION,
      profileVersion: COLOR_PROFILE_VERSION,
      features,
    },
    disagreementReasons:
      features.confidence < 0.5 ? ["professional-color-input-confidence-low"] : [],
  };
}
