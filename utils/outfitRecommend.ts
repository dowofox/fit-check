import { getFitSuitability } from "@/utils/sizeMatch";
import { doesProductSizeRowMatch } from "@/utils/productSizeMeasurements";
import { getDetailMaterialAdjustment } from "@/utils/outfitDetailMaterial";
import { getResolvedItemMaterial } from "@/utils/productClassification";
import { ClosetItem, GarmentProfile, UserProfile } from "@/utils/storage";

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
    silhouette: number;
    wearFit: number;
    pointBalance: number;
    colorSupport: number;
    styleSupport: number;
    weather: number;
    rotation: number;
  };
};

export type OutfitRecommendationResult = {
  recommendations: OutfitRecommendation[];
  hasAnyRecommendation: boolean;
  emptyReason?: OutfitRecommendationEmptyReason;
  missingCategories?: string[];
};

const DISPLAY_REASON_GROUPS = [
  /상황|데이트|깔끔한 상황|편안한 상황|데일리 상황/,
  /오늘|기온|날씨|비나 눈|예보|계절/,
  /실루엣|핏|볼륨|비율|기장|상체|하체/,
  /색|무채색|베이직 컬러|밝은 톤/,
  /스타일|무드|캐주얼|포멀|미니멀/,
  /신발|아우터|액세서리|완성도/,
];

const INTERNAL_REASON_PATTERNS = [
  /AI/,
  /사진상/,
  /추정값/,
  /분석값/,
  /보수적으로 판단/,
  /상품 실측을 기준/,
  /한 아이템은 상품 실측/,
  /실측이 없어/,
  /점수/,
  /추천 후보에서 제외/,
];

export function getOutfitDisplayReasons(reasons: string[], limit = 3) {
  if (limit <= 0) return [];

  const candidates = reasons.filter(
    (reason, index, allReasons) =>
      Boolean(reason?.trim()) &&
      allReasons.indexOf(reason) === index &&
      !INTERNAL_REASON_PATTERNS.some((pattern) => pattern.test(reason))
  );
  const selected: string[] = [];

  DISPLAY_REASON_GROUPS.forEach((pattern) => {
    const matchedReason = candidates.find(
      (reason) => !selected.includes(reason) && pattern.test(reason)
    );
    if (matchedReason && selected.length < limit) selected.push(matchedReason);
  });

  candidates.forEach((reason) => {
    if (selected.length < limit && !selected.includes(reason)) selected.push(reason);
  });

  return selected.slice(0, limit);
}

export type OutfitRecommendationEmptyReason =
  | "missing_core_category"
  | "below_quality_threshold"
  | "saved_combinations_exhausted";

export type OutfitRecommendationWeather = {
  temperature?: number;
  condition?: string;
  rainChance?: number;
};

export type OutfitRecommendationOptions = {
  weather?: OutfitRecommendationWeather | null;
};

export const MIN_DISPLAY_RECOMMENDATION_SCORE = 70;

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
const STRONG_COLORS = ["레드", "빨강", "오렌지", "주황", "옐로우", "노랑", "그린", "초록", "블루", "파랑", "퍼플", "보라", "핑크", "형광", "네온"];
const COMPLEX_PATTERNS = ["체크", "카모", "플라워", "그래픽", "로고패턴", "애니멀", "페이즐리"];
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
const STRONG_COLD_WEATHER_KEYWORDS = [
  "패딩",
  "puffer",
  "구스 다운",
  "구스다운",
  "덕 다운",
  "덕다운",
  "다운 패딩",
  "다운패딩",
  "다운 자켓",
  "다운 재킷",
  "다운 점퍼",
  "다운 베스트",
  "down jacket",
  "down parka",
  "down vest",
  "플리스",
  "후리스",
  "fleece",
  "기모",
  "보아",
  "무스탕",
  "shearling",
  "방한",
  "발열",
  "충전재",
  "헤비 니트",
  "헤비니트",
  "heavy knit",
  "헤비 코듀로이",
  "헤비코듀로이",
  "heavy corduroy",
  "두꺼운 울",
  "두꺼운울",
  "퍼 안감",
  "퍼안감",
  "퍼 부츠",
  "퍼부츠",
  "faux fur",
  "fur lining",
  "fur boots",
];
const COLD_WEATHER_OUTER_KEYWORDS = ["코트", "coat"];
const styleGroupCache = new Map<string, string[] | undefined>();
const basicColorCache = new Map<string, boolean>();

function getItemSeasons(item: ClosetItem) {
  if (item.seasons?.length) return item.seasons;
  if (item.season) {
    const seasons = ["봄", "여름", "가을", "겨울", "사계절", "전체"]
      .filter((season) => item.season?.includes(season));

    return seasons;
  }

  return [];
}

function hasUncertainSeason(item: ClosetItem) {
  return item.seasonNeedsReview === true || getItemSeasons(item).length === 0;
}

function hasTrustedSeasonSource(item: ClosetItem) {
  return (
    getItemSeasons(item).length > 0 &&
    ["user", "official_product", "rule"].includes(item.seasonSource || "")
  );
}

