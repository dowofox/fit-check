const CLOSET_SEASONS = ["봄", "여름", "가을", "겨울", "사계절"] as const;

type ClosetSeasonFields = {
  season?: string;
  seasons?: string[];
  seasonSource?: string;
  userEditedClassificationFields?: readonly string[];
};

export function normalizeClosetSeasons(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const seasons = CLOSET_SEASONS.filter((season) =>
    values.some((currentValue) => currentValue.includes(season))
  );
  if (
    seasons.length === 0 &&
    values.some((currentValue) => currentValue.includes("전체"))
  ) {
    return ["사계절"];
  }

  return seasons.length > 1
    ? seasons.filter((season) => season !== "사계절")
    : seasons;
}

export function hasUserEditedClosetSeason(item: ClosetSeasonFields) {
  return (
    item.seasonSource === "user" ||
    item.userEditedClassificationFields?.includes("season") === true
  );
}

export function getCanonicalClosetItemSeasons(item: ClosetSeasonFields) {
  const arraySeasons = normalizeClosetSeasons(item.seasons);
  const legacySeasons = normalizeClosetSeasons(item.season);

  if (arraySeasons.length === 0) return legacySeasons;
  if (legacySeasons.length === 0) return arraySeasons;
  if (arraySeasons.join("|") === legacySeasons.join("|")) return arraySeasons;

  return hasUserEditedClosetSeason(item)
    ? normalizeClosetSeasons([...arraySeasons, ...legacySeasons])
    : arraySeasons;
}

export function normalizeClosetItemSeasonFields<T extends ClosetSeasonFields>(
  item: T
): T {
  const seasons = getCanonicalClosetItemSeasons(item);
  if (seasons.length === 0) return item;

  const season = seasons.join(", ");
  const hasSameSeasons =
    Array.isArray(item.seasons) &&
    item.seasons.length === seasons.length &&
    item.seasons.every((value, index) => value === seasons[index]);

  if (hasSameSeasons && item.season === season) return item;

  return {
    ...item,
    season,
    seasons,
  };
}
