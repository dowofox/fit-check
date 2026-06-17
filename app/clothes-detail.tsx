import { getFitSuitability } from "@/utils/sizeMatch";
import {
  ClosetItem,
  ConfirmedProduct,
  getClosetItems,
  getDisplayImageUri,
  getUserProfile,
  ProductSizeGuide,
  StyleProfile,
  updateClosetItem,
  UserProfile,
} from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const EXTRACT_PRODUCT_URL = "http://192.168.219.104:3001/extract-product";

type EditableClosetFields = {
  category: string;
  subCategory: string;
  detailCategory: string;
  color: string;
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
  mallName: string;
  price: string;
};

type ConfirmedProductDraftTextField =
  | "brand"
  | "productName"
  | "productUrl"
  | "productImageUrl"
  | "mallName"
  | "price";

type ExtractedProduct = ConfirmedProductDraft;

const EMPTY_CONFIRMED_PRODUCT_DRAFT: ConfirmedProductDraft = {
  brand: "",
  productName: "",
  productUrl: "",
  productImageUrl: "",
  mallName: "",
  price: "",
};

const EMPTY_DRAFT: EditableClosetFields = {
  category: "",
  subCategory: "",
  detailCategory: "",
  color: "",
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

const INTENDED_FIT_OPTIONS = ["딱 맞게", "여유 있게", "오버핏", "상관없음"];
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

    return seasons.length > 0 ? seasons : ["사계절"];
  }

  return ["사계절"];
}

function toggleSeason(currentSeasons: string[], season: string) {
  if (season === "사계절") return ["사계절"];

  const nextSeasons = currentSeasons.includes(season)
    ? currentSeasons.filter((currentSeason) => currentSeason !== season)
    : [...currentSeasons.filter((currentSeason) => currentSeason !== "사계절"), season];

  return nextSeasons.length > 0 ? nextSeasons : ["사계절"];
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

function getConfirmedProductDraft(item?: ClosetItem | null): ConfirmedProductDraft {
  const confirmedProduct = item?.confirmedProduct;

  return {
    brand: confirmedProduct?.brand || "",
    productName: confirmedProduct?.productName || "",
    productUrl: confirmedProduct?.productUrl || "",
    productImageUrl: confirmedProduct?.productImageUrl || "",
    productSizeGuide: confirmedProduct?.productSizeGuide,
    mallName: confirmedProduct?.mallName || "",
    price: confirmedProduct?.price || "",
  };
}

function buildConfirmedProductFromDraft(draft: ConfirmedProductDraft): ConfirmedProduct | null {
  const brand = draft.brand.trim();
  const productName = draft.productName.trim();

  if (!brand || !productName) return null;

  return {
    brand,
    productName,
    productUrl: draft.productUrl.trim(),
    productImageUrl: draft.productImageUrl.trim(),
    productSizeGuide: draft.productSizeGuide,
    mallName: draft.mallName.trim(),
    price: draft.price.trim(),
    confirmedAt: new Date().toISOString(),
  };
}

function getProductSizeGuideSummary(productSizeGuide?: ProductSizeGuide) {
  const sizes =
    productSizeGuide?.sizes
      ?.map((sizeInfo) => sizeInfo.size?.trim())
      .filter(Boolean) || [];

  return sizes.length > 0 ? sizes.join(" / ") : "";
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
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "분석 전"}</Text>
    </View>
  );
}

function getBooleanLabel(value?: boolean) {
  return value ? "감지됨" : "없음";
}

