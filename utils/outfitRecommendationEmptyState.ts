import type {
  OutfitRecommendationEmptyReason,
  OutfitRecommendationResult,
} from "@/utils/outfitRecommend";
import type { ClosetItem } from "@/utils/storage";

type RecommendationEmptyResult = Pick<
  OutfitRecommendationResult,
  "emptyReason" | "missingCategories"
>;

export type OutfitRecommendationEmptyContent = {
  title: string;
  text: string;
};

const DEFAULT_EMPTY_CONTENT: OutfitRecommendationEmptyContent = {
  title: "추천 가능한 조합이 부족해요",
  text: "상의와 하의를 등록하면 코디를 추천할 수 있어요.",
};

const EMPTY_CONTENT_BY_REASON: Partial<
  Record<OutfitRecommendationEmptyReason, OutfitRecommendationEmptyContent>
> = {
  below_quality_threshold: {
    title: "추천할 만한 조합이 아직 부족해요",
    text: "현재 옷으로는 충분히 잘 맞는 조합을 찾지 못했어요. 다른 색상이나 실루엣의 옷을 추가해보세요.",
  },
  saved_combinations_exhausted: {
    title: "새로운 추천 조합이 없어요",
    text: "추천 가능한 조합을 이미 저장했어요. 옷을 더 추가하면 새로운 코디를 만들 수 있어요.",
  },
};

function getCategoryCount(items: ClosetItem[], category: string) {
  return items.filter((item) => item.category === category).length;
}

function getMissingCoreCategoryText(missingCategories?: string[]) {
  if (!missingCategories?.length) return DEFAULT_EMPTY_CONTENT.text;

  return `${missingCategories.join(", ")}를 추가해주세요. 상의와 하의가 있어야 코디를 추천할 수 있어요.`;
}

export function getOutfitRecommendationEmptyContent(
  result: RecommendationEmptyResult,
  items: ClosetItem[] = []
): OutfitRecommendationEmptyContent {
  if (result.emptyReason === "missing_core_category") {
    return {
      title: "추천에 필요한 옷이 부족해요",
      text: getMissingCoreCategoryText(result.missingCategories),
    };
  }

  const content = result.emptyReason
    ? EMPTY_CONTENT_BY_REASON[result.emptyReason]
    : undefined;

  if (result.emptyReason === "below_quality_threshold" && content) {
    const shoeGuide = getCategoryCount(items, "신발") === 0
      ? " 신발을 등록하면 완성도 높은 코디를 추천할 수 있어요."
      : " 더 자연스럽게 맞는 아이템을 추가하면 추천이 좋아져요.";

    return {
      ...content,
      text: `${content.text}${shoeGuide}`,
    };
  }

  return content || DEFAULT_EMPTY_CONTENT;
}
