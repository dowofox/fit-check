import {
  getDetailMaterialAdjustment,
  type DetailMaterialEffectTrace,
} from "@/utils/outfitDetailMaterial";
import {
  appendLegacyEvidence,
  getLegacyDetailRuleId,
  getLegacyMaterialSeasonRuleId,
} from "@/utils/fashionCompatibility/ruleRegistry";
import type { OutfitScoreEvidence } from "@/utils/fashionCompatibility/types";
import type { ClosetItem } from "@/utils/storage";

function getMaterialInputSource(item: ClosetItem) {
  if (
    item.userEditedClassificationFields?.includes("material") &&
    item.material?.trim()
  ) {
    return "user_confirmed";
  }
  if (item.confirmedProduct?.materialComposition) {
    return "official_product";
  }
  if (item.material?.trim()) return "image_analysis";
  return "legacy_default";
}

function getTraceRuleId(trace: DetailMaterialEffectTrace) {
  if (trace.effect === "detail") {
    return getLegacyDetailRuleId(trace.ruleId);
  }
  if (trace.effect === "season-positive") {
    return getLegacyMaterialSeasonRuleId(trace.ruleId, "positive");
  }
  if (trace.effect === "season-negative") {
    return getLegacyMaterialSeasonRuleId(trace.ruleId, "negative");
  }
  return getLegacyMaterialSeasonRuleId(trace.ruleId, "style");
}

export function evaluateLegacyMaterialAdjustment(
  items: ClosetItem[],
  currentSeason: string,
  evidence: OutfitScoreEvidence[]
) {
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return getDetailMaterialAdjustment(items, currentSeason, (trace) => {
    const inputSources = Array.from(
      new Set(
        trace.itemIds
          .map((itemId) => itemsById.get(itemId))
          .filter((item): item is ClosetItem => Boolean(item))
          .map(getMaterialInputSource)
      )
    );

    appendLegacyEvidence(evidence, {
      ruleId: getTraceRuleId(trace),
      direction:
        trace.score > 0
          ? "positive"
          : trace.score < 0
            ? "negative"
            : "neutral",
      magnitude: Math.abs(trace.score),
      itemIds: trace.itemIds,
      diagnostics: {
        materialSource: inputSources.join(",") || "legacy_default",
        usedTextFallback: inputSources.includes("image_analysis"),
        duplicateSignalGroup:
          trace.effect === "detail"
            ? "material-and-detail-category"
            : "",
      },
    });
  });
}
