import { getFitSuitability } from "@/utils/sizeMatch";
import { ClosetItem, UserProfile } from "@/utils/storage";

export type OutfitRecommendation = {
  id: string;
  items: ClosetItem[];
  title: string;
  tags: string[];
  recommendedShoes?: {
    type: string;
    reason: string;
  };
  sockRecommendation: {
    required: boolean;
    type: string;
    color: string;
    reason: string;
  };
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

export type OutfitRecommendationWeather = {
  temperature?: number;
  condition?: string;
  rainChance?: number;
};

export type OutfitRecommendationOptions = {
  weather?: OutfitRecommendationWeather | null;
};

export type ShoeRecommendation = {
  shoe: ClosetItem;
  score: number;
  reason: string;
  isCurrent: boolean;
};

const STYLE_GROUPS = [
  ["캐주얼", "꾸안꾸", "시티보이", "아메카지", "데일리", "편안함"],
  ["스트릿", "고프코어", "테크웨어", "워크웨어"],
  ["포멀", "댄디", "클래식", "모던", "프레피", "미니멀", "깔끔함"],
  ["러블리", "페미닌"],
];

const BASIC_COLORS = ["블랙", "화이트", "아이보리", "베이지", "그레이", "네이비", "데님"];
const DARK_COLORS = ["블랙", "네이비", "차콜"];
const LIGHT_COLORS = ["화이트", "아이보리", "베이지", "크림", "라이트그레이"];
const STYLE_CONFLICT_PAIRS = [
  ["포멀", "스트릿"],
  ["댄디", "스트릿"],
  ["클래식", "고프코어"],
  ["페미닌", "테크웨어"],
  ["러블리", "워크웨어"],
];
const WIDE_FITS = ["와이드", "와이드핏", "스트레이트", "레귤러", "레귤러핏"];
const SLIM_FITS = ["슬림", "슬림핏", "타이트"];
const OVERSIZED_FITS = ["오버핏", "루즈", "루즈핏"];
const UNIVERSAL_SEASONS = ["사계절", "전체"];
const styleGroupCache = new Map<string, string[] | undefined>();
const basicColorCache = new Map<string, boolean>();

function getItemSeasons(item: ClosetItem) {
  if (item.seasons?.length) return item.seasons;
  if (item.season) {
    const seasons = ["봄", "여름", "가을", "겨울", "사계절", "전체"]
      .filter((season) => item.season?.includes(season));

    return seasons.length > 0 ? seasons : ["사계절"];
  }

  return ["사계절"];
}

function getItemStyles(item: ClosetItem) {
  if (item.styleTags?.length) return item.styleTags;
  return item.style ? [item.style] : [];
}

function getPrimaryStyle(item?: ClosetItem) {
  if (!item) return undefined;
  return getItemStyles(item)[0];
}

function getItemLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category || "아이템";
}

