import type { ClosetItem, SavedOutfit } from "@/utils/storage";

export type SavedOutfitWithItems = SavedOutfit & {
  items: ClosetItem[];
  missingItemIds: string[];
};

export function matchSavedOutfitsWithCloset(
  savedOutfits: SavedOutfit[],
  closetItems: ClosetItem[]
): SavedOutfitWithItems[] {
  const closetById = new Map(closetItems.map((item) => [item.id, item]));

  return savedOutfits.map((outfit) => {
    const items: ClosetItem[] = [];
    const missingItemIds: string[] = [];

    outfit.itemIds.forEach((itemId) => {
      const item = closetById.get(itemId);
      if (item) items.push(item);
      else missingItemIds.push(itemId);
    });

    return { ...outfit, items, missingItemIds };
  });
}