function hasUserConfirmedSeason(item: ClosetItem) {
  const isUserEdited = item.userEditedClassificationFields?.includes("season") === true;

  return (
    getItemSeasons(item).length > 0 &&
    item.seasonNeedsReview !== true &&
    (item.seasonSource === "user" || isUserEdited)
  );
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
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
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

function getBaseStyleScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
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

function isStrongColor(color?: string) {
  return STRONG_COLORS.some((keyword) => String(color || "").includes(keyword));
}

function isPointItem(item: ClosetItem) {
  const graphicSize = String(item.graphicSize || "").toLowerCase();
  const hasLargeGraphic = item.graphicDetected === true &&
    ["medium", "large", "중간", "큼"].some((size) => graphicSize.includes(size));
  const hasPattern = Boolean(
    item.pattern && !["무지", "없음", "판단 어려움"].includes(item.pattern)
  );

  return hasLargeGraphic || hasPattern || isStrongColor(item.color);
}

function getStyleScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  let score = getBaseStyleScore(items, reasons, warnings);
  const moods = items.flatMap((item) => item.styleProfile?.mood || []).filter(Boolean);
  const moodCounts = moods.reduce<Record<string, number>>((counts, mood) => {
    counts[mood] = (counts[mood] || 0) + 1;
    return counts;
  }, {});
  const sharedMood = Object.entries(moodCounts).find(([, count]) => count >= 2)?.[0];
  const silhouettes = uniqueValues(items.map((item) => item.styleProfile?.silhouette));
  const pointItemCount = items.filter(isPointItem).length;

  if (sharedMood) {
    score += 3;
    reasons.push(`${sharedMood} 무드가 아이템 사이에 반복되어 코디 분위기가 자연스럽게 이어져요.`);
  }

  if (silhouettes.length === 1 && silhouettes[0]) {
    score += 2;
    reasons.push(`${silhouettes[0]} 실루엣 방향이 일관되어 전체 인상이 정돈돼 보여요.`);
  } else if (silhouettes.length >= 3) {
    score -= 2;
    warnings.push("아이템별 실루엣 방향이 다양해 전체 스타일이 흐려질 수 있어요.");
  }

  if (pointItemCount === 1) {
    score += 2;
    const pointItem = items.find(isPointItem);
    if (pointItem) {
      const bottom = items.find((item) => item.category === "하의");
      if (pointItem.category === "상의" && pointItem.graphicDetected && bottom && !isPointItem(bottom)) {
        reasons.push("그래픽 상의가 포인트라 하의는 단순한 색상과 디자인으로 맞췄어요.");
      } else {
        reasons.push(`${getItemLabel(pointItem)}가 포인트 역할을 하고 나머지 아이템이 이를 받쳐줘요.`);
      }
    }
  } else if (pointItemCount === 2) {
    score -= 2;
    warnings.push("포인트 아이템이 2개라 실제 착용 시 조금 복잡해 보일 수 있어요.");
  } else if (pointItemCount >= 3) {
    score -= 6;
    warnings.push("그래픽·패턴·강한 색상의 포인트가 3개 이상이라 시선이 분산될 수 있어요.");
  }

  return Math.max(0, Math.min(30, score));
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

  if (hasUncertainSeason(item) && !hasTrustedSeasonSource(item)) {
    warnings.push(`${getItemLabel(item)}: 계절 정보가 불확실해 중립적으로 비교했어요.`);
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

  if (hasUncertainSeason(item) && !hasTrustedSeasonSource(item)) return true;
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

function getTemperatureSafetySearchText(item: ClosetItem) {
  return [
    item.confirmedProduct?.productName,
    item.category,
    item.subCategory,
    item.detailCategory,
    item.description,
    getResolvedItemMaterial(item),
    item.pattern,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/다운타운/g, "")
    .replace(/기모노/g, "")
    .replace(/퍼플/g, "");
}

function hasStrongColdWeatherTrait(item: ClosetItem) {
  const itemText = getTemperatureSafetySearchText(item);
  const isColdWeatherOuter =
    item.category === "아우터" &&
    COLD_WEATHER_OUTER_KEYWORDS.some((keyword) => itemText.includes(keyword));

  return (
    isColdWeatherOuter ||
    STRONG_COLD_WEATHER_KEYWORDS.some((keyword) => itemText.includes(keyword))
  );
}

function isSummerLightItem(item: ClosetItem) {
  const lightKeywords = ["반팔", "민소매", "린넨", "얇은", "쿨", "쇼츠", "반바지"];
  const itemText = getItemSearchText(item);

  return lightKeywords.some((keyword) => itemText.includes(keyword));
}

function isWeatherCandidate(item: ClosetItem, weather?: OutfitRecommendationWeather | null) {
  if (!weather || typeof weather.temperature !== "number") return true;

  if (hasUserConfirmedSeason(item)) return true;

  const temperature = weather.temperature;

  if (temperature >= 24) {
    return !hasSpecificSeason(item, "겨울") && !hasStrongColdWeatherTrait(item);
  }

  if (temperature >= 18) {
    return !hasStrongColdWeatherTrait(item);
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
  if (!strictSeasonFilter) {
    return items.filter((item) => {
      const isUserConfirmedMismatch =
        hasUserConfirmedSeason(item) && !isSeasonCandidate(item, currentSeason);

      return !isUserConfirmedMismatch && isWeatherCandidate(item, weather);
    });
  }

  return items.filter((item) =>
    isSeasonCandidate(item, currentSeason) &&
    isWeatherCandidate(item, weather)
  );
}

function getSeasonPriority(item: ClosetItem, currentSeason: string) {
  const seasons = getItemSeasons(item);

  if (hasUncertainSeason(item) && !hasTrustedSeasonSource(item)) return 1;
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

function getBaseColorScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
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

function colorValuesMatch(firstColor?: string, secondColor?: string) {
  const first = String(firstColor || "").trim();
  const second = String(secondColor || "").trim();
  return Boolean(first && second && (first.includes(second) || second.includes(first)));
}

function getColorScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  let score = getBaseColorScore(items, reasons, warnings);
  const itemColors = items.map((item) => item.color).filter((color): color is string => Boolean(color));
  const strongColorCount = itemColors.filter(isStrongColor).length;
  let matchColorCount = 0;
  let avoidColorCount = 0;

  items.forEach((item) => {
    const otherColors = items
      .filter((otherItem) => otherItem.id !== item.id)
      .map((otherItem) => otherItem.color)
      .filter((color): color is string => Boolean(color));

    if ((item.styleProfile?.matchColors || []).some((color) =>
      otherColors.some((otherColor) => colorValuesMatch(color, otherColor))
    )) {
      matchColorCount += 1;
    }

    if ((item.styleProfile?.avoidColors || []).some((color) =>
      otherColors.some((otherColor) => colorValuesMatch(color, otherColor))
    )) {
      avoidColorCount += 1;
    }
  });

  if (matchColorCount > 0) {
    score += Math.min(4, matchColorCount * 2);
    reasons.push("아이템의 AI 색상 프로필에서 추천한 색 조합이 실제 코디에 반영됐어요.");
  }

  if (avoidColorCount > 0) {
    score -= Math.min(8, avoidColorCount * 4);
    warnings.push("일부 아이템의 피할 색상 정보와 겹쳐 색 조합 점수를 낮췄어요.");
  }

  if (strongColorCount === 1) {
    score += 1;
    reasons.push("강한 색상은 하나만 사용해 포인트가 분명하고 과하지 않아요.");
  } else if (strongColorCount >= 2) {
    score -= 5;
    warnings.push("강한 색상이 2개 이상이라 서로 경쟁하고 산만해 보일 수 있어요.");
  }

  return Math.max(0, Math.min(25, score));
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

function getBaseFitScore(top: ClosetItem, bottom: ClosetItem, reasons: string[], warnings: string[]) {
  const topFit = `${top.fit || ""} ${top.styleProfile?.fit || ""} ${top.styleProfile?.silhouette || ""}`;
  const bottomFit = `${bottom.fit || ""} ${bottom.styleProfile?.fit || ""} ${bottom.styleProfile?.silhouette || ""} ${bottom.detailCategory || ""} ${bottom.subCategory || ""}`;
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

  if (topIsOversized && bottomIsSlim) {
    warnings.push("오버핏 상의와 슬림 하의의 볼륨 차이가 커서 상체가 더 커 보일 수 있어요.");
    return isCasualOrStreet ? 11 : 9;
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

function getFitScore(top: ClosetItem, bottom: ClosetItem, reasons: string[], warnings: string[]) {
  let score = getBaseFitScore(top, bottom, reasons, warnings);
  const topLength = `${top.styleProfile?.lengthType || ""} ${top.description || ""}`;
  const bottomLength = `${bottom.styleProfile?.lengthType || ""} ${bottom.description || ""}`;
  const bottomShape = `${bottom.fit || ""} ${bottom.styleProfile?.silhouette || ""} ${bottom.detailCategory || ""}`;
  const topIsShort = includesAny(topLength, ["크롭", "짧은", "숏"]);
  const topIsLong = includesAny(topLength, ["롱", "긴", "롱라인"]);
  const bottomIsLong = includesAny(bottomLength, ["롱", "긴", "발목", "맥시"]);
  const bottomIsWide = includesAny(bottomShape, WIDE_FITS);

  if (topIsShort && bottomIsWide) {
    score += 3;
    reasons.push("크롭 또는 짧은 상의와 와이드 하의 조합이라 비율이 또렷하고 균형감이 좋아요.");
  }

  if (topIsLong && bottomIsLong) {
    score -= 3;
    warnings.push("긴 상의와 긴 하의가 함께 있어 전체 비율이 무겁고 다리가 짧아 보일 수 있어요.");
  }

  return Math.max(0, Math.min(20, score));
}

type ResolvedGarmentProfile = {
  source: "measurement" | "impression" | "fallback";
  silhouette: NonNullable<GarmentProfile["silhouette"]>;
  volume: number;
  visualWeight: number;
  lengthBalance: NonNullable<GarmentProfile["lengthBalance"]>;
  pointLevel: number;
  structure: NonNullable<GarmentProfile["structure"]>;
  drape: NonNullable<GarmentProfile["drape"]>;
};

function getGarmentSearchText(item: ClosetItem) {
  const resolvedMaterial = getResolvedItemMaterial(item);

  return [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.fit,
    item.description,
    resolvedMaterial,
    item.styleProfile?.fit,
    item.styleProfile?.silhouette,
    item.styleProfile?.lengthType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getFallbackSilhouette(item: ClosetItem): ResolvedGarmentProfile["silhouette"] {
  const text = getGarmentSearchText(item);

  if (includesAny(text, ["크롭", "짧은 기장", "cropped"])) return "cropped";
  if (includesAny(text, ["세미오버", "세미 오버", "semi oversized"])) return "semiOversized";
  if (includesAny(text, ["오버핏", "오버사이즈", "루즈", "oversized"])) return "oversized";
  if (includesAny(text, ["와이드", "배기", "wide"])) return "wide";
  if (includesAny(text, ["슬림", "스키니", "타이트", "slim"])) return "slim";
  if (includesAny(text, ["롱", "긴 기장", "맥시", "long"])) return "long";

  return "regular";
}

function getFallbackLengthBalance(
  item: ClosetItem,
  silhouette: ResolvedGarmentProfile["silhouette"]
): ResolvedGarmentProfile["lengthBalance"] {
  const text = getGarmentSearchText(item);

  if (silhouette === "cropped" || includesAny(text, ["크롭", "숏", "짧은 기장"])) return "short";
  if (silhouette === "long" || includesAny(text, ["롱", "맥시", "긴 기장"])) return "long";
  return "regular";
}

function getFallbackStructure(item: ClosetItem): ResolvedGarmentProfile["structure"] {
  const text = getGarmentSearchText(item);

  if (includesAny(text, ["데님", "가죽", "레더", "캔버스", "테일러드", "블레이저"])) {
    return "stiff";
  }
  if (includesAny(text, ["니트", "린넨", "레이온", "실크", "저지", "부드러운"])) {
    return "soft";
  }
  return "normal";
}

function getCurrentSizeMeasurement(item: ClosetItem) {
  const sizeGuide = item.confirmedProduct?.productSizeGuide;

  if (!sizeGuide?.sizes?.length || !item.size) return undefined;
  return sizeGuide.sizes.find((measurement) =>
    doesProductSizeRowMatch(measurement, item.size)
  );
}

function getMeasuredVolume(item: ClosetItem) {
  const measurement = getCurrentSizeMeasurement(item);
  if (!measurement) return undefined;

  if (item.category === "상의" || item.category === "아우터") {
    if (typeof measurement.chest !== "number") return undefined;
    if (measurement.chest >= 62) return 8;
    if (measurement.chest >= 57) return 6;
    if (measurement.chest <= 50) return 2;
    return 4;
  }

  if (item.category === "하의") {
    if (
      (typeof measurement.thigh === "number" && measurement.thigh >= 35) ||
      (typeof measurement.hem === "number" && measurement.hem >= 26)
    ) {
      return 8;
    }
    if (
      typeof measurement.thigh === "number" &&
      measurement.thigh <= 28 &&
      typeof measurement.hem === "number" &&
      measurement.hem <= 19
    ) {
      return 2;
    }
  }

  return undefined;
}

function getMeasuredLengthBalance(
  item: ClosetItem
): ResolvedGarmentProfile["lengthBalance"] | undefined {
  const totalLength = getCurrentSizeMeasurement(item)?.totalLength;
  if (typeof totalLength !== "number") return undefined;

  if (item.category === "상의" || item.category === "아우터") {
    if (totalLength <= 58) return "short";
    if (totalLength >= 75) return "long";
  }
  if (item.category === "하의") {
    if (totalLength <= 90) return "short";
    if (totalLength >= 105) return "long";
  }

  return "regular";
}

function getResolvedGarmentProfile(
  item: ClosetItem,
  useImpression = true
): ResolvedGarmentProfile {
  const explicitProfile = item.garmentProfile;
  const impressionProfile = useImpression ? explicitProfile : undefined;
  const currentMeasurement = getCurrentSizeMeasurement(item);
  const measuredVolume = getMeasuredVolume(item);
  const source: ResolvedGarmentProfile["source"] = currentMeasurement
    ? "measurement"
    : explicitProfile
      ? "impression"
      : "fallback";
  const fallbackSilhouette = getFallbackSilhouette(item);
  const silhouette =
    measuredVolume !== undefined
      ? item.category === "하의"
        ? measuredVolume >= 7
          ? "wide"
          : measuredVolume <= 2
            ? "slim"
            : fallbackSilhouette
        : measuredVolume >= 8
          ? "oversized"
          : measuredVolume >= 6
            ? "semiOversized"
            : measuredVolume <= 2
              ? "slim"
              : fallbackSilhouette
      : impressionProfile?.silhouette || fallbackSilhouette;
  const lengthBalance =
    getMeasuredLengthBalance(item) ||
    getFallbackLengthBalance(item, silhouette);
  const structure = impressionProfile?.structure || getFallbackStructure(item);
  const text = getGarmentSearchText(item);
  const defaultVolume: Record<ResolvedGarmentProfile["silhouette"], number> = {
    slim: 2,
    regular: 4,
    semiOversized: 6,
    oversized: 8,
    wide: 8,
    cropped: 4,
    long: 6,
  };
  const defaultVisualWeight =
    structure === "stiff" || includesAny(text, ["패딩", "코트", "울", "두꺼운"])
      ? 7
      : structure === "soft"
        ? 4
        : 5;
  const fallbackPointLevel =
    (isPointItem(item) ? 6 : 2) +
    (item.graphicDetected && String(item.graphicSize || "").includes("큼") ? 2 : 0);
  const baseVolume = measuredVolume ?? defaultVolume[silhouette];
  const impressionVolume =
    typeof impressionProfile?.volume === "number" ? impressionProfile.volume : baseVolume;
  const basePointLevel = Math.min(10, fallbackPointLevel);
  const impressionPointLevel =
    typeof impressionProfile?.pointLevel === "number"
      ? impressionProfile.pointLevel
      : basePointLevel;

  return {
    source,
    silhouette,
    volume: Math.round(baseVolume * 0.75 + impressionVolume * 0.25),
    visualWeight: impressionProfile?.visualWeight ?? Math.min(10, defaultVisualWeight),
    lengthBalance,
    pointLevel: Math.round(basePointLevel * 0.75 + impressionPointLevel * 0.25),
    structure,
    drape:
      impressionProfile?.drape ||
      (structure === "soft" ? "high" : structure === "stiff" ? "low" : "medium"),
  };
}

function getSourceWeight(source: ResolvedGarmentProfile["source"]) {
  if (source === "measurement") return 1;
  if (source === "impression") return 0.5;
  return 0.25;
}

function blendScoreBySource(
  score: number,
  neutralScore: number,
  maximumScore: number,
  sources: ResolvedGarmentProfile["source"][]
) {
  const averageWeight =
    sources.reduce((total, source) => total + getSourceWeight(source), 0) /
    Math.max(1, sources.length);
  const blendedScore = neutralScore + (score - neutralScore) * averageWeight;

  return Math.max(0, Math.min(maximumScore, Math.round(blendedScore)));
}

function getSilhouetteScore(
  top: ClosetItem,
  bottom: ClosetItem,
  reasons: string[],
  warnings: string[]
) {
  const topProfile = getResolvedGarmentProfile(top);
  const bottomProfile = getResolvedGarmentProfile(bottom);
  const topLoose = ["semiOversized", "oversized"].includes(topProfile.silhouette);
  const bottomWide = bottomProfile.silhouette === "wide";
  const bottomSlim = bottomProfile.silhouette === "slim";
  let score = 25;

  if (topProfile.silhouette === "cropped" && bottomWide) {
    score = 35;
    reasons.push("짧은 상의와 와이드 하의가 만나 상하 비율과 실루엣 균형이 좋아요.");
  } else if (topLoose && bottomWide) {
    score = topProfile.silhouette === "semiOversized" ? 34 : 31;
    reasons.push(
      topProfile.silhouette === "semiOversized"
        ? "상의가 세미오버핏이라 와이드 하의와 실루엣 균형이 좋아요."
        : "여유 있는 상의와 와이드 하의가 자연스러운 볼륨 흐름을 만들어요."
    );
  } else if (["slim", "regular"].includes(topProfile.silhouette) && bottomWide) {
    score = 32;
    reasons.push("상체는 정돈되고 하체에 여유가 있어 실루엣 대비가 안정적이에요.");
  } else if (topLoose && bottomSlim) {
    score = 19;
    warnings.push("상의 볼륨에 비해 하의가 지나치게 슬림해 상하 균형이 끊겨 보일 수 있어요.");
  } else if (
    topProfile.lengthBalance === "long" &&
    bottomProfile.lengthBalance === "long"
  ) {
    score = 18;
    warnings.push("상의와 하의 기장이 모두 길어 전체 비율이 무겁고 답답해 보일 수 있어요.");
  } else if (
    topProfile.silhouette === "regular" &&
    ["regular", "slim"].includes(bottomProfile.silhouette)
  ) {
    score = 29;
    reasons.push("상의와 하의의 기본 실루엣이 정돈되어 무난하게 이어져요.");
  }

  if (
    topProfile.volume >= 7 &&
    bottomProfile.volume >= 7 &&
    topProfile.lengthBalance !== "short"
  ) {
    score -= 8;
    warnings.push("두 아이템 모두 볼륨이 커서 전체 실루엣이 부해 보일 수 있어요.");
  }

  const visualWeightDifference = Math.abs(
    topProfile.visualWeight - bottomProfile.visualWeight
  );
  if (visualWeightDifference <= 2) {
    score += 2;
    reasons.push("상의와 하의의 시각적 무게감이 비슷해 한쪽으로 치우치지 않아요.");
  } else if (visualWeightDifference >= 6) {
    score -= 5;
    warnings.push("상의와 하의의 시각적 무게감 차이가 커서 조합이 따로 보일 수 있어요.");
  } else if (topProfile.visualWeight >= 7 && bottomProfile.pointLevel <= 4) {
    reasons.push("상의의 시각적 무게감이 강해서 하의는 단순한 실루엣으로 받쳐주는 조합이에요.");
  }

  const impressionSilhouettes = [
    top.garmentProfile?.silhouette,
    bottom.garmentProfile?.silhouette,
  ].filter(Boolean);
  if (impressionSilhouettes.length > 0) {
    const impressionSupportsBalance =
      top.garmentProfile?.silhouette === "cropped" && bottomProfile.silhouette === "wide";
    score += impressionSupportsBalance ? 1 : 0;
  }

  return blendScoreBySource(
    score,
    25,
    35,
    [topProfile.source, bottomProfile.source]
  );
}

function getWearFitBalanceScore(
  top: ClosetItem,
  bottom: ClosetItem,
  profile: UserProfile | null | undefined,
  reasons: string[],
  warnings: string[]
) {
  const topProfile = getResolvedGarmentProfile(top, false);
  const bottomProfile = getResolvedGarmentProfile(bottom, false);
  const volumeDifference = Math.abs(topProfile.volume - bottomProfile.volume);
  const bodyType = profile?.bodyType || "";
  let score = 18;

  if (volumeDifference <= 3) {
    score += 3;
    reasons.push("상하의 볼륨 차이가 과하지 않아 착장 구성의 연결감이 좋아요.");
  } else if (volumeDifference >= 6) {
    score -= 4;
    warnings.push("상하의 볼륨 차이가 커서 착장 구성에서 한쪽만 과장되어 보일 수 있어요.");
  }

  if (topProfile.lengthBalance === "short" && bottomProfile.lengthBalance === "long") {
    score += 3;
  }
  if (topProfile.lengthBalance === "long" && bottomProfile.lengthBalance === "long") {
    score -= 4;
  }
  if (topProfile.structure === "stiff" && bottomProfile.structure === "stiff") {
    score -= 2;
    warnings.push("상하의가 모두 각이 강해 움직임이 딱딱하고 무거워 보일 수 있어요.");
  } else if (topProfile.drape === "high" || bottomProfile.drape === "high") {
    score += 1;
  }
  if (
    (bodyType.includes("상체") || bodyType.includes("역삼각")) &&
    getCurrentSizeMeasurement(top) &&
    topProfile.volume >= 7
  ) {
    score -= 2;
    warnings.push("현재 체형 정보에서는 상의 볼륨이 상체를 더 크게 보이게 할 수 있어요.");
  }
  if (
    (bodyType.includes("하체") || bodyType.includes("삼각")) &&
    getCurrentSizeMeasurement(bottom) &&
    bottomProfile.volume >= 8
  ) {
    score -= 2;
    warnings.push("현재 체형 정보에서는 하의 볼륨이 하체를 더 무겁게 보이게 할 수 있어요.");
  }

  const measurementCount = [topProfile, bottomProfile].filter(
    (itemProfile) => itemProfile.source === "measurement"
  ).length;
  const measurementWeight = 0.25 + measurementCount * 0.375;
  const weightedScore = 18 + (score - 18) * measurementWeight;

  return Math.max(0, Math.min(25, Math.round(weightedScore)));
}

function getPointBalanceScore(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[]
) {
  const profiles = items.map((item) => getResolvedGarmentProfile(item));
  const weightedPointLevels = profiles.map((profile) => {
    const neutralPointLevel = 4;
    return neutralPointLevel +
      (profile.pointLevel - neutralPointLevel) * getSourceWeight(profile.source);
  });
  const strongPointItems = weightedPointLevels.filter((pointLevel) => pointLevel >= 7);
  const totalPointLevel = weightedPointLevels.reduce(
    (total, pointLevel) => total + pointLevel,
    0
  );

  if (strongPointItems.length === 0 && totalPointLevel <= items.length * 4) {
    reasons.push("포인트 강도가 낮아 다른 요소와 충돌하지 않는 안정적인 조합이에요.");
    return blendScoreBySource(
      13,
      10,
      15,
      profiles.map((profile) => profile.source)
    );
  }
  if (strongPointItems.length === 1) {
    reasons.push("포인트 아이템은 하나만 두고 나머지를 차분하게 받쳐 시선이 정돈돼요.");
    return blendScoreBySource(
      15,
      10,
      15,
      profiles.map((profile) => profile.source)
    );
  }
  if (strongPointItems.length === 2) {
    warnings.push("포인트가 강한 아이템이 두 개라 실제 착용 시 조금 복잡해 보일 수 있어요.");
    return blendScoreBySource(
      8,
      10,
      15,
      profiles.map((profile) => profile.source)
    );
  }

  warnings.push("포인트가 강한 아이템이 많아 코디의 중심이 분산될 수 있어요.");
  return blendScoreBySource(
    3,
    10,
    15,
    profiles.map((profile) => profile.source)
  );
}

function getColorSupportScore(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[]
) {
  const colorReasons: string[] = [];
  const colorWarnings: string[] = [];
  const rawColorScore = getColorScore(items, colorReasons, colorWarnings);

  reasons.push(...colorReasons.slice(0, 1));
  warnings.push(...colorWarnings);
  return Math.max(0, Math.min(10, Math.round(rawColorScore * 0.4)));
}

function getStyleSupportScore(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[]
) {
  const styleReasons: string[] = [];
  const styleWarnings: string[] = [];
  const rawStyleScore = getBaseStyleScore(items, styleReasons, styleWarnings);

  reasons.push(...styleReasons.slice(0, 1));
  warnings.push(...styleWarnings);
  return Math.max(0, Math.min(5, Math.round(rawStyleScore / 5)));
}

function getSeasonWeatherBaseScore(isSeasonMatched: boolean) {
  return isSeasonMatched ? 5 : 0;
}

function getRotationBreakdownScore(items: ClosetItem[], reasons: string[]) {
  const rawRotationScore = getRotationScore(items, reasons);
  return Math.max(0, Math.min(5, Math.round((rawRotationScore + 20) / 8)));
}

function getSizeWarnings(
  items: ClosetItem[],
  profile?: UserProfile | null,
  fitSuitabilityCache = new Map<string, ReturnType<typeof getFitSuitability>>()
) {
  if (!profile) return ["프로필 사이즈가 없어 사이즈 적합도는 참고하지 못했어요."];

  return items
    .filter((item) => ["상의", "하의", "아우터"].includes(item.category))
    .map((item) => {
      if (!fitSuitabilityCache.has(item.id)) {
        fitSuitabilityCache.set(item.id, getFitSuitability(item, profile));
      }

      const result = fitSuitabilityCache.get(item.id)!;
      const hasSizeWarning =
        result.fitResult === "small" ||
        ["작을 수", "클 수", "많이 여유로울 수"].some((keyword) =>
          result.status.includes(keyword)
        );

      return hasSizeWarning ? `${getItemLabel(item)}: ${result.status}` : "";
    })
    .filter(Boolean);
}

function isImportantWarning(warning: string) {
  return [
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
}

function getWarningPenalty(warnings: string[]) {
  return warnings.reduce(
    (totalPenalty, warning) => totalPenalty + (isImportantWarning(warning) ? 6 : 3),
    0
  );
}

function getCoreMeasurementSourceCount(items: ClosetItem[]) {
  return items
    .filter((item) => item.category === "상의" || item.category === "하의")
    .filter((item) => getResolvedGarmentProfile(item).source === "measurement")
    .length;
}

function applyScoreCaps(
  score: number,
  warnings: string[],
  reasons: string[],
  breakdown: OutfitRecommendation["breakdown"],
  measurementSourceCount: number
) {
  let maximumScore = 100;

  if (warnings.length >= 1) maximumScore = Math.min(maximumScore, 88);
  if (warnings.length >= 2) maximumScore = Math.min(maximumScore, 82);
  if (warnings.some(isImportantWarning)) maximumScore = Math.min(maximumScore, 78);
  if (reasons.length < 3) maximumScore = Math.min(maximumScore, 78);
  if (breakdown.silhouette < 22) maximumScore = Math.min(maximumScore, 75);
  if (breakdown.wearFit < 16) maximumScore = Math.min(maximumScore, 78);
  if (breakdown.pointBalance < 9) maximumScore = Math.min(maximumScore, 82);
  if (measurementSourceCount === 0) maximumScore = Math.min(maximumScore, 82);
  if (measurementSourceCount === 1) maximumScore = Math.min(maximumScore, 88);

  const isExceptionalCombination =
    measurementSourceCount === 2 &&
    warnings.length === 0 &&
    reasons.length >= 4 &&
    breakdown.silhouette >= 32 &&
    breakdown.wearFit >= 22 &&
    breakdown.pointBalance >= 13 &&
    breakdown.colorSupport >= 8 &&
    breakdown.styleSupport >= 4 &&
    breakdown.weather >= 4;

  if (!isExceptionalCombination) maximumScore = Math.min(maximumScore, 89);

  return Math.min(maximumScore, Math.max(0, Math.round(score)));
}

function getVersatilityScore(items: ClosetItem[], reasons: string[], warnings: string[]) {
  if (items.length === 0) return 0;

  const itemScores = items.map((item) => {
    let score = 0;
    const pattern = item.pattern || "";
    const graphicSize = String(item.graphicSize || "").toLowerCase();
    const seasons = getItemSeasons(item).filter((season) => !UNIVERSAL_SEASONS.includes(season));

    if (isBasicColor(item.color)) score += 2;
    if (["", "무지", "없음", "판단 어려움"].includes(pattern)) score += 1;
    if (item.graphicDetected === false) score += 1;
    if (["상의", "하의", "신발", "아우터"].includes(item.category)) score += 1;

    if (["large", "큼"].some((size) => graphicSize.includes(size))) score -= 2;
    if (isStrongColor(item.color)) score -= 2;
    if (COMPLEX_PATTERNS.some((complexPattern) => pattern.includes(complexPattern))) score -= 2;
    if (seasons.length === 1) score -= 1;

    return score;
  });
  const score = Math.round(
    itemScores.reduce((total, itemScore) => total + itemScore, 0) / itemScores.length
  );
  const normalizedScore = Math.max(-5, Math.min(5, score));

  if (normalizedScore >= 3) {
    reasons.push("베이직 컬러와 단순한 디자인이 중심이라 여러 상황에 활용하기 좋은 조합이에요.");
  } else if (normalizedScore <= -2) {
    warnings.push("큰 그래픽이나 강한 패턴이 많아 다른 옷과 돌려 입는 범용성은 낮을 수 있어요.");
  }

  return normalizedScore;
}

function getRotationScore(items: ClosetItem[], reasons: string[]) {
  if (items.length === 0) return 0;

  const now = Date.now();
  let hasRecentlyWornItem = false;
  let hasLongUnwornItem = false;
  let hasFrequentlyWornItem = false;
  const itemScores = items.map((item) => {
    let score = 0;
    const wornAt = item.lastWornAt ? new Date(item.lastWornAt).getTime() : Number.NaN;
    const daysSinceWorn = Number.isNaN(wornAt)
      ? Number.POSITIVE_INFINITY
      : Math.max(0, (now - wornAt) / (1000 * 60 * 60 * 24));
    const wearCount = item.wearCount || 0;

    if (daysSinceWorn <= 3) {
      score -= 10;
      hasRecentlyWornItem = true;
    } else if (daysSinceWorn <= 7) {
      score -= 5;
      hasRecentlyWornItem = true;
    } else if (daysSinceWorn >= 30) {
      score += 5;
      hasLongUnwornItem = true;
    }

    if (wearCount <= 1) {
      score += 5;
    } else if (wearCount >= 5) {
      score -= 5;
      hasFrequentlyWornItem = true;
    }

    return score;
  });
  const score = Math.round(
    itemScores.reduce((total, itemScore) => total + itemScore, 0) / itemScores.length
  );
  const preferenceAdjustment = items.reduce((adjustment, item) => {
    if (item.recommendationPreference === "prefer") return adjustment + 5;
    if (item.recommendationPreference === "less") return adjustment - 10;
    return adjustment;
  }, 0);
  const normalizedScore = Math.max(-20, Math.min(20, score + preferenceAdjustment));
  const hasPreferredItem = items.some((item) => item.recommendationPreference === "prefer");
  const hasLessPreferredItem = items.some((item) => item.recommendationPreference === "less");

  if (hasPreferredItem) {
    reasons.push("자주 추천으로 설정한 아이템을 이번 조합에 우선 반영했어요.");
  }

  if (hasLessPreferredItem) {
    reasons.push("잠시 덜 추천으로 설정한 아이템은 추천 우선순위를 낮췄어요.");
  } else if (normalizedScore >= 5 && hasLongUnwornItem) {
    reasons.push("최근 코디 저장에 덜 포함된 아이템을 우선 반영해 추천 구성을 다양하게 했어요.");
  } else if (normalizedScore <= -5 && (hasRecentlyWornItem || hasFrequentlyWornItem)) {
    reasons.push("최근 자주 저장한 옷은 추천 우선순위를 낮췄어요.");
  }

  return normalizedScore;
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

  const weatherBreakdownScore = Math.max(
    0,
    Math.min(5, recommendation.breakdown.weather + Math.round(weatherScore / 4))
  );
  const breakdown = {
    ...recommendation.breakdown,
    weather: weatherBreakdownScore,
  };
  const score = applyScoreCaps(
    recommendation.score + weatherBreakdownScore - recommendation.breakdown.weather,
    warnings,
    reasons,
    breakdown,
    getCoreMeasurementSourceCount(recommendation.items)
  );

  return {
    ...recommendation,
    score,
    grade: getGrade(score),
    reasons,
    warnings,
    breakdown,
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
  const topProfileSource = getResolvedGarmentProfile(top).source;
  const bottomProfileSource = getResolvedGarmentProfile(bottom).source;
  const measurementSourceCount = [topProfileSource, bottomProfileSource].filter(
    (source) => source === "measurement"
  ).length;
  const hasUncertainSeasonItem = items.some(hasUncertainSeason);
  const isSeasonMatched = items.every((item) => isSeasonAllowed(item, currentSeason, warnings));

  if (measurementSourceCount === 2) {
    reasons.push("상품 실측을 기준으로 상하의 실루엣 균형을 봤어요.");
  } else if (measurementSourceCount === 1) {
    reasons.push("한 아이템은 상품 실측을 사용하고, 나머지는 보수적인 추정값으로 판단했어요.");
  } else if (
    topProfileSource === "impression" ||
    bottomProfileSource === "impression"
  ) {
    reasons.push("실측이 없어 사진상 의류 인상으로 보수적으로 판단했어요.");
  } else {
    reasons.push("실측과 사진 분석값이 없어 옷 종류와 설명만으로 보수적으로 판단했어요.");
  }

  if (!isSeasonMatched) {
    warnings.push(`${currentSeason} 기준으로 계절감이 맞지 않는 아이템이 포함되어 점수를 낮게 봤어요.`);
  } else if (hasUncertainSeasonItem) {
    reasons.push("계절 정보가 불확실한 아이템은 사계절로 단정하지 않고 중립적으로 비교했어요.");
  } else {
    reasons.push(`${currentSeason}에 입기 좋은 계절 정보의 아이템들로 구성됐어요.`);
  }

  const silhouette = getSilhouetteScore(top, bottom, reasons, warnings);
  const wearFit = getWearFitBalanceScore(top, bottom, profile, reasons, warnings);
  const pointBalance = getPointBalanceScore(items, reasons, warnings);
  const colorSupport = getColorSupportScore(items, reasons, warnings);
  const styleSupport = getStyleSupportScore(items, reasons, warnings);
  const weather = getSeasonWeatherBaseScore(isSeasonMatched);
  const rotation = getRotationBreakdownScore(items, reasons);
  const detailMaterialAdjustment = getDetailMaterialAdjustment(items, currentSeason);

  reasons.unshift(...detailMaterialAdjustment.reasons);
  warnings.unshift(...detailMaterialAdjustment.warnings);

  if (shoes) {
    reasons.push("신발까지 포함되어 코디 완성도는 높아요.");
  } else {
    warnings.push("신발이 빠져 완성 코디로 보기 어렵고 실제 착장 완성도가 낮아요.");
  }

  if (silhouette < 22 && colorSupport >= 8) {
    warnings.push("색상은 안정적이지만 실루엣 균형이 약해 강한 추천은 아니에요.");
  }

  const warningPenalty = getWarningPenalty(warnings);
  const breakdown: OutfitRecommendation["breakdown"] = {
    silhouette,
    wearFit,
    pointBalance,
    colorSupport,
    styleSupport,
    weather,
    rotation,
  };
  const rawScore =
    silhouette +
    wearFit +
    pointBalance +
    colorSupport +
    styleSupport +
    weather +
    rotation +
    detailMaterialAdjustment.score;
  const score = applyScoreCaps(
    rawScore - warningPenalty,
    warnings,
    reasons,
    breakdown,
    measurementSourceCount
  );
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
    breakdown,
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

function getItemCombinationKey(recommendation: OutfitRecommendation) {
  return getSortedItemIds(recommendation.items).join("|");
}

function isDisplayableRecommendation(recommendation: OutfitRecommendation) {
  return recommendation.score >= MIN_DISPLAY_RECOMMENDATION_SCORE;
}

function filterDisplayableRecommendations(recommendations: OutfitRecommendation[]) {
  return recommendations.filter(isDisplayableRecommendation);
}

function stripAlternatives(recommendation: OutfitRecommendation): OutfitRecommendation {
  return {
    ...recommendation,
    alternativeCount: 0,
    alternatives: [],
  };
}

function getAlternativeRecommendations(
  baseRecommendation: OutfitRecommendation,
  recommendations: OutfitRecommendation[]
) {
  const baseCoreKey = getCoreOutfitKey(baseRecommendation);
  const baseItemKey = getItemCombinationKey(baseRecommendation);
  const usedItemKeys = new Set<string>();
  const alternatives: OutfitRecommendation[] = [];

  for (const recommendation of recommendations) {
    if (!isDisplayableRecommendation(recommendation)) continue;

    const itemKey = getItemCombinationKey(recommendation);

    if (itemKey === baseItemKey) continue;
    if (getCoreOutfitKey(recommendation) === baseCoreKey) continue;
    if (usedItemKeys.has(itemKey)) continue;

    usedItemKeys.add(itemKey);
    alternatives.push(stripAlternatives(recommendation));

    if (alternatives.length >= 3) break;
  }

  return alternatives;
}

function getBestRecommendationByCoreOutfit(recommendations: OutfitRecommendation[]) {
  const recommendationMap = new Map<string, OutfitRecommendation[]>();

  recommendations.forEach((recommendation) => {
    const coreKey = getCoreOutfitKey(recommendation);
    const currentRecommendations = recommendationMap.get(coreKey) || [];

    recommendationMap.set(coreKey, [...currentRecommendations, recommendation]);
  });

  const sortedRecommendations = [...recommendations].sort(compareRecommendations);

  return Array.from(recommendationMap.values()).map((coreRecommendations) => {
    const [bestRecommendation] = [...coreRecommendations].sort(compareRecommendations);
    const alternatives = getAlternativeRecommendations(bestRecommendation, sortedRecommendations);

    return {
      ...bestRecommendation,
      alternativeCount: alternatives.length,
      alternatives,
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

function getMissingCoreCategories(items: ClosetItem[]) {
  const missingCategories: string[] = [];

  if (byCategory(items, "상의").length === 0) missingCategories.push("상의");
  if (byCategory(items, "하의").length === 0) missingCategories.push("하의");

  return missingCategories;
}

function getEmptyReason({
  items,
  recommendationCandidates,
  displayableRecommendations,
  recommendations,
  savedOutfitItemIds,
}: {
  items: ClosetItem[];
  recommendationCandidates: OutfitRecommendation[];
  displayableRecommendations: OutfitRecommendation[];
  recommendations: OutfitRecommendation[];
  savedOutfitItemIds: string[][];
}): OutfitRecommendationEmptyReason | undefined {
  if (recommendations.length > 0) return undefined;

  const missingCategories = getMissingCoreCategories(items);
  if (missingCategories.length > 0) return "missing_core_category";
  if (displayableRecommendations.length > 0 && savedOutfitItemIds.length > 0) {
    return "saved_combinations_exhausted";
  }
  if (recommendationCandidates.length > 0) return "below_quality_threshold";

  return "below_quality_threshold";
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
  const displayableRecommendations = filterDisplayableRecommendations(
    excludeSavedCombinations(recommendations, savedOutfitItemIds)
  );
  const sortedRecommendations = getBestRecommendationByCoreOutfit(
    displayableRecommendations
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
  const displayableRecommendations = filterDisplayableRecommendations(recommendationCandidates);
  const missingCategories = getMissingCoreCategories(items);

  return {
    recommendations,
    hasAnyRecommendation: allRecommendations.length > 0,
    emptyReason: getEmptyReason({
      items,
      recommendationCandidates,
      displayableRecommendations,
      recommendations,
      savedOutfitItemIds,
    }),
    missingCategories: missingCategories.length > 0 ? missingCategories : undefined,
  };
}
