import {
  CURRENT_CLASSIFICATION_VERSION,
  CURRENT_PHOTO_ANALYSIS_VERSION,
  isAnalysisVersionOutdated,
} from "@/utils/clothesAnalysisVersions";
import type { ClothesAnalysis } from "@/utils/clothesAnalysis";
import { normalizePhotoClassificationWithTaxonomy } from "@/utils/clothingTaxonomy";
import { normalizeProductColor } from "@/utils/color";
import {
  inferProductAttributesFromConfirmedProduct,
  type ProductClassificationResult,
} from "@/utils/productClassification";
import { getConfirmedProductSeasonInference } from "@/utils/seasonInference";
import type {
  ClosetItem,
  ProductClassificationField,
  SeasonInferenceResult,
} from "@/utils/storage";

const INVALID_TEXT_VALUES = new Set([
  "",
  "판단 어려움",
  "분석 전",
  "분류 확인 필요",
  "상세 종류 확인 필요",
  "상세 분류 전",
  "스타일 미분석",
  "스타일 분석 전",
  "핏 미분석",
  "핏 분석 전",
]);
const VALID_CATEGORIES = new Set(["상의", "하의", "신발", "아우터", "액세서리", "기타"]);
const GENERIC_CLASSIFICATION_VALUES = new Set([
  "상의",
  "하의",
  "신발",
  "아우터",
  "액세서리",
  "기타",
  "셔츠",
  "팬츠",
  "티셔츠",
  "자켓",
  "재킷",
  "가방",
  "모자",
]);

export type ClosetItemAnalysisUpdateAvailability = {
  status:
    | "current"
    | "photo_and_classification"
    | "classification_only"
    | "unavailable";
  classificationOutdated: boolean;
  photoAnalysisOutdated: boolean;
  canRefreshClassification: boolean;
  canRefreshPhoto: boolean;
  analysisImageUri?: string;
};

export type ClosetItemAnalysisDiff = {
  field: keyof ClosetItem;
  label: string;
  before: string;
  after: string;
};

export type ClosetItemAnalysisMergeOptions = {
  applyClassification?: boolean;
  applyPhotoAnalysis?: boolean;
  now?: string;
};

export type ClosetItemAnalysisMergeResult = {
  item: ClosetItem;
  changes: Partial<ClosetItem>;
  diffs: ClosetItemAnalysisDiff[];
  skippedUserEditedFields: ProductClassificationField[];
};

export type ClosetAnalysisBatchProgress = {
  current: number;
  total: number;
  updated: number;
  unchanged: number;
  failed: number;
};

export type ClosetAnalysisBatchResult = {
  updates: { id: string; changes: Partial<ClosetItem> }[];
  updated: number;
  unchanged: number;
  failedItemIds: string[];
  cancelled: boolean;
};

const DIFF_FIELDS: Array<{
  field: keyof ClosetItem;
  label: string;
}> = [
  { field: "category", label: "카테고리" },
  { field: "subCategory", label: "기본 종류" },
  { field: "detailCategory", label: "상세 종류" },
  { field: "color", label: "색상" },
  { field: "material", label: "소재" },
  { field: "styleTags", label: "스타일" },
  { field: "seasons", label: "계절" },
  { field: "fit", label: "핏" },
  { field: "pattern", label: "패턴" },
  { field: "graphicType", label: "그래픽" },
  { field: "description", label: "특징" },
  { field: "matchTip", label: "매치 팁" },
  { field: "avoidTip", label: "피할 조합" },
];

function normalizeComparableValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === undefined || value === null ? "" : String(value).trim();
}

function isMeaningfulText(value: unknown): value is string {
  return typeof value === "string" && !INVALID_TEXT_VALUES.has(value.trim());
}

function isMeaningfulArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.some((entry) => isMeaningfulText(entry))
  );
}

function isMeaningfulObject(value: unknown) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).some(
      (entry) =>
        isMeaningfulText(entry) ||
        (typeof entry === "number" && Number.isFinite(entry)) ||
        (typeof entry === "boolean") ||
        (Array.isArray(entry) && entry.length > 0) ||
        (entry && typeof entry === "object")
    )
  );
}

