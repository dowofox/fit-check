export function normalizeCanonicalIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;

  const normalizedValue = value.trim();
  const timestamp = new Date(normalizedValue).getTime();
  if (Number.isNaN(timestamp)) return undefined;

  const isoTimestamp = new Date(timestamp).toISOString();
  return isoTimestamp === normalizedValue ? isoTimestamp : undefined;
}
