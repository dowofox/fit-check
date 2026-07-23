import {
  API_ENDPOINTS,
  API_TIMEOUTS,
  fetchApiWithTimeout,
} from "@/utils/api";
import { encodeAnalysisImageUri } from "@/utils/analysisImage";
import { isUsableClothesAnalysisResponse } from "@/utils/closetRegistration";
import { normalizePhotoClassificationWithTaxonomy } from "@/utils/clothingTaxonomy";
import {
  applyProductAnalysisTarget,
  getProductAnalysisTarget,
  type ProductAnalysisTarget,
} from "@/utils/productClassification";
import type {
  AnalysisConfidence,
  AnalysisQuality,
  ConfirmedProduct,
  GarmentProfile,
  MaterialComposition,
  ProductCandidate,
  SeasonSource,
  StyleProfile,
} from "@/utils/storage";

export type ClothesAnalysis = {
  source?: "image" | "productFallback" | "manual";
  category?: string;
  subCategory?: string;
  detailCategory?: string;
  color?: string;
  style?: string;
  styleTags?: string[];
  season?: string;
  seasons?: string[];
  seasonSource?: SeasonSource;
  seasonNeedsReview?: boolean;
  fit?: string;
  size?: string;
  brand?: string;
  confirmedBrand?: string | null;
  inferredBrand?: string;
  inferredProductName?: string;
  brandConfidence?: number;
  confidence?: AnalysisConfidence;
  logoDetected?: boolean;
  logoText?: string;
  graphicDetected?: boolean;
  graphicType?: string;
  graphicSize?: string;
  material?: string;
  pattern?: string;
  description?: string;
  matchTip?: string;
  avoidTip?: string;
  productCandidates?: ProductCandidate[];
  styleProfile?: StyleProfile;
  garmentProfile?: GarmentProfile;
  analysisWarnings?: string[];
  analysisQuality?: AnalysisQuality;
  cleanImageBase64?: string | null;
};

export type ClothesAnalysisProductContextInput = {
  productName?: string;
  productCategory?: string;
  brand?: string;
  productColor?: string;
  materialComposition?: MaterialComposition;
};

export function buildProductAnalysisContext(
  product?: ClothesAnalysisProductContextInput | ConfirmedProduct | null
): ProductAnalysisTarget | undefined {
  if (!product) return undefined;

  const context = getProductAnalysisTarget({
    productName: product.productName,
    productCategory: product.productCategory,
    brand: product.brand,
    productColor: product.productColor,
    materialComposition: product.materialComposition,
  });

  return Object.values(context).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  )
    ? context
    : undefined;
}

export function normalizeClothesAnalysisResult(
  payload: unknown,
  product?: ClothesAnalysisProductContextInput | ConfirmedProduct | null
) {
  if (!isUsableClothesAnalysisResponse(payload)) {
    throw new Error("Analyze clothes returned an invalid payload");
  }

  const productContext = buildProductAnalysisContext(product);
  return normalizePhotoClassificationWithTaxonomy(
    applyProductAnalysisTarget(payload as ClothesAnalysis, productContext)
  );
}

export async function requestClothesAnalysis(
  uri: string,
  product?: ClothesAnalysisProductContextInput | ConfirmedProduct | null,
  options: { signal?: AbortSignal } = {}
) {
  const encodedImage = await encodeAnalysisImageUri(uri);
  if (options.signal?.aborted) {
    const error = new Error("The operation was aborted.");
    error.name = "AbortError";
    throw error;
  }
  const productContext = buildProductAnalysisContext(product);
  const response = await fetchApiWithTimeout(
    API_ENDPOINTS.analyzeClothes,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: encodedImage.base64,
        imageMimeType: encodedImage.mimeType,
        ...(productContext ? { productContext } : {}),
      }),
      signal: options.signal,
    },
    API_TIMEOUTS.analyze
  );

  if (!response.ok) {
    throw new Error(`Analyze clothes failed: ${response.status}`);
  }

  return normalizeClothesAnalysisResult(await response.json(), product);
}
