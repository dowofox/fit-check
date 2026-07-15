import type { MaterialComposition } from "@/utils/storage";

export const MIN_SEASONAL_MATERIAL_PERCENTAGE = 20;

function cleanMaterialName(value: string) {
  return value
    .trim()
    .replace(/^(?:겉감|안감|충전재|배색|소재)\s*[:：]\s*/i, "")
    .trim();
}

export function parseMaterialSummaryItems(summary?: string) {
  return Array.from(
    (summary || "").matchAll(/([^0-9%,/|·;\n]+?)\s*(\d+(?:\.\d+)?)\s*%/gi)
  )
    .map((match) => ({
      name: cleanMaterialName(match[1]),
      percentage: Number(match[2]),
    }))
    .filter((item) => item.name && Number.isFinite(item.percentage));
}

export function getSignificantMaterialText(
  materialComposition?: MaterialComposition
) {
  const officialItems = materialComposition?.items || [];
  const parsedSummaryItems = officialItems.length > 0
    ? []
    : parseMaterialSummaryItems(materialComposition?.summary);
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
