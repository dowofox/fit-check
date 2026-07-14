import { API_ENDPOINTS } from "@/utils/api";
import {
  getClosetItemReviewFields,
  getRegistrationReviewLabels,
  normalizeClosetRegistrationBasics,
} from "@/utils/closetRegistration";
import {
  getResolvedItemMaterial,
  getProductClassificationNotice,
  inferProductAttributesFromConfirmedProduct,
} from "@/utils/productClassification";
import { getConfirmedProductSeasonInference } from "@/utils/seasonInference";
import { getProductSizeGuideStatusMessage } from "@/utils/productSizeGuideStatus";
import {
  buildProductSizeMeasurement,
  doesProductSizeRowMatch,
  getProductSizeDisplayName,
  getValidProductSizeRows,
  normalizeProductSizeForCompare,
  removeProductSizeMeasurement,
  type ProductMeasurementDraft,
  upsertProductSizeMeasurement,
} from "@/utils/productSizeMeasurements";
import {
  getFitSuitability,
  getRecommendedProductSize,
  isAccessoryOrBagItem,
  type FitSuitabilityResult,
  type SizeRecommendationResult,
} from "@/utils/sizeMatch";
import { openProductSearch } from "@/utils/productSearch";
import {
  endPerformanceTimer,
  startPerformanceTimer,
  type PerformanceTimer,
} from "@/utils/performance";
import {
  ClosetItem,
  ConfirmedProduct,
  GarmentProfile,
  getClosetItems,
  getDisplayImageUri,
  getUserProfile,
  ProductSizeGuide,
  ProductSizeMeasurement,
  ProductClassificationField,
  ReferenceClothing,
  saveUserProfile,
  StyleProfile,
  updateClosetItem,
  UserProfile,
} from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type EditableClosetFields = {
  category: string;
  subCategory: string;
  detailCategory: string;
  color: string;
  material: string;
  style: string;
  styleTags: string[];
  seasons: string[];
  fit: string;
  size: string;
  intendedFit: string;
  description: string;
  matchTip: string;
  avoidTip: string;
};

type ConfirmedProductDraft = {
  brand: string;
  productName: string;
  productUrl: string;
  productImageUrl: string;
  productSizeGuide?: ProductSizeGuide;
  materialComposition?: ConfirmedProduct["materialComposition"];
  mallName: string;
  price: string;
};

type ProductMeasurementField = Exclude<keyof ProductMeasurementDraft, "size">;

type ConfirmedProductDraftTextField =
  | "brand"
  | "productName"
  | "productUrl"
  | "productImageUrl"
  | "mallName"
  | "price";

type ExtractedProduct = ConfirmedProductDraft & {
  sizeGuideStatus?: string;
};
type RecommendationPreference = NonNullable<ClosetItem["recommendationPreference"]>;
type ReferenceClothingKey = keyof ReferenceClothing;

const EMPTY_CONFIRMED_PRODUCT_DRAFT: ConfirmedProductDraft = {
  brand: "",
  productName: "",
  productUrl: "",
  productImageUrl: "",
  mallName: "",
  price: "",
};

const EMPTY_PRODUCT_MEASUREMENT_DRAFT: ProductMeasurementDraft = {
  size: "",
  totalLength: "",
  shoulder: "",
  chest: "",
  sleeve: "",
  waist: "",
  hip: "",
  thigh: "",
  rise: "",
  hem: "",
  footLength: "",
};

function getReferenceClothingKey(item: ClosetItem): ReferenceClothingKey | null {
  if (isAccessoryOrBagItem(item)) return null;
  if (item.category === "상의") return "topItemId";
  if (item.category === "하의") return "bottomItemId";
  if (item.category === "아우터") return "outerItemId";
  if (item.category === "신발") return "shoesItemId";
  return null;
}

function getReferenceClothingCategoryLabel(key: ReferenceClothingKey) {
  const labels: Record<ReferenceClothingKey, string> = {
    topItemId: "상의",
    bottomItemId: "하의",
    outerItemId: "아우터",
    shoesItemId: "신발",
  };

  return labels[key];
}

const EMPTY_DRAFT: EditableClosetFields = {
  category: "",
  subCategory: "",
  detailCategory: "",
  color: "",
  material: "",
  style: "",
  styleTags: ["데일리"],
  seasons: ["사계절"],
  fit: "",
  size: "",
  intendedFit: "상관없음",
  description: "",
  matchTip: "",
  avoidTip: "",
};

const STYLE_OPTIONS = [
  "캐주얼",
  "미니멀",
  "스트릿",
  "포멀",
  "스포티",
  "빈티지",
  "아메카지",
  "워크웨어",
  "시티보이",
  "고프코어",
  "테크웨어",
  "프레피",
  "댄디",
  "러블리",
  "페미닌",
  "모던",
  "클래식",
  "꾸안꾸",
  "유니섹스",
  "기타",
];

const CATEGORY_OPTIONS = ["상의", "하의", "아우터", "신발", "액세서리", "기타"];
const TOP_SIZE_OPTIONS = ["FREE", "S", "M", "L", "XL", "2XL", "3XL"];
const BOTTOM_SIZE_OPTIONS = ["FREE", "28", "29", "30", "31", "32", "33", "34", "36"];
const SHOE_SIZE_OPTIONS = ["FREE", "250", "255", "260", "265", "270", "275", "280", "285"];

function getSizeOptions(category: string) {
  if (category === "상의" || category === "아우터") return TOP_SIZE_OPTIONS;
  if (category === "하의") return BOTTOM_SIZE_OPTIONS;
  if (category === "신발") return SHOE_SIZE_OPTIONS;
  return [];
}

const INTENDED_FIT_OPTIONS = ["딱 맞게", "여유 있게", "오버핏", "상관없음"];
const SHOW_INTERNAL_AI_ANALYSIS = false;
const RECOMMENDATION_PREFERENCE_OPTIONS: {
  value: RecommendationPreference;
  label: string;
}[] = [
  { value: "prefer", label: "자주 추천" },
  { value: "normal", label: "기본" },
  { value: "less", label: "잠시 덜 추천" },
];
const SEASON_OPTIONS = ["봄", "여름", "가을", "겨울", "사계절"];
const STYLE_TAG_OPTIONS = [
  "미니멀",
  "캐주얼",
  "스트릿",
  "댄디",
  "포멀",
  "스포티",
  "아메카지",
  "고프코어",
  "빈티지",
  "러블리",
  "페미닌",
  "모던",
  "클래식",
  "데일리",
  "편안함",
  "깔끔함",
  "꾸안꾸",
];

function getItemStyleTags(item: ClosetItem) {
  if (item.styleTags?.length) return item.styleTags;
  if (item.style) return [item.style];

  return ["데일리"];
}

function getItemSeasons(item: ClosetItem) {
  if (item.seasons?.length) return item.seasons;
  if (item.season) {
    const seasons = SEASON_OPTIONS.filter((season) => item.season?.includes(season));

    return seasons;
  }

  return [];
}

function toggleSeason(currentSeasons: string[], season: string) {
  if (season === "사계절") return ["사계절"];

  const nextSeasons = currentSeasons.includes(season)
    ? currentSeasons.filter((currentSeason) => currentSeason !== season)
    : [...currentSeasons.filter((currentSeason) => currentSeason !== "사계절"), season];

  return nextSeasons;
}

function toggleStyleTag(currentTags: string[], tag: string) {
  if (currentTags.includes(tag)) {
    const nextTags = currentTags.filter((currentTag) => currentTag !== tag);
    return nextTags.length > 0 ? nextTags : ["데일리"];
  }

  if (currentTags.length >= 3) return currentTags;

  return [...currentTags, tag];
}

function getEditableValues(item: ClosetItem): EditableClosetFields {
  return {
    category: item.category || "",
    subCategory: item.subCategory || "",
    detailCategory: item.detailCategory || "",
    color: item.color || "",
    material: item.material || "",
    style: item.style || "",
    styleTags: getItemStyleTags(item),
    seasons: getItemSeasons(item),
    fit: item.fit || "",
    size: item.size || "",
    intendedFit: item.intendedFit || "상관없음",
    description: item.description || "",
    matchTip: item.matchTip || "",
    avoidTip: item.avoidTip || "",
  };
}

function getUserEditedClassificationFields(
  item: ClosetItem,
  draft: EditableClosetFields
) {
  const editedFields = new Set<ProductClassificationField>(
    item.userEditedClassificationFields || []
  );

  if (draft.category !== item.category) editedFields.add("category");
  if (draft.subCategory !== (item.subCategory || "")) editedFields.add("subCategory");
  if (draft.detailCategory !== (item.detailCategory || "")) {
    editedFields.add("detailCategory");
  }
  if (draft.material !== (item.material || "")) editedFields.add("material");
  if (JSON.stringify(draft.styleTags) !== JSON.stringify(getItemStyleTags(item))) {
    editedFields.add("styleTags");
  }
  if (JSON.stringify(draft.seasons) !== JSON.stringify(getItemSeasons(item))) {
    editedFields.add("season");
  }

  return [...editedFields];
}

function getConfirmedProductDraft(item?: ClosetItem | null): ConfirmedProductDraft {
  const confirmedProduct = item?.confirmedProduct;

  return {
    brand: confirmedProduct?.brand || "",
    productName: confirmedProduct?.productName || "",
    productUrl: confirmedProduct?.productUrl || "",
    productImageUrl: confirmedProduct?.productImageUrl || "",
    productSizeGuide: confirmedProduct?.productSizeGuide,
    materialComposition: confirmedProduct?.materialComposition,
    mallName: confirmedProduct?.mallName || "",
    price: confirmedProduct?.price || "",
  };
}

function buildConfirmedProductFromDraft(
  draft: ConfirmedProductDraft,
  options: { includeProductSizeGuide?: boolean } = { includeProductSizeGuide: true }
): ConfirmedProduct | null {
  const brand = draft.brand.trim();
  const productName = draft.productName.trim();

  if (!brand || !productName) return null;

  return {
    brand,
    productName,
    productUrl: draft.productUrl.trim(),
    productImageUrl: draft.productImageUrl.trim(),
    productSizeGuide: options.includeProductSizeGuide
      ? normalizeProductSizeGuideForDisplay(draft.productSizeGuide)
      : undefined,
    materialComposition: draft.materialComposition,
    mallName: draft.mallName.trim(),
    price: draft.price.trim(),
    confirmedAt: new Date().toISOString(),
  };
}

function normalizeProductSizeGuideForDisplay(
  productSizeGuide?: ProductSizeGuide
): ProductSizeGuide | undefined {
  const sizes = getValidProductSizeRows(productSizeGuide);

  if (sizes.length === 0) return undefined;

  return {
    ...productSizeGuide,
    sizes,
  };
}

function getProductSizeGuideSummary(productSizeGuide?: ProductSizeGuide) {
  const sizes = getValidProductSizeRows(productSizeGuide).map((sizeInfo) =>
    getProductSizeDisplayName(sizeInfo)
  );

  return sizes.length > 0 ? sizes.join(" / ") : "";
}

const PRODUCT_SIZE_MEASUREMENT_LABELS: [keyof ProductSizeMeasurement, string][] = [
  ["totalLength", "총장"],
  ["shoulder", "어깨"],
  ["chest", "가슴"],
  ["sleeve", "소매"],
  ["waist", "허리"],
  ["hip", "엉덩이"],
  ["thigh", "허벅지"],
  ["rise", "밑위"],
  ["hem", "밑단"],
  ["footLength", "발길이"],
];

function getProfileSizeForItem(item: ClosetItem, profile?: UserProfile | null) {
  if (!profile) return "";

  if (item.category?.includes("신발")) return profile.shoeSize || "";
  if (item.category?.includes("하의")) return profile.bottomSize || "";
  if (item.category?.includes("상의") || item.category?.includes("아우터")) return profile.topSize || "";

  const sizeRows = getValidProductSizeRows(item.confirmedProduct?.productSizeGuide);
  const profileSizes = [profile.topSize, profile.bottomSize, profile.shoeSize].filter(Boolean);
  const matchedSize = profileSizes.find((profileSize) =>
    sizeRows.some((row) => doesProductSizeRowMatch(row, profileSize))
  );

  return matchedSize || "";
}

function getMeasurementRows(sizeInfo: ProductSizeMeasurement) {
  return PRODUCT_SIZE_MEASUREMENT_LABELS
    .map(([key, label]) => {
      const value = sizeInfo[key];
      return typeof value === "number" ? { label, value: `${value}cm` } : null;
    })
    .filter(Boolean) as { label: string; value: string }[];
}

function measurementValueToDraft(value?: number) {
  return typeof value === "number" ? String(value) : "";
}

