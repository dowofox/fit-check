import type {
  ClosetItem,
  ConfirmedProduct,
  MaterialComposition,
  SeasonInferenceResult,
} from "@/utils/storage";
import { getSignificantMaterialText } from "@/utils/materialComposition";

const OFFICIAL_SEASON_RULES: Array<{
  id: string;
  keywords: string[];
  keywordGroups?: string[][];
  excludedKeywords?: string[];
  seasons: string[];
}> = [
  {
    id: "deep-winter",
    keywords: [
      "패딩",
      "구스 다운",
      "구스다운",
      "덕 다운",
      "덕다운",
      "다운 베스트",
      "다운베스트",
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
    id: "summer-knit",
    keywords: ["반팔 니트", "민소매 니트", "니트 베스트", "short sleeve knit"],
    seasons: ["봄", "여름"],
  },
  {
    id: "summer-bottom",
    keywords: [
      "버뮤다",
      "하프 팬츠",
      "쿨링 팬츠",
      "냉감 팬츠",
      "시어서커 팬츠",
      "메쉬 팬츠",
      "mesh pants",
      "seersucker pants",
    ],
    seasons: ["여름"],
  },
  {
    id: "summer-footwear",
    keywords: ["샌들", "슬리퍼", "쪼리", "크록스", "sandal", "slides", "flip flop"],
    seasons: ["여름"],
  },
  {
    id: "summer-accessory",
    keywords: [
      "밀짚모자",
      "밀짚 모자",
      "라피아 햇",
      "라피아 모자",
      "선캡",
      "비치 햇",
      "straw hat",
      "sun visor",
    ],
    seasons: ["여름"],
  },
  {
    id: "summer-sleeveless-and-bottom",
    keywords: ["민소매", "슬리브리스", "나시", "탱크탑", "쇼츠", "반바지", "sleeveless", "tank top"],
    seasons: ["여름"],
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
    id: "short-sleeve",
    keywords: ["반팔", "숏슬리브", "숏 슬리브", "하프 슬리브", "short sleeve", "short-sleeve"],
    seasons: ["여름"],
  },
  {
    id: "winter-bottom",
    keywords: [
      "기모 팬츠",
      "기모 바지",
      "코듀로이 팬츠",
      "골덴 팬츠",
      "울 팬츠",
      "모직 팬츠",
      "플리스 팬츠",
      "후리스 팬츠",
      "벨벳 팬츠",
      "corduroy pants",
      "wool pants",
      "fleece pants",
    ],
    keywordGroups: [
      ["기모", "팬츠"],
      ["기모", "바지"],
      ["코듀로이", "팬츠"],
      ["골덴", "팬츠"],
      ["울", "팬츠"],
      ["모직", "팬츠"],
      ["플리스", "팬츠"],
      ["후리스", "팬츠"],
      ["벨벳", "팬츠"],
    ],
    seasons: ["가을", "겨울"],
  },
  {
    id: "warm-material",
    keywords: ["기모", "헤비", "울", "모 ", "wool", "캐시미어", "플리스", "후리스", "fleece"],
    seasons: ["가을", "겨울"],
  },
  {
    id: "winter-footwear",
    keywords: [
      "부츠",
      "첼시부츠",
      "첼시 부츠",
      "앵클부츠",
      "앵클 부츠",
      "롱부츠",
      "롱 부츠",
      "워커",
      "방한화",
      "스노우 부츠",
      "boots",
      "chelsea boots",
      "snow boots",
    ],
    excludedKeywords: ["부츠컷", "bootcut", "boot cut"],
    seasons: ["가을", "겨울"],
  },
  {
    id: "winter-accessory",
    keywords: [
      "비니",
      "귀마개",
      "방한",
      "머플러",
      "목도리",
      "겨울 장갑",
      "바라클라바",
      "beanie",
      "earmuff",
      "winter gloves",
      "balaclava",
    ],
    seasons: ["가을", "겨울"],
  },
  {
    id: "transitional",
    keywords: [
      "봄",
      "가을",
      "간절기",
      "경량",
      "트렌치",
      "얇은 니트",
      "가디건",
      "바람막이",
      "윈드브레이커",
      "블루종",
      "트러커 자켓",
      "트러커 재킷",
      "데님 자켓",
      "데님 재킷",
      "셔켓",
      "셔츠 자켓",
      "셔츠 재킷",
      "오버셔츠",
      "오버 셔츠",
      "후드 집업",
      "맨투맨",
      "스웨트셔츠",
      "cardigan",
      "windbreaker",
      "shirt jacket",
      "shirt-jacket",
      "shacket",
      "overshirt",
      "sweatshirt",
      "코치 자켓",
      "코치 재킷",
    ],
    seasons: ["봄", "가을"],
  },
  {
    id: "coat",
    keywords: ["코트", "coat"],
    excludedKeywords: ["트렌치코트", "트렌치 코트", "trench coat"],
    seasons: ["가을", "겨울"],
  },
  {
    id: "explicit-all-season",
    keywords: ["사계절", "올시즌", "all season", "all-season", "year round"],
    seasons: ["사계절"],
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

function includesSeasonKeyword(text: string, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase();
  if (normalizedKeyword === "기모") {
    return text.replace(/기모노/g, "").includes(normalizedKeyword);
  }

  if (/^[가-힣]$/.test(normalizedKeyword)) {
    return text
      .split(/[\s,/%()[\]{}·:;]+/)
      .filter(Boolean)
      .includes(normalizedKeyword);
  }

  return text.includes(normalizedKeyword);
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
    getSignificantMaterialText(materialComposition),
    currentItem?.detailCategory,
    currentItem?.subCategory,
  ]);
  if (!searchText) return null;

  const matchedRule = OFFICIAL_SEASON_RULES.find(
    (rule) =>
      !(rule.excludedKeywords || []).some((keyword) =>
        includesSeasonKeyword(searchText, keyword)
      ) &&
      (rule.keywords.some((keyword) => includesSeasonKeyword(searchText, keyword)) ||
        (rule.keywordGroups || []).some((keywords) =>
          keywords.every((keyword) => includesSeasonKeyword(searchText, keyword))
        ))
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
