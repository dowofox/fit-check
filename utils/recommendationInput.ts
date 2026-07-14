import {
  getClosetItemReviewFields,
  normalizeClosetRegistrationBasics,
} from "@/utils/closetRegistration";
import type { ClosetItem, SavedOutfit, UserProfile } from "@/utils/storage";

const UNCERTAIN_VALUE_PATTERN = /확인\s*필요|판단\s*어려움|분석\s*전|미분석/;

function getReliableValue(value?: string) {
  const trimmedValue = value?.trim();
  if (!trimmedValue || UNCERTAIN_VALUE_PATTERN.test(trimmedValue)) return undefined;
  return trimmedValue;
}

function getRecommendationStyles(item: ClosetItem) {
  const styles = [...(item.styleTags || []), item.style]
    .map(getReliableValue)
    .filter((style): style is string => Boolean(style));
  const uniqueStyles = Array.from(new Set(styles));

  return uniqueStyles.length > 0 ? uniqueStyles : ["데일리"];
}

export function toRecommendationInputItem(item: ClosetItem): ClosetItem {
  const materialSummary = item.confirmedProduct?.materialComposition?.summary;
  const registration = normalizeClosetRegistrationBasics({
    category: item.category,
    color: item.color,
    seasons: item.seasons?.length ? item.seasons : item.season,
  });
  const reviewFields = getClosetItemReviewFields(item);
  const category = registration.reviewFields.includes("category")
    ? "기타"
    : registration.category;
  const color = registration.reviewFields.includes("color")
    ? undefined
    : registration.color;
  const styles = getRecommendationStyles(item);
  const subCategory = getReliableValue(item.subCategory);
  const detailCategory = getReliableValue(item.detailCategory) || subCategory;
  const confirmedProduct = item.confirmedProduct
    ? {
        brand: item.confirmedProduct.brand,
        productName: item.confirmedProduct.productName,
        confirmedAt: item.confirmedProduct.confirmedAt,
        materialComposition: materialSummary
          ? { summary: materialSummary, source: item.confirmedProduct.materialComposition?.source }
          : undefined,
      }
    : undefined;

  return {
    id: item.id,
    imageUri: item.imageUri || "",
    cleanImageUri: item.cleanImageUri,
    category,
    subCategory,
    detailCategory: detailCategory || category,
    color,
    style: styles[0],
    styleTags: styles,
    season: registration.seasons.join(", "),
    seasons: registration.seasons,
    seasonSource: item.seasonSource,
    seasonNeedsReview:
      reviewFields.includes("season"),
    fit: getReliableValue(item.fit),
    size: item.size,
    intendedFit: item.intendedFit,
    brand: item.brand,
    confirmedBrand: item.confirmedBrand,
    graphicDetected: item.graphicDetected,
    graphicType: item.graphicType,
    graphicSize: item.graphicSize,
    material: getReliableValue(materialSummary) || getReliableValue(item.material),
    pattern: getReliableValue(item.pattern),
    confirmedProduct,
    styleProfile: item.styleProfile,
    garmentProfile: item.garmentProfile,
    description: item.description,
    recommendationPreference: item.recommendationPreference,
    wearCount: item.wearCount,
    lastWornAt: item.lastWornAt,
    createdAt: item.createdAt,
  };
}

export function toRecommendationInputItems(items: ClosetItem[]) {
  return items.map(toRecommendationInputItem);
}

export function getSavedOutfitItemIds(
  savedOutfits: SavedOutfit[],
  closetItems: ClosetItem[]
) {
  const closetItemIds = new Set(closetItems.map((item) => item.id));

  return savedOutfits
    .map((outfit) => outfit.itemIds)
    .filter(
      (itemIds) =>
        itemIds.length > 0 && itemIds.every((itemId) => closetItemIds.has(itemId))
    );
}

export function getRecommendationDataKey(
  items: ClosetItem[],
  profile: UserProfile | null,
  savedOutfitItemIds: string[][] = []
) {
  return JSON.stringify({ items, profile, savedOutfitItemIds });
}
