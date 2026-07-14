import { ClosetItem } from "@/utils/storage";
import { normalizeProductColor } from "@/utils/color";

export type RecommendedShoppingItem = {
  id: string;
  title: string;
  category: string;
  reason: string;
  searchQuery: string;
  priority: "high" | "medium" | "low";
  relatedClosetItemIds?: string[];
};

type RecommendationInput = Omit<RecommendedShoppingItem, "id">;
type Season = "봄" | "여름" | "가을" | "겨울";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const BASIC_COLORS = ["블랙", "화이트", "아이보리", "그레이", "네이비", "베이지"];

function getItemText(item: ClosetItem) {
  return [
    item.detailCategory,
    item.subCategory,
    item.category,
    item.color,
    normalizeProductColor(item.color),
    item.style,
    ...(item.styleTags || []),
    ...(item.styleProfile?.mood || []),
    ...(item.styleProfile?.usage || []),
    item.styleProfile?.formality,
    item.confirmedProduct?.brand,
    item.confirmedProduct?.productName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getItemSeasons(item: ClosetItem) {
  if (item.seasons?.length) return item.seasons;
  if (item.season) return item.season.split(/[,/]/).map((season) => season.trim()).filter(Boolean);
  return [];
}

function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울";
}

function getSeasonOuterRecommendation(season: Season) {
  if (season === "여름") return { title: "가벼운 셔츠 아우터", query: "여름 린넨 셔츠 아우터" };
  if (season === "겨울") return { title: "보온성 있는 겨울 아우터", query: "겨울 데일리 코트 패딩" };
  if (season === "봄") return { title: "가벼운 봄 재킷", query: "봄 미니멀 재킷" };
  return { title: "활용도 높은 가을 재킷", query: "가을 데일리 재킷" };
}

function inferCategory(query: string) {
  if (/팬츠|슬랙스|데님|바지/.test(query)) return "하의";
  if (/스니커즈|운동화|로퍼|부츠|신발/.test(query)) return "신발";
  if (/재킷|자켓|코트|패딩|아우터|가디건/.test(query)) return "아우터";
  if (/볼캡|가방|백|모자|액세서리/.test(query)) return "액세서리";
  return "상의";
}

function makeRecommendationId(title: string, index: number) {
  const normalizedTitle = title.replace(/\s+/g, "-").replace(/[^가-힣a-zA-Z0-9-]/g, "");
  return `shopping-${normalizedTitle || "item"}-${index}`;
}

function finalizeRecommendations(recommendations: RecommendationInput[]) {
  const deduplicated = new Map<string, RecommendationInput>();

  recommendations.forEach((recommendation) => {
    const key = `${recommendation.category}:${recommendation.title}`;
    const existing = deduplicated.get(key);
    if (!existing || PRIORITY_ORDER[recommendation.priority] < PRIORITY_ORDER[existing.priority]) {
      deduplicated.set(key, recommendation);
    }
  });

  return [...deduplicated.values()]
    .sort((first, second) => PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority])
    .slice(0, 6)
    .map((recommendation, index) => ({
      ...recommendation,
      id: makeRecommendationId(recommendation.title, index),
    }));
}

