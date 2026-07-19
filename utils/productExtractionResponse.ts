import { validateProductUrlInput } from "@/utils/productUrl";
import type { ConfirmedProduct, ProductSizeGuide } from "@/utils/storage";

export type ExtractedProductResponse = {
  brand?: string;
  productName?: string;
  productCategory?: string;
  productColor?: string;
  productUrl: string;
  productImageUrl?: string;
  productSizeGuide?: ProductSizeGuide;
  materialComposition?: ConfirmedProduct["materialComposition"];
  sizeGuideStatus?: string;
  mallName?: string;
  price?: string;
  extractionStatus?: "complete" | "partial" | "missing_image";
  extractionSource?: "musinsa" | "structured_metadata";
  missingFields?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

function getOptionalStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return strings.length > 0 ? strings : undefined;
}

function getOptionalProductUrl(value: unknown) {
  const url = getOptionalString(value);
  if (!url) return undefined;

  const validation = validateProductUrlInput(url);
  return validation.ok ? validation.url : undefined;
}

export function parseExtractedProductResponse(
  payload: unknown,
  fallbackProductUrl: string
): ExtractedProductResponse | null {
  if (!isRecord(payload)) return null;

  const fallbackValidation = validateProductUrlInput(fallbackProductUrl);
  const productUrl =
    getOptionalProductUrl(payload.productUrl) ||
    (fallbackValidation.ok ? fallbackValidation.url : undefined);
  if (!productUrl) return null;

  const brand = getOptionalString(payload.brand);
  const productName = getOptionalString(payload.productName);
  const productCategory = getOptionalString(payload.productCategory);
  const productColor = getOptionalString(payload.productColor);
  const productImageUrl = getOptionalProductUrl(payload.productImageUrl);
  const productSizeGuide = isRecord(payload.productSizeGuide)
    ? (payload.productSizeGuide as ProductSizeGuide)
    : undefined;
  const materialComposition = isRecord(payload.materialComposition)
    ? (payload.materialComposition as ConfirmedProduct["materialComposition"])
    : undefined;

  if (
    !brand &&
    !productName &&
    !productCategory &&
    !productColor &&
    !productImageUrl &&
    !productSizeGuide &&
    !materialComposition
  ) {
    return null;
  }

  const extractionStatus = ["complete", "partial", "missing_image"].includes(
    String(payload.extractionStatus || "")
  )
    ? (payload.extractionStatus as ExtractedProductResponse["extractionStatus"])
    : undefined;
  const extractionSource = ["musinsa", "structured_metadata"].includes(
    String(payload.extractionSource || "")
  )
    ? (payload.extractionSource as ExtractedProductResponse["extractionSource"])
    : undefined;

  return {
    brand,
    productName,
    productCategory,
    productColor,
    productUrl,
    productImageUrl,
    productSizeGuide,
    materialComposition,
    sizeGuideStatus: getOptionalString(payload.sizeGuideStatus),
    mallName: getOptionalString(payload.mallName),
    price: getOptionalString(payload.price),
    extractionStatus,
    extractionSource,
    missingFields: getOptionalStringArray(payload.missingFields),
  };
}
