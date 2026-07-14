import type {
  ClosetItem,
  ConfirmedProduct,
  MaterialComposition,
  SeasonInferenceResult,
} from "@/utils/storage";

const OFFICIAL_SEASON_RULES: Array<{
  id: string;
  keywords: string[];
  seasons: string[];
}> = [
  {
    id: "explicit-all-season",
    keywords: ["사계절", "올시즌", "all season", "all-season", "year round"],
    seasons: ["사계절"],
  },
  {
    id: "deep-winter",
    keywords: [
      "패딩",
      "다운",
      "충전재",
      "무스탕",
      "양털",
      "보아",
      "puffer",
      "down jacket",
      "shearling",
    ],
    seasons: ["겨울"],
  },
  {
    id: "warm-material",
    keywords: ["기모", "헤비", "울", "모 ", "wool", "캐시미어", "플리스", "후리스", "fleece"],
    seasons: ["가을", "겨울"],
  },
  {
    id: "cooling-material",
    keywords: [
      "썸머",
      "여름",
      "쿨링",
      "쿨맥스",
      "린넨",
      "시어서커",
      "메시",
      "통기",
      "냉감",
      "에어리",
      "linen",
      "seersucker",
      "mesh",
    ],
    seasons: ["봄", "여름"],
  },
  {
    id: "summer-shape",
    keywords: ["민소매", "슬리브리스", "나시", "탱크탑", "반팔", "쇼츠", "반바지", "sleeveless", "short sleeve"],
    seasons: ["여름"],
  },
  {
    id: "transitional",
    keywords: ["봄", "가을", "간절기", "경량", "트렌치", "얇은 니트", "바람막이", "코치 자켓", "코치 재킷"],
    seasons: ["봄", "가을"],
  },
];

function normalizeSearchText(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase()
    .replace(/[\-_\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMaterialText(materialComposition?: MaterialComposition) {
  return [
    materialComposition?.summary,
    ...(materialComposition?.items || []).map((item) => item.name),
  ]
    .filter(Boolean)
    .join(" ");
}

export function inferSeasonsFromOfficialProduct({
  productName,
  materialComposition,
  currentItem,
}: {
  productName?: string;
  materialComposition?: MaterialComposition;
  currentItem?: ClosetItem;
}): SeasonInferenceResult | null {
  const searchText = normalizeSearchText([
    productName,
    getMaterialText(materialComposition),
    currentItem?.detailCategory,
    currentItem?.subCategory,
  ]);
  if (!searchText) return null;

  const matchedRule = OFFICIAL_SEASON_RULES.find((rule) =>
    rule.keywords.some((keyword) => searchText.includes(keyword.toLowerCase()))
  );
  if (!matchedRule) return null;

  return {
    seasons: [...matchedRule.seasons],
    source: "official_product",
    needsReview: false,
    reasons: [`공식 상품명 또는 소재에서 ${matchedRule.id} 계절 근거를 확인했어요.`],
  };
}

export function getConfirmedProductSeasonInference(
  confirmedProduct?: ConfirmedProduct,
  currentItem?: ClosetItem
) {
  if (!confirmedProduct) return null;

  return inferSeasonsFromOfficialProduct({
    productName: confirmedProduct.productName,
    materialComposition: confirmedProduct.materialComposition,
    currentItem,
  });
}

export function resolveRegistrationSeasonInference({
  selectedSeasons,
  selectedSource,
  selectedNeedsReview,
  userEdited,
  confirmedProduct,
  currentItem,
}: {
  selectedSeasons: string[];
  selectedSource?: SeasonInferenceResult["source"];
  selectedNeedsReview?: boolean;
  userEdited: boolean;
  confirmedProduct?: ConfirmedProduct;
  currentItem?: ClosetItem;
}): SeasonInferenceResult {
  if (userEdited) {
    return {
      seasons: selectedSeasons,
      source: "user",
      needsReview: selectedSeasons.length === 0,
      reasons: ["사용자가 직접 선택한 계절을 우선 적용했어요."],
    };
  }

  const officialInference = getConfirmedProductSeasonInference(confirmedProduct, currentItem);
  if (officialInference) return officialInference;

  return {
    seasons: selectedSeasons,
    source: selectedSource || "photo_ai",
    needsReview: selectedNeedsReview ?? selectedSeasons.length === 0,
  };
}