function isMeaningfulValue(value: unknown) {
  if (isMeaningfulText(value)) return true;
  if (isMeaningfulArray(value)) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return isMeaningfulObject(value);
}

function getClassificationSpecificity(value: unknown) {
  if (!isMeaningfulText(value)) return 0;
  if (GENERIC_CLASSIFICATION_VALUES.has(value.trim())) return 1;
  return Math.min(5, 2 + value.trim().split(/\s+/).length);
}

function shouldAcceptClassificationValue(
  field: keyof ClosetItem,
  currentValue: unknown,
  nextValue: unknown
) {
  if (!isMeaningfulValue(nextValue)) return false;
  if (field === "category" && !VALID_CATEGORIES.has(String(nextValue).trim())) {
    return false;
  }
  if (
    (field === "subCategory" || field === "detailCategory") &&
    isMeaningfulValue(currentValue) &&
    getClassificationSpecificity(nextValue) < getClassificationSpecificity(currentValue)
  ) {
    return false;
  }
  return true;
}

function getProtectedField(
  field: keyof ClosetItem
): ProductClassificationField | undefined {
  if (
    field === "season" ||
    field === "seasons" ||
    field === "seasonSource" ||
    field === "seasonNeedsReview"
  ) {
    return "season";
  }
  if (field === "style" || field === "styleTags") return "styleTags";
  if (
    field === "category" ||
    field === "subCategory" ||
    field === "detailCategory" ||
    field === "color" ||
    field === "material"
  ) {
    return field;
  }
  return undefined;
}

function getStrongConfirmedBrand(analysis?: ClothesAnalysis) {
  const brand = analysis?.confirmedBrand || analysis?.brand;
  const confidence = analysis?.brandConfidence ?? 0;
  const hasEvidence = Boolean(
    analysis?.logoDetected &&
      (analysis.logoText?.trim() || analysis.brand?.trim() || analysis.confirmedBrand?.trim())
  );

  return isMeaningfulText(brand) && confidence >= 80 && hasEvidence
    ? brand.trim()
    : undefined;
}

function getTaxonomyAnalysis(
  item: ClosetItem,
  analysis?: ClothesAnalysis
): ClothesAnalysis {
  return normalizePhotoClassificationWithTaxonomy({
    category: analysis?.category || item.category,
    subCategory: analysis?.subCategory || item.subCategory,
    detailCategory: analysis?.detailCategory || item.detailCategory,
    color: analysis?.color || item.color,
    style: analysis?.style || item.style,
    styleTags: analysis?.styleTags || item.styleTags,
    season: analysis?.season || item.season,
    seasons: analysis?.seasons || item.seasons,
    seasonSource: analysis?.seasonSource || item.seasonSource,
    seasonNeedsReview: analysis?.seasonNeedsReview ?? item.seasonNeedsReview,
    fit: analysis?.fit || item.fit,
    material: analysis?.material || item.material,
    pattern: analysis?.pattern || item.pattern,
    graphicDetected: analysis?.graphicDetected ?? item.graphicDetected,
    graphicType: analysis?.graphicType || item.graphicType,
    graphicSize: analysis?.graphicSize || item.graphicSize,
    description: analysis?.description || item.description,
    matchTip: analysis?.matchTip || item.matchTip,
    avoidTip: analysis?.avoidTip || item.avoidTip,
    styleProfile: analysis?.styleProfile || item.styleProfile,
    garmentProfile: analysis?.garmentProfile || item.garmentProfile,
    confidence: analysis?.confidence || item.confidence,
    analysisWarnings: analysis?.analysisWarnings || item.analysisWarnings,
    analysisQuality: analysis?.analysisQuality || item.analysisQuality,
  });
}

function getOfficialClassification(item: ClosetItem) {
  const product = item.confirmedProduct;
  if (!product) return {};

  return inferProductAttributesFromConfirmedProduct({
    productName: product.productName,
    productCategory: product.productCategory,
    brand: product.brand,
    materialComposition: product.materialComposition,
    currentItem: {
      ...item,
      userEditedClassificationFields: [],
    },
  });
}

