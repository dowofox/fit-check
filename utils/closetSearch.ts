import type { ClosetItem } from "@/utils/storage";

export type ClosetSortOrder = "newest" | "oldest";

function getClosetItemSearchText(item: ClosetItem) {
  return [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.color,
    item.style,
    ...(item.styleTags || []),
    item.material,
    item.pattern,
    item.confirmedBrand,
    item.brand,
    item.confirmedProduct?.brand,
    item.confirmedProduct?.productName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterClosetItemsByQuery(items: ClosetItem[], query: string) {
  const terms = query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return items;

  return items.filter((item) => {
    const searchText = getClosetItemSearchText(item);
    return terms.every((term) => searchText.includes(term));
  });
}

export function sortClosetItems(items: ClosetItem[], order: ClosetSortOrder) {
  return items
    .map((item, index) => ({
      item,
      index,
      timestamp: new Date(item.createdAt).getTime(),
    }))
    .sort((first, second) => {
      const firstHasDate = Number.isFinite(first.timestamp);
      const secondHasDate = Number.isFinite(second.timestamp);

      if (firstHasDate !== secondHasDate) return firstHasDate ? -1 : 1;
      if (!firstHasDate || first.timestamp === second.timestamp) {
        return first.index - second.index;
      }

      return order === "newest"
        ? second.timestamp - first.timestamp
        : first.timestamp - second.timestamp;
    })
    .map(({ item }) => item);
}
