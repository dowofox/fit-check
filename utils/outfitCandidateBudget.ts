import type { ClosetItem } from "@/utils/storage";

export const MAX_OUTFIT_COMBINATION_BUDGET = 800;

export const LARGE_WARDROBE_CANDIDATE_LIMITS = {
  tops: 4,
  bottoms: 4,
  shoes: 2,
  outers: 2,
  accessories: 2,
} as const;

export function getAccessoryCombinationCount(accessoryCount: number) {
  const count = Math.max(0, Math.floor(accessoryCount));
  const pairs = count >= 2 ? (count * (count - 1)) / 2 : 0;
  const triples = count >= 3 ? (count * (count - 1) * (count - 2)) / 6 : 0;
  return 1 + count + pairs + triples;
}

export function estimateOutfitCombinationCount({
  topCount,
  bottomCount,
  shoeCount,
  outerCount,
  accessoryCount,
}: {
  topCount: number;
  bottomCount: number;
  shoeCount: number;
  outerCount: number;
  accessoryCount: number;
}) {
  return (
    topCount *
    bottomCount *
    (shoeCount + 1) *
    (outerCount + 1) *
    getAccessoryCombinationCount(accessoryCount)
  );
}

function getInformationScore(item: ClosetItem) {
  return [
    item.detailCategory || item.subCategory,
    item.color,
    item.styleTags?.length ? item.styleTags : item.style,
    item.material,
    item.fit || item.garmentProfile?.silhouette,
  ].filter(Boolean).length;
}

function getPreferenceScore(item: ClosetItem) {
  if (item.recommendationPreference === "prefer") return 2;
  if (item.recommendationPreference === "less") return -2;
  return 0;
}

function getDiversityKey(item: ClosetItem) {
  return [
    item.detailCategory || item.subCategory || item.category,
    item.color || "색상 없음",
  ]
    .join("|")
    .toLocaleLowerCase();
}

export function limitOutfitCandidatePool(items: ClosetItem[], limit: number) {
  if (items.length <= limit) return items;

  const rankedItems = items
    .map((item, index) => ({ item, index }))
    .sort((first, second) => {
      const preferenceDifference =
        getPreferenceScore(second.item) - getPreferenceScore(first.item);
      if (preferenceDifference !== 0) return preferenceDifference;

      const informationDifference =
        getInformationScore(second.item) - getInformationScore(first.item);
      if (informationDifference !== 0) return informationDifference;

      const wearDifference =
        (first.item.wearCount || 0) - (second.item.wearCount || 0);
      if (wearDifference !== 0) return wearDifference;

      const firstLastWornAt = first.item.lastWornAt || "";
      const secondLastWornAt = second.item.lastWornAt || "";
      if (firstLastWornAt !== secondLastWornAt) {
        if (!firstLastWornAt) return -1;
        if (!secondLastWornAt) return 1;
        return firstLastWornAt.localeCompare(secondLastWornAt);
      }

      return first.index - second.index;
    });
  const selected: ClosetItem[] = [];
  const selectedIds = new Set<string>();
  const diversityKeys = new Set<string>();

  rankedItems.forEach(({ item }) => {
    if (selected.length >= limit) return;

    const diversityKey = getDiversityKey(item);
    if (diversityKeys.has(diversityKey)) return;

    selected.push(item);
    selectedIds.add(item.id);
    diversityKeys.add(diversityKey);
  });

  rankedItems.forEach(({ item }) => {
    if (selected.length >= limit || selectedIds.has(item.id)) return;
    selected.push(item);
    selectedIds.add(item.id);
  });

  return selected;
}
