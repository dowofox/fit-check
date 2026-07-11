import type { ClosetItem, SavedOutfit, UserProfile } from "@/utils/storage";

export function toRecommendationInputItem(item: ClosetItem): ClosetItem {
  const materialSummary = item.confirmedProduct?.materialComposition?.summary;
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
    imageUri: item.imageUri,
    cleanImageUri: item.cleanImageUri,
    category: item.category,
    subCategory: item.subCategory,
    detailCategory: item.detailCategory,
    color: item.color,
    style: item.style,
    styleTags: item.styleTags,
    season: item.season,
    seasons: item.seasons,
    fit: item.fit,
    size: item.size,
    intendedFit: item.intendedFit,
    brand: item.brand,
    confirmedBrand: item.confirmedBrand,
    graphicDetected: item.graphicDetected,
    graphicType: item.graphicType,
    graphicSize: item.graphicSize,
    material: materialSummary || item.material,
    pattern: item.pattern,
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

export function getSavedOutfitItemIds(savedOutfits: SavedOutfit[]) {
  return savedOutfits.map((outfit) => outfit.itemIds);
}

export function getRecommendationDataKey(
  items: ClosetItem[],
  profile: UserProfile | null,
  savedOutfitItemIds: string[][] = []
) {
  return JSON.stringify({ items, profile, savedOutfitItemIds });
}
