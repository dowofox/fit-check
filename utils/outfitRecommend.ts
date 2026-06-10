import { getFitSuitability } from "@/utils/sizeMatch";
import { ClosetItem, UserProfile } from "@/utils/storage";

export type OutfitRecommendation = {
  id: string;
  items: ClosetItem[];
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  alternativeCount?: number;
  reasons: string[];
  warnings: string[];
  breakdown: {
    category: number;
    style: number;
    color: number;
    fit: number;
    optional: number;
  };
};

const STYLE_GROUPS = [
  ["캐주얼", "꾸안꾸", "시티보이", "아메카지"],
  ["스트릿", "고프코어", "테크웨어", "워크웨어"],
  ["포멀", "댄디", "클래식", "모던", "프레피"],
  ["러블리", "페미닌"],
];

const BASIC_COLORS = ["블랙", "화이트", "아이보리", "베이지", "그레이", "네이비", "데님"];
const WIDE_FITS = ["와이드", "와이드핏", "스트레이트", "레귤러", "레귤러핏"];
const SLIM_FITS = ["슬림", "슬림핏", "타이트"];
const OVERSIZED_FITS = ["오버핏", "루즈", "루즈핏"];
const UNIVERSAL_SEASONS = ["사계절", "전체"];

function getItemLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category || "아이템";
}

function getGrade(score: number): OutfitRecommendation["grade"] {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function byCategory(items: ClosetItem[], category: string) {
  return items.filter((item) => item.category === category);
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getStyleGroup(style?: string) {
  return STYLE_GROUPS.find((group) => group.includes(style || ""));
}

function getCategoryScore(items: ClosetItem[]) {
  const hasTop = items.some((item) => item.category === "상의");
  const hasBottom = items.some((item) => item.category === "하의");
  const hasShoes = items.some((item) => item.category === "신발");

  if (hasTop && hasBottom && hasShoes) return 25;
  if (hasTop && hasBottom) return 15;
  return 0;
}

function getStyleScore(items: ClosetItem[], reasons: string[]) {
  const styles = items.map((item) => item.style).filter((style): style is string => Boolean(style));
  const counts = styles.reduce<Record<string, number>>((acc, style) => {
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, {});
  const maxSameStyleCount = Math.max(0, ...Object.values(counts));

  if (maxSameStyleCount >= 3) {
    reasons.push("같은 스타일 아이템이 3개 이상이라 전체 무드가 안정적이에요.");
    return 30;
  }

  if (maxSameStyleCount === 2) {
    reasons.push("같은 스타일 아이템이 2개라 조합의 방향성이 보여요.");
    return 22;
  }

  const knownGroups = styles.map(getStyleGroup).filter((group): group is string[] => Boolean(group));
  const hasSimilarStyleGroup = knownGroups.length >= 2
    && knownGroups.some((group) => knownGroups.filter((otherGroup) => otherGroup === group).length >= 2);

  if (hasSimilarStyleGroup) {
    reasons.push("완전히 같진 않지만 비슷한 스타일 계열끼리 묶여 있어요.");
    return 12;
  }

  return 0;
}

function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1;

  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울";
}

function isSeasonAllowed(item: ClosetItem, currentSeason: string, warnings: string[]) {
  const season = item.season?.trim();

  if (!season) {
    warnings.push(`${getItemLabel(item)}: 계절 정보가 부족해요.`);
    return true;
  }

  return UNIVERSAL_SEASONS.includes(season) || season.includes(currentSeason);
}

function getColorScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  const colors = uniqueValues(items.map((item) => item.color));
  const basicColorCount = colors.filter((color) => BASIC_COLORS.includes(color)).length;
  const accentColorCount = colors.length - basicColorCount;

  if (colors.length === 0 || accentColorCount === 0) {
    reasons.push("무채색이나 베이직 컬러 중심이라 색 조합이 안정적이에요.");
    return 25;
  }

  if (accentColorCount === 1) {
    reasons.push("포인트 컬러가 하나라 부담 없이 포인트를 줄 수 있어요.");
    return 20;
  }

  if (colors.length <= 4) return 12;

  warnings.push("색상이 많아 실제 착용 시 산만해 보일 수 있어요.");
  return 4;
}

function includesAny(value: string | undefined, keywords: string[]) {
  return keywords.some((keyword) => String(value || "").includes(keyword));
}

function isBasicColor(color?: string) {
  return BASIC_COLORS.includes(color || "");
}

function hasMatchingStyle(item: ClosetItem, baseItems: ClosetItem[]) {
  if (!item.style) return false;

  const itemStyleGroup = getStyleGroup(item.style);

  return baseItems.some((baseItem) => {
    if (!baseItem.style) return false;
    if (baseItem.style === item.style) return true;

    const baseStyleGroup = getStyleGroup(baseItem.style);
    return Boolean(itemStyleGroup && baseStyleGroup && itemStyleGroup === baseStyleGroup);
  });
}

function getOptionalScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  const baseItems = items.filter((item) => ["상의", "하의", "신발"].includes(item.category));
  const outer = items.find((item) => item.category === "아우터");
  const accessories = items.filter((item) => item.category === "액세서리");
  let score = 0;

  if (outer) {
    const hasStyle = Boolean(outer.style);
    const hasColor = Boolean(outer.color);
    const isNaturalOuter = hasMatchingStyle(outer, baseItems) || isBasicColor(outer.color);

    if (isNaturalOuter && hasStyle && hasColor) {
      score += 4;
      reasons.push("아우터가 전체 코디의 색상이나 스타일 흐름에 자연스럽게 맞아요.");
    } else if (hasStyle || hasColor) {
      score += 2;
      warnings.push("아우터 정보가 일부 부족해서 실제 조화는 한 번 더 확인해보세요.");
    } else {
      score += 1;
      warnings.push("아우터 색상/스타일 정보가 부족해요.");
    }
  }

  if (accessories.length === 0) {
    return Math.min(score, 8);
  }

  const accessoryColors = accessories.map((item) => item.color).filter((color): color is string => Boolean(color));
  const missingColorCount = accessories.length - accessoryColors.length;
  const accentColorCount = accessoryColors.filter((color) => !isBasicColor(color)).length;

  if (accessories.length >= 3) {
    score += 2;
    warnings.push("액세서리가 3개 이상이면 코디가 다소 복잡해 보일 수 있어요.");
  } else if (missingColorCount > 0) {
    score += 1;
    warnings.push("액세서리 색상 정보가 부족해요.");
  } else if (accentColorCount >= 2) {
    score += accessories.length === 2 ? 3 : 2;
    warnings.push("액세서리 색상이 강하면 포인트가 과해 보일 수 있어요.");
  } else if (accessories.length === 2) {
    score += 5;
    reasons.push("액세서리 2개가 과하지 않게 포인트를 더해줘요.");
  } else {
    score += 3;
    reasons.push("액세서리 1개가 코디에 자연스러운 포인트를 줘요.");
  }

  return Math.min(score, 8);
}

