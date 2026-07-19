import type { ClosetItem } from "@/utils/storage";

export type ClosetSortOrder = "newest" | "oldest";

const closetItemSearchTextCache = new WeakMap<ClosetItem, string>();

export function resolveClosetDetailFilter(
  selectedDetailCategory: string,
  availableDetailCategories: string[]
) {
  return availableDetailCategories.includes(selectedDetailCategory)
    ? selectedDetailCategory
    : "전체";
}

function getClosetItemSearchText(item: ClosetItem) {
  const cachedText = closetItemSearchTextCache.get(item);
  if (cachedText !== undefined) return cachedText;

  const searchText = [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.color,
    item.style,
    ...(item.styleTags || []),
    item.fit,
    item.size,
    item.season,
    ...(item.seasons || []),
    item.material,
    item.pattern,
    item.confirmedBrand,
    item.brand,
    item.confirmedProduct?.brand,
    item.confirmedProduct?.productName,
    item.confirmedProduct?.materialComposition?.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  closetItemSearchTextCache.set(item, searchText);
  return searchText;
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