export function getRecommendedShoppingItems(items: ClosetItem[]): RecommendedShoppingItem[] {
  if (items.length === 0) return [];

  const recommendations: RecommendationInput[] = [];
  const byCategory = (category: string) => items.filter((item) => item.category === category);
  const tops = byCategory("상의");
  const bottoms = byCategory("하의");
  const shoes = byCategory("신발");
  const outers = byCategory("아우터");
  const accessories = byCategory("액세서리");
  const currentSeason = getCurrentSeason();
  const currentSeasonItems = items.filter((item) => {
    const seasons = getItemSeasons(item);
    return seasons.length === 0 || seasons.includes(currentSeason) || seasons.includes("사계절") || seasons.includes("전체");
  });
  const seasonTaggedItems = items.filter((item) => getItemSeasons(item).length > 0);
  const explicitlyMatchedSeasonItems = seasonTaggedItems.filter((item) => {
    const seasons = getItemSeasons(item);
    return seasons.includes(currentSeason) || seasons.includes("사계절") || seasons.includes("전체");
  });
  const itemTexts = new Map(items.map((item) => [item.id, getItemText(item)]));
  const matchingIds = (keywords: string[]) =>
    items.filter((item) => keywords.some((keyword) => itemTexts.get(item.id)?.includes(keyword))).map((item) => item.id);

  if (tops.length > 0 && bottoms.length === 0) {
    recommendations.push({
      title: "첫 데일리 하의",
      category: "하의",
      reason: "상의와 함께 바로 코디할 하의가 없어 가장 먼저 기본 하의를 보강하는 게 좋아요.",
      searchQuery: "데일리 와이드 데님팬츠",
      priority: "high",
      relatedClosetItemIds: tops.map((item) => item.id),
    });
  }

  if (bottoms.length > 0 && tops.length === 0) {
    recommendations.push({
      title: "첫 데일리 상의",
      category: "상의",
      reason: "하의와 조합할 상의가 없어 블랙이나 화이트 기본 상의를 먼저 추천해요.",
      searchQuery: "화이트 블랙 데일리 티셔츠",
      priority: "high",
      relatedClosetItemIds: bottoms.map((item) => item.id),
    });
  }

  if (tops.length > 0 && bottoms.length > 0 && shoes.length === 0) {
    recommendations.push({
      title: "기본 데일리 스니커즈",
      category: "신발",
      reason: "상의와 하의 조합은 가능하지만 신발이 없어 완성 코디를 만들기 어려워요.",
      searchQuery: "화이트 블랙 데일리 스니커즈",
      priority: "high",
      relatedClosetItemIds: [...tops, ...bottoms].map((item) => item.id),
    });
  }

  if (tops.length >= 3 && bottoms.length <= Math.floor(tops.length / 3)) {
    recommendations.push({
      title: "활용도 높은 데일리 하의",
      category: "하의",
      reason: `상의 ${tops.length}개에 비해 하의가 ${bottoms.length}개라 코디 조합이 반복되기 쉬워요.`,
      searchQuery: "데일리 와이드 데님팬츠 슬랙스",
      priority: "high",
      relatedClosetItemIds: tops.map((item) => item.id),
    });
  }

  if (bottoms.length >= 3 && tops.length <= Math.floor(bottoms.length / 3)) {
    recommendations.push({
      title: "기본 컬러 데일리 상의",
      category: "상의",
      reason: `하의 ${bottoms.length}개에 비해 상의가 ${tops.length}개라 기본 상의를 보강하면 활용도가 높아져요.`,
      searchQuery: "화이트 블랙 기본 티셔츠 셔츠",
      priority: "high",
      relatedClosetItemIds: bottoms.map((item) => item.id),
    });
  }

  const summerItems = items.filter((item) => getItemSeasons(item).some((season) => season === "여름" || season === "사계절"));
  if (summerItems.length >= 3 && shoes.length < 2) {
    recommendations.push({
      title: "가벼운 화이트 스니커즈",
      category: "신발",
      reason: `여름 활용 아이템이 ${summerItems.length}개지만 신발이 ${shoes.length}개라 밝은 스니커즈가 조합을 넓혀줘요.`,
      searchQuery: "화이트 여름 데일리 스니커즈",
      priority: shoes.length === 0 ? "high" : "medium",
      relatedClosetItemIds: summerItems.map((item) => item.id),
    });
  }

  if (
    seasonTaggedItems.length >= 3 &&
    explicitlyMatchedSeasonItems.length <= Math.floor(seasonTaggedItems.length / 3)
  ) {
    const seasonalStaples = {
      봄: "봄 데일리 셔츠",
      여름: "여름 반팔 티셔츠",
      가을: "가을 맨투맨",
      겨울: "겨울 데일리 니트",
    } as const;
    const seasonalStaple = seasonalStaples[currentSeason];
    recommendations.push({
      title: seasonalStaple,
      category: "상의",
      reason: `계절 정보가 있는 옷 중 ${currentSeason}에 바로 활용할 옷이 적어 기본 상의를 보강하면 좋아요.`,
      searchQuery: seasonalStaple,
      priority: "medium",
      relatedClosetItemIds: explicitlyMatchedSeasonItems.map((item) => item.id),
    });
  }

  const basicColorTops = tops.filter((item) =>
    BASIC_COLORS.includes(normalizeProductColor(item.color) || "")
  );
  const hasLightDenim = bottoms.some((item) => /연청|라이트.*데님|밝은.*데님/.test(itemTexts.get(item.id) || ""));
  if (basicColorTops.length >= 2 && !hasLightDenim) {
    recommendations.push({
      title: "연청 데님팬츠",
      category: "하의",
      reason: "블랙·화이트 계열 상의가 많아 연청 데님을 더하면 밝고 안정적인 조합을 만들기 좋아요.",
      searchQuery: "연청 와이드 데님팬츠",
      priority: "medium",
      relatedClosetItemIds: basicColorTops.map((item) => item.id),
    });
  }

  const streetIds = matchingIds(["스트릿", "고프코어", "테크웨어", "워크웨어"]);
  if (streetIds.length >= 2) {
    if (!bottoms.some((item) => /와이드|카고/.test(itemTexts.get(item.id) || ""))) {
      recommendations.push({ title: "와이드 데님 또는 카고팬츠", category: "하의", reason: "스트릿 계열 옷이 많아 넓은 실루엣의 하의를 더하면 스타일 연결이 자연스러워요.", searchQuery: "스트릿 와이드 데님 카고팬츠", priority: "medium", relatedClosetItemIds: streetIds });
    }
    if (shoes.length < 2) {
      recommendations.push({ title: "볼륨감 있는 스니커즈", category: "신발", reason: "스트릿 스타일을 받쳐줄 신발 선택지가 부족해 활용도 높은 스니커즈를 추천해요.", searchQuery: "스트릿 볼륨 스니커즈", priority: "medium", relatedClosetItemIds: streetIds });
    }
    if (accessories.length === 0) {
      recommendations.push({ title: "베이직 볼캡", category: "액세서리", reason: "스트릿 코디를 가볍게 마무리할 액세서리가 없어 베이직 볼캡이 잘 맞아요.", searchQuery: "스트릿 베이직 볼캡", priority: "low", relatedClosetItemIds: streetIds });
    }
  }

  const minimalIds = matchingIds(["미니멀", "모던", "댄디", "깔끔"]);
  if (minimalIds.length >= 2) {
    if (!bottoms.some((item) => /슬랙스/.test(itemTexts.get(item.id) || ""))) {
      recommendations.push({ title: "세미 와이드 슬랙스", category: "하의", reason: "미니멀 계열 옷과 안정적으로 연결할 슬랙스가 부족해 기본 컬러 제품을 추천해요.", searchQuery: "미니멀 세미 와이드 슬랙스", priority: "medium", relatedClosetItemIds: minimalIds });
    }
    if (!tops.some((item) => /셔츠/.test(itemTexts.get(item.id) || ""))) {
      recommendations.push({ title: "미니멀 셔츠", category: "상의", reason: "미니멀 스타일의 포멀 범위를 넓혀줄 깔끔한 셔츠가 있으면 좋아요.", searchQuery: "미니멀 무지 셔츠", priority: "low", relatedClosetItemIds: minimalIds });
    }
    if (!shoes.some((item) => /로퍼/.test(itemTexts.get(item.id) || ""))) {
      recommendations.push({ title: "블랙 로퍼", category: "신발", reason: "미니멀 코디를 단정하게 마무리할 신발 선택지로 블랙 로퍼가 잘 맞아요.", searchQuery: "미니멀 블랙 로퍼", priority: "low", relatedClosetItemIds: minimalIds });
    }
  }

  if (outers.length === 0 && currentSeasonItems.length >= 3) {
    const outer = getSeasonOuterRecommendation(currentSeason);
    recommendations.push({
      title: outer.title,
      category: "아우터",
      reason: `${currentSeason}에 활용할 아우터가 없어 현재 옷장 위에 쉽게 걸칠 수 있는 제품을 추천해요.`,
      searchQuery: outer.query,
      priority: currentSeason === "여름" ? "low" : "medium",
      relatedClosetItemIds: currentSeasonItems.slice(0, 6).map((item) => item.id),
    });
  }

  const profilePairings = items.flatMap((item) =>
    (item.styleProfile?.recommendedPairings || []).map((pairing) => ({ pairing, itemId: item.id }))
  );
  const pairingCounts = new Map<string, { count: number; itemIds: string[] }>();
  profilePairings.forEach(({ pairing, itemId }) => {
    const normalizedPairing = pairing.trim();
    if (!normalizedPairing) return;
    const current = pairingCounts.get(normalizedPairing) || { count: 0, itemIds: [] };
    pairingCounts.set(normalizedPairing, { count: current.count + 1, itemIds: [...current.itemIds, itemId] });
  });
  const frequentPairing = [...pairingCounts.entries()].sort((first, second) => second[1].count - first[1].count)[0];
  if (frequentPairing && frequentPairing[1].count >= 2 && !items.some((item) => itemTexts.get(item.id)?.includes(frequentPairing[0].toLowerCase()))) {
    recommendations.push({
      title: frequentPairing[0],
      category: inferCategory(frequentPairing[0]),
      reason: `옷 ${frequentPairing[1].count}개의 AI 스타일 분석에서 공통으로 추천된 조합이에요.`,
      searchQuery: frequentPairing[0],
      priority: "medium",
      relatedClosetItemIds: frequentPairing[1].itemIds,
    });
  }

  return finalizeRecommendations(recommendations);
}