function getFitScore(top: ClosetItem, bottom: ClosetItem, reasons: string[], warnings: string[]) {
  const topFit = top.fit || "";
  const bottomFit = `${bottom.fit || ""} ${bottom.detailCategory || ""} ${bottom.subCategory || ""}`;
  const topIsOversized = includesAny(topFit, OVERSIZED_FITS);
  const topIsSlim = includesAny(topFit, SLIM_FITS);
  const bottomIsOversized = includesAny(bottomFit, OVERSIZED_FITS);
  const bottomIsWide = includesAny(bottomFit, WIDE_FITS);
  const bottomIsSlim = includesAny(bottomFit, SLIM_FITS);

  if (topIsOversized && bottomIsOversized) {
    warnings.push("상하의가 모두 크게 잡히면 실루엣이 과해 보일 수 있어요.");
    return 9;
  }

  if (topIsOversized && bottomIsWide) {
    reasons.push("상의 오버핏과 하의 와이드/스트레이트 실루엣이 잘 맞아요.");
    return 20;
  }

  if (!topIsOversized && bottomIsWide) return 16;
  if (topIsSlim && bottomIsSlim) {
    warnings.push("상하의가 모두 타이트하면 답답해 보일 수 있어요.");
    return 4;
  }

  return 16;
}

function getSizeWarnings(items: ClosetItem[], profile?: UserProfile | null) {
  if (!profile) return ["프로필 사이즈가 없어 사이즈 적합도는 참고하지 못했어요."];

  return items
    .map((item) => {
      const result = getFitSuitability(item, profile);
      const hasSizeWarning = ["작을 수 있어요", "사이즈를 직접 확인해보세요", "사이즈 정보가 더 필요해요"].includes(result.status);

      return hasSizeWarning ? `${getItemLabel(item)}: ${result.status}` : "";
    })
    .filter(Boolean);
}

function buildRecommendation(items: ClosetItem[], currentSeason: string, profile?: UserProfile | null): OutfitRecommendation | null {
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");

  if (!top || !bottom) return null;

  const reasons: string[] = [];
  const warnings = getSizeWarnings(items, profile);
  const isSeasonMatched = items.every((item) => isSeasonAllowed(item, currentSeason, warnings));

  if (!isSeasonMatched) return null;

  const category = getCategoryScore(items);
  const style = getStyleScore(items, reasons);
  const color = getColorScore(items, reasons, warnings);
  const fit = getFitScore(top, bottom, reasons, warnings);
  const optional = getOptionalScore(items, reasons, warnings);
  const score = category + style + color + fit + optional;

  return {
    id: items.map((item) => item.id).join("-"),
    items,
    score,
    grade: getGrade(score),
    reasons,
    warnings,
    breakdown: {
      category,
      style,
      color,
      fit,
      optional,
    },
  };
}

