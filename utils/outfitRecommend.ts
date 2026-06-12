import { getFitSuitability } from "@/utils/sizeMatch";
import { ClosetItem, UserProfile } from "@/utils/storage";

export type OutfitRecommendation = {
  id: string;
  items: ClosetItem[];
  title: string;
  tags: string[];
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  alternativeCount?: number;
  alternatives?: OutfitRecommendation[];
  penalty?: number;
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

export type OutfitRecommendationResult = {
  recommendations: OutfitRecommendation[];
  hasAnyRecommendation: boolean;
};

export type ShoeRecommendation = {
  shoe: ClosetItem;
  score: number;
  reason: string;
  isCurrent: boolean;
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
const styleGroupCache = new Map<string, string[] | undefined>();
const basicColorCache = new Map<string, boolean>();

function getItemLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category || "아이템";
}

function getRecommendationDisplay(items: ClosetItem[]) {
  const itemNames = items
    .map((item) => `${item.detailCategory || ""} ${item.subCategory || ""} ${item.category || ""}`)
    .join(" ");

  const styles = items.map((item) => item.style).filter(Boolean);
  const seasons = items.map((item) => item.season).filter(Boolean);
  const colors = items.map((item) => item.color).filter(Boolean);

  const hasDenim = ["청바지", "데님"].some((keyword) => itemNames.includes(keyword));
  const hasHoodOrSweatshirt = ["후드", "맨투맨"].some((keyword) => itemNames.includes(keyword));
  const hasShirt = itemNames.includes("셔츠");
  const hasSlacks = itemNames.includes("슬랙스");
  const hasOuter = ["자켓", "재킷", "코트", "아우터", "블레이저", "가디건"].some((keyword) =>
    itemNames.includes(keyword)
  );

  const seasonWord =
    seasons.some((season) => season?.includes("봄")) ? "봄날" :
      seasons.some((season) => season?.includes("여름")) ? "여름" :
        seasons.some((season) => season?.includes("가을")) ? "가을" :
          seasons.some((season) => season?.includes("겨울")) ? "겨울" :
            "오늘의";

  const moodWord =
    hasShirt && hasSlacks ? "깔끔한" :
      hasHoodOrSweatshirt ? "편안한" :
        hasDenim ? "가벼운" :
          hasOuter ? "분위기 있는" :
            "데일리";

  const sceneWord =
    hasShirt && hasSlacks ? "데이트" :
      hasHoodOrSweatshirt ? "주말" :
        hasDenim ? "산책" :
          hasOuter ? "남친룩" :
            "외출";

  const title = `${seasonWord} ${sceneWord} 코디`;

  const tags = [
    hasDenim ? "데님" : null,
    hasHoodOrSweatshirt ? "편안함" : null,
    hasShirt || hasSlacks ? "깔끔함" : null,
    hasOuter ? "아우터" : null,
    colors.some((color) => ["블랙", "화이트", "아이보리", "베이지", "그레이"].includes(color || "")) ? "베이직" : null,
    styles[0] || null,
  ].filter((tag): tag is string => Boolean(tag)).slice(0, 2);

  return {
    title,
    tags: tags.length > 0 ? tags : ["데일리", "추천"],
  };
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
  const key = style || "";
  if (!styleGroupCache.has(key)) {
    styleGroupCache.set(key, STYLE_GROUPS.find((group) => group.includes(key)));
  }

  return styleGroupCache.get(key);
}

function getCategoryScore(items: ClosetItem[]) {
  const hasTop = items.some((item) => item.category === "상의");
  const hasBottom = items.some((item) => item.category === "하의");
  const hasShoes = items.some((item) => item.category === "신발");

  if (hasTop && hasBottom && hasShoes) return 25;
  if (hasTop && hasBottom) return 8;
  return 0;
}

function getStyleScore(items: ClosetItem[], reasons: string[]) {
  const styles = items.map((item) => item.style).filter((style): style is string => Boolean(style));
  const counts = styles.reduce<Record<string, number>>((acc, style) => {
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, {});
  const maxSameStyleCount = Math.max(0, ...Object.values(counts));
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");
  const topStyleGroup = getStyleGroup(top?.style);
  const bottomStyleGroup = getStyleGroup(bottom?.style);

  if (topStyleGroup && bottomStyleGroup && topStyleGroup === bottomStyleGroup) {
    reasons.push(`상의와 하의가 모두 ${top?.style || "같은"} 계열이라 방향성은 맞아요.`);
  }

  if (maxSameStyleCount >= 3) {
    reasons.push("스타일은 잘 맞지만, 스타일 일치만으로 강한 추천이라고 보긴 어려워요.");
    return 20;
  }

  if (maxSameStyleCount === 2) {
    reasons.push("같은 스타일 아이템이 2개라 조합의 방향성은 보여요.");
    return 14;
  }

  const knownGroups = styles.map(getStyleGroup).filter((group): group is string[] => Boolean(group));
  const hasSimilarStyleGroup = knownGroups.length >= 2
    && knownGroups.some((group) => knownGroups.filter((otherGroup) => otherGroup === group).length >= 2);

  if (hasSimilarStyleGroup) {
    reasons.push("완전히 같진 않지만 비슷한 스타일 계열끼리 묶여 있어요.");
    return 8;
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

function isSeasonCandidate(item: ClosetItem, currentSeason: string) {
  const season = item.season?.trim();

  if (!season) return true;

  return UNIVERSAL_SEASONS.includes(season) || season.includes(currentSeason);
}

function getColorScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  const colors = uniqueValues(items.map((item) => item.color));
  const basicColorCount = colors.filter((color) => BASIC_COLORS.includes(color)).length;
  const accentColorCount = colors.length - basicColorCount;

  if (colors.length === 0 || accentColorCount === 0) {
    reasons.push("무채색이나 베이직 컬러 중심이라 색 조합이 안정적이에요.");
    return 24;
  }

  if (accentColorCount === 1) {
    reasons.push("포인트 컬러가 하나라 부담 없이 포인트를 줄 수 있어요.");
    return 18;
  }

  if (colors.length >= 4) {
    warnings.push("다만 색상이 여러 개라 실제 착용 시 산만해 보일 수 있어요.");
    return 6;
  }

  warnings.push("색 포인트가 둘 이상이라 조합이 조금 복잡해 보일 수 있어요.");
  return 10;
}

function includesAny(value: string | undefined, keywords: string[]) {
  return keywords.some((keyword) => String(value || "").includes(keyword));
}

function isBasicColor(color?: string) {
  const key = color || "";
  if (!basicColorCache.has(key)) {
    basicColorCache.set(key, BASIC_COLORS.includes(key));
  }

  return basicColorCache.get(key) || false;
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
      score += 1;
      warnings.push("아우터가 코디를 더 좋게 만든다고 보기엔 정보가 부족해요.");
    } else {
      score += 0;
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
    score += 0;
    warnings.push("액세서리가 3개 이상이라 포인트가 과하고 코디가 복잡해 보일 수 있어요.");
  } else if (missingColorCount > 0) {
    score += 1;
    warnings.push("액세서리 색상 정보가 부족해요.");
  } else if (accentColorCount >= 2) {
    score += accessories.length === 2 ? 2 : 1;
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
    warnings.push("상의가 오버핏이고 하의도 넓은 실루엣이라 체형에 따라 부해 보일 수 있어요.");
    return 5;
  }

  if (topIsOversized && bottomIsWide) {
    reasons.push("상의 오버핏과 하의 와이드/스트레이트 실루엣이 잘 맞아요.");
    return 17;
  }

  if (!topIsOversized && bottomIsWide) {
    reasons.push("상의는 과하지 않고 하의 실루엣에 여유가 있어 균형은 무난해요.");
    return 15;
  }

  if (topIsSlim && bottomIsSlim) {
    warnings.push("상하의가 모두 타이트하면 답답하고 여유 없는 인상으로 보일 수 있어요.");
    return 3;
  }

  reasons.push("전체적인 핏 균형은 무난하지만 강한 포인트가 있는 조합은 아니에요.");
  return 13;
}

function getSizeWarnings(
  items: ClosetItem[],
  profile?: UserProfile | null,
  fitSuitabilityCache = new Map<string, ReturnType<typeof getFitSuitability>>()
) {
  if (!profile) return ["프로필 사이즈가 없어 사이즈 적합도는 참고하지 못했어요."];

  return items
    .map((item) => {
      if (!fitSuitabilityCache.has(item.id)) {
        fitSuitabilityCache.set(item.id, getFitSuitability(item, profile));
      }

      const result = fitSuitabilityCache.get(item.id)!;
      const hasSizeWarning = ["작을 수 있어요", "사이즈를 직접 확인해보세요", "사이즈 정보가 더 필요해요"].includes(result.status);

      return hasSizeWarning ? `${getItemLabel(item)}: ${result.status}` : "";
    })
    .filter(Boolean);
}

function getWarningPenalty(warnings: string[]) {
  return warnings.reduce((totalPenalty, warning) => {
    const isImportantWarning = [
      "신발",
      "부해",
      "산만",
      "복잡",
      "작을 수",
      "답답",
      "과해",
    ].some((keyword) => warning.includes(keyword));

    return totalPenalty + (isImportantWarning ? 6 : 3);
  }, 0);
}

function buildRecommendation(
  items: ClosetItem[],
  currentSeason: string,
  profile?: UserProfile | null,
  fitSuitabilityCache?: Map<string, ReturnType<typeof getFitSuitability>>
): OutfitRecommendation | null {
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");
  const shoes = items.find((item) => item.category === "신발");

  if (!top || !bottom) return null;

  const reasons: string[] = [];
  const warnings = getSizeWarnings(items, profile, fitSuitabilityCache);
  const isSeasonMatched = items.every((item) => isSeasonAllowed(item, currentSeason, warnings));

  if (!isSeasonMatched) return null;

  const category = getCategoryScore(items);
  const style = getStyleScore(items, reasons);
  const color = getColorScore(items, reasons, warnings);
  const fit = getFitScore(top, bottom, reasons, warnings);
  const optional = getOptionalScore(items, reasons, warnings);
  const hasSizeWarning = warnings.some((warning) =>
    ["작을 수 있어요", "사이즈를 직접 확인해보세요", "사이즈 정보가 더 필요해요"].some((keyword) =>
      warning.includes(keyword)
    )
  );

  if (shoes) {
    reasons.push("신발까지 포함되어 코디 완성도는 높아요.");
  } else {
    warnings.push("신발이 빠져 완성 코디로 보기 어렵고 실제 착장 완성도가 낮아요.");
  }

  if (style >= 14 && color <= 10) {
    warnings.push("스타일 방향성은 맞지만 색상이 많아 좋은 조합이라고 단정하기 어려워요.");
  }

  if (style >= 14 && fit <= 5) {
    warnings.push("스타일은 맞아도 상하의 핏 균형이 무너질 수 있어 점수를 낮게 봤어요.");
  }

  if (style >= 14 && hasSizeWarning) {
    warnings.push("스타일이 맞아도 사이즈 경고가 있어 실제 착용 만족도는 낮을 수 있어요.");
  }

  const warningPenalty = getWarningPenalty(warnings);
  const rawScore = category + style + color + fit + optional;
  const score = Math.max(0, rawScore - warningPenalty);
  const display = getRecommendationDisplay(items);

  if (score < 70 && reasons.length > 0) {
    reasons.push("전체적으로 무난할 수는 있지만 강한 추천 조합은 아니에요.");
  }

  return {
    id: items.map((item) => item.id).join("-"),
    items,
    title: display.title,
    tags: display.tags,
    score,
    grade: getGrade(score),
    penalty: warningPenalty,
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

function getAccessoryPriorityScore(item: ClosetItem) {
  const infoScore = Number(Boolean(item.color)) + Number(Boolean(item.style));
  const createdAtTime = new Date(item.createdAt).getTime();
  const safeCreatedAtTime = Number.isNaN(createdAtTime) ? 0 : createdAtTime;

  return {
    infoScore,
    createdAtTime: safeCreatedAtTime,
  };
}

function getAccessoryCandidates(accessories: ClosetItem[]) {
  return [...accessories]
    .sort((first, second) => {
      const firstScore = getAccessoryPriorityScore(first);
      const secondScore = getAccessoryPriorityScore(second);
      const infoDiff = secondScore.infoScore - firstScore.infoScore;

      if (infoDiff !== 0) return infoDiff;

      return secondScore.createdAtTime - firstScore.createdAtTime;
    })
    .slice(0, 6);
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
    const [bestRecommendation, ...alternatives] = [...coreRecommendations].sort(compareRecommendations);

    return {
      ...bestRecommendation,
      alternativeCount: Math.max(coreRecommendations.length - 1, 0),
      alternatives: alternatives.slice(0, 3).map((alternative) => ({
        ...alternative,
        alternativeCount: 0,
        alternatives: [],
      })),
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

function getOutfitColorsWithoutShoes(outfitItems: ClosetItem[]) {
  return uniqueValues(
    outfitItems
      .filter((item) => item.category !== "신발")
      .map((item) => item.color)
  );
}

function getShoeRecommendationScore(
  shoe: ClosetItem,
  outfitItems: ClosetItem[],
  currentSeason: string,
  isCurrent: boolean
): ShoeRecommendation | null {
  if (!isSeasonCandidate(shoe, currentSeason)) return null;

  const baseItems = outfitItems.filter((item) => !["신발"].includes(item.category));
  const outfitColors = getOutfitColorsWithoutShoes(outfitItems);
  const shoeColor = shoe.color;
  const reasons: string[] = [];
  let score = isCurrent ? 2 : 0;

  if (hasMatchingStyle(shoe, baseItems)) {
    score += 5;
    reasons.push("코디 스타일 흐름과 잘 맞아요.");
  } else if (shoe.style) {
    score += 2;
    reasons.push("스타일 정보는 있지만 코디와 완전히 같은 계열은 아니에요.");
  }

  if (isBasicColor(shoeColor)) {
    score += 4;
    reasons.push("기본색이라 코디에 안정적으로 붙어요.");
  } else if (shoeColor && outfitColors.includes(shoeColor)) {
    score += 3;
    reasons.push("코디 안의 색상과 연결감이 있어요.");
  } else if (shoeColor) {
    score += 1;
    reasons.push("색상이 포인트가 될 수 있어요.");
  }

  if (!shoeColor) {
    reasons.push("색상 정보가 부족해 실제 조화는 확인이 필요해요.");
  }

  return {
    shoe,
    score,
    reason: reasons[0] || "무난하게 함께 신어볼 수 있어요.",
    isCurrent,
  };
}

export function getShoeRecommendationsForOutfit(
  outfitItems: ClosetItem[],
  allClosetItems: ClosetItem[],
  currentSeason = getCurrentSeason()
) {
  const currentShoeIds = new Set(
    outfitItems
      .filter((item) => item.category === "신발")
      .map((item) => item.id)
  );
  const shoes = byCategory(allClosetItems, "신발");
  const currentShoes = shoes
    .filter((shoe) => currentShoeIds.has(shoe.id))
    .map((shoe) => getShoeRecommendationScore(shoe, outfitItems, currentSeason, true))
    .filter((recommendation): recommendation is ShoeRecommendation => Boolean(recommendation));
  const recommendations = shoes
    .filter((shoe) => !currentShoeIds.has(shoe.id))
    .map((shoe) => getShoeRecommendationScore(shoe, outfitItems, currentSeason, false))
    .filter((recommendation): recommendation is ShoeRecommendation => Boolean(recommendation))
    .sort((first, second) => second.score - first.score)
    .slice(0, 3);

  return {
    currentShoes,
    recommendations,
  };
}

function buildRecommendationCandidates(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason()
) {
  const seasonItems = items.filter((item) => isSeasonCandidate(item, currentSeason));
  const tops = byCategory(seasonItems, "상의");
  const bottoms = byCategory(seasonItems, "하의");
  const shoes = byCategory(seasonItems, "신발");
  const outers = byCategory(seasonItems, "아우터");
  const accessories = getAccessoryCandidates(byCategory(seasonItems, "액세서리"));
  const recommendations: OutfitRecommendation[] = [];
  const fitSuitabilityCache = new Map<string, ReturnType<typeof getFitSuitability>>();

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
            const recommendation = buildRecommendation(
              outfitItems,
              currentSeason,
              profile,
              fitSuitabilityCache
            );

            if (recommendation) {
              recommendations.push(recommendation);
            }
          }
        }
      }
    }
  }

  return recommendations;
}

function selectRecommendations(
  recommendations: OutfitRecommendation[],
  savedOutfitItemIds: string[][] = []
) {
  return getBestRecommendationByCoreOutfit(
    excludeSavedCombinations(recommendations, savedOutfitItemIds)
  )
    .sort(compareRecommendations)
    .slice(0, 3);
}

export function getOutfitRecommendations(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  savedOutfitItemIds: string[][] = []
): OutfitRecommendation[] {
  return selectRecommendations(
    buildRecommendationCandidates(items, profile, currentSeason),
    savedOutfitItemIds
  );
}

export function getOutfitRecommendationResult(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  savedOutfitItemIds: string[][] = []
): OutfitRecommendationResult {
  const recommendationCandidates = buildRecommendationCandidates(items, profile, currentSeason);
  const allRecommendations = selectRecommendations(recommendationCandidates);
  const recommendations = savedOutfitItemIds.length > 0
    ? selectRecommendations(recommendationCandidates, savedOutfitItemIds)
    : allRecommendations;

  return {
    recommendations,
    hasAnyRecommendation: allRecommendations.length > 0,
  };
}
