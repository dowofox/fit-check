import type { MaterialComposition } from "@/utils/storage";

export const MIN_SEASONAL_MATERIAL_PERCENTAGE = 20;

function parseSummaryItems(summary?: string) {
  return (summary || "")
    .split(/[,/|·;\n]+/)
    .map((segment) => segment.match(/^\s*(.+?)\s*(\d+(?:\.\d+)?)\s*%\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ name: match[1].trim(), percentage: Number(match[2]) }))
    .filter((item) => item.name && Number.isFinite(item.percentage));
}

export function getSignificantMaterialText(
  materialComposition?: MaterialComposition
) {
  const officialItems = materialComposition?.items || [];
  const parsedSummaryItems = officialItems.length > 0
    ? []
    : parseSummaryItems(materialComposition?.summary);
  const materialItems = officialItems.length > 0 ? officialItems : parsedSummaryItems;

  if (materialItems.length === 0) return materialComposition?.summary?.trim() || "";

  return materialItems
    .filter(
      (item) =>
        item.percentage == null ||
        item.percentage >= MIN_SEASONAL_MATERIAL_PERCENTAGE
    )
    .map((item) => item.name.trim())
    .filter(Boolean)
    .join(" ");
}
