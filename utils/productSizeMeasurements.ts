import type {
  ProductSizeGuide,
  ProductSizeMeasurement,
} from "@/utils/storage";

export type ProductMeasurementDraft = {
  size: string;
  totalLength: string;
  shoulder: string;
  chest: string;
  sleeve: string;
  waist: string;
  hip: string;
  thigh: string;
  rise: string;
  hem: string;
  footLength: string;
};

type ProductMeasurementKey = Exclude<keyof ProductMeasurementDraft, "size">;

const PRODUCT_MEASUREMENT_KEYS: ProductMeasurementKey[] = [
  "totalLength",
  "shoulder",
  "chest",
  "sleeve",
  "waist",
  "hip",
  "thigh",
  "rise",
  "hem",
  "footLength",
];

const INVALID_PRODUCT_SIZE_KEYWORDS = [
  "무신사",
  "무진장",
  "단독",
  "이벤트",
  "쿠폰",
  "할인",
  "적립",
  "후기",
  "배송",
  "무료",
  "랭킹",
  "브랜드",
];

const NAMED_PRODUCT_SIZE_ALIASES: Record<string, string> = {
  XSMALL: "XS",
  EXTRASMALL: "XS",
  SMALL: "S",
  MEDIUM: "M",
  LARGE: "L",
  XLARGE: "XL",
  EXTRALARGE: "XL",
  XXLARGE: "XXL",
  DOUBLEEXTRALARGE: "XXL",
  EXTRAEXTRALARGE: "XXL",
  XXXLARGE: "XXXL",
  TRIPLEEXTRALARGE: "XXXL",
  EXTRAEXTRAEXTRALARGE: "XXXL",
  "2XLARGE": "XXL",
  "2EXTRALARGE": "XXL",
  "3XLARGE": "XXXL",
  "3EXTRALARGE": "XXXL",
};

function getNamedProductSizeAlias(size?: string) {
  const compactSize = (size || "")
    .trim()
    .toUpperCase()
    .replace(/\(?\s*\d{1,3}(?:\.\d+)?\s*[~～\-–—]\s*\d{1,3}(?:\.\d+)?\s*\)?/g, "")
    .replace(/[\s_-]+/g, "");

  return NAMED_PRODUCT_SIZE_ALIASES[compactSize];
}

function isFreeSizeAlias(size?: string) {
  const compactSize = (size || "")
    .trim()
    .toUpperCase()
    .replace(/\(?\s*\d{1,3}(?:\.\d+)?\s*[~～\-–—]\s*\d{1,3}(?:\.\d+)?\s*\)?/g, "")
    .replace(/\(\s*\d{1,3}(?:\.\d+)?\s*\)/g, "")
    .replace(/[\s/_-]+/g, "");

  return ["FREE", "F", "FREESIZE", "ONESIZE", "OS"].includes(compactSize);
}

export function normalizeProductSizeForCompare(size?: string) {
  const normalizedSize = (size || "").replace(/\s+/g, "").toUpperCase();
  if (isFreeSizeAlias(size)) return "FREE";
  const namedSize = getNamedProductSizeAlias(size);
  if (namedSize) return namedSize;

  const letterSize = normalizedSize.match(/(?:[2-5]XL|XXXL|XXL|XL|XS|S|M|L|FREE|OS)/)?.[0];
  const baseSize = letterSize || normalizedSize;

  if (baseSize === "2XL") return "XXL";
  if (baseSize === "3XL") return "XXXL";

  return baseSize;
}

function getBaseSizeForStorage(size: string) {
  const normalizedSize = size.replace(/\s+/g, "").toUpperCase();
  if (isFreeSizeAlias(size)) return "FREE";
  const namedSize = getNamedProductSizeAlias(size);
  if (namedSize) return namedSize;

  return (
    normalizedSize.match(/(?:[2-5]XL|XXXL|XXL|XL|XS|S|M|L|FREE|OS)/)?.[0] ||
    normalizedSize
  );
}

function getNumericRange(size: string) {
  const rangeMatch = size.match(/(\d{1,3})\s*[~～\-–—]\s*(\d{1,3})/);
  if (!rangeMatch) return undefined;

  const firstValue = Number(rangeMatch[1]);
  const secondValue = Number(rangeMatch[2]);

  return {
    min: Math.min(firstValue, secondValue),
    max: Math.max(firstValue, secondValue),
  };
}

