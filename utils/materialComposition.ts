import type { MaterialComposition, MaterialSection } from "@/utils/storage";

export const MIN_SEASONAL_MATERIAL_PERCENTAGE = 20;

function cleanMaterialName(value: string) {
  return value
    .trim()
    .replace(
      /^(?:겉감|외피|안감|충전재|충전물|배색|부자재|소재|shell|outer|lining|liner|filling|fill|trim)(?:\s*(?:소재|material))?\s*[:：]\s*/i,
      ""
    )
    .trim();
}

function getMaterialSection(value: string): MaterialSection | undefined {
  const normalizedValue = value.trim().toLowerCase();

  if (/^(?:겉감|외피|shell|outer)(?:\s*[:：]|\s|$)/.test(normalizedValue)) {
    return "outer";
  }
  if (/^(?:안감|lining|liner)(?:\s*[:：]|\s|$)/.test(normalizedValue)) {
    return "lining";
  }
  if (/^(?:충전재|충전물|filling|fill)(?:\s*[:：]|\s|$)/.test(normalizedValue)) {
    return "filling";
  }
  if (/^(?:배색|부자재|trim)(?:\s*[:：]|\s|$)/.test(normalizedValue)) {
    return "trim";
  }

  return undefined;
}

function getMaterialSectionAt(value: string, index: number) {
  const sectionPattern =
    /(?:^|[\s,/|;()])(겉감|외피|안감|충전재|충전물|배색|부자재|shell|outer|lining|liner|filling|fill|trim)(?:\s*(?:소재|material))?\s*[:：]/gi;
  let section: MaterialSection | undefined;

  for (const match of value.matchAll(sectionPattern)) {
    if ((match.index ?? 0) > index) break;
    section = getMaterialSection(match[1]);
  }

  return section;
}

export function parseMaterialSummaryItems(summary?: string) {
  const materialSummary = summary || "";

  return Array.from(
    materialSummary.matchAll(/([^0-9%,/|·;\n]+?)\s*(\d+(?:\.\d+)?)\s*%/gi)
  )
    .map((match) => {
      const section =
        getMaterialSectionAt(materialSummary, match.index ?? 0) ||
        getMaterialSection(match[1]);
      return {
        name: cleanMaterialName(match[1]),
        percentage: Number(match[2]),
        ...(section ? { section } : {}),
      };
    })
    .filter((item) => item.name && Number.isFinite(item.percentage));
}

function getMaterialItems(materialComposition?: MaterialComposition) {
  const officialItems = materialComposition?.items || [];
  const parsedSummaryItems = parseMaterialSummaryItems(materialComposition?.summary);
  const hasOfficialSections = officialItems.some((item) => item.section);
  const hasSummarySections = parsedSummaryItems.some((item) => item.section);

  if (hasOfficialSections) return officialItems;
  if (hasSummarySections) return parsedSummaryItems;
  return officialItems.length > 0 ? officialItems : parsedSummaryItems;
}

export function isRecommendationMaterialSection(section?: MaterialSection) {
  return section !== "trim";
}

function getSignificantItems(materialComposition?: MaterialComposition) {
  return getMaterialItems(materialComposition).filter(
    (item) =>
      isRecommendationMaterialSection(item.section) &&
      (item.percentage == null ||
        item.percentage >= MIN_SEASONAL_MATERIAL_PERCENTAGE)
  );
}

export function hasMaterialSectionData(materialComposition?: MaterialComposition) {
  return getMaterialItems(materialComposition).some((item) => item.section);
}

export function getPrimaryMaterialText(
  materialComposition?: MaterialComposition
) {
  const materialItems = getMaterialItems(materialComposition);
  const significantItems = getSignificantItems(materialComposition);
  const outerItems = significantItems.filter((item) => item.section === "outer");
  const primaryItems = outerItems.length > 0 ? outerItems : significantItems;

  if (primaryItems.length === 0) {
    return materialItems.length === 0 ? materialComposition?.summary?.trim() || "" : "";
  }

  return primaryItems
    .map((item) => item.name.trim())
    .filter(Boolean)
    .join(" ");
}

export function getSignificantMaterialText(
  materialComposition?: MaterialComposition
) {
  const allMaterialItems = getMaterialItems(materialComposition);
  const materialItems = getSignificantItems(materialComposition);

  if (materialItems.length === 0) {
    return allMaterialItems.length === 0
      ? materialComposition?.summary?.trim() || ""
      : "";
  }

  return materialItems
    .map((item) => item.name.trim())
    .filter(Boolean)
    .join(" ");
}
