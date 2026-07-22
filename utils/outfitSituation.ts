import type { OutfitRecommendation } from "@/utils/outfitRecommend";
import { getOutfitFeedbackRankingAdjustment } from "@/utils/outfitFeedback";
import type { ClosetItem } from "@/utils/storage";

export type OutfitSituationId = "all" | "date" | "clean" | "daily" | "relaxed";

export type OutfitSituation = {
  id: OutfitSituationId;
  label: string;
  keywords: readonly string[];
  reason?: string;
};

export const MIN_OUTFIT_SITUATION_SCORE = 6;

export const OUTFIT_SITUATIONS: readonly OutfitSituation[] = [
  { id: "all", label: "전체", keywords: [] },
  {
    id: "date",
    label: "데이트",
    keywords: ["미니멀", "댄디", "포멀", "니트", "셔츠", "로퍼", "더비"],
    reason: "데이트에 어울리는 단정하고 부드러운 인상의 조합이에요.",
  },
  {
    id: "clean",
    label: "깔끔한",
    keywords: ["미니멀", "모던", "클래식", "댄디", "셔츠", "슬랙스"],
    reason: "색과 포인트를 절제해 깔끔한 상황에 잘 맞는 조합이에요.",
  },
  {
    id: "daily",
    label: "데일리",
    keywords: ["캐주얼", "데일리", "데님", "티셔츠", "스니커즈"],
    reason: "평소 자주 입기 좋은 캐주얼 아이템 중심의 조합이에요.",
  },
  {
    id: "relaxed",
    label: "편안한",
    keywords: ["편안함", "캐주얼", "와이드", "조거", "후드", "맨투맨", "스니커즈"],
    reason: "움직이기 편한 실루엣과 캐주얼 아이템이 중심인 조합이에요.",
  },
] as const;

type SituationSignal = {
  keywords: readonly string[];
  score: number;
};

type SituationRule = {
  positive: readonly SituationSignal[];
  negative: readonly SituationSignal[];
  penalizeMultiplePoints?: boolean;
  penalizeManyColors?: boolean;
};

const SITUATION_RULES: Record<Exclude<OutfitSituationId, "all">, SituationRule> = {
  date: {
    positive: [
      { keywords: ["미니멀", "댄디", "포멀", "클래식", "페미닌", "러블리"], score: 3 },
      { keywords: ["니트", "셔츠", "가디건", "블라우스"], score: 2 },
      {
        keywords: [
          "로퍼",
          "더비",
          "옥스포드",
          "몽크스트랩",
          "브로그",
          "윙팁",
          "펌프스",
          "메리제인",
          "플랫 슈즈",
          "첼시부츠",
        ],
        score: 2,
      },
      { keywords: ["슬랙스", "치노"], score: 1 },
    ],
    negative: [
      { keywords: ["스포티", "러닝", "트레이닝", "조거"], score: 3 },
      { keywords: ["테크웨어", "고프코어", "카고", "강한 그래픽"], score: 2 },
    ],
    penalizeMultiplePoints: true,
    penalizeManyColors: true,
  },
  clean: {
    positive: [
      { keywords: ["미니멀", "모던", "클래식", "댄디", "깔끔함", "포멀"], score: 3 },
      { keywords: ["셔츠", "니트", "블라우스"], score: 2 },
      { keywords: ["슬랙스", "치노"], score: 2 },
      {
        keywords: [
          "로퍼",
          "더비",
          "옥스포드",
          "몽크스트랩",
          "브로그",
          "윙팁",
          "펌프스",
          "메리제인",
          "플랫 슈즈",
        ],
        score: 1,
      },
    ],
    negative: [
      { keywords: ["그래픽", "카모", "네온", "테크웨어"], score: 3 },
      { keywords: ["트레이닝", "조거", "러닝화"], score: 2 },
    ],
    penalizeMultiplePoints: true,
    penalizeManyColors: true,
  },
  daily: {
    positive: [
      { keywords: ["캐주얼", "데일리", "꾸안꾸"], score: 3 },
      { keywords: ["데님", "청바지", "티셔츠", "맨투맨"], score: 2 },
      { keywords: ["스니커즈", "운동화"], score: 2 },
      { keywords: ["미니멀", "베이직", "무지"], score: 1 },
    ],
    negative: [
      { keywords: ["이브닝", "턱시도", "드레스슈즈"], score: 2 },
      { keywords: ["강한 그래픽", "네온", "메탈릭"], score: 2 },
    ],
    penalizeMultiplePoints: true,
  },
  relaxed: {
    positive: [
      { keywords: ["편안함", "캐주얼", "꾸안꾸", "릴랙스"], score: 3 },
      { keywords: ["와이드", "조거", "후드", "맨투맨", "트레이닝"], score: 3 },
      { keywords: ["스니커즈", "운동화", "러닝화"], score: 2 },
    ],
    negative: [
      { keywords: ["포멀", "턱시도", "드레스"], score: 2 },
      { keywords: ["로퍼", "더비", "하이힐"], score: 2 },
    ],
  },
};