function setCandidate(
  target: Partial<ClosetItem>,
  item: ClosetItem,
  field: keyof ClosetItem,
  value: unknown,
  protectedFields: Set<ProductClassificationField>,
  skippedFields: Set<ProductClassificationField>
) {
  const protectedField = getProtectedField(field);
  if (protectedField && protectedFields.has(protectedField)) {
    if (
      isMeaningfulValue(value) &&
      normalizeComparableValue(item[field]) !== normalizeComparableValue(value)
    ) {
      skippedFields.add(protectedField);
    }
    return;
  }

  if (!shouldAcceptClassificationValue(field, item[field], value)) return;
  (target as Record<string, unknown>)[field] = value;
}

function applyOfficialClassification(
  target: Partial<ClosetItem>,
  item: ClosetItem,
  classification: ProductClassificationResult,
  protectedFields: Set<ProductClassificationField>,
  skippedFields: Set<ProductClassificationField>
) {
  setCandidate(
    target,
    item,
    "color",
    normalizeProductColor(item.confirmedProduct?.productColor),
    protectedFields,
    skippedFields
  );
  setCandidate(target, item, "category", classification.category, protectedFields, skippedFields);
  setCandidate(
    target,
    item,
    "subCategory",
    classification.subCategory,
    protectedFields,
    skippedFields
  );
  setCandidate(
    target,
    item,
    "detailCategory",
    classification.detailCategory,
    protectedFields,
    skippedFields
  );
  setCandidate(target, item, "material", classification.material, protectedFields, skippedFields);
  setCandidate(
    target,
    item,
    "styleTags",
    classification.styleTags,
    protectedFields,
    skippedFields
  );
  if (classification.styleTags?.[0]) {
    setCandidate(
      target,
      item,
      "style",
      classification.styleTags[0],
      protectedFields,
      skippedFields
    );
  }
}

function applyOfficialSeason(
  target: Partial<ClosetItem>,
  item: ClosetItem,
  inference: SeasonInferenceResult | null,
  protectedFields: Set<ProductClassificationField>,
  skippedFields: Set<ProductClassificationField>
) {
  if (!inference?.seasons.length) return;

  setCandidate(target, item, "seasons", inference.seasons, protectedFields, skippedFields);
  setCandidate(
    target,
    item,
    "season",
    inference.seasons.join(", "),
    protectedFields,
    skippedFields
  );
  setCandidate(target, item, "seasonSource", inference.source, protectedFields, skippedFields);
  if (!protectedFields.has("season")) {
    target.seasonNeedsReview = inference.needsReview;
  }
}

export function getClosetItemAnalysisImageUri(item: ClosetItem) {
  return getClosetItemAnalysisImageUris(item)[0];
}

export function getClosetItemAnalysisImageUris(item: ClosetItem) {
  return Array.from(
    new Set(
      [item.imageUri, item.cleanImageUri]
        .map((uri) => uri?.trim())
        .filter((uri): uri is string => Boolean(uri))
    )
  );
}

export function getClosetItemAnalysisUpdateAvailability(
  item: ClosetItem
): ClosetItemAnalysisUpdateAvailability {
  const classificationOutdated = isAnalysisVersionOutdated(
    item.classificationVersion,
    CURRENT_CLASSIFICATION_VERSION
  );
  const analysisImageUri = getClosetItemAnalysisImageUri(item);
  const photoAnalysisOutdated =
    Boolean(analysisImageUri) &&
    isAnalysisVersionOutdated(
      item.photoAnalysisVersion,
      CURRENT_PHOTO_ANALYSIS_VERSION
    );
  const hasOfficialProduct = Boolean(item.confirmedProduct);
  const canRefreshPhoto = photoAnalysisOutdated && Boolean(analysisImageUri);
  const canRefreshClassification =
    classificationOutdated && (hasOfficialProduct || Boolean(analysisImageUri));

  if (!classificationOutdated && !photoAnalysisOutdated) {
    return {
      status: "current",
      classificationOutdated,
      photoAnalysisOutdated,
      canRefreshClassification,
      canRefreshPhoto,
      analysisImageUri,
    };
  }
  if (canRefreshPhoto) {
    return {
      status: "photo_and_classification",
      classificationOutdated,
      photoAnalysisOutdated,
      canRefreshClassification,
      canRefreshPhoto,
      analysisImageUri,
    };
  }
  if (canRefreshClassification) {
    return {
      status: "classification_only",
      classificationOutdated,
      photoAnalysisOutdated,
      canRefreshClassification,
      canRefreshPhoto,
      analysisImageUri,
    };
  }
  return {
    status: "unavailable",
    classificationOutdated,
    photoAnalysisOutdated,
    canRefreshClassification,
    canRefreshPhoto,
    analysisImageUri,
  };
}

