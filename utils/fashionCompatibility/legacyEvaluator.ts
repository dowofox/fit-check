import { evaluateLegacyColorSupport } from "@/utils/fashionCompatibility/legacyColorRules";
import { evaluateLegacyMaterialAdjustment } from "@/utils/fashionCompatibility/legacyMaterialRules";
import {
  evaluateLegacyPointBalance,
  evaluateLegacySilhouette,
  evaluateLegacyWearFit,
  getResolvedLegacyGarmentProfile,
} from "@/utils/fashionCompatibility/legacyShapeRules";
import { evaluateLegacyStyleSupport } from "@/utils/fashionCompatibility/legacyStyleRules";
import type {
  LegacyCompatibilityResult,
  OutfitScoreEvidence,
} from "@/utils/fashionCompatibility/types";
import type { ClosetItem, UserProfile } from "@/utils/storage";

type LegacyCompatibilityInput = {
  items: ClosetItem[];
  top: ClosetItem;
  bottom: ClosetItem;
  currentSeason: string;
  profile?: UserProfile | null;
  reasons: string[];
  warnings: string[];
};

export function evaluateLegacyFashionCompatibility({
  items,
  top,
  bottom,
  currentSeason,
  profile,
  reasons,
  warnings,
}: LegacyCompatibilityInput): LegacyCompatibilityResult {
  const evidence: OutfitScoreEvidence[] = [];
  const silhouette = evaluateLegacySilhouette(
    top,
    bottom,
    reasons,
    warnings,
    evidence
  );
  const wearFit = evaluateLegacyWearFit(
    top,
    bottom,
    profile,
    reasons,
    warnings,
    evidence
  );
  const pointBalance = evaluateLegacyPointBalance(
    items,
    reasons,
    warnings,
    evidence
  );
  const colorSupport = evaluateLegacyColorSupport(
    items,
    reasons,
    warnings,
    evidence
  );
  const styleSupport = evaluateLegacyStyleSupport(
    items,
    reasons,
    warnings,
    evidence
  );
  const detailMaterialAdjustment = evaluateLegacyMaterialAdjustment(
    items,
    currentSeason,
    evidence
  );
  const topSource = getResolvedLegacyGarmentProfile(top).source;
  const bottomSource = getResolvedLegacyGarmentProfile(bottom).source;
  const breakdown = {
    silhouette,
    wearFit,
    pointBalance,
    colorSupport,
    styleSupport,
  };

  return {
    score:
      silhouette +
      wearFit +
      pointBalance +
      colorSupport +
      styleSupport +
      detailMaterialAdjustment.score,
    maxScore: 78,
    breakdown,
    detailMaterialAdjustment,
    reasons,
    warnings,
    evidence,
    usedFallback:
      topSource === "fallback" || bottomSource === "fallback",
  };
}
