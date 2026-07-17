export type OutfitFeedbackValue = "like" | "less";

export type OutfitRecommendationFeedback = {
  itemIds: string[];
  value: OutfitFeedbackValue;
  updatedAt: string;
};

export function getOutfitFeedbackKey(itemIds: string[]) {
  return Array.from(
    new Set(itemIds.map((itemId) => itemId.trim()).filter(Boolean))
  )
    .sort()
    .join("|");
}

function isOutfitFeedbackValue(value: unknown): value is OutfitFeedbackValue {
  return value === "like" || value === "less";
}

export function normalizeOutfitRecommendationFeedbacks(
  value: unknown
): OutfitRecommendationFeedback[] {
  if (!Array.isArray(value)) return [];

  const feedbackByKey = new Map<string, OutfitRecommendationFeedback>();

  value.forEach((candidate) => {
    if (!candidate || typeof candidate !== "object") return;

    const feedback = candidate as Partial<OutfitRecommendationFeedback>;
    const itemIds = Array.isArray(feedback.itemIds)
      ? feedback.itemIds.filter((itemId): itemId is string => typeof itemId === "string")
      : [];
    const key = getOutfitFeedbackKey(itemIds);

    if (
      !key ||
      !isOutfitFeedbackValue(feedback.value) ||
      typeof feedback.updatedAt !== "string" ||
      !feedback.updatedAt
    ) {
      return;
    }

    const normalizedFeedback: OutfitRecommendationFeedback = {
      itemIds: key.split("|"),
      value: feedback.value,
      updatedAt: feedback.updatedAt,
    };
    const currentFeedback = feedbackByKey.get(key);

    if (!currentFeedback || normalizedFeedback.updatedAt >= currentFeedback.updatedAt) {
      feedbackByKey.set(key, normalizedFeedback);
    }
  });

  return Array.from(feedbackByKey.values()).sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt)
  );
}

export function getOutfitFeedbackRankingAdjustment(
  value?: OutfitFeedbackValue
) {
  if (value === "like") return 6;
  if (value === "less") return -12;
  return 0;
}