export function getClosetItemAnalysisDiff(
  currentItem: ClosetItem,
  nextItem: ClosetItem
) {
  return DIFF_FIELDS.flatMap<ClosetItemAnalysisDiff>(({ field, label }) => {
    const before = normalizeComparableValue(currentItem[field]);
    const after = normalizeComparableValue(nextItem[field]);
    if (before === after) return [];
    return [{ field, label, before: before || "없음", after: after || "없음" }];
  });
}

export function mergeClosetItemAnalysisUpdate(
  currentItem: ClosetItem,
  newAnalysis?: ClothesAnalysis,
  options: ClosetItemAnalysisMergeOptions = {}
): ClosetItemAnalysisMergeResult {
  const {
    applyClassification = true,
    applyPhotoAnalysis = Boolean(newAnalysis),
    now = new Date().toISOString(),
  } = options;
  const protectedFields = new Set(
    currentItem.userEditedClassificationFields || []
  );
  const skippedFields = new Set<ProductClassificationField>();
  const taxonomyAnalysis = getTaxonomyAnalysis(currentItem, newAnalysis);
  const candidates: Partial<ClosetItem> = {};
  const photoFields: Array<keyof ClosetItem> = [
    "category",
    "subCategory",
    "detailCategory",
    "color",
    "style",
    "styleTags",
    "season",
    "seasons",
    "seasonSource",
    "seasonNeedsReview",
    "fit",
    "material",
    "pattern",
    "graphicDetected",
    "graphicType",
    "graphicSize",
    "description",
    "matchTip",
    "avoidTip",
    "styleProfile",
    "garmentProfile",
    "confidence",
    "analysisWarnings",
    "analysisQuality",
    "logoDetected",
    "logoText",
    "productCandidates",
    "inferredProductName",
  ];

  if (applyPhotoAnalysis && newAnalysis) {
    photoFields.forEach((field) => {
      setCandidate(
        candidates,
        currentItem,
        field,
        taxonomyAnalysis[field as keyof ClothesAnalysis],
        protectedFields,
        skippedFields
      );
    });

    const confirmedBrand = getStrongConfirmedBrand(newAnalysis);
    if (!currentItem.confirmedProduct && confirmedBrand) {
      candidates.confirmedBrand = confirmedBrand;
      candidates.brand = confirmedBrand;
      candidates.brandConfidence = newAnalysis.brandConfidence;
    } else if (
      !currentItem.confirmedProduct &&
      isMeaningfulText(newAnalysis.inferredBrand || newAnalysis.brand)
    ) {
      candidates.inferredBrand = (newAnalysis.inferredBrand || newAnalysis.brand)?.trim();
    }
  }

  if (applyClassification) {
    if (!applyPhotoAnalysis) {
      (["category", "subCategory", "detailCategory", "style", "styleTags"] as const).forEach(
        (field) => {
          setCandidate(
            candidates,
            currentItem,
            field,
            taxonomyAnalysis[field],
            protectedFields,
            skippedFields
          );
        }
      );
    }
    applyOfficialClassification(
      candidates,
      currentItem,
      getOfficialClassification(currentItem),
      protectedFields,
      skippedFields
    );
    applyOfficialSeason(
      candidates,
      currentItem,
      getConfirmedProductSeasonInference(currentItem.confirmedProduct, currentItem),
      protectedFields,
      skippedFields
    );
  }

  const changes: Partial<ClosetItem> = {};
  Object.entries(candidates).forEach(([field, value]) => {
    if (
      normalizeComparableValue(currentItem[field as keyof ClosetItem]) !==
      normalizeComparableValue(value)
    ) {
      (changes as Record<string, unknown>)[field] = value;
    }
  });

  if (applyClassification) {
    changes.classificationVersion = CURRENT_CLASSIFICATION_VERSION;
    changes.lastClassificationUpdatedAt = now;
  }
  if (applyPhotoAnalysis) {
    changes.photoAnalysisVersion = CURRENT_PHOTO_ANALYSIS_VERSION;
    changes.lastAnalyzedAt = now;
  }
  if (Object.keys(changes).length > 0) changes.updatedAt = now;

  const item = { ...currentItem, ...changes };
  return {
    item,
    changes,
    diffs: getClosetItemAnalysisDiff(currentItem, item),
    skippedUserEditedFields: Array.from(skippedFields),
  };
}