function getRecommendationDisplay(items: ClosetItem[], currentSeason: string) {
  const itemNames = items
    .map((item) => `${item.detailCategory || ""} ${item.subCategory || ""} ${item.category || ""}`)
    .join(" ");

  const styles = items.flatMap(getItemStyles).filter(Boolean);
  const colors = items.map((item) => item.color).filter(Boolean);

  const hasDenim = ["청바지", "데님"].some((keyword) => itemNames.includes(keyword));
  const hasHoodOrSweatshirt = ["후드", "맨투맨"].some((keyword) => itemNames.includes(keyword));
  const hasShirt = itemNames.includes("셔츠");
  const hasSlacks = itemNames.includes("슬랙스");
  const hasMinimalStyle = styles.some((style) => ["미니멀", "모던", "클래식"].includes(style || ""));
  const hasOuter = ["자켓", "재킷", "코트", "아우터", "블레이저", "가디건"].some((keyword) =>
    itemNames.includes(keyword)
  ) || items.some((item) => item.category === "아우터");

  const seasonalTag =
    currentSeason === "봄" ? "봄" :
      currentSeason === "여름" ? "여름" :
        currentSeason === "가을" ? "가을" :
          "겨울";
  const seasonalTitlePrefix =
    currentSeason === "봄" ? "봄날" :
      currentSeason === "여름" ? "여름" :
        currentSeason === "가을" ? "가을" :
          "겨울";
  const seasonalMood =
    currentSeason === "봄" ? "산책" :
      currentSeason === "여름" ? "데일리" :
        currentSeason === "가을" ? "카페" :
          "데이트";

  let title = `${seasonalTitlePrefix} ${seasonalMood} 코디`;

  if ((hasShirt && hasSlacks) || hasMinimalStyle) {
    title = `${seasonalTitlePrefix} 미니멀 데일리 룩`;
  } else if (hasHoodOrSweatshirt) {
    title = `${seasonalTitlePrefix} 캐주얼 편안한 룩`;
  } else if (hasDenim) {
    title = `${seasonalTitlePrefix} 캐주얼 데님 룩`;
  } else if (hasOuter) {
    title = currentSeason === "겨울"
      ? "겨울 데이트 코디"
      : `${seasonalTitlePrefix} 아우터 룩`;
  }

  const tags = [
    seasonalTag,
    currentSeason === "여름" ? "가벼움" : null,
    currentSeason === "겨울" ? "따뜻함" : null,
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

function getRecommendedShoes(items: ClosetItem[]): OutfitRecommendation["recommendedShoes"] {
  const hasShoes = items.some((item) => item.category === "신발");

  if (hasShoes) return undefined;

  const styles = items.flatMap(getItemStyles).filter((style): style is string => Boolean(style));
  const colors = items.map((item) => item.color).filter((color): color is string => Boolean(color));
  const itemNames = items.map(getItemLabel).join(" ");
  const isFormal = styles.some((style) => ["포멀", "댄디", "클래식", "프레피"].some((keyword) => style.includes(keyword)));
  const isStreet = styles.some((style) => ["스트릿", "고프코어", "테크웨어", "워크웨어"].some((keyword) => style.includes(keyword)));
  const hasDenim = itemNames.includes("데님") || itemNames.includes("청바지");

  if (isFormal) {
    return {
      type: "블랙 로퍼",
      reason: "포멀한 상하의 조합에는 블랙 로퍼가 가장 깔끔하게 어울립니다.",
    };
  }

  if (isStreet) {
    return {
      type: "블랙 스니커즈",
      reason: "스트릿 스타일에는 무게감 있는 블랙 스니커즈가 안정적으로 어울립니다.",
    };
  }

  if (hasDenim || colors.some((color) => ["블랙", "네이비", "데님", "그레이"].includes(color))) {
    return {
      type: "화이트 스니커즈",
      reason: "캐주얼 스타일과 가장 무난하게 어울립니다.",
    };
  }

  return {
    type: "아이보리 스니커즈",
    reason: "밝은 기본색 신발이라 대부분의 데일리 코디에 자연스럽게 연결됩니다.",
  };
}

function getSockRecommendation(
  items: ClosetItem[],
  recommendedShoes?: OutfitRecommendation["recommendedShoes"]
): OutfitRecommendation["sockRecommendation"] {
  const styles = items.flatMap(getItemStyles).filter((style): style is string => Boolean(style));
  const shoe = items.find((item) => item.category === "신발");
  const bottom = items.find((item) => item.category === "하의");
  const shoeText = shoe ? getItemSearchText(shoe) : recommendedShoes?.type || "";
  const shoeColor = shoe?.color || recommendedShoes?.type || "";
  const bottomLabel = bottom ? getItemLabel(bottom) : "하의";
  const shoeLabel = shoe ? `${shoeColor || ""} ${getItemLabel(shoe)}`.trim() : recommendedShoes?.type || "신발";
  const noSockKeywords = ["슬리퍼", "샌들", "크록스", "쪼리", "플립플랍", "플립플롭"];
  const optionalSockKeywords = ["버켄스탁", "피셔맨 샌들", "피셔맨"];
  const sockRecommendedKeywords = ["운동화", "스니커즈", "러닝화", "로퍼", "더비슈즈", "더비", "부츠", "워커"];
  const isNoSockShoe = noSockKeywords.some((keyword) => shoeText.includes(keyword)) &&
    !optionalSockKeywords.some((keyword) => shoeText.includes(keyword));
  const isOptionalSockShoe = optionalSockKeywords.some((keyword) => shoeText.includes(keyword));
  const isSockRecommendedShoe = sockRecommendedKeywords.some((keyword) => shoeText.includes(keyword));
  const isDaily = styles.some((style) => ["데일리", "캐주얼", "편안함", "꾸안꾸"].some((keyword) => style.includes(keyword)));
  const isMinimal = styles.some((style) => ["미니멀", "모던", "깔끔함"].some((keyword) => style.includes(keyword)));
  const isStreet = styles.some((style) => ["스트릿", "고프코어", "테크웨어", "워크웨어"].some((keyword) => style.includes(keyword)));
  const isFormal = styles.some((style) => ["포멀", "댄디", "클래식", "프레피"].some((keyword) => style.includes(keyword)));
  let type = "크루삭스";
  let color = "흰색";

  if (isNoSockShoe) {
    return {
      required: false,
      type: "양말 없음",
      color: "",
      reason: `${shoeLabel} 스타일이라 양말 없이 착용하는 것이 자연스럽습니다.`,
    };
  }

  if (isFormal) {
    type = "얇은 드레스삭스";
  } else if (isStreet) {
    type = "스포츠 양말";
  } else if (isMinimal) {
    type = "무지 크루삭스";
  } else if (isDaily) {
    type = "크루삭스";
  }

  if (isDaily) {
    color = "흰색";
  } else if (["화이트", "아이보리", "크림"].some((keyword) => shoeColor.includes(keyword))) {
    color = "흰색/아이보리";
  } else if (["블랙", "검정", "차콜"].some((keyword) => shoeColor.includes(keyword))) {
    color = "검정/회색";
  } else if (["베이지", "브라운", "카멜"].some((keyword) => shoeColor.includes(keyword))) {
    color = "아이보리/베이지";
  } else if (isFormal) {
    color = "검정/네이비";
  }

  if (isOptionalSockShoe) {
    type = isDaily || isMinimal ? "무지 크루삭스" : "양말 없음 또는 크루삭스";
    color = isDaily ? "아이보리" : color;
  }

  const styleReason = isStreet
    ? "스트릿 스타일과 잘 어울립니다."
    : isFormal
      ? "포멀한 신발에는 얇은 양말이 실루엣을 깔끔하게 잡아줍니다."
      : isMinimal
        ? "미니멀한 분위기를 해치지 않는 무지 양말이 좋아요."
        : "데일리 코디에 자연스럽게 연결됩니다.";
  const shoeReason = shoe || recommendedShoes
    ? isSockRecommendedShoe
      ? `${shoeLabel}와 자연스럽게 연결됩니다.`
      : `${shoeLabel}에 부담 없이 맞출 수 있어요.`
    : "";
  const reason = shoe || recommendedShoes
    ? isOptionalSockShoe
      ? `${shoeLabel}는 양말 없이도 자연스럽고, 포인트를 주고 싶다면 ${color} ${type}도 좋아요.`
      : `${bottomLabel}와 ${shoeLabel} 조합에 ${color} ${type}가 가장 자연스럽게 어울려요. ${shoeReason} ${styleReason}`
    : `${bottomLabel} 중심의 코디라 ${color} ${type}를 신으면 전체 분위기를 깔끔하게 마무리할 수 있어요.`;

  return {
    required: !isOptionalSockShoe,
    type,
    color,
    reason,
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

function hasStyleConflict(styles: string[]) {
  return STYLE_CONFLICT_PAIRS.some(([firstStyle, secondStyle]) =>
    styles.some((style) => style.includes(firstStyle)) &&
    styles.some((style) => style.includes(secondStyle))
  );
}

function getStyleGroupName(style?: string) {
  const group = getStyleGroup(style);

  if (!group) return style || "미분석";
  if (group.includes("캐주얼")) return "캐주얼";
  if (group.includes("스트릿")) return "스트릿";
  if (group.includes("포멀")) return "포멀";
  if (group.includes("러블리")) return "러블리";

  return style || "미분석";
}

function getCategoryScore(items: ClosetItem[]) {
  const hasTop = items.some((item) => item.category === "상의");
  const hasBottom = items.some((item) => item.category === "하의");
  const hasShoes = items.some((item) => item.category === "신발");

  if (hasTop && hasBottom && hasShoes) return 25;
  if (hasTop && hasBottom) return 8;
  return 0;
}

function getStyleScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  const styles = items.flatMap(getItemStyles).filter((style): style is string => Boolean(style));
  const counts = styles.reduce<Record<string, number>>((acc, style) => {
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, {});
  const maxSameStyleCount = Math.max(0, ...Object.values(counts));
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");
  const topStyle = getPrimaryStyle(top);
  const bottomStyle = getPrimaryStyle(bottom);
  const topStyleGroup = getStyleGroup(topStyle);
  const bottomStyleGroup = getStyleGroup(bottomStyle);

  if (hasStyleConflict(styles)) {
    warnings.push(`${styles.slice(0, 3).join(", ")} 조합은 스타일 방향이 충돌할 수 있어요.`);
    return 5;
  }

  if (topStyleGroup && bottomStyleGroup && topStyleGroup === bottomStyleGroup) {
    reasons.push(`상의와 하의가 모두 ${getStyleGroupName(topStyle)} 계열이라 스타일 방향이 자연스럽게 이어져요.`);
  }

  if (maxSameStyleCount >= 3) {
    reasons.push(`${Object.keys(counts).find((style) => counts[style] === maxSameStyleCount) || "비슷한"} 태그가 여러 아이템에 반복되어 코디 분위기가 분명해요.`);
    return 24;
  }

  if (maxSameStyleCount === 2) {
    reasons.push("같은 스타일 태그가 2개라 조합의 방향성은 충분히 보여요.");
    return 18;
  }

  const knownGroups = styles.map(getStyleGroup).filter((group): group is string[] => Boolean(group));
  const hasSimilarStyleGroup = knownGroups.length >= 2
    && knownGroups.some((group) => knownGroups.filter((otherGroup) => otherGroup === group).length >= 2);

  if (hasSimilarStyleGroup) {
    reasons.push("태그가 완전히 같지는 않지만 비슷한 스타일 계열끼리 묶여 있어요.");
    return 14;
  }

  if (styles.length > 0) {
    warnings.push("아이템별 스타일 태그 연결감이 약해서 코디 의도가 흐려질 수 있어요.");
  }

  return 4;
}

function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1;

  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울";
}

function isSeasonAllowed(item: ClosetItem, currentSeason: string, warnings: string[]) {
  const seasons = getItemSeasons(item);

  if (seasons.length === 0) {
    warnings.push(`${getItemLabel(item)}: 계절 정보가 부족해요.`);
    return true;
  }

  const isAllowed = isSeasonCandidate(item, currentSeason);

  if (!isAllowed) {
    warnings.push(`${getItemLabel(item)}: ${currentSeason}에 맞는 계절 정보가 아니라 실제 착용감이 어색할 수 있어요.`);
  }

  return isAllowed;
}

function isSeasonCandidate(item: ClosetItem, currentSeason: string) {
  const seasons = getItemSeasons(item);

  if (seasons.length === 0) return true;

  return seasons.some((season) => {
    if (UNIVERSAL_SEASONS.includes(season)) return true;
    if (season.includes(currentSeason)) return true;
    if (currentSeason === "봄" && season.includes("가을")) return true;
    if (currentSeason === "가을" && season.includes("봄")) return true;
    return false;
  });
}

function getItemSearchText(item: ClosetItem) {
  return [
    item.confirmedProduct?.brand,
    item.confirmedProduct?.productName,
    item.confirmedBrand,
    item.inferredBrand,
    item.category,
    item.subCategory,
    item.detailCategory,
    item.description,
    item.fit,
    item.style,
    ...(item.styleTags || []),
  ].filter(Boolean).join(" ");
}

function isThickOuterItem(item: ClosetItem) {
  const thickKeywords = ["패딩", "코트", "울", "플리스", "무스탕", "두꺼운", "퍼", "기모"];
  const itemText = getItemSearchText(item);

  return item.category === "아우터" && thickKeywords.some((keyword) => itemText.includes(keyword));
}

function isSummerLightItem(item: ClosetItem) {
  const lightKeywords = ["반팔", "민소매", "린넨", "얇은", "쿨", "쇼츠", "반바지"];
  const itemText = getItemSearchText(item);

  return lightKeywords.some((keyword) => itemText.includes(keyword));
}

function isWeatherCandidate(item: ClosetItem, weather?: OutfitRecommendationWeather | null) {
  if (!weather || typeof weather.temperature !== "number") return true;

  const temperature = weather.temperature;

  if (temperature >= 24) {
    return !hasSpecificSeason(item, "겨울") && !isThickOuterItem(item);
  }

  if (temperature >= 18) {
    return !isThickOuterItem(item);
  }

  if (temperature <= 10) {
    return !hasSpecificSeason(item, "여름") && !isSummerLightItem(item);
  }

  return true;
}

function getSeasonMatchedItems(
  items: ClosetItem[],
  currentSeason: string,
  weather?: OutfitRecommendationWeather | null,
  strictSeasonFilter = true
) {
  if (!strictSeasonFilter) return items;

  return items.filter((item) =>
    isSeasonCandidate(item, currentSeason) &&
    isWeatherCandidate(item, weather)
  );
}

function getSeasonPriority(item: ClosetItem, currentSeason: string) {
  const seasons = getItemSeasons(item);

  if (seasons.length === 0) return 1;
  if (isSeasonCandidate(item, currentSeason)) return 2;
  return 0;
}

function sortBySeasonPriority(items: ClosetItem[], currentSeason: string) {
  return [...items].sort((first, second) => {
    const seasonDiff = getSeasonPriority(second, currentSeason) - getSeasonPriority(first, currentSeason);

    if (seasonDiff !== 0) return seasonDiff;

    const firstCreatedAt = new Date(first.createdAt).getTime();
    const secondCreatedAt = new Date(second.createdAt).getTime();

    return (Number.isNaN(secondCreatedAt) ? 0 : secondCreatedAt) - (Number.isNaN(firstCreatedAt) ? 0 : firstCreatedAt);
  });
}

function getColorScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  const colors = uniqueValues(items.map((item) => item.color));
  const basicColorCount = colors.filter((color) => BASIC_COLORS.includes(color)).length;
  const accentColorCount = colors.length - basicColorCount;
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");
  const topColor = top?.color;
  const bottomColor = bottom?.color;

  if (topColor && bottomColor) {
    const topIsBasic = isBasicColor(topColor);
    const bottomIsBasic = isBasicColor(bottomColor);
    const bottomLabel = bottom ? getItemLabel(bottom) : "";
    const hasDenimBottom = bottomColor.includes("데님") || bottomLabel.includes("데님") || bottomLabel.includes("청바지");

    if (topColor.includes("블랙") && hasDenimBottom) {
      reasons.push("검정 상의와 데님 하의 조합이라 캐주얼하게 안정적이에요.");
      return 25;
    }

    if (topIsBasic && bottomIsBasic && topColor !== bottomColor) {
      reasons.push(`${topColor} 상의와 ${bottomColor} 하의 조합이라 과하지 않고 안정적이에요.`);
      return 23;
    }

    if (topColor === bottomColor && !topColor.includes("블랙") && !topColor.includes("화이트")) {
      warnings.push(`상의와 하의가 모두 ${topColor} 계열이라 실루엣이 뭉쳐 보일 수 있어요.`);
      return 10;
    }

    if (
      DARK_COLORS.some((color) => topColor.includes(color)) &&
      DARK_COLORS.some((color) => bottomColor.includes(color))
    ) {
      warnings.push("상의와 하의가 모두 어두운 색이라 답답하게 보일 수 있어요.");
      return 13;
    }

    if (
      LIGHT_COLORS.some((color) => topColor.includes(color)) &&
      LIGHT_COLORS.some((color) => bottomColor.includes(color))
    ) {
      reasons.push("밝은 톤끼리 이어져 부드럽고 깨끗한 인상이에요.");
      return 20;
    }
  }

  if (colors.length === 0 || accentColorCount === 0) {
    reasons.push("무채색이나 베이직 컬러 중심이라 색 조합이 안정적이에요.");
    return 24;
  }

  if (accentColorCount === 1) {
    reasons.push("베이직 컬러 위에 포인트 컬러가 하나라 부담 없이 개성을 줄 수 있어요.");
    return 20;
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
  const itemStyles = getItemStyles(item);
  if (itemStyles.length === 0) return false;

  return baseItems.some((baseItem) => {
    const baseStyles = getItemStyles(baseItem);
    if (baseStyles.length === 0) return false;
    if (itemStyles.some((style) => baseStyles.includes(style))) return true;

    return itemStyles.some((style) => {
      const itemStyleGroup = getStyleGroup(style);

      return baseStyles.some((baseStyle) => {
        const baseStyleGroup = getStyleGroup(baseStyle);
        return Boolean(itemStyleGroup && baseStyleGroup && itemStyleGroup === baseStyleGroup);
      });
    });
  });
}

function getOptionalScore(items: ClosetItem[], currentSeason: string, reasons: string[], warnings: string[]) {
  const baseItems = items.filter((item) => ["상의", "하의", "신발"].includes(item.category));
  const outer = items.find((item) => item.category === "아우터");
  const accessories = items.filter((item) => item.category === "액세서리");
  let score = 0;

  if (currentSeason === "겨울" && !outer) {
    warnings.push("겨울 코디인데 아우터가 없어 보온성과 완성도가 부족할 수 있어요.");
  }

  if (outer) {
    const hasStyle = getItemStyles(outer).length > 0;
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

    if (currentSeason === "겨울") {
      score += 2;
      reasons.push("겨울에는 아우터가 포함되어 코디 완성도와 계절감이 좋아요.");
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
  const outfitStyles = [...getItemStyles(top), ...getItemStyles(bottom)];
  const isCasualOrStreet = outfitStyles.some((style) =>
    ["캐주얼", "데일리", "편안함", "스트릿", "고프코어", "시티보이"].some((keyword) => style.includes(keyword))
  );
  const topIsOversized = includesAny(topFit, OVERSIZED_FITS);
  const topIsSlim = includesAny(topFit, SLIM_FITS);
  const bottomIsOversized = includesAny(bottomFit, OVERSIZED_FITS);
  const bottomIsWide = includesAny(bottomFit, WIDE_FITS);
  const bottomIsSlim = includesAny(bottomFit, SLIM_FITS);

  if (topIsOversized && bottomIsOversized) {
    warnings.push("상의와 하의가 모두 크게 잡혀 체형에 따라 전체 실루엣이 부해 보일 수 있어요.");
    return isCasualOrStreet ? 9 : 5;
  }

  if (topIsOversized && bottomIsWide) {
    reasons.push(isCasualOrStreet
      ? "오버핏 상의와 와이드 하의가 캐주얼/스트릿 무드에서는 자연스럽게 맞아요."
      : "오버핏 상의와 와이드 하의가 여유 있는 실루엣으로 맞아요."
    );
    return isCasualOrStreet ? 20 : 17;
  }

  if ((topIsSlim || !topIsOversized) && bottomIsWide) {
    reasons.push("상의는 비교적 정돈되고 하의는 여유가 있어 상하의 실루엣 균형이 좋아요.");
    return topIsSlim ? 18 : 15;
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
      "계절",
      "충돌",
      "색상",
      "어색",
    ].some((keyword) => warning.includes(keyword));

    return totalPenalty + (isImportantWarning ? 6 : 3);
  }, 0);
}

function hasSpecificSeason(item: ClosetItem, season: string) {
  return getItemSeasons(item).some((itemSeason) =>
    !UNIVERSAL_SEASONS.includes(itemSeason) && itemSeason.includes(season)
  );
}

function hasOuterLikeItem(items: ClosetItem[]) {
  return items.some((item) => item.category === "아우터");
}

function hasThickOuter(items: ClosetItem[]) {
  const thickKeywords = ["패딩", "코트", "울", "플리스", "무스탕", "두꺼운"];

  return items.some((item) =>
    item.category === "아우터" &&
    thickKeywords.some((keyword) => `${getItemLabel(item)} ${item.description || ""}`.includes(keyword))
  );
}

function hasLightClothes(items: ClosetItem[]) {
  const lightKeywords = ["반팔", "민소매", "린넨", "얇은", "티셔츠"];

  return items.some((item) =>
    lightKeywords.some((keyword) => `${getItemLabel(item)} ${item.description || ""}`.includes(keyword))
  );
}

function getShoeItems(items: ClosetItem[]) {
  return items.filter((item) => item.category === "신발");
}

function isBrightShoe(item: ClosetItem) {
  const color = item.color || "";

  return ["화이트", "아이보리", "크림", "베이지"].some((keyword) => color.includes(keyword));
}

function hasRainOrSnow(weather: OutfitRecommendationWeather) {
  const condition = weather.condition || "";

  return ["비", "소나기", "눈", "우천", "rain", "snow"].some((keyword) =>
    condition.toLowerCase().includes(keyword.toLowerCase())
  );
}

function applyWeatherAdjustment(
  recommendation: OutfitRecommendation,
  weather: OutfitRecommendationWeather | null | undefined
): OutfitRecommendation {
  if (!weather || typeof weather.temperature !== "number") return recommendation;

  const reasons = [...recommendation.reasons];
  const warnings = [...recommendation.warnings];
  const temperature = weather.temperature;
  const rainChance = weather.rainChance ?? 0;
  const hasOuter = hasOuterLikeItem(recommendation.items);
  const hasSummerItem = recommendation.items.some((item) => hasSpecificSeason(item, "여름"));
  const hasSpringFallItem = recommendation.items.some((item) =>
    hasSpecificSeason(item, "봄") || hasSpecificSeason(item, "가을")
  );
  const hasWinterItem = recommendation.items.some((item) => hasSpecificSeason(item, "겨울"));
  const shoes = getShoeItems(recommendation.items);
  const weatherIsWet = hasRainOrSnow(weather) || rainChance >= 60;
  let weatherScore = 0;

  if (temperature <= 5) {
    if (hasOuter || hasWinterItem) {
      weatherScore += 8;
      reasons.push("오늘은 기온이 낮아 아우터나 겨울 아이템이 포함된 조합을 우선 추천했어요.");
    }

    if (hasSummerItem || hasLightClothes(recommendation.items)) {
      weatherScore -= 12;
      warnings.push("오늘 기온이 낮아 여름 옷이나 얇은 아이템은 춥게 느껴질 수 있어요.");
    }
  } else if (temperature <= 15) {
    if (hasOuter || hasSpringFallItem) {
      weatherScore += 6;
      reasons.push("오늘은 선선해서 봄/가을 아이템이나 아우터가 있는 조합에 점수를 더 줬어요.");
    }
  } else if (temperature <= 23) {
    if (hasSpringFallItem || hasLightClothes(recommendation.items)) {
      weatherScore += 4;
      reasons.push("오늘 기온에는 봄/가을 느낌의 가벼운 조합이 부담 없이 잘 맞아요.");
    }
  } else {
    if (hasSummerItem || hasLightClothes(recommendation.items)) {
      weatherScore += 7;
      reasons.push("오늘은 더운 편이라 여름 옷이나 가벼운 아이템이 포함된 조합을 높게 봤어요.");
    }

    if (hasThickOuter(recommendation.items)) {
      weatherScore -= 10;
      warnings.push("오늘 기온에는 두꺼운 아우터가 답답하게 느껴질 수 있어요.");
    }
  }

  if (weatherIsWet) {
    if (shoes.length > 0) {
      weatherScore += 2;
      reasons.push("비나 눈 예보가 있어 신발까지 포함된 조합을 조금 더 안정적으로 봤어요.");
    } else {
      weatherScore -= 6;
      warnings.push("비나 눈 예보가 있어 신발 선택이 빠진 조합은 완성도가 낮아 보여요.");
    }

    if (shoes.some(isBrightShoe)) {
      weatherScore -= 6;
      warnings.push("비 예보가 있어 밝은 흰 신발 조합은 오염이 신경 쓰일 수 있어 점수를 낮췄어요.");
    }

    if (!hasOuter && temperature <= 18) {
      weatherScore -= 4;
      warnings.push("비 예보와 낮은 기온을 고려하면 가벼운 아우터가 없는 점이 아쉬워요.");
    }
  }

  const score = Math.min(100, Math.max(0, recommendation.score + weatherScore));

  return {
    ...recommendation,
    score,
    grade: getGrade(score),
    reasons,
    warnings,
  };
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

  if (!isSeasonMatched) {
    warnings.push(`${currentSeason} 기준으로 계절감이 맞지 않는 아이템이 포함되어 점수를 낮게 봤어요.`);
  } else {
    reasons.push(`${currentSeason}에 입기 좋은 계절 정보의 아이템들로 구성됐어요.`);
  }

  const category = getCategoryScore(items);
  const style = getStyleScore(items, reasons, warnings);
  const color = getColorScore(items, reasons, warnings);
  const fit = getFitScore(top, bottom, reasons, warnings);
  const optional = getOptionalScore(items, currentSeason, reasons, warnings);
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
  const score = Math.min(100, Math.max(0, rawScore - warningPenalty));
  const display = getRecommendationDisplay(items, currentSeason);
  const recommendedShoes = getRecommendedShoes(items);
  const sockRecommendation = getSockRecommendation(items, recommendedShoes);

  if (score < 70 && reasons.length > 0) {
    reasons.push("전체적으로 무난할 수는 있지만 강한 추천 조합은 아니에요.");
  }

  return {
    id: items.map((item) => item.id).join("-"),
    items,
    title: display.title,
    tags: display.tags,
    recommendedShoes,
    sockRecommendation,
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
  const infoScore = Number(Boolean(item.color)) + Number(getItemStyles(item).length > 0);
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

function getTopItemId(recommendation: OutfitRecommendation) {
  return recommendation.items.find((item) => item.category === "상의")?.id || "no-top";
}

function diversifyRecommendations(recommendations: OutfitRecommendation[], limit = 5) {
  const result: OutfitRecommendation[] = [];
  const topUsageCount = new Map<string, number>();

  for (const recommendation of recommendations) {
    const topId = getTopItemId(recommendation);
    const currentUsage = topUsageCount.get(topId) || 0;

    if (currentUsage >= 2) continue;

    result.push(recommendation);
    topUsageCount.set(topId, currentUsage + 1);

    if (result.length >= limit) return result;
  }

  for (const recommendation of recommendations) {
    if (result.some((selectedRecommendation) => selectedRecommendation.id === recommendation.id)) {
      continue;
    }

    result.push(recommendation);

    if (result.length >= limit) break;
  }

  return result;
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
  } else if (getItemStyles(shoe).length > 0) {
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
  currentSeason = getCurrentSeason(),
  options: OutfitRecommendationOptions & { strictSeasonFilter?: boolean } = {}
) {
  const strictSeasonFilter = options.strictSeasonFilter ?? true;
  const seasonItems = getSeasonMatchedItems(items, currentSeason, options.weather, strictSeasonFilter);
  const tops = sortBySeasonPriority(byCategory(seasonItems, "상의"), currentSeason);
  const bottoms = sortBySeasonPriority(byCategory(seasonItems, "하의"), currentSeason);
  const shoes = sortBySeasonPriority(byCategory(seasonItems, "신발"), currentSeason);
  const outers = sortBySeasonPriority(byCategory(seasonItems, "아우터"), currentSeason);
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
              if (strictSeasonFilter) {
                recommendation.reasons.unshift(
                  options.weather
                    ? "현재 날씨와 계절에 맞는 옷만 우선 추천했어요."
                    : "현재 계절에 맞는 옷만 우선 추천했어요."
                );
                recommendation.reasons.push("계절이 맞지 않는 아이템은 추천 후보에서 제외했어요.");
              } else {
                recommendation.warnings.unshift(
                  "계절에 맞는 조합이 부족해서 일부 계절감이 애매한 아이템까지 함께 비교했어요."
                );
              }

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
  const sortedRecommendations = getBestRecommendationByCoreOutfit(
    excludeSavedCombinations(recommendations, savedOutfitItemIds)
  )
    .sort(compareRecommendations);

  return diversifyRecommendations(sortedRecommendations, 5);
}

function buildRecommendationCandidatesWithFallback(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  options: OutfitRecommendationOptions = {}
) {
  const filteredCandidates = buildRecommendationCandidates(items, profile, currentSeason, {
    ...options,
    strictSeasonFilter: true,
  });

  if (filteredCandidates.length > 0) return filteredCandidates;

  return buildRecommendationCandidates(items, profile, currentSeason, {
    ...options,
    strictSeasonFilter: false,
  });
}

export function getOutfitRecommendations(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  savedOutfitItemIds: string[][] = []
): OutfitRecommendation[] {
  return selectRecommendations(
    buildRecommendationCandidatesWithFallback(items, profile, currentSeason),
    savedOutfitItemIds
  );
}

export function getOutfitRecommendationResult(
  items: ClosetItem[],
  profile?: UserProfile | null,
  currentSeason = getCurrentSeason(),
  savedOutfitItemIds: string[][] = [],
  options: OutfitRecommendationOptions = {}
): OutfitRecommendationResult {
  const recommendationCandidates = buildRecommendationCandidatesWithFallback(items, profile, currentSeason, options)
    .map((recommendation) => applyWeatherAdjustment(recommendation, options.weather));
  const allRecommendations = selectRecommendations(recommendationCandidates);
  const recommendations = savedOutfitItemIds.length > 0
    ? selectRecommendations(recommendationCandidates, savedOutfitItemIds)
    : allRecommendations;

  return {
    recommendations,
    hasAnyRecommendation: allRecommendations.length > 0,
  };
}