function getAiAnalysisRows(item: ClosetItem) {
  return [
    { label: "확정 브랜드", value: item.confirmedBrand || "확정 없음" },
    { label: "추정 브랜드", value: item.inferredBrand || "추정 없음" },
    { label: "추정 상품명", value: item.inferredProductName || "추정 없음" },
    { label: "로고", value: getBooleanLabel(item.logoDetected) },
    { label: "로고 텍스트", value: item.logoText || "없음" },
    { label: "프린팅/그래픽", value: item.graphicType || "판단 어려움" },
    { label: "그래픽 크기", value: item.graphicSize || "판단 어려움" },
    { label: "소재", value: item.material || "판단 어려움" },
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
        <View>
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
  return typeof item.confidence?.product === "number" && item.confidence.product < 70;
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
  const warnings = item.analysisWarnings || [];
  const quality = item.analysisQuality;
  const missingHints = quality?.missingHints || [];
  const shouldShow =
    hasProductWarning ||
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
        <View>
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
        <View>
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

async function openProductSearch(provider: "naver" | "musinsa" | "google", query: string) {
  if (!query) return;

  const encodedQuery = encodeURIComponent(query);
  const urls = {
    naver: `https://search.shopping.naver.com/search/all?query=${encodedQuery}`,
    musinsa: `https://www.musinsa.com/search/musinsa/integration?q=${encodedQuery}`,
    google: `https://www.google.com/search?q=${encodedQuery}`,
  };

  try {
    await Linking.openURL(urls[provider]);
  } catch (error) {
    console.error("상품 검색 열기 실패:", error);
    Alert.alert("검색 실패", "검색 페이지를 열지 못했어요. 다시 시도해주세요.");
  }
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
        <View style={styles.matchingSearchHeaderText}>
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

function ConfirmedProductCard({
  confirmedProduct,
  onOpenUrl,
  onEdit,
  onOpenUrlForm,
}: {
  confirmedProduct: ConfirmedProduct;
  onOpenUrl: () => void;
  onEdit: () => void;
  onOpenUrlForm: () => void;
}) {
  const meta = [confirmedProduct.mallName, confirmedProduct.price].filter(Boolean).join(" / ");
  const sizeGuideSummary = getProductSizeGuideSummary(confirmedProduct.productSizeGuide);

  return (
    <View style={styles.productReferenceCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="check-circle" size={16} color="#8c6f47" />
        </View>
        <View>
          <Text style={styles.tipTitle}>확정 상품</Text>
          <Text style={styles.aiDetailSubtitle}>사용자가 직접 확인해서 저장한 실제 상품 정보예요.</Text>
        </View>
      </View>

      <View style={styles.confirmedProductInfoRow}>
        {confirmedProduct.productImageUrl ? (
          <Image
            source={{ uri: confirmedProduct.productImageUrl }}
            style={styles.confirmedProductImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.confirmedProductInfoText}>
          <Text style={styles.productReferenceBrand}>{confirmedProduct.brand}</Text>
          <Text style={styles.productReferenceName}>{confirmedProduct.productName}</Text>
          {meta ? <Text style={styles.productReferenceReason}>{meta}</Text> : null}
          {sizeGuideSummary ? (
            <View style={styles.confirmedProductSizeGuideBox}>
              <Text style={styles.confirmedProductSizeGuideTitle}>사이즈 정보 있음</Text>
              <Text style={styles.confirmedProductSizeGuideText}>{sizeGuideSummary}</Text>
            </View>
          ) : null}
        </View>
      </View>

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
        <View>
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
        <View>
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
        <View>
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

export default function ClothesDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<EditableClosetFields>(EMPTY_DRAFT);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [confirmedProductDraft, setConfirmedProductDraft] =
    useState<ConfirmedProductDraft>(EMPTY_CONFIRMED_PRODUCT_DRAFT);
  const [isProductUrlFormOpen, setIsProductUrlFormOpen] = useState(false);
  const [productUrlInput, setProductUrlInput] = useState("");
  const [isExtractingProduct, setIsExtractingProduct] = useState(false);
  const [extractErrorMessage, setExtractErrorMessage] = useState("");
  const [extractedProduct, setExtractedProduct] = useState<ExtractedProduct | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadItem() {
        const [closetItems, userProfile] = await Promise.all([
          getClosetItems(),
          getUserProfile(),
        ]);
        const selectedItem = closetItems.find((closetItem) => closetItem.id === id);

        setProfile(userProfile);
        setItem(selectedItem || null);
        if (selectedItem) {
          setDraft(getEditableValues(selectedItem));
          setConfirmedProductDraft(getConfirmedProductDraft(selectedItem));
        }
        setIsLoaded(true);
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

  function updateDraftSeasons(season: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      seasons: toggleSeason(currentDraft.seasons, season),
    }));
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
    setEditMode(true);
  }

  function handleCancel() {
    if (item) {
      setDraft(getEditableValues(item));
    }

    setEditMode(false);
  }

  async function handleSave() {
    if (!item) return;

    try {
      const updatedCloset = await updateClosetItem(item.id, {
        ...draft,
        style: draft.styleTags[0] || draft.style,
        season: draft.seasons.join(", "),
      });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("수정 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
      setDraft(getEditableValues(updatedItem));
      setEditMode(false);
    } catch (error) {
      console.error("옷 정보 수정 실패:", error);
      Alert.alert("수정 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  async function saveConfirmedProduct(confirmedProduct: ConfirmedProduct) {
    if (!item) return;

    try {
      const updatedCloset = await updateClosetItem(item.id, { confirmedProduct });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("저장 실패", "확정 상품 정보를 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
      setConfirmedProductDraft(getConfirmedProductDraft(updatedItem));
      setIsProductFormOpen(false);
      Alert.alert("저장 완료", "확정 상품 정보가 저장됐어요.");
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

      const response = await fetch(EXTRACT_PRODUCT_URL, {
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
        mallName: result.mallName || "",
        price: result.price || "",
      };

      if (!nextDraft.brand || !nextDraft.productName) {
        throw new Error("Missing extracted product fields");
      }

      setConfirmedProductDraft(nextDraft);
      setExtractedProduct({ ...nextDraft });
    } catch (error) {
      console.error("상품 URL 추출 실패:", error);
      setExtractErrorMessage("자동 추출에 실패했어요. 브랜드명, 상품명, 링크만 직접 입력해주세요.");
    } finally {
      setIsExtractingProduct(false);
    }
  }

  function handleConfirmExtractedProduct() {
    const confirmedProduct = buildConfirmedProductFromDraft(confirmedProductDraft);

    if (!confirmedProduct) {
      Alert.alert("입력 확인", "브랜드명과 상품명은 꼭 필요해요.");
      return;
    }

    saveConfirmedProduct(confirmedProduct);
  }

  function handleSaveConfirmedProductForm() {
    const confirmedProduct = buildConfirmedProductFromDraft(confirmedProductDraft);

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

  const fitSuitability = item ? getFitSuitability(item, profile) : null;

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
              <Pressable style={styles.saveButton} onPress={handleSave}>
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
            <Image source={{ uri: getDisplayImageUri(item) }} style={styles.heroImage} />

            <View style={styles.summaryCard}>
              <Text style={styles.itemTitle}>
                {item.detailCategory || item.subCategory || item.category}
              </Text>
              <Text style={styles.itemSubtitle}>
                {item.category}{item.color ? ` · ${item.color}` : ""}
              </Text>
            </View>

            <View style={styles.infoCard}>
              {editMode ? (
                <>
                  <EditRow
                    label="종류"
                    value={draft.category}
                    onChangeText={(value) => updateDraft("category", value)}
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
                  <MultiChipGroup
                    label="계절"
                    values={draft.seasons}
                    options={SEASON_OPTIONS}
                    onSelect={updateDraftSeasons}
                  />
                  <EditRow
                    label="핏"
                    value={draft.fit}
                    onChangeText={(value) => updateDraft("fit", value)}
                  />
                  <EditRow
                    label="사이즈"
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
                  <DetailRow label="종류" value={item.category} />
                  <DetailRow label="기본 종류" value={item.subCategory} />
                  <DetailRow label="상세 종류" value={item.detailCategory || item.subCategory} />
                  <DetailRow label="색상" value={item.color} />
                  <DetailRow label="스타일" value={item.style} />
                  <DetailRow label="스타일 태그" value={getItemStyleTags(item).map((tag) => `#${tag}`).join(" ")} />
                  <DetailRow label="계절" value={getItemSeasons(item).join(", ")} />
                  <DetailRow label="핏" value={item.fit} />
                  <DetailRow label="사이즈" value={item.size || "사이즈 미입력"} />
                  <DetailRow label="착용 의도" value={item.intendedFit || "상관없음"} />
                </>
              )}
            </View>

            {!editMode && <AiDetailCard item={item} />}

            {!editMode && <AnalysisQualityCard item={item} />}

            {!editMode && <StyleProfileCard item={item} />}

            {!editMode && item.confirmedProduct && (
              <ConfirmedProductCard
                confirmedProduct={item.confirmedProduct}
                onOpenUrl={handleOpenConfirmedProductUrl}
                onEdit={handleOpenConfirmedProductForm}
                onOpenUrlForm={handleOpenProductUrlForm}
              />
            )}

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

            {!editMode && <MatchingItemSearchCard item={item} />}

            {!editMode && fitSuitability && (
              <View style={styles.sizeMatchCard}>
                <View style={styles.tipHeader}>
                  <View style={styles.tipIconCircle}>
                    <Feather name="check-square" size={16} color="#8c6f47" />
                  </View>
                  <Text style={styles.tipTitle}>내 사이즈 적합도</Text>
                </View>
                <Text style={styles.sizeMatchStatus}>{fitSuitability.status}</Text>
                <Text style={styles.tipText}>{fitSuitability.description}</Text>
              </View>
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

  summaryCard: {
    backgroundColor: "#111",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },

  itemTitle: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
    marginBottom: 6,
  },

  itemSubtitle: {
    color: "#d8d2ca",
    fontSize: 15,
    fontWeight: "800",
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

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#eee7dd",
  },

  detailLabel: {
    color: "#8a8178",
    fontSize: 14,
    fontWeight: "900",
  },

  detailValue: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
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

  tipCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  sizeMatchCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
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
    fontWeight: "700",
    marginTop: 2,
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

  analysisQualityText: {
    color: "#625a51",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: 6,
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
    fontWeight: "900",
    marginBottom: 4,
  },

  productReferenceName: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 7,
  },

  productReferenceReason: {
    color: "#625a51",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
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
  },

  confirmedProductSecondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },

  tipIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    alignItems: "center",
    justifyContent: "center",
  },

  tipTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
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
