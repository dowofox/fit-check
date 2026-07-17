import type { ClosetItem } from "@/utils/storage";

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
