import type { MaterialComposition, MaterialSection } from "@/utils/storage";

type MaterialItem = NonNullable<MaterialComposition["items"]>[number];

export const MIN_SEASONAL_MATERIAL_PERCENTAGE = 20;
const MATERIAL_SECTION_INDEX_PATTERN = "(?:\\s*(?:\\(\\d+\\)|\\d+))?";
const MATERIAL_SECTION_SEPARATOR_PATTERN = "(?:\\s*[:：]\\s*|\\s+)";
const MATERIAL_SECTION_NAME_PATTERN =
  "겉감|외피|안감|충전재|충전물|배색|부자재|shell|outer|lining|liner|filling|fill|trim";

function cleanMaterialName(value: string) {
  return value
    .trim()
    .replace(
      /^(?:겉감|외피|안감|충전재|충전물|배색|부자재|소재|shell|outer|lining|liner|filling|fill|trim)(?:\s*(?:\(\d+\)|\d+))?(?:\s*(?:소재|material))?(?:\s*(?:\(\d+\)|\d+))?(?:\s*[:：]\s*|\s+)/i,
      ""
    )
    .replace(/^[\s():：]+/, "")
    .trim();
}

function getMaterialSection(value: string): MaterialSection | undefined {
  const normalizedValue = value.trim().toLowerCase();
  const suffixPattern = `${MATERIAL_SECTION_INDEX_PATTERN}(?:\\s*[:：]|\\s|$)`;

  if (new RegExp(`^(?:겉감|외피|shell|outer)${suffixPattern}`).test(normalizedValue)) {
    return "outer";
  }
  if (new RegExp(`^(?:안감|lining|liner)${suffixPattern}`).test(normalizedValue)) {
    return "lining";
  }
  if (new RegExp(`^(?:충전재|충전물|filling|fill)${suffixPattern}`).test(normalizedValue)) {
    return "filling";
  }
  if (new RegExp(`^(?:배색|부자재|trim)${suffixPattern}`).test(normalizedValue)) {
    return "trim";
  }

  return undefined;
}

function getMaterialSectionAt(value: string, index: number) {
  const sectionMatches = value.matchAll(
    new RegExp(
      `(?:^|[\\s,/|;()])(${MATERIAL_SECTION_NAME_PATTERN})${MATERIAL_SECTION_INDEX_PATTERN}(?:\\s*(?:소재|material))?${MATERIAL_SECTION_INDEX_PATTERN}${MATERIAL_SECTION_SEPARATOR_PATTERN}`,
      "gi"
    )
  );
  let section: MaterialSection | undefined;

  for (const match of sectionMatches) {
    if ((match.index ?? 0) > index) break;
    section = getMaterialSection(match[1]);
  }

  return section;
}

function parseSectionedMaterialNameItems(summary: string): MaterialItem[] {
  const sectionMatches = [
    ...summary.matchAll(
      new RegExp(
        `(?:^|[\\s,/|;()])(${MATERIAL_SECTION_NAME_PATTERN})${MATERIAL_SECTION_INDEX_PATTERN}(?:\\s*(?:소재|material))?${MATERIAL_SECTION_INDEX_PATTERN}${MATERIAL_SECTION_SEPARATOR_PATTERN}`,
        "gi"
      )
    ),
  ];

  return sectionMatches.flatMap((match, index) => {
    const section = getMaterialSection(match[1]);
    if (!section) return [];

    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = sectionMatches[index + 1]?.index ?? summary.length;
    return summary
      .slice(contentStart, contentEnd)
      .split(/[,/|;·\n]+/)
      .filter((name) => !name.includes("%"))
      .map((name) =>
        name
          .replace(/^[\s:：()]+|[\s:：()]+$/g, "")
          .trim()
      )
      .filter(Boolean)
      .map((name) => ({ name, percentage: null, section }));
  });
}

function mergeMaterialSummaryItems(
  sectionedItems: MaterialItem[],
  percentageItems: MaterialItem[]
) {
  const mergedItems = sectionedItems.map((item) => ({ ...item }));

  for (const item of percentageItems) {
    const existingItem = mergedItems.find(
      (candidate) =>
        candidate.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
        candidate.section === item.section
    );
    if (existingItem) {
      existingItem.percentage = item.percentage;
    } else {
      mergedItems.push(item);
    }
  }

  return mergedItems;
}

export function parseMaterialSummaryItems(summary?: string): MaterialItem[] {
  const materialSummary = summary || "";
  const percentageItems = Array.from(
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
  const sectionedItems = parseSectionedMaterialNameItems(materialSummary);

  return sectionedItems.length > 0
    ? mergeMaterialSummaryItems(sectionedItems, percentageItems)
    : percentageItems;
}

export function getMaterialPercentageTotal(
  items?: MaterialComposition["items"]
) {
  return (items || []).reduce((total, item) => {
    if (
      item.percentage == null ||
      !Number.isFinite(item.percentage)
    ) {
      return total;
    }

    return total + item.percentage;
  }, 0);
}

export function hasInvalidMaterialPercentageTotal(
  materialComposition?: MaterialComposition
) {
  const total = getMaterialPercentageTotal(materialComposition?.items);

  if (total === 0) {
    return false;
  }

  return total > 100.5;
}

function getMaterialItems(materialComposition?: MaterialComposition) {

  if (hasInvalidMaterialPercentageTotal(materialComposition)) {
    return [];
  }

  const officialItems = materialComposition?.items || [];
  const parsedSummaryItems =
    parseMaterialSummaryItems(materialComposition?.summary);

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

function getRecommendationMaterialItemText(
  item: NonNullable<MaterialComposition["items"]>[number]
) {
  const name = item.name.trim();
  return item.section === "filling" ? `충전재 ${name}` : name;
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
    .map(getRecommendationMaterialItemText)
    .filter(Boolean)
    .join(" ");
}