function isValidProductSizeName(size?: string) {
  const normalizedSize = size?.trim();

  return Boolean(
    normalizedSize &&
      !INVALID_PRODUCT_SIZE_KEYWORDS.some((keyword) => normalizedSize.includes(keyword))
  );
}

function parsePositiveMeasurement(value: string | number | undefined) {
  const parsedValue = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

export function hasValidProductSizeMeasurements(sizeInfo: ProductSizeMeasurement) {
  return PRODUCT_MEASUREMENT_KEYS.some(
    (key) => parsePositiveMeasurement(sizeInfo[key]) !== undefined
  );
}

export function sanitizeProductSizeMeasurement(
  sizeInfo: ProductSizeMeasurement
): ProductSizeMeasurement | null {
  if (!isValidProductSizeName(sizeInfo.size)) return null;

  const sanitized: ProductSizeMeasurement = { ...sizeInfo };
  PRODUCT_MEASUREMENT_KEYS.forEach((key) => {
    sanitized[key] = parsePositiveMeasurement(sizeInfo[key]);
  });

  return hasValidProductSizeMeasurements(sanitized) ? sanitized : null;
}

export function getValidProductSizeRows(productSizeGuide?: ProductSizeGuide) {
  return (productSizeGuide?.sizes || [])
    .map(sanitizeProductSizeMeasurement)
    .filter((sizeInfo): sizeInfo is ProductSizeMeasurement => Boolean(sizeInfo));
}

export function getProductSizeDisplayName(sizeInfo: ProductSizeMeasurement) {
  if (
    [sizeInfo.size, sizeInfo.displaySize, sizeInfo.rawSize].some(
      (size) => normalizeProductSizeForCompare(size) === "FREE"
    )
  ) {
    return "FREE";
  }

  return (sizeInfo.displaySize || sizeInfo.rawSize || sizeInfo.size).trim();
}

function isSizeInNumericRange(size: string | undefined, sizeInfo: ProductSizeMeasurement) {
  const numericSize = Number((size || "").trim());
  const numericRange = sizeInfo.numericRange || getNumericRange(getProductSizeDisplayName(sizeInfo));

  return (
    Number.isFinite(numericSize) &&
    numericRange !== undefined &&
    numericSize >= numericRange.min &&
    numericSize <= numericRange.max
  );
}

export function doesProductSizeRowMatch(
  sizeInfo: ProductSizeMeasurement,
  size?: string
) {
  const targetSize = normalizeProductSizeForCompare(size);
  if (!targetSize) return false;

  return (
    normalizeProductSizeForCompare(sizeInfo.size) === targetSize ||
    normalizeProductSizeForCompare(sizeInfo.displaySize) === targetSize ||
    normalizeProductSizeForCompare(sizeInfo.rawSize) === targetSize ||
    isSizeInNumericRange(size, sizeInfo)
  );
}

export function buildProductSizeMeasurement(
  draft: ProductMeasurementDraft
): ProductSizeMeasurement | null {
  const displaySize = draft.size.trim();
  if (!isValidProductSizeName(displaySize)) return null;

  const measurement: ProductSizeMeasurement = {
    size: getBaseSizeForStorage(displaySize),
    rawSize: displaySize,
    displaySize,
    numericRange: getNumericRange(displaySize),
  };
  PRODUCT_MEASUREMENT_KEYS.forEach((key) => {
    measurement[key] = parsePositiveMeasurement(draft[key]);
  });

  return hasValidProductSizeMeasurements(measurement) ? measurement : null;
}

export function upsertProductSizeMeasurement(
  currentRows: ProductSizeMeasurement[],
  measurement: ProductSizeMeasurement
) {
  return [
    ...currentRows.filter((row) => !doesProductSizeRowMatch(row, measurement.size)),
    measurement,
  ];
}

export function removeProductSizeMeasurement(
  currentRows: ProductSizeMeasurement[],
  measurement: ProductSizeMeasurement
) {
  const targetKey = [
    measurement.size,
    measurement.rawSize || "",
    measurement.displaySize || "",
  ].join("|");

  return currentRows.filter(
    (row) =>
      [row.size, row.rawSize || "", row.displaySize || ""].join("|") !== targetKey
  );
}