export function getClosetItemLocalAnalysisUpdate(
  item: ClosetItem,
  now?: string
) {
  return mergeClosetItemAnalysisUpdate(item, undefined, {
    applyClassification: true,
    applyPhotoAnalysis: false,
    now,
  });
}

export function getAnalysisStatusLabel(item: ClosetItem) {
  const availability = getClosetItemAnalysisUpdateAvailability(item);
  if (availability.status === "current") return "최신 분석";
  if (availability.status === "unavailable") return "자동 업데이트 불가";
  return "업데이트 가능";
}

export async function prepareClosetAnalysisBatch(
  items: ClosetItem[],
  options: {
    requestPhotoAnalysis: (
      imageUri: string,
      item: ClosetItem
    ) => Promise<ClothesAnalysis>;
    shouldFallbackToLocal?: (error: unknown) => boolean;
    isCancelled?: () => boolean;
    onProgress?: (progress: ClosetAnalysisBatchProgress) => void;
    onItemPrepared?: (
      item: ClosetItem,
      result: ClosetItemAnalysisMergeResult
    ) => void;
    onItemError?: (item: ClosetItem, error: unknown) => void;
  }
): Promise<ClosetAnalysisBatchResult> {
  const updates: { id: string; changes: Partial<ClosetItem> }[] = [];
  const failedItemIds: string[] = [];
  let updated = 0;
  let unchanged = 0;

  for (const [index, item] of items.entries()) {
    if (options.isCancelled?.()) {
      return {
        updates,
        updated,
        unchanged,
        failedItemIds,
        cancelled: true,
      };
    }

    options.onProgress?.({
      current: index + 1,
      total: items.length,
      updated,
      unchanged,
      failed: failedItemIds.length,
    });

    try {
      const availability = getClosetItemAnalysisUpdateAvailability(item);
      let result: ClosetItemAnalysisMergeResult;

      if (availability.canRefreshPhoto && availability.analysisImageUri) {
        try {
          let analysis: ClothesAnalysis | undefined;
          let lastImageError: unknown;

          for (const imageUri of getClosetItemAnalysisImageUris(item)) {
            try {
              analysis = await options.requestPhotoAnalysis(imageUri, item);
              break;
            } catch (error) {
              if (!options.shouldFallbackToLocal?.(error)) throw error;
              lastImageError = error;
            }
          }
          if (!analysis) throw lastImageError || new Error("No usable analysis image");
          if (options.isCancelled?.()) {
            return {
              updates,
              updated,
              unchanged,
              failedItemIds,
              cancelled: true,
            };
          }
          result = mergeClosetItemAnalysisUpdate(item, analysis, {
            applyClassification: true,
            applyPhotoAnalysis: true,
          });
        } catch (error) {
          if (
            availability.canRefreshClassification &&
            options.shouldFallbackToLocal?.(error)
          ) {
            result = getClosetItemLocalAnalysisUpdate(item);
          } else {
            throw error;
          }
        }
      } else if (availability.canRefreshClassification) {
        result = getClosetItemLocalAnalysisUpdate(item);
      } else {
        continue;
      }

      updates.push({ id: item.id, changes: result.changes });
      options.onItemPrepared?.(item, result);
      if (result.diffs.length > 0) updated += 1;
      else unchanged += 1;
    } catch (error) {
      failedItemIds.push(item.id);
      options.onItemError?.(item, error);
    }
  }

  options.onProgress?.({
    current: items.length,
    total: items.length,
    updated,
    unchanged,
    failed: failedItemIds.length,
  });

  return {
    updates,
    updated,
    unchanged,
    failedItemIds,
    cancelled: false,
  };
}
