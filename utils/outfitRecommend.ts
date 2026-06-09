import { getFitSuitability } from "@/utils/sizeMatch";
import { ClosetItem, UserProfile } from "@/utils/storage";

export type OutfitRecommendation = {
  id: string;
  items: ClosetItem[];
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  reasons: string[];
  warnings: string[];
  breakdown: {
    category: number;
    style: number;
    color: number;
    fit: number;
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
  const score = category + style + color + fit;

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
    },
  };
}

export function getOutfitRecommendations(items: ClosetItem[], profile?: UserProfile | null, currentSeason = getCurrentSeason()): OutfitRecommendation[] {
  const tops = byCategory(items, "상의");
  const bottoms = byCategory(items, "하의");
  const shoes = byCategory(items, "신발");
  const outers = byCategory(items, "아우터");
  const accessories = byCategory(items, "액세서리");
  const recommendations: OutfitRecommendation[] = [];

  for (const top of tops) {
    for (const bottom of bottoms) {
      const baseItems = [top, bottom];
      const shoeOptions = shoes.length > 0 ? shoes : [null];
      const outerOptions = outers.length > 0 ? [null, ...outers] : [null];
      const accessoryOptions = accessories.length > 0 ? [null, ...accessories] : [null];

      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          for (const accessory of accessoryOptions) {
            const outfitItems = [
              ...baseItems,
              ...(shoe ? [shoe] : []),
              ...(outer ? [outer] : []),
              ...(accessory ? [accessory] : []),
            ];
            const recommendation = buildRecommendation(outfitItems, currentSeason, profile);

            if (recommendation) recommendations.push(recommendation);
          }
        }
      }
    }
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
