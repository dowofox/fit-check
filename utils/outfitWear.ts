export type OutfitWearRecord = {
  id: string;
  savedOutfitId?: string;
  itemIds: string[];
  wornAt: string;
  dateKey: string;
};

export function getOutfitWearItemKey(itemIds: string[]) {
  return Array.from(
    new Set(itemIds.map((itemId) => itemId.trim()).filter(Boolean))
  )
    .sort()
    .join("|");
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeOutfitWearRecords(value: unknown): OutfitWearRecord[] {
  if (!Array.isArray(value)) return [];

  const recordsByKey = new Map<string, OutfitWearRecord>();

  value.forEach((candidate) => {
    if (!candidate || typeof candidate !== "object") return;

    const record = candidate as Partial<OutfitWearRecord>;
    const itemIds = Array.isArray(record.itemIds)
      ? record.itemIds.filter((itemId): itemId is string => typeof itemId === "string")
      : [];
    const itemKey = getOutfitWearItemKey(itemIds);

    if (
      !itemKey ||
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.wornAt !== "string" ||
      !record.wornAt ||
      typeof record.dateKey !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.dateKey)
    ) {
      return;
    }

    const normalizedRecord: OutfitWearRecord = {
      id: record.id,
      savedOutfitId:
        typeof record.savedOutfitId === "string" && record.savedOutfitId
          ? record.savedOutfitId
          : undefined,
      itemIds: itemKey.split("|"),
      wornAt: record.wornAt,
      dateKey: record.dateKey,
    };
    const recordKey = `${record.dateKey}|${itemKey}`;
    const currentRecord = recordsByKey.get(recordKey);

    if (!currentRecord || normalizedRecord.wornAt >= currentRecord.wornAt) {
      recordsByKey.set(recordKey, normalizedRecord);
    }
  });

  return Array.from(recordsByKey.values()).sort((first, second) =>
    second.wornAt.localeCompare(first.wornAt)
  );
}

export function wasOutfitWornOnDate(
  records: OutfitWearRecord[],
  itemIds: string[],
  dateKey = getLocalDateKey()
) {
  const itemKey = getOutfitWearItemKey(itemIds);

  return records.some(
    (record) =>
      record.dateKey === dateKey &&
      getOutfitWearItemKey(record.itemIds) === itemKey
  );
}
