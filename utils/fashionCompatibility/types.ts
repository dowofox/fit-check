export type FashionRuleSourceType =
  | "color_science"
  | "fashion_research"
  | "stylist_consensus"
  | "expert_dataset"
  | "user_learning"
  | "temporary_heuristic";

export type FashionRuleDimension =
  | "color"
  | "silhouette"
  | "proportion"
  | "fit"
  | "material"
  | "style"
  | "occasion"
  | "personal"
  | "environment";

export type FashionRuleMetadata = {
  id: string;
  dimension: FashionRuleDimension;
  sourceType: FashionRuleSourceType;
  sourceReferences: string[];
  confidence: number;
  applicableStyles?: string[];
  applicableSituations?: string[];
  rationale: string;
  knownExceptions?: string[];
  version: string;
  enabled: boolean;
};

export type OutfitScoreEvidence = {
  id: string;
  ruleId: string;
  dimension: FashionRuleDimension;
  direction: "positive" | "negative" | "neutral";
  magnitude: number;
  confidence: number;
  sourceType: FashionRuleSourceType;
  itemIds: string[];
  messageKey: string;
  diagnostics?: Record<string, string | number | boolean>;
};

export type LegacyCompatibilityBreakdown = {
  silhouette: number;
  wearFit: number;
  pointBalance: number;
  colorSupport: number;
  styleSupport: number;
};

export type LegacyMaterialAdjustment = {
  score: number;
  reasons: string[];
  warnings: string[];
};

export type LegacyCompatibilityResult = {
  score: number;
  maxScore: number;
  breakdown: LegacyCompatibilityBreakdown;
  detailMaterialAdjustment: LegacyMaterialAdjustment;
  reasons: string[];
  warnings: string[];
  evidence: OutfitScoreEvidence[];
  usedFallback: boolean;
};

export type CompatibilityComparison = {
  legacyScore: number;
  professionalScore?: number;
  scoreDifference?: number;
  legacyRank?: number;
  professionalRank?: number;
  disagreementReasons: string[];
  professionalConfidence?: number;
  mode: "legacy-only" | "shadow";
};

export function createLegacyOnlyComparison(
  legacyScore: number
): CompatibilityComparison {
  return {
    legacyScore,
    disagreementReasons: [],
    mode: "legacy-only",
  };
}