function hasCategory(recommendation: OutfitRecommendation, category: string) {
  return recommendation.items.some((item) => item.category === category);
}

function compareRecommendations(a: OutfitRecommendation, b: OutfitRecommendation) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;

  const shoeDiff = Number(hasCategory(b, "신발")) - Number(hasCategory(a, "신발"));
  if (shoeDiff !== 0) return shoeDiff;

  const outerDiff = Number(hasCategory(b, "아우터")) - Number(hasCategory(a, "아우터"));
  if (outerDiff !== 0) return outerDiff;

  return a.warnings.length - b.warnings.length;
}

function getAccessoryCombinations(accessories: ClosetItem[]) {
  const combinations: ClosetItem[][] = [[]];

  for (let size = 1; size <= 3; size += 1) {
    function pick(startIndex: number, selectedItems: ClosetItem[]) {
      if (selectedItems.length === size) {
        combinations.push(selectedItems);
        return;
      }

      for (let index = startIndex; index < accessories.length; index += 1) {
        pick(index + 1, [...selectedItems, accessories[index]]);
      }
    }

    pick(0, []);
  }

  return combinations;
}

function getCoreOutfitKey(recommendation: OutfitRecommendation) {
  const topId = recommendation.items.find((item) => item.category === "상의")?.id || "no-top";
  const bottomId = recommendation.items.find((item) => item.category === "하의")?.id || "no-bottom";
  const shoeId = recommendation.items.find((item) => item.category === "신발")?.id || "no-shoes";

  return [topId, bottomId, shoeId].join("-");
}

function getBestRecommendationByCoreOutfit(recommendations: OutfitRecommendation[]) {
  const recommendationMap = new Map<string, OutfitRecommendation[]>();

  recommendations.forEach((recommendation) => {
    const coreKey = getCoreOutfitKey(recommendation);
    const currentRecommendations = recommendationMap.get(coreKey) || [];

    recommendationMap.set(coreKey, [...currentRecommendations, recommendation]);
  });

  return Array.from(recommendationMap.values()).map((coreRecommendations) => {
    const [bestRecommendation] = [...coreRecommendations].sort(compareRecommendations);

    return {
      ...bestRecommendation,
      alternativeCount: Math.max(coreRecommendations.length - 1, 0),
    };
  });
}

function getSortedItemIds(items: ClosetItem[]) {
  return items.map((item) => item.id).sort();
}

function isSameItemCombination(firstItemIds: string[], secondItemIds: string[]) {
  const firstSortedIds = [...firstItemIds].sort();
  const secondSortedIds = [...secondItemIds].sort();

  return (
    firstSortedIds.length === secondSortedIds.length &&
    firstSortedIds.every((id, index) => id === secondSortedIds[index])
  );
}

function excludeSavedCombinations(recommendations: OutfitRecommendation[], savedOutfitItemIds: string[][]) {
  if (savedOutfitItemIds.length === 0) return recommendations;

  return recommendations.filter((recommendation) => {
    const itemIds = getSortedItemIds(recommendation.items);

    return !savedOutfitItemIds.some((savedItemIds) =>
      isSameItemCombination(savedItemIds, itemIds)
    );
  });
}

export function getOutfitRecommendations(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  savedOutfitItemIds: string[][] = []
): OutfitRecommendation[] {
  const tops = byCategory(items, "상의");
  const bottoms = byCategory(items, "하의");
  const shoes = byCategory(items, "신발");
  const outers = byCategory(items, "아우터");
  const accessories = byCategory(items, "액세서리");
  const recommendations: OutfitRecommendation[] = [];
  const hasShoesInCloset = shoes.length > 0;

  for (const top of tops) {
    for (const bottom of bottoms) {
      const baseItems = [top, bottom];
      const shoeOptions = shoes.length > 0 ? [null, ...shoes] : [null];
      const outerOptions = outers.length > 0 ? [null, ...outers] : [null];
      const accessoryOptions = getAccessoryCombinations(accessories);

      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          for (const accessoryItems of accessoryOptions) {
            const outfitItems = [
              ...baseItems,
              ...(shoe ? [shoe] : []),
              ...(outer ? [outer] : []),
              ...accessoryItems,
            ];
            const recommendation = buildRecommendation(outfitItems, currentSeason, profile);

            if (recommendation) {
              if (!hasShoesInCloset) {
                recommendation.warnings.push("신발이 없어 완성 코디로는 부족할 수 있어요.");
              }

              recommendations.push(recommendation);
            }
          }
        }
      }
    }
  }

  return getBestRecommendationByCoreOutfit(
    excludeSavedCombinations(recommendations, savedOutfitItemIds)
  )
    .sort(compareRecommendations)
    .slice(0, 3);
}