const STRONG_COLOR_KEYWORDS = [
  "레드",
  "빨강",
  "오렌지",
  "주황",
  "옐로우",
  "노랑",
  "라임",
  "네온",
  "형광",
  "핫핑크",
  "퍼플",
  "보라",
];

function getItemSituationText(item: ClosetItem) {
  return [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.style,
    ...(item.styleTags || []),
    ...(item.styleProfile?.mood || []),
    item.styleProfile?.formality,
    item.styleProfile?.silhouette,
    item.fit,
    item.material,
    item.pattern,
    item.color,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function hasSignal(searchText: string, signal: SituationSignal) {
  return signal.keywords.some((keyword) =>
    searchText.includes(keyword.toLocaleLowerCase())
  );
}

function getStrongPointCount(items: ClosetItem[]) {
  return items.filter((item) => {
    const graphicSize = String(item.graphicSize || "").toLocaleLowerCase();
    const pattern = String(item.pattern || "");
    const color = String(item.color || "");

    return (
      (item.graphicDetected === true &&
        ["중간", "큼", "medium", "large"].some((value) =>
          graphicSize.includes(value)
        )) ||
      !["", "무지", "없음", "판단 어려움"].includes(pattern) ||
      STRONG_COLOR_KEYWORDS.some((keyword) => color.includes(keyword)) ||
      (item.garmentProfile?.pointLevel || 0) >= 7
    );
  }).length;
}

function getDistinctColorCount(items: ClosetItem[]) {
  return new Set(items.map((item) => item.color).filter(Boolean)).size;
}

export function getOutfitSituationScore(
  items: ClosetItem[],
  situation?: OutfitSituation
) {
  if (!situation || situation.id === "all") return 10;

  const rule = SITUATION_RULES[situation.id];
  const coreItems = items.filter((item) => item.category !== "액세서리");
  const searchText = coreItems.map(getItemSituationText).join(" ");
  let score = 2;

  rule.positive.forEach((signal) => {
    if (hasSignal(searchText, signal)) score += signal.score;
  });
  rule.negative.forEach((signal) => {
    if (hasSignal(searchText, signal)) score -= signal.score;
  });

  const strongPointCount = getStrongPointCount(coreItems);
  if (rule.penalizeMultiplePoints && strongPointCount >= 3) score -= 3;
  else if (rule.penalizeMultiplePoints && strongPointCount === 2) score -= 1;

  if (rule.penalizeManyColors && getDistinctColorCount(coreItems) >= 4) score -= 2;

  return Math.max(0, Math.min(10, score));
}

export function getItemSituationScore(item: ClosetItem, situation?: OutfitSituation) {
  if (!situation || situation.id === "all") return 0;

  const rule = SITUATION_RULES[situation.id];
  const searchText = getItemSituationText(item);
  const positiveScore = rule.positive.reduce(
    (score, signal) => score + (hasSignal(searchText, signal) ? signal.score : 0),
    0
  );
  const negativeScore = rule.negative.reduce(
    (score, signal) => score + (hasSignal(searchText, signal) ? signal.score : 0),
    0
  );

  return Math.max(-4, Math.min(4, positiveScore - negativeScore));
}

export function isOutfitSituationMatch(
  recommendation: OutfitRecommendation,
  situation?: OutfitSituation
) {
  return getOutfitSituationScore(recommendation.items, situation) >= MIN_OUTFIT_SITUATION_SCORE;
}

function addSituationDisplay(
  recommendation: OutfitRecommendation,
  situation: OutfitSituation
) {
  const reasons =
    situation.reason && !recommendation.reasons.includes(situation.reason)
      ? [situation.reason, ...recommendation.reasons]
      : recommendation.reasons;

  return {
    ...recommendation,
    reasons,
    tags: Array.from(new Set([situation.label, ...recommendation.tags])).slice(0, 3),
  };
}

export function applyOutfitSituationRanking(
  recommendations: OutfitRecommendation[],
  situation?: OutfitSituation
) {
  if (!situation || situation.id === "all") return recommendations;

  return recommendations
    .filter((recommendation) => isOutfitSituationMatch(recommendation, situation))
    .map((recommendation) => {
      const alternatives = (recommendation.alternatives || [])
        .filter((alternative) => isOutfitSituationMatch(alternative, situation))
        .map((alternative) => addSituationDisplay(alternative, situation));

      return {
        recommendation: {
          ...addSituationDisplay(recommendation, situation),
          alternatives,
          alternativeCount: alternatives.length,
        },
        situationScore: getOutfitSituationScore(recommendation.items, situation),
      };
    })
    .sort(
      (first, second) =>
        second.recommendation.score +
          Math.max(0, second.situationScore - MIN_OUTFIT_SITUATION_SCORE) * 2 +
          getOutfitFeedbackRankingAdjustment(second.recommendation.feedbackPreference) +
          (second.recommendation.feedbackTrendAdjustment || 0) -
          (first.recommendation.score +
            Math.max(0, first.situationScore - MIN_OUTFIT_SITUATION_SCORE) * 2 +
            getOutfitFeedbackRankingAdjustment(first.recommendation.feedbackPreference) +
            (first.recommendation.feedbackTrendAdjustment || 0))
    )
    .map(({ recommendation }) => recommendation);
}