function getProductMeasurementDraft(item: ClosetItem): ProductMeasurementDraft {
  const sizeRows = getValidProductSizeRows(item.confirmedProduct?.productSizeGuide);
  const currentSize = item.size || "";
  const matchingRow =
    sizeRows.find((row) => doesProductSizeRowMatch(row, currentSize));

  if (!matchingRow) {
    return {
      ...EMPTY_PRODUCT_MEASUREMENT_DRAFT,
      size: currentSize,
    };
  }

  return {
    size: getProductSizeDisplayName(matchingRow),
    totalLength: measurementValueToDraft(matchingRow.totalLength),
    shoulder: measurementValueToDraft(matchingRow.shoulder),
    chest: measurementValueToDraft(matchingRow.chest),
    sleeve: measurementValueToDraft(matchingRow.sleeve),
    waist: measurementValueToDraft(matchingRow.waist),
    hip: measurementValueToDraft(matchingRow.hip),
    thigh: measurementValueToDraft(matchingRow.thigh),
    rise: measurementValueToDraft(matchingRow.rise),
    hem: measurementValueToDraft(matchingRow.hem),
    footLength: measurementValueToDraft(matchingRow.footLength),
  };
}

const TOP_MEASUREMENT_FIELDS: { key: ProductMeasurementField; label: string }[] = [
  { key: "totalLength", label: "총장" },
  { key: "shoulder", label: "어깨" },
  { key: "chest", label: "가슴" },
  { key: "sleeve", label: "소매" },
];

const BOTTOM_MEASUREMENT_FIELDS: { key: ProductMeasurementField; label: string }[] = [
  { key: "totalLength", label: "총장" },
  { key: "waist", label: "허리" },
  { key: "hip", label: "엉덩이" },
  { key: "thigh", label: "허벅지" },
  { key: "rise", label: "밑위" },
  { key: "hem", label: "밑단" },
];

const SHOE_MEASUREMENT_FIELDS: { key: ProductMeasurementField; label: string }[] = [
  { key: "footLength", label: "발길이" },
];

function getMeasurementFields(item: ClosetItem) {
  if (isAccessoryOrBagItem(item)) return [];
  const categoryText = [item.category, item.subCategory, item.detailCategory]
    .filter(Boolean)
    .join(" ");

  if (categoryText.includes("하의")) return BOTTOM_MEASUREMENT_FIELDS;
  if (categoryText.includes("신발")) return SHOE_MEASUREMENT_FIELDS;
  return TOP_MEASUREMENT_FIELDS;
}

