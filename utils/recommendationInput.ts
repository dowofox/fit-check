import {
  getClosetItemReviewFields,
  normalizeClosetRegistrationBasics,
} from "@/utils/closetRegistration";
import { normalizeProductColor } from "@/utils/color";
import {
  doesProductSizeRowMatch,
  getValidProductSizeRows,
} from "@/utils/productSizeMeasurements";
import { getResolvedItemMaterial } from "@/utils/productClassification";
import type {
  ClosetItem,
  MaterialComposition,
  SavedOutfit,
  UserProfile,
} from "@/utils/storage";
import { isClosetItemAvailableForRecommendation } from "@/utils/storage";

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

function getRecommendationMaterialComposition(
  item: ClosetItem
): MaterialComposition | undefined {
  const composition = item.confirmedProduct?.materialComposition;
  if (!composition) return undefined;

  const summary = composition.summary?.trim() || undefined;
  const items = (composition.items || [])
    .map((material) => ({
      name: material.name.trim(),
      percentage: material.percentage,
      ...(material.section ? { section: material.section } : {}),
    }))
    .filter((material) => material.name);

  if (!summary && items.length === 0) return undefined;

  return {
    summary,
    items: items.length > 0 ? items : undefined,
    source: composition.source,
  };
}

export function toRecommendationInputItem(item: ClosetItem): ClosetItem {
  const materialComposition = getRecommendationMaterialComposition(item);
  const resolvedMaterial = getReliableValue(getResolvedItemMaterial(item));
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
    : normalizeProductColor(registration.color);
  const styles = getRecommendationStyles(item);
  const subCategory = getReliableValue(item.subCategory);
  const detailCategory = getReliableValue(item.detailCategory) || subCategory;
  const productSizeGuide = item.confirmedProduct?.productSizeGuide;
  const validProductSizeRows = getValidProductSizeRows(productSizeGuide);
  const currentSizeMeasurement = item.size
    ? validProductSizeRows.find((measurement) =>
        doesProductSizeRowMatch(measurement, item.size)
      )
    : undefined;
  const confirmedProduct = item.confirmedProduct
    ? {
        brand: item.confirmedProduct.brand,
        productName: item.confirmedProduct.productName,
        confirmedAt: item.confirmedProduct.confirmedAt,
        materialComposition,
        productSizeGuide: currentSizeMeasurement
          ? {
              unit: productSizeGuide?.unit,
              sizes: [currentSizeMeasurement],
            }
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
    seasonNeedsReview: item.seasonNeedsReview ?? reviewFields.includes("season"),
    fit: getReliableValue(item.fit),
    size: item.size,
    intendedFit: item.intendedFit,
    brand: item.brand,
    confirmedBrand: item.confirmedBrand,
    graphicDetected: item.graphicDetected,
    graphicType: item.graphicType,
    graphicSize: item.graphicSize,
    material: resolvedMaterial,
    pattern: getReliableValue(item.pattern),
    confirmedProduct,
    styleProfile: item.styleProfile,
    garmentProfile: item.garmentProfile,
    description: item.description,
    recommendationPreference: item.recommendationPreference,
    wearCount: item.wearCount,
    lastWornAt: item.lastWornAt,
    userEditedClassificationFields: item.userEditedClassificationFields?.filter(
      (field) => field === "season" || field === "material"
    ),
    createdAt: item.createdAt,
  };
}

export function toRecommendationInputItems(items: ClosetItem[]) {
  return items
    .filter(isClosetItemAvailableForRecommendation)
    .map(toRecommendationInputItem);
}

export function shouldUseRecommendationWeather(source?: string) {
  return source === "home";
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