function ChipGroup({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const isActive = value === option;

          return (
            <Pressable
              key={option}
              style={[styles.optionChip, isActive && styles.optionChipActive]}
              onPress={() => onSelect(option)}
            >
              <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiChipGroup({
  label,
  values,
  options,
  onSelect,
}: {
  label: string;
  values: string[];
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const isActive = values.includes(option);

          return (
            <Pressable
              key={option}
              style={[styles.optionChip, isActive && styles.optionChipActive]}
              onPress={() => onSelect(option)}
            >
              <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  const normalizedValue = value?.trim();
  if (!normalizedValue || ["판단 어려움", "추정 없음", "확정 없음", "없음"].includes(normalizedValue)) {
    return null;
  }

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        <Text style={styles.detailValue}>{normalizedValue}</Text>
      </View>
    </View>
  );
}

function SeasonChipEditor({
  values,
  onSelect,
  needsConfirmation,
  isConfirmed,
  onConfirm,
}: {
  values: string[];
  onSelect: (value: string) => void;
  needsConfirmation: boolean;
  isConfirmed: boolean;
  onConfirm: () => void;
}) {
  return (
    <>
      <MultiChipGroup
        label="입기 좋은 계절"
        values={values}
        options={SEASON_OPTIONS}
        onSelect={onSelect}
      />
      {needsConfirmation && values.length > 0 ? (
        <Pressable
          style={[
            styles.seasonConfirmationButton,
            isConfirmed && styles.seasonConfirmationButtonDone,
          ]}
          onPress={onConfirm}
          disabled={isConfirmed}
        >
          <Feather name={isConfirmed ? "check-circle" : "check"} size={14} color="#fff" />
          <Text style={styles.seasonConfirmationButtonText}>
            {isConfirmed ? "계절 확인 완료" : "선택한 계절로 확인"}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

function getMaterialCompositionSummary(
  materialComposition?: ConfirmedProduct["materialComposition"]
) {
  const summary = materialComposition?.summary?.trim();
  if (!summary) return "";

  const items = materialComposition?.items || [];
  const totalPercentage = items.reduce(
    (total, item) =>
      typeof item.percentage === "number" ? total + item.percentage : total,
    0
  );

  if (totalPercentage <= 100.5) return summary;

  const materialNames = items
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name));

  return materialNames.length > 0
    ? `${Array.from(new Set(materialNames)).join(", ")} (혼용률 확인 필요)`
    : "소재 혼용률 확인 필요";
}

function getDisplayBrand(item: ClosetItem) {
  return (
    item.confirmedProduct?.brand?.trim() ||
    item.confirmedBrand?.trim() ||
    item.brand?.trim() ||
    ""
  );
}

function getDisplayTitle(item: ClosetItem) {
  return (
    item.confirmedProduct?.productName?.trim() ||
    item.detailCategory?.trim() ||
    item.subCategory?.trim() ||
    item.category
  );
}

function getDisplayMaterial(item: ClosetItem) {
  const resolvedMaterial = getResolvedItemMaterial(item);

  if (item.userEditedClassificationFields?.includes("material")) {
    return resolvedMaterial ? `${resolvedMaterial} (직접 수정)` : "";
  }

  const officialMaterial = getMaterialCompositionSummary(
    item.confirmedProduct?.materialComposition
  );
  if (officialMaterial) return `${officialMaterial} (공식 소재)`;

  return resolvedMaterial && resolvedMaterial !== "판단 어려움"
    ? `${resolvedMaterial} (사진/입력 기준)`
    : "";
}

function getDisplayStyleText(item: ClosetItem) {
  const tags = getItemStyleTags(item).filter(Boolean).slice(0, 3);
  if (tags.length > 0) return tags.join(", ");
  return item.style?.trim() || "";
}

function getBooleanLabel(value?: boolean) {
  return value ? "감지됨" : "없음";
}

function getAiAnalysisRows(item: ClosetItem) {
  const confirmedBrand =
    item.confirmedProduct?.brand?.trim() || item.confirmedBrand?.trim() || "";
  const officialMaterial = getMaterialCompositionSummary(
    item.confirmedProduct?.materialComposition
  );

  return [
    { label: "확정 브랜드", value: confirmedBrand || "확정 없음" },
    {
      label: "추정 브랜드",
      value: confirmedBrand ? "확정 브랜드 우선" : item.inferredBrand || "추정 없음",
    },
    { label: "추정 상품명", value: item.inferredProductName || "추정 없음" },
    { label: "로고", value: getBooleanLabel(item.logoDetected) },
    { label: "로고 텍스트", value: item.logoText || "없음" },
    { label: "프린팅/그래픽", value: item.graphicType || "판단 어려움" },
    { label: "그래픽 크기", value: item.graphicSize || "판단 어려움" },
    {
      label: "소재",
      value:
        officialMaterial ||
        item.material ||
        "판단 어려움",
    },
    { label: "패턴", value: item.pattern || "판단 어려움" },
  ];
}

function AiDetailCard({ item }: { item: ClosetItem }) {
  return (
    <View style={styles.aiDetailCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="cpu" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>AI 상세 분석</Text>
          <Text style={styles.aiDetailSubtitle}>명확한 로고/텍스트가 있을 때만 브랜드를 확정해요.</Text>
        </View>
      </View>

      <View style={styles.aiDetailGrid}>
        {getAiAnalysisRows(item).map((row) => (
          <View key={row.label} style={styles.aiDetailPill}>
            <Text style={styles.aiDetailLabel}>{row.label}</Text>
            <Text style={styles.aiDetailValue} numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function hasLowProductConfidence(item: ClosetItem) {
  if (item.confirmedProduct) return false;

  return typeof item.confidence?.product === "number" && item.confidence.product < 70;
}

function isProductConfirmationWarning(warning: string) {
  return ["상품 링크", "상품 식별", "상품 확정"].some((keyword) =>
    warning.includes(keyword)
  );
}

function isBrandConfirmationWarning(warning: string) {
  return (
    warning.includes("브랜드") &&
    ["불확실", "식별", "추정", "판단", "확실하지"].some((keyword) =>
      warning.includes(keyword)
    )
  );
}

function getImageQualityLabel(imageQuality?: string) {
  const labels: Record<string, string> = {
    good: "좋음",
    dark: "어두움",
    blurred: "흐림",
    folded: "접힘/구김",
    partial: "일부만 보임",
  };

  return labels[imageQuality || ""] || "분석 전";
}

function AnalysisQualityCard({ item }: { item: ClosetItem }) {
  const hasProductWarning = hasLowProductConfidence(item);
  const hasConfirmedProduct = Boolean(item.confirmedProduct);
  const hasConfirmedBrand = Boolean(
    item.confirmedProduct?.brand?.trim() || item.confirmedBrand?.trim()
  );
  const warnings = (item.analysisWarnings || []).filter(
    (warning) =>
      (!hasConfirmedProduct || !isProductConfirmationWarning(warning)) &&
      (!hasConfirmedBrand || !isBrandConfirmationWarning(warning))
  );
  const quality = item.analysisQuality;
  const missingHints = quality?.missingHints || [];
  const needsManualSizeGuide =
    hasConfirmedProduct &&
    !isAccessoryOrBagItem(item) &&
    getValidProductSizeRows(item.confirmedProduct?.productSizeGuide).length === 0;
  const shouldShow =
    hasProductWarning ||
    needsManualSizeGuide ||
    warnings.length > 0 ||
    quality?.imageQuality ||
    quality?.needsMorePhotos ||
    missingHints.length > 0;

  if (!shouldShow) return null;

  return (
    <View style={styles.analysisQualityCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="alert-triangle" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>분석 검증</Text>
          <Text style={styles.aiDetailSubtitle}>확실하지 않은 값은 보수적으로 저장했어요.</Text>
        </View>
      </View>

      {quality?.imageQuality ? (
        <Text style={styles.analysisQualityText}>
          사진 상태: {getImageQualityLabel(quality.imageQuality)}
        </Text>
      ) : null}

      {hasProductWarning ? (
        <Text style={styles.analysisQualityText}>
          실제 상품 식별이 확실하지 않아요.{"\n"}
          상품 링크로 확정하면 더 정확한 추천을 받을 수 있어요.
        </Text>
      ) : null}

      {needsManualSizeGuide ? (
        <Text style={styles.analysisQualityText}>
          상품 실측은 자동으로 찾지 못했어요. 직접 입력하면 핏 분석이 더 정확해져요.
        </Text>
      ) : null}

      {warnings.length > 0 && (
        <Text style={styles.analysisQualityText}>
          확인 필요: {warnings.join(", ")}
        </Text>
      )}

      {quality?.needsMorePhotos || missingHints.length > 0 ? (
        <Text style={styles.analysisQualityText}>
          추가 사진 힌트: {missingHints.length > 0 ? missingHints.join(", ") : "라벨, 뒷면, 전체 실루엣"}
        </Text>
      ) : null}
    </View>
  );
}

function AnalysisActionNoticeCard({ item }: { item: ClosetItem }) {
  const hasProductWarning = hasLowProductConfidence(item);
  const hasConfirmedProduct = Boolean(item.confirmedProduct);
  const quality = item.analysisQuality;
  const missingHints = quality?.missingHints || [];
  const needsMaterialCheck =
    hasConfirmedProduct && !item.confirmedProduct?.materialComposition?.summary?.trim();
  const hasImageActionWarning =
    Boolean(quality?.needsMorePhotos) ||
    quality?.imageQuality === "dark" ||
    quality?.imageQuality === "blurred" ||
    quality?.imageQuality === "partial";

  const notices = [
    hasProductWarning
      ? "실제 상품 식별이 확실하지 않아요. 상품 링크로 확정하면 더 정확한 추천을 받을 수 있어요."
      : "",
    needsMaterialCheck
      ? "공식 소재를 자동으로 찾지 못했어요. 현재는 사진/입력 소재만 참고해요."
      : "",
    hasImageActionWarning
      ? `사진 상태가 ${getImageQualityLabel(quality?.imageQuality)}이라 분석이 제한될 수 있어요. ${
          missingHints.length > 0
            ? `${missingHints.join(", ")} 사진을 추가하면 더 정확해져요.`
            : "전체 실루엣이나 라벨 사진이 있으면 더 정확해져요."
        }`
      : "",
  ].filter(Boolean);

  if (notices.length === 0) return null;

  return (
    <View style={styles.analysisActionNoticeCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="alert-circle" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>확인하면 더 좋아요</Text>
          <Text style={styles.aiDetailSubtitle}>추천 정확도를 높이는 데 필요한 항목만 보여드려요.</Text>
        </View>
      </View>

      {notices.map((notice, index) => (
        <Text key={`analysis-action-${index}`} style={styles.analysisQualityText}>
          {notice}
        </Text>
      ))}
    </View>
  );
}

function AiAnalysisAccordion({
  item,
  isOpen,
  onToggle,
}: {
  item: ClosetItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasContent = Boolean(
    item.analysisQuality ||
      item.analysisWarnings?.length ||
      item.garmentProfile ||
      item.styleProfile ||
      getAiAnalysisRows(item).length
  );

  if (!hasContent) return null;

  return (
    <View style={styles.aiAnalysisAccordionCard}>
      <Pressable style={styles.aiAnalysisToggle} onPress={onToggle}>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>AI 분석 정보</Text>
          <Text style={styles.aiDetailSubtitle}>
            추천 엔진이 참고하는 내부 분석값이에요. 필요할 때만 펼쳐서 확인하세요.
          </Text>
        </View>
        <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#8c6f47" />
      </Pressable>

      {isOpen ? (
        <View style={styles.aiAnalysisContent}>
          <AiDetailCard item={item} />
          <AnalysisQualityCard item={item} />
          <GarmentProfileCard item={item} />
          <StyleProfileCard item={item} />
        </View>
      ) : null}
    </View>
  );
}

function joinStyleProfileValues(values?: string[]) {
  return values?.filter(Boolean).join(", ") || "";
}

function getTemperatureRangeText(temperatureRange?: StyleProfile["temperatureRange"]) {
  if (!temperatureRange) return "";

  const min = typeof temperatureRange.min === "number" ? `${temperatureRange.min}도` : "";
  const max = typeof temperatureRange.max === "number" ? `${temperatureRange.max}도` : "";

  if (min && max) return `${min} ~ ${max}`;
  if (min) return `${min} 이상`;
  if (max) return `${max} 이하`;

  return "";
}

function getStyleProfileRows(styleProfile?: StyleProfile) {
  if (!styleProfile) return [];

  return [
    { label: "실루엣", value: styleProfile.silhouette },
    { label: "무드", value: joinStyleProfileValues(styleProfile.mood) },
    { label: "사용 상황", value: joinStyleProfileValues(styleProfile.usage) },
    { label: "포멀 정도", value: styleProfile.formality },
    { label: "넥라인", value: styleProfile.neckline },
    { label: "소매 길이", value: styleProfile.sleeveLength },
    { label: "기장", value: styleProfile.lengthType },
    { label: "어울리는 색", value: joinStyleProfileValues(styleProfile.matchColors) },
    { label: "피할 색", value: joinStyleProfileValues(styleProfile.avoidColors) },
    { label: "추천 조합", value: joinStyleProfileValues(styleProfile.recommendedPairings) },
    { label: "피할 조합", value: joinStyleProfileValues(styleProfile.avoidPairings) },
    { label: "추천 기온", value: getTemperatureRangeText(styleProfile.temperatureRange) },
  ].filter((row) => row.value);
}

function StyleProfileCard({ item }: { item: ClosetItem }) {
  const rows = getStyleProfileRows(item.styleProfile);

  if (rows.length === 0) return null;

  return (
    <View style={styles.styleProfileCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="sliders" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>스타일 프로필</Text>
          <Text style={styles.aiDetailSubtitle}>코디 추천과 쇼핑 검색에 활용할 옷의 스타일 기준이에요.</Text>
        </View>
      </View>

      <View style={styles.styleProfileGrid}>
        {rows.map((row) => (
          <View key={row.label} style={styles.styleProfilePill}>
            <Text style={styles.styleProfileLabel}>{row.label}</Text>
            <Text style={styles.styleProfileValue} numberOfLines={3}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const SILHOUETTE_LABELS: Record<NonNullable<GarmentProfile["silhouette"]>, string> = {
  slim: "슬림",
  regular: "레귤러",
  semiOversized: "세미오버",
  oversized: "오버사이즈",
  wide: "와이드",
  cropped: "크롭",
  long: "롱",
};

const LENGTH_BALANCE_LABELS: Record<NonNullable<GarmentProfile["lengthBalance"]>, string> = {
  short: "짧음",
  regular: "기본",
  long: "김",
};

const STRUCTURE_LABELS: Record<NonNullable<GarmentProfile["structure"]>, string> = {
  soft: "부드러움",
  normal: "보통",
  stiff: "각이 잡힘",
};

const DRAPE_LABELS: Record<NonNullable<GarmentProfile["drape"]>, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

function GarmentProfileCard({ item }: { item: ClosetItem }) {
  const profile = item.garmentProfile;
  if (!profile) return null;

  const rows = [
    {
      label: "실루엣",
      value: profile.silhouette ? SILHOUETTE_LABELS[profile.silhouette] : "",
    },
    {
      label: "볼륨감",
      value: typeof profile.volume === "number" ? `${profile.volume} / 10` : "",
    },
    {
      label: "기장감",
      value: profile.lengthBalance ? LENGTH_BALANCE_LABELS[profile.lengthBalance] : "",
    },
    {
      label: "포인트 강도",
      value: typeof profile.pointLevel === "number" ? `${profile.pointLevel} / 10` : "",
    },
    {
      label: "시각적 무게감",
      value: typeof profile.visualWeight === "number" ? `${profile.visualWeight} / 10` : "",
    },
    {
      label: "소재 구조감",
      value: profile.structure ? STRUCTURE_LABELS[profile.structure] : "",
    },
    {
      label: "드레이프감",
      value: profile.drape ? DRAPE_LABELS[profile.drape] : "",
    },
  ].filter((row) => row.value);

  if (rows.length === 0) return null;

  return (
    <View style={styles.styleProfileCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="maximize-2" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>의류 인상 프로필</Text>
          <Text style={styles.aiDetailSubtitle}>
            사진에서 보이는 옷의 실루엣, 부피감, 소재 느낌을 추정한 값이에요.{"\n"}
            실제 핏은 상품 실측과 내 신체 치수를 기준으로 따로 판단해야 해요.
          </Text>
        </View>
      </View>

      <View style={styles.styleProfileGrid}>
        {rows.map((row) => (
          <View key={row.label} style={styles.styleProfilePill}>
            <Text style={styles.styleProfileLabel}>{row.label}</Text>
            <Text style={styles.styleProfileValue}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function getProductSearchQuery(item: ClosetItem) {
  const confirmedProduct = item.confirmedProduct;
  const candidate = item.selectedProductCandidate;

  if (confirmedProduct) return `${confirmedProduct.brand} ${confirmedProduct.productName}`.trim();
  if (candidate) return `${candidate.brand} ${candidate.productName}`.trim();
  if (item.confirmedBrand) {
    return `${item.confirmedBrand} ${item.detailCategory || item.subCategory || item.category}`.trim();
  }

  return "";
}

function getBaseItemLabel(item: ClosetItem) {
  const confirmedProduct = item.confirmedProduct;
  const candidate = item.selectedProductCandidate;

  if (confirmedProduct) return `${confirmedProduct.brand} ${confirmedProduct.productName}`.trim();
  if (candidate) return `${candidate.brand} ${candidate.productName}`.trim();
  if (item.confirmedBrand) {
    return `${item.confirmedBrand} ${item.detailCategory || item.subCategory || item.category}`.trim();
  }

  return [
    item.detailCategory || item.subCategory || item.category,
    item.color,
    ...getItemStyleTags(item),
  ]
    .filter(Boolean)
    .join(" ");
}

function getMatchingItemQueries(item: ClosetItem) {
  const profilePairings = item.styleProfile?.recommendedPairings?.filter(Boolean);

  if (profilePairings?.length) return profilePairings;

  if (item.category === "상의") {
    return ["와이드 데님팬츠", "아이보리 스니커즈", "블랙 크로스백"];
  }

  if (item.category === "하의") {
    return ["오버핏 반팔 티셔츠", "미니멀 셔츠", "화이트 스니커즈"];
  }

  if (item.category === "신발") {
    return ["와이드 데님팬츠", "그래픽 반팔 티셔츠", "크루삭스"];
  }

  if (item.category === "아우터") {
    return ["무지 반팔 티셔츠", "데님팬츠", "스니커즈"];
  }

  return ["미니멀 셔츠", "와이드 데님팬츠", "아이보리 스니커즈"];
}

function MatchingItemSearchCard({ item }: { item: ClosetItem }) {
  const baseItemLabel = getBaseItemLabel(item);
  const matchingQueries = getMatchingItemQueries(item);

  return (
    <View style={styles.matchingSearchCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="shopping-bag" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>이 옷에 어울리는 아이템</Text>
          <Text style={styles.aiDetailSubtitle}>
            선택한 참고 상품과 어울릴 만한 아이템을 쇼핑몰에서 찾아볼 수 있어요.
          </Text>
        </View>
      </View>

      {baseItemLabel ? (
        <Text style={styles.matchingSearchBaseText} numberOfLines={2}>
          기준: {baseItemLabel}
        </Text>
      ) : null}

      <View style={styles.matchingQueryList}>
        {matchingQueries.map((query) => (
          <View key={query} style={styles.matchingQueryCard}>
            <Text style={styles.matchingQueryText}>{query}</Text>
            <View style={styles.matchingButtonRow}>
              <Pressable
                style={styles.matchingSearchButton}
                onPress={() => openProductSearch("musinsa", query)}
              >
                <Text style={styles.matchingSearchButtonText}>무신사</Text>
              </Pressable>
              <Pressable
                style={styles.matchingSearchButton}
                onPress={() => openProductSearch("naver", query)}
              >
                <Text style={styles.matchingSearchButtonText}>네이버</Text>
              </Pressable>
              <Pressable
                style={styles.matchingSearchButton}
                onPress={() => openProductSearch("google", query)}
              >
                <Text style={styles.matchingSearchButtonText}>구글</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecommendationPreferenceCard({
  value,
  isSaving,
  onSelect,
}: {
  value: RecommendationPreference;
  isSaving: boolean;
  onSelect: (value: RecommendationPreference) => void;
}) {
  return (
    <View style={styles.recommendationPreferenceCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="sliders" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>추천 조절</Text>
          <Text style={styles.aiDetailSubtitle}>
            이 설정은 코디 추천에서 이 옷이 나오는 빈도를 조절해요.
          </Text>
        </View>
      </View>

      <View style={styles.recommendationPreferenceOptions}>
        {RECOMMENDATION_PREFERENCE_OPTIONS.map((option) => {
          const isActive = value === option.value;

          return (
            <Pressable
              key={option.value}
              style={[
                styles.recommendationPreferenceButton,
                isActive && styles.recommendationPreferenceButtonActive,
              ]}
              onPress={() => onSelect(option.value)}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.recommendationPreferenceButtonText,
                  isActive && styles.recommendationPreferenceButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ConfirmedProductCard({
  item,
  profile,
  confirmedProduct,
  onOpenUrl,
  onEdit,
  onOpenUrlForm,
  onOpenMeasurementForm,
  onDeleteMeasurement,
}: {
  item: ClosetItem;
  profile?: UserProfile | null;
  confirmedProduct: ConfirmedProduct;
  onOpenUrl: () => void;
  onEdit: () => void;
  onOpenUrlForm: () => void;
  onOpenMeasurementForm: () => void;
  onDeleteMeasurement: (measurement: ProductSizeMeasurement) => void;
}) {
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const productImageTimerRef = useRef<PerformanceTimer>(null);
  const isAccessoryOrBag = isAccessoryOrBagItem(item);
  const meta = [confirmedProduct.mallName, confirmedProduct.price].filter(Boolean).join(" / ");
  const materialSummary = getMaterialCompositionSummary(confirmedProduct.materialComposition);
  const sizeGuideSummary = useMemo(
    () =>
      isAccessoryOrBag
        ? ""
        : getProductSizeGuideSummary(confirmedProduct.productSizeGuide),
    [confirmedProduct.productSizeGuide, isAccessoryOrBag]
  );
  const sizeGuideRows = useMemo(
    () =>
      isAccessoryOrBag
        ? []
        : getValidProductSizeRows(confirmedProduct.productSizeGuide),
    [confirmedProduct.productSizeGuide, isAccessoryOrBag]
  );
  const profileSize = getProfileSizeForItem(item, profile);

  return (
    <View style={styles.productReferenceCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="check-circle" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>확정 상품</Text>
          <Text style={styles.aiDetailSubtitle}>사용자가 직접 확인해서 저장한 실제 상품 정보예요.</Text>
        </View>
      </View>

      <View style={styles.confirmedProductInfoRow}>
        {confirmedProduct.productImageUrl ? (
          <ExpoImage
            source={confirmedProduct.productImageUrl}
            style={styles.confirmedProductImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoadStart={() => {
              endPerformanceTimer(productImageTimerRef.current, { restarted: true });
              productImageTimerRef.current = startPerformanceTimer(
                "clothes-detail.confirmed-product-image-load"
              );
            }}
            onLoad={() => {
              endPerformanceTimer(productImageTimerRef.current);
              productImageTimerRef.current = null;
            }}
            onError={() => {
              endPerformanceTimer(productImageTimerRef.current, { failed: true });
              productImageTimerRef.current = null;
            }}
          />
        ) : null}

        <View style={styles.confirmedProductInfoText}>
          <Text style={styles.productReferenceBrand} numberOfLines={2} ellipsizeMode="tail">
            {confirmedProduct.brand}
          </Text>
          <Text style={styles.productReferenceName} numberOfLines={2} ellipsizeMode="tail">
            {confirmedProduct.productName}
          </Text>
          {meta ? <Text style={styles.productReferenceReason} numberOfLines={2}>{meta}</Text> : null}
          {materialSummary ? (
            <Text style={styles.productReferenceReason} numberOfLines={3}>
              공식 소재: {materialSummary}
            </Text>
          ) : null}
          {sizeGuideSummary ? (
            <View style={styles.confirmedProductSizeGuideBox}>
              <View style={styles.confirmedProductSizeGuideHeader}>
                <View style={styles.confirmedProductSizeGuideTextWrap}>
                  <Text style={styles.confirmedProductSizeGuideTitle}>사이즈 정보 있음</Text>
                  <Text style={styles.confirmedProductSizeGuideText}>{sizeGuideSummary}</Text>
                </View>
                <Pressable
                  style={styles.sizeGuideToggleButton}
                  onPress={() => setIsSizeGuideOpen((current) => !current)}
                >
                  <Text style={styles.sizeGuideToggleText}>{isSizeGuideOpen ? "접기" : "실측 보기"}</Text>
                  <Feather
                    name={isSizeGuideOpen ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#8c6f47"
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {sizeGuideRows.length > 0 && isSizeGuideOpen ? (
        <View style={styles.sizeGuideDetailBox}>
          {profileSize ? (
            <Text style={styles.sizeGuideProfileHint}>내 프로필 사이즈: {profileSize}</Text>
          ) : null}

          {sizeGuideRows.map((sizeInfo) => {
            const isProfileSize =
              Boolean(profileSize) &&
              doesProductSizeRowMatch(sizeInfo, profileSize);
            const measurementRows = getMeasurementRows(sizeInfo);
            const displaySize = getProductSizeDisplayName(sizeInfo);

            return (
              <View
                key={`${sizeInfo.size}-${displaySize}`}
                style={[styles.sizeGuideRowCard, isProfileSize && styles.sizeGuideRowCardActive]}
              >
                <View style={styles.sizeGuideRowHeader}>
                  <Text style={styles.sizeGuideSizeText}>{displaySize}</Text>
                  <View style={styles.sizeGuideRowActions}>
                    {isProfileSize ? <Text style={styles.sizeGuideMySizeBadge}>내 사이즈</Text> : null}
                    <Pressable
                      style={styles.sizeGuideDeleteButton}
                      onPress={() => onDeleteMeasurement(sizeInfo)}
                      accessibilityRole="button"
                      accessibilityLabel={`${displaySize} 실측 삭제`}
                    >
                      <Feather name="trash-2" size={13} color="#b45309" />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.sizeGuideMeasurementGrid}>
                  {measurementRows.map((measurement) => (
                    <View key={`${displaySize}-${measurement.label}`} style={styles.sizeGuideMeasurementPill}>
                      <Text style={styles.sizeGuideMeasurementLabel}>{measurement.label}</Text>
                      <Text style={styles.sizeGuideMeasurementValue}>{measurement.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {isAccessoryOrBag ? (
        <View style={styles.confirmedProductSizeGuideBox}>
          <Text style={styles.productReferenceReason}>
            액세서리/가방은 의류 핏 분석 대상이 아니에요. 크기 정보는 추후 별도 지원 예정이에요.
          </Text>
        </View>
      ) : null}

      <View style={styles.confirmedProductActionRow}>
        {confirmedProduct.productUrl ? (
          <Pressable style={styles.confirmedProductPrimaryButton} onPress={onOpenUrl}>
            <Feather name="external-link" size={14} color="#fff" />
            <Text style={styles.confirmedProductPrimaryButtonText}>상품 링크 열기</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.confirmedProductSecondaryButton} onPress={onOpenUrlForm}>
          <Feather name="link" size={14} color="#8c6f47" />
          <Text style={styles.confirmedProductSecondaryButtonText}>상품 URL로 변경</Text>
        </Pressable>
        <Pressable style={styles.confirmedProductSecondaryButton} onPress={onEdit}>
          <Feather name="edit-2" size={14} color="#8c6f47" />
          <Text style={styles.confirmedProductSecondaryButtonText}>확정 정보 수정</Text>
        </Pressable>
        {!isAccessoryOrBag ? (
          <Pressable style={styles.confirmedProductSecondaryButton} onPress={onOpenMeasurementForm}>
            <Feather name="maximize" size={14} color="#8c6f47" />
            <Text style={styles.confirmedProductSecondaryButtonText}>
              {sizeGuideRows.length > 0 ? "실측 수정" : "실측 직접 입력"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ProductMeasurementForm({
  item,
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  item: ClosetItem;
  draft: ProductMeasurementDraft;
  onChange: (field: keyof ProductMeasurementDraft, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isAccessoryOrBag = isAccessoryOrBagItem(item);
  const fields = getMeasurementFields(item);

  if (isAccessoryOrBag) {
    return (
      <View style={styles.confirmedProductFormCard}>
        <Text style={styles.tipTitle}>상품 크기 정보</Text>
        <Text style={styles.aiDetailSubtitle}>
          액세서리/가방은 의류 핏 분석 대상이 아니에요. 크기 정보는 추후 별도 지원 예정이에요.
        </Text>
        <View style={styles.confirmedProductActionRow}>
          <Pressable style={styles.confirmedProductSecondaryButton} onPress={onCancel}>
            <Text style={styles.confirmedProductSecondaryButtonText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.confirmedProductFormCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="maximize" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>상품 실측 직접 입력</Text>
          <Text style={styles.aiDetailSubtitle}>
            상품 페이지의 실측표를 cm 단위로 입력해주세요. 같은 사이즈는 기존 값이 수정돼요.
          </Text>
        </View>
      </View>

      <EditRow
        label="사이즈명"
        value={draft.size}
        onChangeText={(value) => onChange("size", value)}
      />

      <View style={styles.manualMeasurementGrid}>
        {fields.map((field) => (
          <View key={field.key} style={styles.manualMeasurementField}>
            <Text style={styles.detailLabel}>{field.label}</Text>
            <View style={styles.manualMeasurementInputWrap}>
              <TextInput
                value={draft[field.key]}
                onChangeText={(value) => onChange(field.key, value)}
                placeholder="0"
                keyboardType="decimal-pad"
                style={styles.manualMeasurementInput}
              />
              <Text style={styles.manualMeasurementUnit}>cm</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.confirmedProductActionRow}>
        <Pressable style={styles.confirmedProductSecondaryButton} onPress={onCancel}>
          <Text style={styles.confirmedProductSecondaryButtonText}>취소</Text>
        </Pressable>
        <Pressable style={styles.confirmedProductPrimaryButton} onPress={onSave}>
          <Feather name="save" size={14} color="#fff" />
          <Text style={styles.confirmedProductPrimaryButtonText}>실측 저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConfirmedProductForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: ConfirmedProductDraft;
  onChange: (field: ConfirmedProductDraftTextField, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.confirmedProductFormCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="edit-3" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>직접 입력해서 확정</Text>
          <Text style={styles.aiDetailSubtitle}>실제 쇼핑몰에서 확인한 상품 정보를 저장해요.</Text>
        </View>
      </View>

      <EditRow label="브랜드명" value={draft.brand} onChangeText={(value) => onChange("brand", value)} />
      <EditRow label="상품명" value={draft.productName} onChangeText={(value) => onChange("productName", value)} />
      <EditRow label="상품 링크" value={draft.productUrl} onChangeText={(value) => onChange("productUrl", value)} />

      <View style={styles.confirmedProductActionRow}>
        <Pressable style={styles.confirmedProductSecondaryButton} onPress={onCancel}>
          <Text style={styles.confirmedProductSecondaryButtonText}>취소</Text>
        </Pressable>
        <Pressable style={styles.confirmedProductPrimaryButton} onPress={onSave}>
          <Text style={styles.confirmedProductPrimaryButtonText}>확정 저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProductUrlConfirmCard({
  productUrl,
  isLoading,
  errorMessage,
  preview,
  onChangeUrl,
  onExtract,
  onConfirm,
  onOpenManualForm,
  onCancel,
}: {
  productUrl: string;
  isLoading: boolean;
  errorMessage: string;
  preview: ExtractedProduct | null;
  onChangeUrl: (value: string) => void;
  onExtract: () => void;
  onConfirm: () => void;
  onOpenManualForm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.confirmedProductFormCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="link" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>상품 URL로 확정</Text>
          <Text style={styles.aiDetailSubtitle}>상품 페이지 링크를 붙여넣으면 정보를 자동으로 가져와요.</Text>
        </View>
      </View>

      <EditRow label="상품 URL" value={productUrl} onChangeText={onChangeUrl} />

      <View style={styles.confirmedProductActionRow}>
        <Pressable style={styles.confirmedProductPrimaryButton} onPress={onExtract} disabled={isLoading}>
          <Feather name="download" size={14} color="#fff" />
          <Text style={styles.confirmedProductPrimaryButtonText}>
            {isLoading ? "가져오는 중..." : "상품 정보 가져오기"}
          </Text>
        </Pressable>
        <Pressable style={styles.confirmedProductSecondaryButton} onPress={onCancel}>
          <Text style={styles.confirmedProductSecondaryButtonText}>취소</Text>
        </Pressable>
      </View>

      {errorMessage ? (
        <View style={styles.productExtractNotice}>
          <Text style={styles.productExtractNoticeText}>{errorMessage}</Text>
          <Pressable style={styles.confirmedProductSecondaryButton} onPress={onOpenManualForm}>
            <Feather name="edit-3" size={14} color="#8c6f47" />
            <Text style={styles.confirmedProductSecondaryButtonText}>직접 입력하기</Text>
          </Pressable>
        </View>
      ) : null}

      {preview ? (
        <View style={styles.productExtractPreview}>
          <Text style={styles.productExtractPreviewTitle}>추출 결과 미리보기</Text>
          <Text style={styles.productReferenceBrand}>{preview.brand || "브랜드명 없음"}</Text>
          <Text style={styles.productReferenceName}>{preview.productName || "상품명 없음"}</Text>
          <Text style={styles.productReferenceReason} numberOfLines={2}>
            {preview.productUrl}
          </Text>
          {getValidProductSizeRows(preview.productSizeGuide).length === 0 ? (
            <Text style={styles.productExtractNoticeText}>
              {getProductSizeGuideStatusMessage(preview.sizeGuideStatus)}
            </Text>
          ) : null}
          <Pressable style={styles.confirmedProductPrimaryButton} onPress={onConfirm}>
            <Feather name="check" size={14} color="#fff" />
            <Text style={styles.confirmedProductPrimaryButtonText}>이 상품으로 확정</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ProductConfirmActionCard({
  hasCandidate,
  onConfirmCandidate,
  onOpenManualForm,
  onOpenUrlForm,
}: {
  hasCandidate: boolean;
  onConfirmCandidate: () => void;
  onOpenManualForm: () => void;
  onOpenUrlForm: () => void;
}) {
  return (
    <View style={styles.productConfirmArea}>
      <Pressable style={styles.confirmedProductPrimaryButton} onPress={onOpenUrlForm}>
        <Feather name="link" size={14} color="#fff" />
        <Text style={styles.confirmedProductPrimaryButtonText}>상품 URL로 확정</Text>
      </Pressable>
      {hasCandidate ? (
        <Pressable style={styles.confirmedProductSecondaryButton} onPress={onConfirmCandidate}>
          <Feather name="check" size={14} color="#8c6f47" />
          <Text style={styles.confirmedProductSecondaryButtonText}>참고 후보로 바로 확정</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.confirmedProductSecondaryButton} onPress={onOpenManualForm}>
        <Feather name="edit-3" size={14} color="#8c6f47" />
        <Text style={styles.confirmedProductSecondaryButtonText}>직접 입력해서 확정</Text>
      </Pressable>
    </View>
  );
}

function ProductReferenceCard({ item }: { item: ClosetItem }) {
  const candidate = item.selectedProductCandidate;
  const searchQuery = getProductSearchQuery(item);

  if (!candidate && !item.confirmedBrand) return null;

  return (
    <View style={styles.productReferenceCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="bookmark" size={16} color="#8c6f47" />
        </View>
        <View style={styles.tipHeaderText}>
          <Text style={styles.tipTitle}>참고 상품</Text>
          <Text style={styles.aiDetailSubtitle}>실제 상품 확정이 아닌 검색 바로가기예요.</Text>
        </View>
      </View>

      <Text style={styles.productReferenceBrand}>
        {candidate?.brand || item.confirmedBrand}
      </Text>
      <Text style={styles.productReferenceName}>
        {candidate?.productName || item.detailCategory || item.subCategory || item.category}
      </Text>
      <Text style={styles.productReferenceReason}>
        {candidate?.reason || "확정 브랜드와 옷 종류를 기준으로 검색해볼 수 있어요."}
      </Text>
      <View style={styles.productSearchArea}>
        <Text style={styles.productSearchTitle}>상품 찾아보기</Text>
        <View style={styles.productSearchButtonRow}>
          <Pressable
            style={styles.productSearchButton}
            onPress={() => openProductSearch("naver", searchQuery)}
          >
            <Text style={styles.productSearchButtonText}>네이버에서 찾기</Text>
          </Pressable>
          <Pressable
            style={styles.productSearchButton}
            onPress={() => openProductSearch("musinsa", searchQuery)}
          >
            <Text style={styles.productSearchButtonText}>무신사에서 찾기</Text>
          </Pressable>
          <Pressable
            style={styles.productSearchButton}
            onPress={() => openProductSearch("google", searchQuery)}
          >
            <Text style={styles.productSearchButtonText}>구글에서 찾기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function EditRow({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="입력해주세요"
        placeholderTextColor="#b2aaa1"
      />
    </View>
  );
}

function TipCard({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text?: string;
}) {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name={icon} size={16} color="#8c6f47" />
        </View>
        <Text style={styles.tipTitle}>{title}</Text>
      </View>
      <Text style={styles.tipText}>{text || "분석 전"}</Text>
    </View>
  );
}

function TipEditCard({
  icon,
  title,
  value,
  onChangeText,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name={icon} size={16} color="#8c6f47" />
        </View>
        <Text style={styles.tipTitle}>{title}</Text>
      </View>
      <TextInput
        style={styles.tipInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="입력해주세요"
        placeholderTextColor="#b2aaa1"
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

function getAlternativeSizeSummary(
  recommendation: SizeRecommendationResult["sizeRecommendations"][number]
) {
  if (recommendation.widthResult === "small") return "품이 타이트할 가능성이 있어요.";
  if (recommendation.lengthResult === "short") return "길이가 짧게 느껴질 수 있어요.";
  if (recommendation.lengthResult === "tooLong") return "길이가 많이 쌓일 수 있어요.";
  if (recommendation.widthResult === "oversized") return "품이 크게 느껴질 수 있어요.";
  return "내 실측 기준으로 무난하게 입기 좋은 후보예요.";
}

function RecommendedSizeCard({
  item,
  result,
  onOpenMeasurementForm,
}: {
  item: ClosetItem;
  result: SizeRecommendationResult;
  onOpenMeasurementForm: () => void;
}) {
  const displayedRecommendations = result.sizeRecommendations.slice(0, 3);
  const recommended = displayedRecommendations[0];

  if (result.blockedReason === "missing_product_measurements") {
    return (
      <View style={styles.sizeMatchCard}>
        <View style={styles.tipHeader}>
          <View style={styles.tipIconCircle}>
            <Feather name="sliders" size={16} color="#8c6f47" />
          </View>
          <Text style={styles.tipTitle}>상품 실측이 필요해요</Text>
        </View>
        <Text style={styles.tipText}>
          {result.missingProductFields?.join(", ") || "주요 실측"} 값이 부족해 추천
          사이즈를 추측하지 않았어요.
        </Text>
        <Pressable style={styles.sizeRecommendationActionButton} onPress={onOpenMeasurementForm}>
          <Text style={styles.sizeRecommendationActionButtonText}>실측 직접 입력</Text>
          <Feather name="chevron-right" size={15} color="#fff" />
        </Pressable>
      </View>
    );
  }

  if (result.missingFields.length > 0) {
    return (
      <View style={styles.sizeMatchCard}>
        <View style={styles.tipHeader}>
          <View style={styles.tipIconCircle}>
            <Feather name="user-check" size={16} color="#8c6f47" />
          </View>
          <Text style={styles.tipTitle}>내 체형 기준 추천 사이즈</Text>
        </View>
        <Text style={styles.tipText}>
          내 프로필에 {result.missingFields.join(", ")} 정보를 입력하면 상품 실측과
          비교할 수 있어요.
        </Text>
        <Pressable
          style={styles.sizeRecommendationActionButton}
          onPress={() => router.push("/profile")}
        >
          <Text style={styles.sizeRecommendationActionButtonText}>프로필 입력하기</Text>
          <Feather name="chevron-right" size={15} color="#fff" />
        </Pressable>
      </View>
    );
  }

  if (!recommended) return null;

  const recommendedRow = getValidProductSizeRows(
    item.confirmedProduct?.productSizeGuide
  ).find(
    (row) =>
      normalizeProductSizeForCompare(row.size) ===
      normalizeProductSizeForCompare(result.recommendedSize)
  );
  const currentSizeMatches = recommendedRow
    ? doesProductSizeRowMatch(recommendedRow, item.size)
    : normalizeProductSizeForCompare(item.size) ===
      normalizeProductSizeForCompare(result.recommendedSize);
  const alternatives = displayedRecommendations.slice(1);
  const isFreeRecommendation =
    normalizeProductSizeForCompare(result.recommendedSize) === "FREE";

  return (
    <View style={styles.sizeMatchCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="user-check" size={16} color="#8c6f47" />
        </View>
        <Text style={styles.tipTitle}>내 체형 기준 추천 사이즈</Text>
      </View>

      <View style={styles.recommendedSizeHeader}>
        <Text style={styles.recommendedSizeLabel}>추천</Text>
        <Text style={styles.recommendedSizeValue}>
          {result.recommendedDisplaySize || result.recommendedSize}
        </Text>
      </View>

      {recommended.reasons.slice(0, 2).map((reason, index) => (
        <Text key={`${recommended.size}-reason-${index}`} style={styles.recommendedSizeReason}>
          {reason}
        </Text>
      ))}

      {isFreeRecommendation ? (
        <Text style={styles.freeSizeAnalysisText}>
          FREE 상품이므로 실측 기준으로 분석했습니다.
        </Text>
      ) : null}

      {!currentSizeMatches && item.size ? (
        <View style={styles.recommendedSizeNotice}>
          <Text style={styles.recommendedSizeNoticeText}>
            현재 선택한 사이즈는 {item.size}이지만 추천은 {result.recommendedDisplaySize || result.recommendedSize}이에요.
          </Text>
        </View>
      ) : null}

      {alternatives.length > 0 ? (
        <View style={styles.alternativeSizeList}>
          {alternatives.map((alternative) => (
            <Text key={`${alternative.size}-${alternative.rank}`} style={styles.alternativeSizeText}>
              {alternative.displaySize || alternative.size}은 {getAlternativeSizeSummary(alternative)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FitSuitabilityCard({
  item,
  result,
  onEditItem,
  onOpenMeasurementForm,
  onOpenProductUrlForm,
}: {
  item: ClosetItem;
  result: FitSuitabilityResult;
  onEditItem: () => void;
  onOpenMeasurementForm: () => void;
  onOpenProductUrlForm: () => void;
}) {
  const action = (() => {
    if (result.blockedReason === "missing_item_size") {
      return { label: "상품 사이즈 선택", onPress: onEditItem };
    }

    if (result.blockedReason === "missing_profile_measurements") {
      return { label: "프로필 입력하기", onPress: () => router.push("/profile") };
    }

    if (
      result.blockedReason === "missing_product_measurements" ||
      result.blockedReason === "unmatched_item_size"
    ) {
      return item.confirmedProduct
        ? { label: "실측 직접 입력", onPress: onOpenMeasurementForm }
        : { label: "상품 링크 등록", onPress: onOpenProductUrlForm };
    }

    return null;
  })();

  return (
    <View style={styles.sizeMatchCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="check-square" size={16} color="#8c6f47" />
        </View>
        <Text style={styles.tipTitle}>내 사이즈 적합도</Text>
      </View>
      <Text style={styles.sizeMatchStatus}>{result.status}</Text>
      <Text style={styles.tipText}>{result.description}</Text>
      {action ? (
        <Pressable style={styles.sizeRecommendationActionButton} onPress={action.onPress}>
          <Text style={styles.sizeRecommendationActionButtonText}>{action.label}</Text>
          <Feather name="chevron-right" size={15} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function ClothesDetailScreen() {
  const { id, openMeasurement, openEdit } = useLocalSearchParams<{
    id?: string;
    openMeasurement?: string;
    openEdit?: string;
  }>();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [referenceItem, setReferenceItem] = useState<ClosetItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isDraftSeasonConfirmed, setIsDraftSeasonConfirmed] = useState(false);
  const [draft, setDraft] = useState<EditableClosetFields>(EMPTY_DRAFT);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [confirmedProductDraft, setConfirmedProductDraft] =
    useState<ConfirmedProductDraft>(EMPTY_CONFIRMED_PRODUCT_DRAFT);
  const [isProductUrlFormOpen, setIsProductUrlFormOpen] = useState(false);
  const [productUrlInput, setProductUrlInput] = useState("");
  const [isExtractingProduct, setIsExtractingProduct] = useState(false);
  const [extractErrorMessage, setExtractErrorMessage] = useState("");
  const [extractedProduct, setExtractedProduct] = useState<ExtractedProduct | null>(null);
  const [isSavingRecommendationPreference, setIsSavingRecommendationPreference] = useState(false);
  const [isSavingReferenceClothing, setIsSavingReferenceClothing] = useState(false);
  const [isMeasurementFormOpen, setIsMeasurementFormOpen] = useState(false);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
  const [measurementDraft, setMeasurementDraft] = useState<ProductMeasurementDraft>(
    EMPTY_PRODUCT_MEASUREMENT_DRAFT
  );
  const heroImageTimerRef = useRef<PerformanceTimer>(null);
  const shouldOpenMeasurementRef = useRef(openMeasurement === "1");
  const shouldOpenEditRef = useRef(Boolean(openEdit));
  const shouldPrioritizeSeasonEdit = openEdit === "season";

  useFocusEffect(
    useCallback(() => {
      async function loadItem() {
        const timer = startPerformanceTimer("screen.clothes-detail.load-item");
        const [closetItems, userProfile] = await Promise.all([
          getClosetItems(),
          getUserProfile(),
        ]);
        const selectedItem = closetItems.find((closetItem) => closetItem.id === id);
        const referenceKey = selectedItem ? getReferenceClothingKey(selectedItem) : null;
        const referenceItemId = referenceKey
          ? userProfile?.referenceClothing?.[referenceKey]
          : undefined;
        const selectedReferenceItem =
          referenceItemId && referenceItemId !== selectedItem?.id
            ? closetItems.find((closetItem) => closetItem.id === referenceItemId)
            : null;

        setProfile(userProfile);
        setItem(selectedItem || null);
        setReferenceItem(selectedReferenceItem || null);
        if (selectedItem) {
          setDraft(getEditableValues(selectedItem));
          setConfirmedProductDraft(getConfirmedProductDraft(selectedItem));
          setIsDraftSeasonConfirmed(false);

          if (shouldOpenEditRef.current) {
            setEditMode(true);
            shouldOpenEditRef.current = false;
          }

          if (
            shouldOpenMeasurementRef.current &&
            selectedItem.confirmedProduct &&
            !isAccessoryOrBagItem(selectedItem)
          ) {
            setMeasurementDraft(getProductMeasurementDraft(selectedItem));
            setIsMeasurementFormOpen(true);
            shouldOpenMeasurementRef.current = false;
          }
        }
        setIsLoaded(true);
        endPerformanceTimer(timer, {
          closetItemCount: closetItems.length,
          itemFound: Boolean(selectedItem),
        });
      }

      loadItem();
    }, [id])
  );

  function updateDraft<K extends keyof EditableClosetFields>(field: K, value: EditableClosetFields[K]) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function updateConfirmedProductDraft(field: ConfirmedProductDraftTextField, value: string) {
    setConfirmedProductDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function updateMeasurementDraft(field: keyof ProductMeasurementDraft, value: string) {
    setMeasurementDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function updateDraftSeasons(season: string) {
    setDraft((currentDraft) => {
      const nextSeasons = toggleSeason(currentDraft.seasons, season);
      setIsDraftSeasonConfirmed(nextSeasons.length > 0);

      return {
        ...currentDraft,
        seasons: nextSeasons,
      };
    });
  }

  function updateDraftStyleTags(tag: string) {
    setDraft((currentDraft) => {
      const styleTags = toggleStyleTag(currentDraft.styleTags, tag);

      return {
        ...currentDraft,
        styleTags,
        style: styleTags[0] || currentDraft.style,
      };
    });
  }

  function handleEdit() {
    if (!item) return;

    setDraft(getEditableValues(item));
    setIsDraftSeasonConfirmed(false);
    setEditMode(true);
  }

  function handleCancel() {
    if (item) {
      setDraft(getEditableValues(item));
    }

    setEditMode(false);
    setIsDraftSeasonConfirmed(false);
  }

  async function handleAddItemPhoto() {
    if (!item || isUpdatingImage) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      setIsUpdatingImage(true);
      const updatedCloset = await updateClosetItem(item.id, {
        imageUri: result.assets[0].uri,
      });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("사진 저장 실패", "선택한 사진을 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
      setDraft(getEditableValues(updatedItem));
    } catch (error) {
      console.error("옷 사진 추가 실패:", error);
      Alert.alert("사진 추가 실패", "사진을 불러오지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsUpdatingImage(false);
    }
  }

  async function handleSave(allowUncertainValues = false) {
    if (!item) return;

    if (!draft.category.trim()) {
      Alert.alert("종류를 선택해주세요", "옷의 종류를 선택해야 수정 내용을 저장할 수 있어요.");
      return;
    }

    if (!draft.color.trim()) {
      Alert.alert("색상을 입력해주세요", "대표 색상을 입력하면 코디 추천에 활용할 수 있어요.");
      return;
    }

    const registration = normalizeClosetRegistrationBasics({
      category: draft.category,
      color: draft.color,
      seasons: draft.seasons,
    });

    if (!allowUncertainValues && registration.reviewFields.length > 0) {
      Alert.alert(
        "수정 정보를 확인해주세요",
        "종류, 색상 또는 계절 정보가 불확실해요. 현재 값으로 저장해도 나중에 다시 수정할 수 있어요.",
        [
          { text: "돌아가기", style: "cancel" },
          { text: "현재 값으로 저장", onPress: () => void handleSave(true) },
        ]
      );
      return;
    }

    const normalizedDraft = {
      ...draft,
      category: registration.category,
      color: registration.color,
      seasons: registration.seasons,
    };

    try {
      const userEditedClassificationFields = getUserEditedClassificationFields(item, normalizedDraft);
      if (
        isDraftSeasonConfirmed &&
        normalizedDraft.seasons.length > 0 &&
        !userEditedClassificationFields.includes("season")
      ) {
        userEditedClassificationFields.push("season");
      }
      const seasonWasEdited = userEditedClassificationFields.includes("season");
      const updatedCloset = await updateClosetItem(item.id, {
        ...normalizedDraft,
        style: normalizedDraft.styleTags[0] || normalizedDraft.style,
        season: normalizedDraft.seasons.join(", "),
        seasonSource: seasonWasEdited ? "user" : item.seasonSource,
        seasonNeedsReview: seasonWasEdited
          ? normalizedDraft.seasons.length === 0
          : item.seasonNeedsReview,
        userEditedClassificationFields,
      });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("수정 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
      setDraft(getEditableValues(updatedItem));
      setEditMode(false);
      setIsDraftSeasonConfirmed(false);
    } catch (error) {
      console.error("옷 정보 수정 실패:", error);
      Alert.alert("수정 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  async function handleRecommendationPreferenceChange(preference: RecommendationPreference) {
    if (!item || isSavingRecommendationPreference) return;

    try {
      setIsSavingRecommendationPreference(true);
      const updatedCloset = await updateClosetItem(item.id, {
        recommendationPreference: preference,
      });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("저장 실패", "추천 설정을 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
    } catch (error) {
      console.error("추천 설정 저장 실패:", error);
      Alert.alert("저장 실패", "추천 설정을 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSavingRecommendationPreference(false);
    }
  }

  async function handleSetReferenceClothing() {
    if (!item || isSavingReferenceClothing) return;

    const referenceKey = getReferenceClothingKey(item);
    if (!referenceKey) return;

    const nextProfile: UserProfile = {
      ...(profile || {}),
      referenceClothing: {
        ...(profile?.referenceClothing || {}),
        [referenceKey]: item.id,
      },
    };

    try {
      setIsSavingReferenceClothing(true);
      await saveUserProfile(nextProfile);
      setProfile(nextProfile);
      setReferenceItem(null);
      Alert.alert(
        "기준 옷 설정 완료",
        `이 옷을 ${getReferenceClothingCategoryLabel(referenceKey)} 기준 옷으로 저장했어요.`
      );
    } catch (error) {
      console.error("기준 옷 저장 실패:", error);
      Alert.alert("저장 실패", "기준 옷을 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSavingReferenceClothing(false);
    }
  }

  async function saveConfirmedProduct(
    confirmedProduct: ConfirmedProduct,
    options: { openMeasurementForm?: boolean } = {}
  ) {
    if (!item) return;

    try {
      const confirmedBrand = confirmedProduct.brand.trim();
      const confirmedMaterial = confirmedProduct.materialComposition?.summary?.trim();
      const currentMaterial = item.material?.trim() || "";
      const previousConfirmedMaterial =
        item.confirmedProduct?.materialComposition?.summary?.trim() || "";
      const shouldSyncMaterial =
        Boolean(confirmedMaterial) &&
        !item.userEditedClassificationFields?.includes("material") &&
        (!currentMaterial ||
          currentMaterial === "판단 어려움" ||
          currentMaterial === previousConfirmedMaterial);
      const replacementConfirmedProduct: ConfirmedProduct = {
        ...confirmedProduct,
        brand: confirmedBrand,
        productSizeGuide: normalizeProductSizeGuideForDisplay(confirmedProduct.productSizeGuide),
      };
      const classification = inferProductAttributesFromConfirmedProduct({
        productName: replacementConfirmedProduct.productName,
        brand: replacementConfirmedProduct.brand,
        materialComposition: replacementConfirmedProduct.materialComposition,
        currentItem: item,
      });
      const officialSeasonInference = item.userEditedClassificationFields?.includes("season")
        ? null
        : getConfirmedProductSeasonInference(replacementConfirmedProduct, item);
      const classificationUpdates: Partial<ClosetItem> = {
        ...(classification.category ? { category: classification.category } : {}),
        ...(classification.subCategory ? { subCategory: classification.subCategory } : {}),
        ...(classification.detailCategory
          ? { detailCategory: classification.detailCategory }
          : {}),
        ...(classification.material ? { material: classification.material } : {}),
        ...(classification.styleTags
          ? {
              styleTags: classification.styleTags,
              style: classification.styleTags[0] || item.style,
            }
          : {}),
        ...(officialSeasonInference
          ? {
              season: officialSeasonInference.seasons.join(", "),
              seasons: officialSeasonInference.seasons,
              seasonSource: officialSeasonInference.source,
              seasonNeedsReview: officialSeasonInference.needsReview,
            }
          : {}),
      };
      const classificationNotice = getProductClassificationNotice(classification, item);
      const updatedCloset = await updateClosetItem(item.id, {
        confirmedProduct: replacementConfirmedProduct,
        confirmedBrand,
        brand: confirmedBrand,
        brandConfidence: 100,
        ...(shouldSyncMaterial ? { material: confirmedMaterial } : {}),
        ...classificationUpdates,
      });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("저장 실패", "확정 상품 정보를 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
      setConfirmedProductDraft(getConfirmedProductDraft(updatedItem));
      setIsProductFormOpen(false);
      setIsProductUrlFormOpen(false);

      if (options.openMeasurementForm && !isAccessoryOrBagItem(updatedItem)) {
        setMeasurementDraft(getProductMeasurementDraft(updatedItem));
        setIsMeasurementFormOpen(true);
        Alert.alert(
          "상품 정보 저장 완료",
          [
            classificationNotice,
            "상품 실측을 자동으로 찾지 못했어요. 직접 입력하면 핏 분석이 더 정확해져요.",
          ]
            .filter(Boolean)
            .join("\n\n")
        );
      } else {
        Alert.alert(
          classificationNotice ? "상품 정보 보정 완료" : "저장 완료",
          classificationNotice || "확정 상품 정보가 저장됐어요."
        );
      }
    } catch (error) {
      console.error("확정 상품 저장 실패:", error);
      Alert.alert("저장 실패", "확정 상품 정보를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  function handleConfirmSelectedProductCandidate() {
    if (!item?.selectedProductCandidate) return;

    const { brand, productName } = item.selectedProductCandidate;

    saveConfirmedProduct({
      brand,
      productName,
      productUrl: "",
      productImageUrl: "",
      mallName: "",
      price: "",
      confirmedAt: new Date().toISOString(),
    });
  }

  function handleOpenConfirmedProductForm() {
    setConfirmedProductDraft(getConfirmedProductDraft(item));
    setIsProductUrlFormOpen(false);
    setIsProductFormOpen(true);
  }

  function handleOpenMeasurementForm() {
    if (!item?.confirmedProduct) return;

    if (isAccessoryOrBagItem(item)) {
      setIsMeasurementFormOpen(false);
      return;
    }

    setMeasurementDraft(getProductMeasurementDraft(item));
    setIsProductFormOpen(false);
    setIsProductUrlFormOpen(false);
    setIsMeasurementFormOpen(true);
  }

  function handleCancelMeasurementForm() {
    setMeasurementDraft(
      item ? getProductMeasurementDraft(item) : EMPTY_PRODUCT_MEASUREMENT_DRAFT
    );
    setIsMeasurementFormOpen(false);
  }

  async function handleSaveProductMeasurement() {
    if (!item?.confirmedProduct) return;

    if (isAccessoryOrBagItem(item)) {
      setIsMeasurementFormOpen(false);
      return;
    }

    const measurement = buildProductSizeMeasurement(measurementDraft);
    if (!measurement) {
      Alert.alert("입력 확인", "사이즈명과 실측값을 하나 이상 입력해주세요.");
      return;
    }

    const existingRows = getValidProductSizeRows(item.confirmedProduct.productSizeGuide);
    const nextRows = upsertProductSizeMeasurement(existingRows, measurement);
    const confirmedProduct: ConfirmedProduct = {
      ...item.confirmedProduct,
      productSizeGuide: {
        unit: "cm",
        sizes: nextRows,
      },
    };

    try {
      const updatedCloset = await updateClosetItem(item.id, { confirmedProduct });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("저장 실패", "상품 실측을 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
      setConfirmedProductDraft(getConfirmedProductDraft(updatedItem));
      setMeasurementDraft(getProductMeasurementDraft(updatedItem));
      setIsMeasurementFormOpen(false);
      Alert.alert("저장 완료", `${measurement.size} 사이즈 실측이 저장됐어요.`);
    } catch (error) {
      console.error("상품 실측 저장 실패:", error);
      Alert.alert("저장 실패", "상품 실측을 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  function handleDeleteProductMeasurement(measurement: ProductSizeMeasurement) {
    if (!item?.confirmedProduct) return;

    const currentConfirmedProduct = item.confirmedProduct;
    const displaySize = getProductSizeDisplayName(measurement);
    Alert.alert(
      "실측 삭제",
      `${displaySize} 사이즈 실측을 삭제할까요? 확정 상품 정보는 그대로 유지돼요.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            const currentRows = getValidProductSizeRows(
              currentConfirmedProduct.productSizeGuide
            );
            const nextRows = removeProductSizeMeasurement(currentRows, measurement);
            const confirmedProduct: ConfirmedProduct = {
              ...currentConfirmedProduct,
              productSizeGuide:
                nextRows.length > 0
                  ? { unit: "cm", sizes: nextRows }
                  : undefined,
            };

            try {
              const updatedCloset = await updateClosetItem(item.id, { confirmedProduct });
              const updatedItem = updatedCloset.find(
                (closetItem) => closetItem.id === item.id
              );

              if (!updatedItem) {
                Alert.alert("삭제 실패", "상품 실측을 삭제하지 못했어요. 다시 시도해주세요.");
                return;
              }

              setItem(updatedItem);
              setConfirmedProductDraft(getConfirmedProductDraft(updatedItem));
              setMeasurementDraft(getProductMeasurementDraft(updatedItem));
            } catch (error) {
              console.error("상품 실측 삭제 실패:", error);
              Alert.alert("삭제 실패", "상품 실측을 삭제하지 못했어요. 다시 시도해주세요.");
            }
          },
        },
      ]
    );
  }

  function handleCancelConfirmedProductForm() {
    setConfirmedProductDraft(getConfirmedProductDraft(item));
    setIsProductFormOpen(false);
  }

  function handleOpenProductUrlForm() {
    const currentProductUrl = item?.confirmedProduct?.productUrl || "";

    setProductUrlInput(currentProductUrl);
    setExtractErrorMessage("");
    setExtractedProduct(null);
    setIsProductFormOpen(false);
    setIsProductUrlFormOpen(true);
  }

  function handleCancelProductUrlForm() {
    setProductUrlInput("");
    setExtractErrorMessage("");
    setExtractedProduct(null);
    setIsProductUrlFormOpen(false);
  }

  async function handleExtractProductFromUrl() {
    const productUrl = productUrlInput.trim();

    if (!productUrl) {
      Alert.alert("URL 확인", "상품 URL을 입력해주세요.");
      return;
    }

    try {
      setIsExtractingProduct(true);
      setExtractErrorMessage("");
      setExtractedProduct(null);

      const response = await fetch(API_ENDPOINTS.extractProduct, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: productUrl }),
      });

      if (!response.ok) {
        throw new Error(`Extract product failed: ${response.status}`);
      }

      const result = await response.json();
      const nextDraft: ConfirmedProductDraft = {
        brand: result.brand || "",
        productName: result.productName || "",
        productUrl: result.productUrl || productUrl,
        productImageUrl: result.productImageUrl || "",
        productSizeGuide: result.productSizeGuide,
        materialComposition: result.materialComposition,
        mallName: result.mallName || "",
        price: result.price || "",
      };

      if (!nextDraft.brand || !nextDraft.productName) {
        throw new Error("Missing extracted product fields");
      }

      setConfirmedProductDraft(nextDraft);
      setExtractedProduct({
        ...nextDraft,
        sizeGuideStatus: result.sizeGuideStatus,
      });
    } catch (error) {
      console.error("상품 URL 추출 실패:", error);
      setExtractErrorMessage("자동 추출에 실패했어요. 브랜드명, 상품명, 링크만 직접 입력해주세요.");
    } finally {
      setIsExtractingProduct(false);
    }
  }

  async function handleConfirmExtractedProduct() {
    const confirmedProduct = buildConfirmedProductFromDraft(confirmedProductDraft);

    if (!confirmedProduct) {
      Alert.alert("입력 확인", "브랜드명과 상품명은 꼭 필요해요.");
      return;
    }

    await saveConfirmedProduct(confirmedProduct, {
      openMeasurementForm:
        getValidProductSizeRows(confirmedProduct.productSizeGuide).length === 0,
    });
  }

  function handleSaveConfirmedProductForm() {
    const confirmedProduct = buildConfirmedProductFromDraft(confirmedProductDraft, {
      includeProductSizeGuide: false,
    });

    if (!confirmedProduct) {
      Alert.alert("입력 확인", "브랜드명과 상품명은 꼭 입력해주세요.");
      return;
    }

    saveConfirmedProduct(confirmedProduct);
  }

  async function handleOpenConfirmedProductUrl() {
    const productUrl = item?.confirmedProduct?.productUrl?.trim();

    if (!productUrl) {
      Alert.alert("상품 링크 없음", "저장된 상품 링크가 없어요.");
      return;
    }

    try {
      await Linking.openURL(productUrl);
    } catch (error) {
      console.error("확정 상품 링크 열기 실패:", error);
      Alert.alert("링크 열기 실패", "상품 링크를 열지 못했어요.");
    }
  }

  const hasSizeRecommendationContext = useMemo(
    () =>
      Boolean(
        item &&
          (item.category === "상의" || item.category === "하의" || item.category === "아우터") &&
          item.confirmedProduct
      ),
    [item]
  );
  const displayImageUri = useMemo(() => {
    const timer = startPerformanceTimer("clothes-detail.getDisplayImageUri");
    const uri = item ? getDisplayImageUri(item) : "";
    endPerformanceTimer(timer, {
      source: item?.cleanImageUri
        ? "cleanImageUri"
        : item?.confirmedProduct?.productImageUrl
          ? "productImageUrl"
          : item?.imageUri
            ? "imageUri"
            : "none",
    });
    return uri;
  }, [item]);
  const fitSuitability = useMemo(
    () => {
      if (!item || isAccessoryOrBagItem(item) || item.category === "신발") return null;
      const timer = startPerformanceTimer("clothes-detail.getFitSuitability");
      const result = getFitSuitability(item, profile);
      endPerformanceTimer(timer, { fitResult: result.fitResult });
      return result;
    },
    [item, profile]
  );
  const sizeRecommendation = useMemo(
    () => {
      if (!item || !hasSizeRecommendationContext) return null;
      const timer = startPerformanceTimer("clothes-detail.getRecommendedProductSize");
      const result = getRecommendedProductSize(item, profile, { referenceItem });
      endPerformanceTimer(timer, {
        sizeRowCount: item.confirmedProduct?.productSizeGuide?.sizes?.length || 0,
        hasReferenceItem: Boolean(referenceItem),
        recommendationCount: result.sizeRecommendations.length,
      });
      return result;
    },
    [hasSizeRecommendationContext, item, profile, referenceItem]
  );
  const shouldShowRecommendedSizeCard = Boolean(
    hasSizeRecommendationContext &&
      sizeRecommendation &&
      (sizeRecommendation.sizeRecommendations.length > 0 ||
        sizeRecommendation.missingFields.length > 0 ||
        sizeRecommendation.blockedReason === "missing_product_measurements")
  );
  const shouldShowFitSuitabilityCard = Boolean(
    fitSuitability &&
      !(
        sizeRecommendation?.blockedReason === "missing_product_measurements" ||
        sizeRecommendation?.blockedReason === "missing_profile_measurements"
      )
  );
  const referenceClothingKey = item ? getReferenceClothingKey(item) : null;
  const recommendationReviewFields = item
    ? getClosetItemReviewFields(item)
    : [];
  const isCurrentReferenceClothing = Boolean(
    item &&
      referenceClothingKey &&
      profile?.referenceClothing?.[referenceClothingKey] === item.id
  );

  if (isLoaded && !item) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Feather name="chevron-left" size={22} color="#111" />
            </Pressable>

            <View>
              <Text style={styles.headerEyebrow}>CLOTHES DETAIL</Text>
              <Text style={styles.headerTitle}>옷 상세</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.emptyCard}>
            <Feather name="alert-circle" size={28} color="#8c6f47" />
            <Text style={styles.emptyTitle}>옷 정보를 찾을 수 없어요</Text>
            <Text style={styles.emptyText}>옷장 화면에서 다시 선택해주세요.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#111" />
          </Pressable>

          <View>
            <Text style={styles.headerEyebrow}>CLOTHES DETAIL</Text>
            <Text style={styles.headerTitle}>옷 상세</Text>
          </View>

          {editMode ? (
            <View style={styles.editActionRow}>
              <Pressable style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>취소</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={() => handleSave()}>
                <Text style={styles.saveButtonText}>저장</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>수정</Text>
            </Pressable>
          )}
        </View>

        {item && (
          <>
            {displayImageUri ? (
              <ExpoImage
                source={displayImageUri}
                style={styles.heroImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.id}
                onLoadStart={() => {
                  endPerformanceTimer(heroImageTimerRef.current, { restarted: true });
                  heroImageTimerRef.current = startPerformanceTimer(
                    "clothes-detail.hero-image-load"
                  );
                }}
                onLoad={() => {
                  endPerformanceTimer(heroImageTimerRef.current);
                  heroImageTimerRef.current = null;
                }}
                onError={() => {
                  endPerformanceTimer(heroImageTimerRef.current, { failed: true });
                  heroImageTimerRef.current = null;
                }}
              />
            ) : (
              <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
                <Feather name="image" size={28} color="#8c6f47" />
                <Text style={styles.heroImagePlaceholderText}>등록된 사진이 없어요</Text>
                <Pressable
                  style={styles.heroImageAddButton}
                  onPress={handleAddItemPhoto}
                  disabled={isUpdatingImage}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.heroImageAddButtonText}>
                    {isUpdatingImage ? "사진 저장 중" : "사진 추가"}
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.summaryCard}>
              <Text style={styles.itemTitle} numberOfLines={2} ellipsizeMode="tail">
                {getDisplayTitle(item)}
              </Text>
              <Text style={styles.itemSubtitle} numberOfLines={2} ellipsizeMode="tail">
                {[getDisplayBrand(item), item.category, item.color].filter(Boolean).join(" · ")}
              </Text>
            </View>

            {!editMode && recommendationReviewFields.length > 0 ? (
              <View style={styles.recommendationInfoReviewCard}>
                <View style={styles.recommendationInfoReviewHeader}>
                  <Feather name="alert-circle" size={18} color="#b45309" />
                  <View style={styles.tipHeaderText}>
                    <Text style={styles.recommendationInfoReviewTitle}>추천 정보 확인</Text>
                    <Text style={styles.recommendationInfoReviewText}>
                      {getRegistrationReviewLabels(recommendationReviewFields).join(", ")} 정보가 불확실해 코디 추천에 충분히 반영되지 않을 수 있어요.
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.recommendationInfoReviewButton} onPress={handleEdit}>
                  <Feather name="edit-3" size={14} color="#fff" />
                  <Text style={styles.recommendationInfoReviewButtonText}>정보 수정</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.infoCard}>
              {editMode ? (
                <>
                  <View style={styles.editPriorityNotice}>
                    <Feather name="check-circle" size={15} color="#8c6f47" />
                    <Text style={styles.editPriorityNoticeText}>
                      직접 수정한 정보는 상품 링크나 사진 분석보다 우선 적용돼요.
                    </Text>
                  </View>
                  {shouldPrioritizeSeasonEdit ? (
                    <SeasonChipEditor
                      values={draft.seasons}
                      onSelect={updateDraftSeasons}
                      needsConfirmation={item.seasonNeedsReview === true}
                      isConfirmed={isDraftSeasonConfirmed}
                      onConfirm={() => setIsDraftSeasonConfirmed(true)}
                    />
                  ) : null}
                  <ChipGroup
                    label="종류"
                    value={draft.category}
                    options={CATEGORY_OPTIONS}
                    onSelect={(value) => updateDraft("category", value)}
                  />
                  <EditRow
                    label="기본 종류"
                    value={draft.subCategory}
                    onChangeText={(value) => updateDraft("subCategory", value)}
                  />
                  <EditRow
                    label="상세 종류"
                    value={draft.detailCategory}
                    onChangeText={(value) => updateDraft("detailCategory", value)}
                  />
                  <EditRow
                    label="색상"
                    value={draft.color}
                    onChangeText={(value) => updateDraft("color", value)}
                  />
                  <EditRow
                    label="소재"
                    value={draft.material}
                    onChangeText={(value) => updateDraft("material", value)}
                  />
                  <ChipGroup
                    label="스타일"
                    value={draft.style}
                    options={STYLE_OPTIONS}
                    onSelect={(value) => updateDraft("style", value)}
                  />
                  <MultiChipGroup
                    label="스타일 태그"
                    values={draft.styleTags}
                    options={STYLE_TAG_OPTIONS}
                    onSelect={updateDraftStyleTags}
                  />
                  {!shouldPrioritizeSeasonEdit ? (
                    <SeasonChipEditor
                      values={draft.seasons}
                      onSelect={updateDraftSeasons}
                      needsConfirmation={item.seasonNeedsReview === true}
                      isConfirmed={isDraftSeasonConfirmed}
                      onConfirm={() => setIsDraftSeasonConfirmed(true)}
                    />
                  ) : null}
                  <EditRow
                    label="핏"
                    value={draft.fit}
                    onChangeText={(value) => updateDraft("fit", value)}
                  />
                  {getSizeOptions(draft.category).length > 0 ? (
                    <ChipGroup
                      label="사이즈"
                      value={draft.size}
                      options={getSizeOptions(draft.category)}
                      onSelect={(value) => updateDraft("size", value)}
                    />
                  ) : null}
                  <EditRow
                    label={getSizeOptions(draft.category).length > 0 ? "사이즈 직접 입력" : "사이즈"}
                    value={draft.size}
                    onChangeText={(value) => updateDraft("size", value)}
                  />
                  <ChipGroup
                    label="착용 의도"
                    value={draft.intendedFit}
                    options={INTENDED_FIT_OPTIONS}
                    onSelect={(value) => updateDraft("intendedFit", value)}
                  />
                </>
              ) : (
                <>
                  <DetailRow label="카테고리" value={item.category} />
                  <DetailRow label="상세 종류" value={item.detailCategory || item.subCategory} />
                  <DetailRow label="브랜드" value={getDisplayBrand(item)} />
                  <DetailRow label="색상" value={item.color} />
                  <DetailRow label="소재" value={getDisplayMaterial(item)} />
                  <DetailRow
                    label="계절"
                    value={getItemSeasons(item).join(", ") || "계절 확인 필요"}
                  />
                  <DetailRow label="스타일" value={getDisplayStyleText(item)} />
                  <DetailRow label="핏" value={item.fit} />
                  <DetailRow label="사이즈" value={item.size || "사이즈 미입력"} />
                  <DetailRow label="착용 의도" value={item.intendedFit || "상관없음"} />
                </>
              )}
            </View>

            {!editMode && referenceClothingKey ? (
              <View style={styles.referenceClothingActionCard}>
                <View style={styles.referenceClothingActionTextWrap}>
                  <Text style={styles.tipTitle}>내 기준 옷</Text>
                  <Text style={styles.aiDetailSubtitle}>
                    가장 잘 맞는 옷을 기준으로 저장해두면 이후 핏 비교에 활용할 수 있어요.
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.referenceClothingButton,
                    isCurrentReferenceClothing && styles.referenceClothingButtonActive,
                  ]}
                  onPress={handleSetReferenceClothing}
                  disabled={isSavingReferenceClothing || isCurrentReferenceClothing}
                >
                  <Feather
                    name={isCurrentReferenceClothing ? "check" : "bookmark"}
                    size={14}
                    color={isCurrentReferenceClothing ? "#fff" : "#8c6f47"}
                  />
                  <Text
                    style={[
                      styles.referenceClothingButtonText,
                      isCurrentReferenceClothing && styles.referenceClothingButtonTextActive,
                    ]}
                  >
                    {isCurrentReferenceClothing
                      ? "내 기준 옷으로 설정됨"
                      : "내 기준 옷으로 설정"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!editMode && (
              <RecommendationPreferenceCard
                value={item.recommendationPreference || "normal"}
                isSaving={isSavingRecommendationPreference}
                onSelect={handleRecommendationPreferenceChange}
              />
            )}

            {!editMode && <AnalysisActionNoticeCard item={item} />}

            {!editMode && item.confirmedProduct && (
              <ConfirmedProductCard
                item={item}
                profile={profile}
                confirmedProduct={item.confirmedProduct}
                onOpenUrl={handleOpenConfirmedProductUrl}
                onEdit={handleOpenConfirmedProductForm}
                onOpenUrlForm={handleOpenProductUrlForm}
                onOpenMeasurementForm={handleOpenMeasurementForm}
                onDeleteMeasurement={handleDeleteProductMeasurement}
              />
            )}

            {!editMode && isMeasurementFormOpen && item.confirmedProduct && (
              <ProductMeasurementForm
                item={item}
                draft={measurementDraft}
                onChange={updateMeasurementDraft}
                onSave={handleSaveProductMeasurement}
                onCancel={handleCancelMeasurementForm}
              />
            )}

            {!editMode && shouldShowRecommendedSizeCard && sizeRecommendation && (
              <RecommendedSizeCard
                item={item}
                result={sizeRecommendation}
                onOpenMeasurementForm={handleOpenMeasurementForm}
              />
            )}

            {!editMode && shouldShowFitSuitabilityCard && fitSuitability ? (
              <FitSuitabilityCard
                item={item}
                result={fitSuitability}
                onEditItem={handleEdit}
                onOpenMeasurementForm={handleOpenMeasurementForm}
                onOpenProductUrlForm={handleOpenProductUrlForm}
              />
            ) : null}

            {!editMode && !item.confirmedProduct && (
              <>
                <ProductReferenceCard item={item} />
                <ProductConfirmActionCard
                  hasCandidate={Boolean(item.selectedProductCandidate)}
                  onConfirmCandidate={handleConfirmSelectedProductCandidate}
                  onOpenManualForm={handleOpenConfirmedProductForm}
                  onOpenUrlForm={handleOpenProductUrlForm}
                />
              </>
            )}

            {!editMode && isProductUrlFormOpen && (
              <ProductUrlConfirmCard
                productUrl={productUrlInput}
                isLoading={isExtractingProduct}
                errorMessage={extractErrorMessage}
                preview={extractedProduct}
                onChangeUrl={setProductUrlInput}
                onExtract={handleExtractProductFromUrl}
                onConfirm={handleConfirmExtractedProduct}
                onOpenManualForm={handleOpenConfirmedProductForm}
                onCancel={handleCancelProductUrlForm}
              />
            )}

            {!editMode && isProductFormOpen && (
              <ConfirmedProductForm
                draft={confirmedProductDraft}
                onChange={updateConfirmedProductDraft}
                onSave={handleSaveConfirmedProductForm}
                onCancel={handleCancelConfirmedProductForm}
              />
            )}

            {editMode ? (
              <>
                <TipEditCard
                  icon="file-text"
                  title="특징"
                  value={draft.description}
                  onChangeText={(value) => updateDraft("description", value)}
                />
                <TipEditCard
                  icon="check-circle"
                  title="매치 팁"
                  value={draft.matchTip}
                  onChangeText={(value) => updateDraft("matchTip", value)}
                />
                <TipEditCard
                  icon="x-circle"
                  title="피하면 좋은 조합"
                  value={draft.avoidTip}
                  onChangeText={(value) => updateDraft("avoidTip", value)}
                />
              </>
            ) : (
              <>
                <TipCard
                  icon="file-text"
                  title="특징"
                  text={item.description}
                />
                <TipCard
                  icon="check-circle"
                  title="매치 팁"
                  text={item.matchTip}
                />
                <TipCard
                  icon="x-circle"
                  title="피하면 좋은 조합"
                  text={item.avoidTip}
                />
              </>
            )}

            {!editMode && <MatchingItemSearchCard item={item} />}

            {!editMode && SHOW_INTERNAL_AI_ANALYSIS && (
              <AiAnalysisAccordion
                item={item}
                isOpen={isAiAnalysisOpen}
                onToggle={() => setIsAiAnalysisOpen((current) => !current)}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  container: {
    flexGrow: 1,
    paddingTop: 34,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpacer: {
    width: 40,
    height: 40,
  },

  editButton: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  editButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  editActionRow: {
    flexDirection: "row",
    gap: 7,
  },

  cancelButton: {
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  cancelButtonText: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },

  saveButton: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  headerEyebrow: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textAlign: "center",
  },

  headerTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },

  heroImage: {
    width: "100%",
    height: 390,
    borderRadius: 28,
    backgroundColor: "#ddd",
    marginBottom: 16,
  },
  heroImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f4eee7",
  },
  heroImagePlaceholderText: {
    color: "#777064",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  heroImageAddButton: {
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 15,
    marginTop: 3,
  },
  heroImageAddButtonText: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },

  summaryCard: {
    backgroundColor: "#111",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },

  itemTitle: {
    color: "#fff",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    marginBottom: 6,
    flexShrink: 1,
  },
  recommendationInfoReviewCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f1d4b3",
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  recommendationInfoReviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  recommendationInfoReviewTitle: {
    color: "#8a3f08",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    marginBottom: 3,
  },
  recommendationInfoReviewText: {
    color: "#b45309",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  recommendationInfoReviewButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  recommendationInfoReviewButtonText: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },

  itemSubtitle: {
    color: "#d8d2ca",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    flexShrink: 1,
  },

  infoCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 14,
  },

  referenceClothingActionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8DED2",
    marginBottom: 14,
    gap: 12,
  },

  referenceClothingActionTextWrap: {
    gap: 4,
  },

  referenceClothingButton: {
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: "#F4EEE7",
    borderWidth: 1,
    borderColor: "#E8DED2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  referenceClothingButtonActive: {
    backgroundColor: "#8c6f47",
    borderColor: "#8c6f47",
  },

  referenceClothingButtonText: {
    color: "#8c6f47",
    fontSize: 13,
    fontWeight: "700",
  },

  referenceClothingButtonTextActive: {
    color: "#fff",
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#eee7dd",
  },

  detailLabel: {
    color: "#8a8178",
    fontSize: 14,
    fontWeight: "900",
    flexShrink: 0,
    marginRight: 12,
  },

  detailValueWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-end",
  },

  detailValue: {
    color: "#111",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    flexShrink: 1,
    textAlign: "right",
  },

  editRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee7dd",
  },

  textInput: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    color: "#111",
    fontSize: 15,
    fontWeight: "800",
    width: "100%",
    minWidth: 0,
  },

  editPriorityNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f4eee7",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 6,
  },

  editPriorityNoticeText: {
    flex: 1,
    minWidth: 0,
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  optionChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },

  optionChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },

  optionChipText: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },

  optionChipTextActive: {
    color: "#fff",
  },

  seasonConfirmationButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    borderRadius: 13,
    backgroundColor: "#8c6f47",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },

  seasonConfirmationButtonDone: {
    backgroundColor: "#777064",
  },

  seasonConfirmationButtonText: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },

  tipCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  recommendationPreferenceCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  recommendationPreferenceHeaderText: {
    flex: 1,
  },

  recommendationPreferenceOptions: {
    flexDirection: "row",
    gap: 7,
    marginTop: 14,
  },

  recommendationPreferenceButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: "#f4eee7",
    borderWidth: 1,
    borderColor: "#eee7dd",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },

  recommendationPreferenceButtonActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },

  recommendationPreferenceButtonText: {
    color: "#777064",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },

  recommendationPreferenceButtonTextActive: {
    color: "#fff",
  },

  sizeMatchCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  recommendedSizeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  recommendedSizeLabel: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "800",
  },

  recommendedSizeValue: {
    color: "#111",
    fontSize: 22,
    fontWeight: "900",
  },

  recommendedSizeScore: {
    color: "#777064",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: "auto",
  },

  recommendedSizeReason: {
    color: "#625a51",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 6,
  },

  freeSizeAnalysisText: {
    color: "#8c6f47",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 4,
  },

  recommendedSizeNotice: {
    backgroundColor: "#f4eee7",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },

  recommendedSizeNoticeText: {
    color: "#8c6f47",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },

  alternativeSizeList: {
    borderTopWidth: 1,
    borderTopColor: "#eee7dd",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
  },

  alternativeSizeText: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },

  aiDetailCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  aiDetailSubtitle: {
    color: "#8a8178",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 2,
    flexShrink: 1,
    width: "100%",
  },
  sizeRecommendationActionButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  sizeRecommendationActionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },

  aiDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  aiDetailPill: {
    width: "48%",
    backgroundColor: "#faf8f5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },

  aiDetailLabel: {
    color: "#8a8178",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
  },

  aiDetailValue: {
    color: "#111",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },

  analysisQualityCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  analysisActionNoticeCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  analysisQualityText: {
    color: "#625a51",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: 6,
  },

  aiAnalysisAccordionCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  aiAnalysisToggle: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  aiAnalysisContent: {
    marginTop: 14,
  },

  styleProfileCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  styleProfileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  styleProfilePill: {
    width: "48%",
    backgroundColor: "#faf8f5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },

  styleProfileLabel: {
    color: "#8a8178",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
  },

  styleProfileValue: {
    color: "#111",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },

  productReferenceCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  productReferenceBrand: {
    color: "#8c6f47",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    marginBottom: 4,
    flexShrink: 1,
  },

  productReferenceName: {
    color: "#111",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    marginBottom: 7,
    flexShrink: 1,
  },

  productReferenceReason: {
    color: "#625a51",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    flexShrink: 1,
  },

  productReferenceConfidence: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
  },

  confirmedProductImage: {
    width: 78,
    height: 78,
    borderRadius: 18,
    backgroundColor: "#faf8f5",
  },

  confirmedProductInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  confirmedProductInfoText: {
    flex: 1,
    minWidth: 0,
  },

  confirmedProductSizeGuideBox: {
    backgroundColor: "#f4eee7",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },

  confirmedProductSizeGuideHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  confirmedProductSizeGuideTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  confirmedProductSizeGuideTitle: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },

  confirmedProductSizeGuideText: {
    color: "#111",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    flexShrink: 1,
  },

  sizeGuideToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 7,
    paddingHorizontal: 9,
  },

  sizeGuideToggleText: {
    color: "#8c6f47",
    fontSize: 11,
    fontWeight: "900",
  },

  sizeGuideDetailBox: {
    backgroundColor: "#faf8f5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    padding: 12,
    marginTop: 12,
    gap: 10,
  },

  sizeGuideProfileHint: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
  },

  sizeGuideRowCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    padding: 12,
  },

  sizeGuideRowCardActive: {
    borderColor: "#8c6f47",
    backgroundColor: "#f4eee7",
  },

  sizeGuideRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  sizeGuideSizeText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },

  sizeGuideMySizeBadge: {
    color: "#fff",
    backgroundColor: "#8c6f47",
    borderRadius: 999,
    overflow: "hidden",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 11,
    fontWeight: "900",
  },

  sizeGuideMeasurementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  sizeGuideMeasurementPill: {
    minWidth: "30%",
    backgroundColor: "#f4eee7",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },

  sizeGuideMeasurementLabel: {
    color: "#8a8178",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 3,
  },

  sizeGuideMeasurementValue: {
    color: "#111",
    fontSize: 12,
    fontWeight: "900",
  },

  productSearchArea: {
    borderTopWidth: 1,
    borderTopColor: "#eee7dd",
    marginTop: 14,
    paddingTop: 13,
  },

  productSearchTitle: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 9,
  },

  productSearchButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  productSearchButton: {
    backgroundColor: "#f4eee7",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },

  productSearchButtonText: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
  },

  productConfirmArea: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
    gap: 9,
  },

  confirmedProductFormCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  measurementFormHeaderText: {
    flex: 1,
  },

  manualMeasurementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  manualMeasurementField: {
    width: "48%",
  },

  manualMeasurementInputWrap: {
    height: 42,
    backgroundColor: "#faf8f5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  manualMeasurementInput: {
    flex: 1,
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },

  manualMeasurementUnit: {
    color: "#8a8178",
    fontSize: 12,
    fontWeight: "700",
  },

  confirmedProductActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  confirmedProductPrimaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    flexShrink: 1,
    gap: 6,
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  confirmedProductPrimaryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    flexShrink: 1,
    textAlign: "center",
    lineHeight: 17,
  },

  sizeGuideRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  sizeGuideDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },

  confirmedProductSecondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    flexShrink: 1,
    gap: 6,
    backgroundColor: "#f4eee7",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  confirmedProductSecondaryButtonText: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
    flexShrink: 1,
    textAlign: "center",
    lineHeight: 17,
  },

  productExtractNotice: {
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f2d5b5",
    padding: 12,
    marginTop: 12,
    gap: 10,
  },

  productExtractNoticeText: {
    color: "#b45309",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },

  productExtractPreview: {
    backgroundColor: "#faf8f5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    padding: 13,
    marginTop: 12,
  },

  productExtractPreviewTitle: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },

  matchingSearchCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  matchingSearchHeaderText: {
    flex: 1,
  },

  matchingSearchBaseText: {
    color: "#8c6f47",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    marginBottom: 12,
  },

  matchingQueryList: {
    gap: 10,
  },

  matchingQueryCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    padding: 12,
  },

  matchingQueryText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 9,
  },

  matchingButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  matchingSearchButton: {
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 8,
    paddingHorizontal: 11,
  },

  matchingSearchButtonText: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
  },

  tipHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 10,
    minWidth: 0,
  },

  tipHeaderText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },

  tipIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  tipTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
    flexShrink: 1,
  },

  sizeMatchStatus: {
    color: "#111",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

  tipText: {
    color: "#625a51",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
  },

  tipInput: {
    minHeight: 96,
    backgroundColor: "#faf8f5",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 13,
    color: "#111",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },

  emptyTitle: {
    color: "#111",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 7,
  },

  emptyText: {
    color: "#6b6258",
    fontSize: 14,
    fontWeight: "700",
  },
});
