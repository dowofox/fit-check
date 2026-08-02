import {
  API_ENDPOINTS,
  API_TIMEOUTS,
  fetchApiWithTimeout,
  isApiRequestTimeoutError,
} from "@/utils/api";
import { ScreenHeader } from "@/components/ui/NaesUi";
import { colors, layout, radius, spacing } from "@/utils/theme";
import { isAnalysisImageTooLargeError } from "@/utils/analysisImage";
import {
  requestClothesAnalysis,
  type ClothesAnalysis,
} from "@/utils/clothesAnalysis";
import {
  CURRENT_CLASSIFICATION_VERSION,
  CURRENT_PHOTO_ANALYSIS_VERSION,
} from "@/utils/clothesAnalysisVersions";
import { normalizeProductColor } from "@/utils/color";
import {
  createClosetItemId,
  getUniqueRegistrationImageUris,
  getProductRegistrationReviewFields,
  getRegistrationReviewLabels,
  getRegistrationValidationMessage,
  normalizeClosetRegistrationBasics,
  normalizeClosetSeasons,
  validateClosetRegistration,
  wasClosetItemSaved,
} from "@/utils/closetRegistration";
import {
  deleteManagedClosetImageFiles,
  persistClosetImage,
} from "@/utils/closetImageFiles";
import {
  getProductClassificationNotice,
  inferProductAttributesFromConfirmedProduct,
} from "@/utils/productClassification";
import { getProductExtractionSummary } from "@/utils/productExtractionSummary";
import {
  parseExtractedProductResponse,
  type ExtractedProductResponse,
} from "@/utils/productExtractionResponse";
import {
  getProductLinkFailure,
  type ProductExtractionErrorResponse,
  type ProductLinkFailure,
} from "@/utils/productLinkFailure";
import {
  getConfirmedProductSeasonInference,
  resolveRegistrationSeasonInference,
} from "@/utils/seasonInference";
import { getProductSizeGuideStatusMessage } from "@/utils/productSizeGuideStatus";
import { validateProductUrlInput } from "@/utils/productUrl";
import {
  CLOSET_SIZE_NOT_ENTERED_LABEL,
  hasSelectedClosetSize,
  normalizeClosetItemSize,
} from "@/utils/sizeMatch";
import { saveClosetItem } from "@/utils/storage";
import type {
  ClosetItem,
  ConfirmedProduct,
  ProductClassificationField,
  SeasonSource,
} from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AUTO_APPLY_BACKGROUND_REMOVAL = false;
const SEASON_OPTIONS = ["봄", "여름", "가을", "겨울", "사계절"];
const CATEGORY_OPTIONS = ["상의", "하의", "신발", "아우터", "액세서리"];
const DEFAULT_SIZE = CLOSET_SIZE_NOT_ENTERED_LABEL;
const MAX_BATCH_IMAGE_SELECTION = 10;
const TOP_SIZE_OPTIONS = ["FREE", "S", "M", "L", "XL", "2XL", "3XL"];
const BOTTOM_SIZE_OPTIONS = ["FREE", "28", "29", "30", "31", "32", "33", "34", "36"];
const SHOE_SIZE_OPTIONS = ["FREE", "250", "255", "260", "265", "270", "275", "280", "285"];
const COMMON_SIZE_OPTIONS = [
  ...TOP_SIZE_OPTIONS,
  ...BOTTOM_SIZE_OPTIONS,
  ...SHOE_SIZE_OPTIONS,
].filter((value, index, array) => array.indexOf(value) === index);

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
const BRAND_OR_LOGO_TERMS = [
  "Nike",
  "나이키",
  "스우시",
  "Swoosh",
  "Adidas",
  "아디다스",
  "Jordan",
  "조던",
  "Puma",
  "푸마",
  "New Balance",
  "뉴발란스",
  "Converse",
  "컨버스",
  "Vans",
  "반스",
  "Supreme",
  "슈프림",
  "Stussy",
  "스투시",
  "Carhartt",
  "칼하트",
  "Patagonia",
  "파타고니아",
  "The North Face",
  "노스페이스",
  "Arc'teryx",
  "Arcteryx",
  "아크테릭스",
];

type SelectedImage = {
  uri: string;
};

type AddMode = "photo" | "link" | "manual";

type ExtractedProduct = ExtractedProductResponse;

function toggleSeason(currentSeasons: string[], season: string) {
  if (season === "사계절") return ["사계절"];

  const nextSeasons = currentSeasons.includes(season)
    ? currentSeasons.filter((currentSeason) => currentSeason !== season)
    : [...currentSeasons.filter((currentSeason) => currentSeason !== "사계절"), season];

  return nextSeasons;
}

function normalizeStyleTags(styleTags?: string[], style?: string) {
  const matchedTags = STYLE_TAG_OPTIONS.filter((option) =>
    styleTags?.some((tag) => tag.includes(option)) || style?.includes(option)
  );

  if (matchedTags.length > 0) return matchedTags.slice(0, 3);
  if (style) return [style].filter((tag) => STYLE_TAG_OPTIONS.includes(tag)).slice(0, 3);

  return ["데일리"];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generalizeBrandTerms(value?: string, fallback = "") {
  if (!value) return fallback;

  let sanitized = value;

  BRAND_OR_LOGO_TERMS.forEach((term) => {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(term), "gi"), "로고");
  });

  return sanitized
    .replace(/로고\s*로고/g, "로고")
    .replace(/브랜드명/g, "로고")
    .replace(/상표명/g, "로고")
    .replace(/\s{2,}/g, " ")
    .trim() || fallback;
}

function getConfirmedBrand(analysis: ClothesAnalysis) {
  const confirmedBrand = analysis.confirmedBrand || analysis.brand;
  const brandConfidence = analysis.brandConfidence ?? 0;
  const hasBrandEvidence = Boolean(analysis.logoText || analysis.brand || analysis.confirmedBrand);

  if (!confirmedBrand || confirmedBrand === "판단 어려움") return undefined;
  if (!analysis.logoDetected || brandConfidence < 80 || !hasBrandEvidence) return undefined;

  return confirmedBrand;
}

function buildConfirmedProductFromExtractedProduct(product: ExtractedProduct): ConfirmedProduct {
  return {
    brand: product.brand || "",
    productName: product.productName || "",
    productCategory: product.productCategory,
    productColor: product.productColor,
    productUrl: product.productUrl,
    productImageUrl: product.productImageUrl,
    productSizeGuide: product.productSizeGuide,
    materialComposition: product.materialComposition,
    mallName: product.mallName || "",
    price: product.price || "",
    confirmedAt: new Date().toISOString(),
  };
}

function createProductFallbackAnalysis(product: ExtractedProduct): ClothesAnalysis {
  const classification = inferProductAttributesFromConfirmedProduct({
    productName: product.productName,
    productCategory: product.productCategory,
    brand: product.brand,
    materialComposition: product.materialComposition,
  });
  const styleTags = classification.styleTags?.length
    ? classification.styleTags
    : ["데일리"];
  const seasonInference = getConfirmedProductSeasonInference(
    buildConfirmedProductFromExtractedProduct(product)
  );

  return {
    source: "productFallback",
    category: classification.category || "기타",
    subCategory: classification.subCategory || "분류 확인 필요",
    detailCategory: classification.detailCategory || "상세 종류 확인 필요",
    color: normalizeProductColor(product.productColor) || "색상 확인 필요",
    style: styleTags[0],
    styleTags,
    season: seasonInference?.seasons.join(", ") || "",
    seasons: seasonInference?.seasons || [],
    seasonSource: seasonInference?.source || "photo_ai",
    seasonNeedsReview: seasonInference?.needsReview ?? true,
    fit: "핏 분석 전",
    material:
      classification.material ||
      product.materialComposition?.summary ||
      "판단 어려움",
    description: "상품 이미지 분석을 완료하지 못해 확인된 상품 정보로 등록합니다.",
    matchTip: "등록 후 옷 상세에서 정보를 보완하면 추천이 더 정확해져요.",
    avoidTip: "종류, 색상, 계절이 다르면 저장 전에 바로잡아주세요.",
    analysisWarnings: ["상품 이미지 AI 분석을 완료하지 못했어요."],
  };
}

function createManualAnalysis(): ClothesAnalysis {
  return {
    source: "manual",
    category: "상의",
    subCategory: "상의",
    seasons: [],
    season: "",
    seasonSource: "user",
    seasonNeedsReview: true,
    style: "데일리",
    styleTags: ["데일리"],
    fit: "핏 정보 없음",
    description: "직접 등록한 옷이에요.",
    matchTip: "옷 정보를 더 채우면 추천이 정교해져요.",
    avoidTip: "",
  };
}

function getInferredBrand(analysis: ClothesAnalysis, confirmedBrand?: string) {
  const inferredBrand = analysis.inferredBrand || analysis.brand || analysis.confirmedBrand || "";
  const trimmedBrand = inferredBrand.trim();

  if (!trimmedBrand || trimmedBrand === confirmedBrand || trimmedBrand === "판단 어려움") {
    return undefined;
  }

  return trimmedBrand;
}

function toggleStyleTag(currentTags: string[], tag: string) {
  if (currentTags.includes(tag)) {
    const nextTags = currentTags.filter((currentTag) => currentTag !== tag);
    return nextTags.length > 0 ? nextTags : ["데일리"];
  }

  if (currentTags.length >= 3) return currentTags;

  return [...currentTags, tag];
}

function getSizeOptions(category?: string) {
  if (category?.includes("상의") || category?.includes("아우터")) return TOP_SIZE_OPTIONS;
  if (category?.includes("하의")) return BOTTOM_SIZE_OPTIONS;
  if (category?.includes("신발")) return SHOE_SIZE_OPTIONS;

  return COMMON_SIZE_OPTIONS;
}

function supportsProductMeasurements(category?: string) {
  return ["상의", "하의", "아우터", "신발"].some((value) =>
    category?.includes(value)
  );
}

async function saveCleanImageToFile(base64?: string | null) {
  if (!base64) {
    return undefined;
  }

  try {
    const fileUri = `${FileSystem.documentDirectory}clean-clothes-${Date.now()}.png`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  } catch (error) {
    console.error("배경제거 이미지 저장 실패:", error);
    return undefined;
  }
}

async function getOptionalCleanImageUri(analysis: ClothesAnalysis) {
  if (!AUTO_APPLY_BACKGROUND_REMOVAL) {
    return undefined;
  }

  return saveCleanImageToFile(analysis.cleanImageBase64);
}

function getAnalysisDetailFields(analysis: ClothesAnalysis) {
  const confirmedBrand = getConfirmedBrand(analysis);
  const inferredBrand = getInferredBrand(analysis, confirmedBrand);

  return {
    brand: confirmedBrand,
    confirmedBrand,
    inferredBrand,
    inferredProductName: analysis.inferredProductName || undefined,
    brandConfidence: confirmedBrand ? analysis.brandConfidence ?? 0 : 0,
    confidence: analysis.confidence,
    logoDetected: analysis.logoDetected ?? false,
    logoText: generalizeBrandTerms(analysis.logoText),
    graphicDetected: analysis.graphicDetected ?? false,
    graphicType: analysis.graphicType || "판단 어려움",
    graphicSize: analysis.graphicSize || "판단 어려움",
    material: analysis.material || "판단 어려움",
    pattern: analysis.pattern || "판단 어려움",
    productCandidates: analysis.productCandidates || [],
    analysisWarnings: analysis.analysisWarnings || [],
    analysisQuality: analysis.analysisQuality,
  };
}

async function saveAnalyzedClosetItem(
  imageUri: string,
  analysis: ClothesAnalysis,
  seasons = normalizeClosetSeasons(analysis.seasons || analysis.season),
  styleTags = normalizeStyleTags(analysis.styleTags, analysis.style),
  size = DEFAULT_SIZE
) {
  const cleanImageUri = await getOptionalCleanImageUri(analysis);
  const registration = normalizeClosetRegistrationBasics({
    category: analysis.category,
    color: analysis.color,
    seasons,
  });
  const itemId = createClosetItemId();
  const analyzedAt = new Date().toISOString();
  let persistedImageUri = imageUri;

  try {
    persistedImageUri = await persistClosetImage(imageUri, itemId);
    const savedItems = await saveClosetItem({
      id: itemId,
      imageUri: persistedImageUri,
      cleanImageUri,
      classificationVersion: CURRENT_CLASSIFICATION_VERSION,
      photoAnalysisVersion: CURRENT_PHOTO_ANALYSIS_VERSION,
      lastAnalyzedAt: analyzedAt,
      lastClassificationUpdatedAt: analyzedAt,
      updatedAt: analyzedAt,
      category: registration.category,
      subCategory: generalizeBrandTerms(analysis.subCategory, "분석 전"),
      detailCategory: generalizeBrandTerms(
        analysis.detailCategory || analysis.subCategory,
        "상세 분류 전"
      ),
      color: registration.color,
      style: styleTags[0] || analysis.style || "스타일 미분석",
      styleTags,
      season: registration.seasons.join(", "),
      seasons: registration.seasons,
      seasonSource: analysis.seasonSource || "photo_ai",
      seasonNeedsReview:
        analysis.seasonNeedsReview ?? registration.reviewFields.includes("season"),
      fit: analysis.fit || "핏 미분석",
      size: normalizeClosetItemSize(size),
      ...getAnalysisDetailFields(analysis),
      styleProfile: analysis.styleProfile || undefined,
      garmentProfile: analysis.garmentProfile || undefined,
      description: generalizeBrandTerms(analysis.description, "옷 특징을 분석하지 못했어요."),
      matchTip: generalizeBrandTerms(analysis.matchTip, "어울리는 조합을 분석하지 못했어요."),
      avoidTip: generalizeBrandTerms(analysis.avoidTip, "피하면 좋은 조합을 분석하지 못했어요."),
      createdAt: analyzedAt,
    });

    if (!wasClosetItemSaved(savedItems, itemId)) {
      throw new Error("closet item was not persisted");
    }

    return {
      needsSeasonReview:
        analysis.seasonNeedsReview === true || registration.reviewFields.includes("season"),
    };
  } catch (error) {
    try {
      await deleteManagedClosetImageFiles([
        persistedImageUri !== imageUri ? persistedImageUri : undefined,
        cleanImageUri,
      ]);
    } catch (cleanupError) {
      console.error("실패한 옷 등록 이미지 정리 실패:", cleanupError);
    }
    throw error;
  }
}

export default function AddClothesScreen() {
  const insets = useSafeAreaInsets();
  const [addMode, setAddMode] = useState<AddMode>("link");
  const [imageUri, setImageUri] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtractingProduct, setIsExtractingProduct] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [analysis, setAnalysis] = useState<ClothesAnalysis | null>(null);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [seasonSource, setSeasonSource] = useState<SeasonSource>("photo_ai");
  const [seasonNeedsReview, setSeasonNeedsReview] = useState(true);
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(["데일리"]);
  const [hasManuallyEditedStyleTags, setHasManuallyEditedStyleTags] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDetailCategory, setSelectedDetailCategory] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [manuallyEditedClassificationFields, setManuallyEditedClassificationFields] =
    useState<ProductClassificationField[]>([]);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
  const [productUrlInput, setProductUrlInput] = useState("");
  const [productLinkFailure, setProductLinkFailure] = useState<ProductLinkFailure | null>(null);
  const [extractedProduct, setExtractedProduct] = useState<ExtractedProduct | null>(null);
  const productExtractionRequestRef = useRef(0);
  const savingOperationRef = useRef(false);

  function invalidateProductExtraction() {
    productExtractionRequestRef.current += 1;
    setIsExtractingProduct(false);
  }

  function beginSavingOperation() {
    if (savingOperationRef.current) return false;

    savingOperationRef.current = true;
    setIsSaving(true);
    return true;
  }

  function finishSavingOperation() {
    savingOperationRef.current = false;
    setIsSaving(false);
  }

  function resetAnalysisState() {
    setAnalysis(null);
    setProgressText("");
    setSelectedSeasons([]);
    setSeasonSource("photo_ai");
    setSeasonNeedsReview(true);
    setSelectedStyleTags(["데일리"]);
    setHasManuallyEditedStyleTags(false);
    setSelectedCategory("");
    setSelectedDetailCategory("");
    setSelectedColor("");
    setShowAdditionalInfo(false);
    setManuallyEditedClassificationFields([]);
    setSelectedSize(DEFAULT_SIZE);
  }

  function handleProductUrlInputChange(value: string) {
    if (savingOperationRef.current) return;

    if (isExtractingProduct) invalidateProductExtraction();

    const extractedProductUrl = extractedProduct?.productUrl?.trim() || "";
    const shouldClearExtractedProduct =
      Boolean(extractedProduct) && value.trim() !== extractedProductUrl;

    setProductUrlInput(value);
    setProductLinkFailure(null);

    if (shouldClearExtractedProduct) {
      setExtractedProduct(null);
      setImageUri("");
      setSelectedImages([]);
      resetAnalysisState();
    }
  }

  function switchAddMode(nextMode: AddMode) {
    if (savingOperationRef.current) return;

    if (nextMode === addMode) {
      if (nextMode === "manual" && !analysis) {
        applyAnalysisToForm(createManualAnalysis());
      }
      return;
    }

    invalidateProductExtraction();
    setAddMode(nextMode);
    setImageUri("");
    setSelectedImages([]);
    setExtractedProduct(null);
    setProductLinkFailure(null);
    resetAnalysisState();

    if (nextMode === "manual") {
      applyAnalysisToForm(createManualAnalysis());
    }
  }

  function switchToPhotoFallback() {
    invalidateProductExtraction();
    setAddMode("photo");
    setImageUri("");
    setSelectedImages([]);
    setProductLinkFailure(null);
    resetAnalysisState();
  }

  function markClassificationFieldAsEdited(field: ProductClassificationField) {
    setManuallyEditedClassificationFields((currentFields) =>
      currentFields.includes(field) ? currentFields : [...currentFields, field]
    );
  }

  function updateSelectedSeason(season: string) {
    setSelectedSeasons((currentSeasons) => {
      const nextSeasons = toggleSeason(currentSeasons, season);
      setSeasonNeedsReview(nextSeasons.length === 0);
      return nextSeasons;
    });
    setSeasonSource("user");
    markClassificationFieldAsEdited("season");
  }

  function confirmSelectedSeasons() {
    if (selectedSeasons.length === 0) return;

    setSeasonSource("user");
    setSeasonNeedsReview(false);
    markClassificationFieldAsEdited("season");
  }

  function applyAnalysisToForm(nextAnalysis: ClothesAnalysis) {
    const isManual = nextAnalysis.source === "manual";
    const officialSeasonInference = extractedProduct
      ? getConfirmedProductSeasonInference(buildConfirmedProductFromExtractedProduct(extractedProduct))
      : null;
    const resolvedSeasons = officialSeasonInference?.seasons ||
      normalizeClosetSeasons(nextAnalysis.seasons || nextAnalysis.season);

    setAnalysis(nextAnalysis);
    setSelectedCategory(nextAnalysis.category || (isManual ? "상의" : "기타"));
    setSelectedDetailCategory(
      isManual
        ? nextAnalysis.detailCategory || ""
        : generalizeBrandTerms(
            nextAnalysis.detailCategory || nextAnalysis.subCategory,
            "상세 분류 확인 필요"
          )
    );
    setSelectedColor(nextAnalysis.color || (isManual ? "" : "색상 확인 필요"));
    setSelectedSeasons(resolvedSeasons);
    setSeasonSource(officialSeasonInference?.source || nextAnalysis.seasonSource || "photo_ai");
    setSeasonNeedsReview(
      officialSeasonInference?.needsReview ??
        nextAnalysis.seasonNeedsReview ??
        resolvedSeasons.length === 0
    );
    setSelectedStyleTags(normalizeStyleTags(nextAnalysis.styleTags, nextAnalysis.style));
    setHasManuallyEditedStyleTags(false);
    setSelectedSize(DEFAULT_SIZE);
    setShowAdditionalInfo(false);
  }

  async function pickImage() {
    if (savingOperationRef.current) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: !extractedProduct,
      selectionLimit: extractedProduct ? 1 : MAX_BATCH_IMAGE_SELECTION,
      quality: 0.8,
    });

    if (!result.canceled) {
      const images = getUniqueRegistrationImageUris(
        result.assets.map((asset) => asset.uri),
        MAX_BATCH_IMAGE_SELECTION
      ).map((uri) => ({ uri }));

      setSelectedImages(images);
      setImageUri(images[0]?.uri || "");
      setAnalysis(null);
      setProgressText("");
      setSelectedSeasons([]);
      setSeasonSource("photo_ai");
      setSeasonNeedsReview(true);
      setSelectedStyleTags(["데일리"]);
      setHasManuallyEditedStyleTags(false);
      setSelectedCategory("");
      setSelectedDetailCategory("");
      setSelectedColor("");
      setShowAdditionalInfo(false);
      setManuallyEditedClassificationFields([]);
      setSelectedSize(DEFAULT_SIZE);
    }
  }

  async function takePhoto() {
    if (savingOperationRef.current) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("권한 필요", "카메라 권한이 필요해요");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      const nextImage = { uri: result.assets[0].uri };

      setSelectedImages([nextImage]);
      setImageUri(nextImage.uri);
      setAnalysis(null);
      setProgressText("");
      setSelectedSeasons([]);
      setSeasonSource("photo_ai");
      setSeasonNeedsReview(true);
      setSelectedStyleTags(["데일리"]);
      setHasManuallyEditedStyleTags(false);
      setSelectedCategory("");
      setSelectedDetailCategory("");
      setSelectedColor("");
      setShowAdditionalInfo(false);
      setManuallyEditedClassificationFields([]);
      setSelectedSize(DEFAULT_SIZE);
    }
  }

  async function extractProductFromUrl() {
    if (savingOperationRef.current) return;

    const validatedUrl = validateProductUrlInput(productUrlInput);

    if (!validatedUrl.ok) {
      setProductLinkFailure(getProductLinkFailure(validatedUrl.error, 400));
      return;
    }

    const productUrl = validatedUrl.url;

    if (isExtractingProduct) return;
    const requestId = productExtractionRequestRef.current + 1;
    productExtractionRequestRef.current = requestId;

    try {
      setIsExtractingProduct(true);
      setProductLinkFailure(null);
      setProductUrlInput(productUrl);
      setExtractedProduct(null);
      setImageUri("");
      setSelectedImages([]);
      resetAnalysisState();

      const response = await fetchApiWithTimeout(API_ENDPOINTS.extractProduct, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: productUrl }),
      }, API_TIMEOUTS.extractProduct);
      if (requestId !== productExtractionRequestRef.current) return;

      if (!response.ok) {
        const errorResponse = (await response.json().catch(() => ({}))) as ProductExtractionErrorResponse;
        if (requestId !== productExtractionRequestRef.current) return;
        setProductLinkFailure(getProductLinkFailure(errorResponse.error, response.status));
        return;
      }

      const product = parseExtractedProductResponse(await response.json(), productUrl);
      if (requestId !== productExtractionRequestRef.current) return;
      if (!product) throw new Error("Extract product returned an invalid payload");

      if (!product.productImageUrl) {
        setExtractedProduct(product);
        setImageUri("");
        setSelectedImages([]);
        setProductLinkFailure({
          kind: "missing_image",
          title: "상품 이미지만 가져오지 못했어요",
          message: "상품 정보는 유지했어요. 옷 사진을 추가하면 링크 정보와 함께 등록할 수 있어요.",
        });
        return;
      }

      setExtractedProduct(product);
      setProductUrlInput(product.productUrl || productUrl);
      setImageUri(product.productImageUrl);
      setSelectedImages([{ uri: product.productImageUrl }]);
    } catch (error) {
      if (requestId !== productExtractionRequestRef.current) return;
      console.error("상품 정보 추출 실패:", error);
      setProductLinkFailure(
        getProductLinkFailure(
          isApiRequestTimeoutError(error)
            ? "product_page_timeout"
            : "product_page_unreachable"
        )
      );
    } finally {
      if (requestId === productExtractionRequestRef.current) {
        setIsExtractingProduct(false);
      }
    }
  }

  async function analyzeItem() {
    if (!imageUri || savingOperationRef.current) return;

    if (selectedImages.length > 1) {
      await analyzeAndSaveBatch();
      return;
    }

    if (!beginSavingOperation()) return;

    try {
      const nextAnalysis = await requestClothesAnalysis(imageUri, extractedProduct);
      applyAnalysisToForm({ ...nextAnalysis, source: "image" });
    } catch (error) {
      console.error("옷 분석 실패:", error);

      if (isAnalysisImageTooLargeError(error)) {
        Alert.alert(
          "사진 용량이 너무 커요",
          "15MB 이하 사진을 선택하면 안정적으로 분석할 수 있어요."
        );
        return;
      }

      if (extractedProduct) {
        applyAnalysisToForm(createProductFallbackAnalysis(extractedProduct));
        Alert.alert(
          "상품 정보로 계속할게요",
          "이미지 AI 분석은 완료하지 못했지만 확인된 상품 정보는 유지했어요. 아래에서 종류, 색상, 계절을 확인한 뒤 저장해주세요."
        );
      } else {
        Alert.alert("분석 실패", "옷 분석 중 문제가 생겼어요. 다시 시도해주세요.");
      }
    } finally {
      finishSavingOperation();
    }
  }

  async function analyzeAndSaveBatch() {
    if (selectedImages.length === 0 || savingOperationRef.current) return;

    let savedCount = 0;
    let failedCount = 0;
    let seasonReviewCount = 0;
    const failedImages: SelectedImage[] = [];

    if (!beginSavingOperation()) return;

    try {
      setAnalysis(null);

      for (const [index, selectedImage] of selectedImages.entries()) {
        setProgressText(`${index + 1}/${selectedImages.length} 분석 중`);

        try {
          const analysis = await requestClothesAnalysis(selectedImage.uri);
          const saveResult = await saveAnalyzedClosetItem(selectedImage.uri, analysis);
          savedCount += 1;
          if (saveResult.needsSeasonReview) seasonReviewCount += 1;
        } catch (error) {
          failedCount += 1;
          failedImages.push(selectedImage);
          console.error("[add-clothes] batch item failed", {
            index: index + 1,
            uri: selectedImage.uri,
            error,
          });
        }
      }

      setProgressText(`완료: ${savedCount}/${selectedImages.length} 저장`);

      if (failedImages.length > 0) {
        setSelectedImages(failedImages);
        setImageUri(failedImages[0]?.uri || "");
        setProgressText(`${savedCount}개 저장 · ${failedCount}개 다시 시도 필요`);

        Alert.alert(
          savedCount > 0 ? "일부 옷을 저장했어요" : "저장하지 못했어요",
          savedCount > 0
            ? `저장하지 못한 사진 ${failedCount}개를 화면에 남겨뒀어요. 다시 분석해주세요.`
            : "선택한 사진은 그대로 두었어요. 네트워크 상태를 확인한 뒤 다시 시도해주세요."
        );
        return;
      }

      if (savedCount > 0) {
        if (seasonReviewCount > 0) {
          const failedMessage = failedCount > 0 ? `, ${failedCount}개 실패` : "";

          Alert.alert(
            "일괄 저장 완료",
            `${savedCount}개 저장${failedMessage}했어요. 계절 확인이 필요한 옷이 ${seasonReviewCount}개 있어요.`,
            [
              { text: "나중에", onPress: () => router.replace("/closet") },
              {
                text: "확인하러 가기",
                onPress: () =>
                  router.replace({
                    pathname: "/closet",
                    params: { category: "확인 필요" },
                  }),
              },
            ]
          );
          return;
        }

        router.replace("/closet");
        return;
      }

      Alert.alert("저장 실패", "선택한 사진은 그대로 두었어요. 다시 시도해주세요.");
    } finally {
      finishSavingOperation();
    }
  }

  function getRegistrationFormState() {
    const confirmedProduct = extractedProduct
      ? buildConfirmedProductFromExtractedProduct(extractedProduct)
      : undefined;
    const seasonWasEdited = manuallyEditedClassificationFields.includes("season");
    const resolvedSeasonInference = resolveRegistrationSeasonInference({
      selectedSeasons,
      selectedSource: seasonSource,
      selectedNeedsReview: seasonNeedsReview,
      userEdited: seasonWasEdited,
      confirmedProduct,
    });
    const registrationInput = {
      category: selectedCategory,
      color: selectedColor,
      seasons: resolvedSeasonInference.seasons,
    };

    return {
      confirmedProduct,
      resolvedSeasonInference,
      registration: normalizeClosetRegistrationBasics(registrationInput),
      validation: validateClosetRegistration(registrationInput),
    };
  }

  async function saveItem() {
    if (
      (!imageUri && addMode !== "manual") ||
      !analysis ||
      savingOperationRef.current
    ) return;

    const formState = getRegistrationFormState();
    const {
      confirmedProduct,
      registration,
      resolvedSeasonInference,
      validation,
    } = formState;
    const resolvedSeasonSource = resolvedSeasonInference.source;
    const resolvedSeasonNeedsReview = resolvedSeasonInference.needsReview;

    if (__DEV__) {
      console.info("[registration.validation]", {
        valid: validation.valid,
        missingFields: validation.missingFields,
        invalidFields: validation.invalidFields,
        category: registration.category,
        hasColor: Boolean(registration.color && registration.color !== "색상 확인 필요"),
        hasSeason: registration.seasons.length > 0,
        hasSize: hasSelectedClosetSize(selectedSize),
        source: analysis.source === "manual" ? "manual" : "product-analysis",
      });
    }

    if (!validation.valid) {
      Alert.alert(
        "등록 정보를 확인해주세요",
        getRegistrationValidationMessage(validation)
      );
      return;
    }

    let persistedImageUri = imageUri;
    let cleanImageUri: string | undefined;
    let didPersistClosetItem = false;

    if (!beginSavingOperation()) return;

    try {
      cleanImageUri = await getOptionalCleanImageUri(analysis);
      const itemId = createClosetItemId();
      const createdAt = new Date().toISOString();
      persistedImageUri = await persistClosetImage(imageUri, itemId);
      const confirmedProductBrand = confirmedProduct?.brand?.trim() || undefined;
      const confirmedMaterial = confirmedProduct?.materialComposition?.summary?.trim();
      const shouldApplyConfirmedMaterial =
        Boolean(confirmedMaterial) &&
        (!analysis.material?.trim() || analysis.material.trim() === "판단 어려움");

      const userEditedClassificationFields: ProductClassificationField[] = [
        ...manuallyEditedClassificationFields,
        ...(hasManuallyEditedStyleTags ? (["styleTags"] as ProductClassificationField[]) : []),
      ];
      const manualDetailCategory = selectedDetailCategory.trim() || selectedCategory.trim();
      const initialItem: ClosetItem = {
        id: itemId,
        imageUri: persistedImageUri,
        cleanImageUri,
        classificationVersion: CURRENT_CLASSIFICATION_VERSION,
        ...(analysis.source === "image"
          ? {
              photoAnalysisVersion: CURRENT_PHOTO_ANALYSIS_VERSION,
              lastAnalyzedAt: createdAt,
            }
          : {}),
        lastClassificationUpdatedAt: createdAt,
        updatedAt: createdAt,
        category: registration.category,
        subCategory:
          addMode === "manual"
            ? manualDetailCategory
            : generalizeBrandTerms(
                selectedDetailCategory || analysis.subCategory || selectedCategory,
                "분석 전"
              ),
        detailCategory: generalizeBrandTerms(
          addMode === "manual"
            ? manualDetailCategory
            : selectedDetailCategory || analysis.detailCategory || analysis.subCategory,
          "상세 분류 전"
        ),
        color: registration.color,
        style: selectedStyleTags[0] || analysis.style || "스타일 분석 전",
        styleTags: selectedStyleTags,
        season: registration.seasons.join(", "),
        seasons: registration.seasons,
        seasonSource: resolvedSeasonSource,
        seasonNeedsReview: resolvedSeasonNeedsReview,
        fit: analysis.fit || "핏 분석 전",
        size: normalizeClosetItemSize(selectedSize),
        ...getAnalysisDetailFields(analysis),
        styleProfile: analysis.styleProfile || undefined,
        garmentProfile: analysis.garmentProfile || undefined,
        description: generalizeBrandTerms(analysis.description, "옷 특징을 분석하지 못했어요."),
        matchTip: generalizeBrandTerms(analysis.matchTip, "어울리는 조합을 분석하지 못했어요."),
        avoidTip: generalizeBrandTerms(analysis.avoidTip, "피하면 좋은 조합을 분석하지 못했어요."),
        confirmedProduct,
        ...(confirmedProductBrand
          ? {
              confirmedBrand: confirmedProductBrand,
              brand: confirmedProductBrand,
              brandConfidence: 100,
            }
          : {}),
        ...(shouldApplyConfirmedMaterial ? { material: confirmedMaterial } : {}),
        userEditedClassificationFields,
        createdAt,
      };
      const classification = confirmedProduct
        ? inferProductAttributesFromConfirmedProduct({
            productName: confirmedProduct.productName,
            productCategory: confirmedProduct.productCategory,
            brand: confirmedProduct.brand,
            materialComposition: confirmedProduct.materialComposition,
            currentItem: initialItem,
          })
        : {};
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
              style: classification.styleTags[0] || initialItem.style,
            }
          : {}),
      };
      const finalItem: ClosetItem = {
        ...initialItem,
        ...classificationUpdates,
      };
      const classificationNotice = getProductClassificationNotice(
        classification,
        initialItem
      );

      const savedItems = await saveClosetItem(finalItem);
      if (!wasClosetItemSaved(savedItems, finalItem.id)) {
        throw new Error("closet item was not persisted");
      }
      didPersistClosetItem = true;

      const needsManualSizeGuide =
        Boolean(confirmedProduct) &&
        supportsProductMeasurements(finalItem.category) &&
        !confirmedProduct?.productSizeGuide?.sizes?.length;

      if (needsManualSizeGuide) {
        const sizeGuideNotice = getProductSizeGuideStatusMessage(
          extractedProduct?.sizeGuideStatus
        );
        const message = [classificationNotice, sizeGuideNotice].filter(Boolean).join("\n\n");

        Alert.alert("옷 저장 완료", message, [
          { text: "나중에", onPress: () => router.replace("/closet") },
          {
            text: "실측 입력",
            onPress: () =>
              router.replace({
                pathname: "/clothes-detail",
                params: { id: finalItem.id, openMeasurement: "1" },
              }),
          },
        ]);
      } else if (classificationNotice) {
        Alert.alert(
          "상품 정보 보정 완료",
          classificationNotice,
          [{ text: "확인", onPress: () => router.replace("/closet") }]
        );
      } else {
        router.replace("/closet");
      }
    } catch (error) {
      if (!didPersistClosetItem) {
        try {
          await deleteManagedClosetImageFiles([
            persistedImageUri !== imageUri ? persistedImageUri : undefined,
            cleanImageUri,
          ]);
        } catch (cleanupError) {
          console.error("실패한 옷 등록 이미지 정리 실패:", cleanupError);
        }
      }
      console.error("옷 저장 실패:", error);
      Alert.alert("저장 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      finishSavingOperation();
    }
  }

  const sizeOptions = getSizeOptions(selectedCategory || analysis?.category);
  const registrationFormState = analysis ? getRegistrationFormState() : null;
  const canAnalyze = addMode !== "manual" && Boolean(imageUri);
  const canSave = Boolean(analysis && registrationFormState?.validation.valid);
  const canContinue = analysis ? canSave : canAnalyze;
  const registrationReviewFields = registrationFormState
    ? getProductRegistrationReviewFields({
        category: registrationFormState.registration.category,
        color: registrationFormState.registration.color,
        seasons: registrationFormState.registration.seasons,
        seasonNeedsReview: registrationFormState.resolvedSeasonInference.needsReview,
      })
    : [];
  const extractionSummary = extractedProduct
    ? getProductExtractionSummary(extractedProduct)
    : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 56, 96) }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="ADD CLOTHES"
          title="옷 추가"
          onBack={() => router.back()}
        />

        {analysis ? (
          <View style={styles.registrationSourceCard}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.registrationSourceImage} />
            ) : (
              <View style={styles.registrationSourceIcon}>
                <Feather name="edit-3" size={18} color={colors.accent} />
              </View>
            )}
            <View style={styles.registrationSourceTextWrap}>
              <Text style={styles.registrationSourceEyebrow}>
                {analysis.source === "manual"
                  ? "직접 등록"
                  : extractedProduct
                    ? "상품 링크"
                    : "사진 등록"}
              </Text>
              <Text style={styles.registrationSourceTitle} numberOfLines={2}>
                {extractedProduct?.productName ||
                  (analysis.source === "manual" ? "직접 입력한 옷" : "선택한 옷 사진")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="등록 방식 다시 선택"
              style={styles.registrationSourceReset}
              onPress={resetAnalysisState}
            >
              <Text style={styles.registrationSourceResetText}>다시 선택</Text>
            </Pressable>
          </View>
        ) : (
          <>
        <View style={styles.linkHeroCard}>
          <View style={styles.recommendedBadge}>
            <Feather name="check" size={12} color={colors.accent} />
            <Text style={styles.recommendedBadgeText}>가장 정확해요</Text>
          </View>
          <Text style={styles.linkHeroTitle}>상품 링크로 정확하게 등록</Text>
          <Text style={styles.linkHeroText}>
            공개 상품 페이지의 상품명과 대표 이미지를 우선 가져와요. 공식 소재와 실측은 쇼핑몰 제공 방식에 따라 함께 확인해요.
          </Text>
        </View>

        <View style={styles.modeSelectionList}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="상품 링크로 추가"
            accessibilityState={{
              selected: addMode === "link",
              disabled: isSaving,
            }}
            style={[
              styles.modeOptionCard,
              styles.modeOptionCardPrimary,
              addMode === "link" && styles.modeOptionCardActive,
            ]}
            onPress={() => switchAddMode("link")}
            disabled={isSaving}
          >
            <View style={styles.modeOptionIcon}>
              <Feather name="link" size={18} color={colors.accent} />
            </View>
            <View style={styles.modeOptionTextWrap}>
              <View style={styles.modeOptionTitleRow}>
                <Text style={styles.modeOptionTitle}>상품 링크로 추가</Text>
                <Text style={styles.modeOptionBadge}>추천</Text>
              </View>
              <Text style={styles.modeOptionDescription}>
                공식 상품 정보와 실측표를 가져와요.
              </Text>
            </View>
            {addMode === "link" ? <Feather name="check-circle" size={18} color={colors.accent} /> : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진으로 빠르게 추가"
            accessibilityState={{
              selected: addMode === "photo",
              disabled: isSaving,
            }}
            style={[styles.modeOptionCard, addMode === "photo" && styles.modeOptionCardActive]}
            onPress={() => switchAddMode("photo")}
            disabled={isSaving}
          >
            <View style={styles.modeOptionIcon}>
              <Feather name="camera" size={18} color={colors.accent} />
            </View>
            <View style={styles.modeOptionTextWrap}>
              <Text style={styles.modeOptionTitle}>사진으로 빠르게 추가</Text>
              <Text style={styles.modeOptionDescription}>
                링크가 없는 옷을 사진으로 간단히 등록해요.
              </Text>
            </View>
            {addMode === "photo" ? <Feather name="check-circle" size={18} color={colors.accent} /> : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="직접 입력해서 추가"
            accessibilityState={{
              selected: addMode === "manual",
              disabled: isSaving,
            }}
            style={[styles.modeOptionCard, addMode === "manual" && styles.modeOptionCardActive]}
            onPress={() => switchAddMode("manual")}
            disabled={isSaving}
          >
            <View style={styles.modeOptionIcon}>
              <Feather name="edit-3" size={18} color={colors.accent} />
            </View>
            <View style={styles.modeOptionTextWrap}>
              <Text style={styles.modeOptionTitle}>직접 입력해서 추가</Text>
              <Text style={styles.modeOptionDescription}>
                링크와 사진이 없을 때 필요한 정보만 입력해요.
              </Text>
            </View>
            {addMode === "manual" ? <Feather name="check-circle" size={18} color={colors.accent} /> : null}
          </Pressable>
        </View>

        {addMode === "photo" && (
          <>
        {extractedProduct ? (
          <View style={styles.linkFallbackNotice}>
            <Feather name="check-circle" size={17} color={colors.accent} />
            <Text style={styles.linkFallbackNoticeText}>
              가져온 상품 정보는 유지됐어요. 옷 사진을 추가하면 함께 저장해요.
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="옷 사진 선택"
          style={styles.uploadCard}
          onPress={pickImage}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <>
              <View style={styles.uploadIconCircle}>
                <Feather name="image" size={28} color={colors.accent} />
              </View>
              <Text style={styles.uploadTitle}>옷 사진 선택</Text>
              <Text style={styles.uploadText}>
                사진으로는 종류, 색상 등 기본 정보를 빠르게 등록해요. 정확한 실측과 소재 정보는 상품 링크가 더 정확해요.
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.photoButtonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="앨범에서 옷 사진 선택"
            style={styles.photoButton}
            onPress={pickImage}
          >
            <Feather name="image" size={18} color={colors.primaryText} />
            <Text style={styles.photoButtonText}>앨범에서 선택</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="카메라로 옷 사진 촬영"
            style={styles.photoButton}
            onPress={takePhoto}
          >
            <Feather name="camera" size={18} color={colors.primaryText} />
            <Text style={styles.photoButtonText}>카메라로 촬영</Text>
          </Pressable>
        </View>

        {selectedImages.length > 1 && (
          <View style={styles.selectedListCard}>
            <Text style={styles.selectedListTitle}>{selectedImages.length}장 선택됨</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.thumbnailRow}>
                {selectedImages.map((selectedImage, index) => (
                  <View key={`${selectedImage.uri}-${index}`} style={styles.thumbnailWrap}>
                    <Image source={{ uri: selectedImage.uri }} style={styles.thumbnailImage} />
                    <View style={styles.thumbnailBadge}>
                      <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
          </>
        )}

        {addMode === "link" && (
          <View style={styles.linkAddCard}>
            <View style={styles.linkAddHeader}>
              <View style={styles.uploadIconCircle}>
                <Feather name="link" size={24} color={colors.accent} />
              </View>
              <View style={styles.linkAddHeaderText}>
                <Text style={styles.uploadTitle}>상품 정보 불러오기</Text>
                <Text style={styles.linkAddDescription}>
                  무신사 등 일부 쇼핑몰 링크는 상품 정보를 자동으로 가져오지 못할 수 있어요.
                </Text>
              </View>
            </View>

            <TextInput
              accessibilityLabel="상품 링크"
              style={styles.linkInput}
              value={productUrlInput}
              onChangeText={handleProductUrlInputChange}
              placeholder="무신사 등 상품 링크를 붙여넣어 주세요"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
            />
            <Text style={styles.linkSupportText}>
              무신사 등 공개된 상품 페이지나 공유 링크를 사용할 수 있어요. 소재와 실측은 페이지에 공개된 경우에만 가져와요.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="상품 정보 가져오기"
              accessibilityState={{
                disabled: isExtractingProduct || isSaving,
                busy: isExtractingProduct,
              }}
              style={[
                styles.linkExtractButton,
                (isExtractingProduct || isSaving) && styles.linkExtractButtonDisabled,
              ]}
              onPress={extractProductFromUrl}
              disabled={isExtractingProduct || isSaving}
            >
              {isExtractingProduct ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Feather name="download" size={16} color={colors.surface} />
              )}
              <Text style={styles.linkExtractButtonText}>
                {isExtractingProduct ? "가져오는 중..." : "상품 정보 가져오기"}
              </Text>
            </Pressable>

            {productLinkFailure ? (
              <View style={styles.linkErrorBox}>
                <View style={styles.linkErrorHeader}>
                  <Feather name="alert-circle" size={17} color={colors.warning} />
                  <Text style={styles.linkErrorTitle}>{productLinkFailure.title}</Text>
                </View>
                <Text style={styles.linkErrorText}>{productLinkFailure.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="사진 등록으로 전환"
                  style={styles.linkFallbackButton}
                  onPress={switchToPhotoFallback}
                >
                  <Text style={styles.linkFallbackButtonText}>
                    {productLinkFailure.kind === "missing_image"
                      ? "사진을 추가해 계속"
                      : "사진으로 빠르게 등록"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {extractedProduct && (
              <View style={styles.extractedProductCard}>
                {extractedProduct.productImageUrl ? (
                  <Image source={{ uri: extractedProduct.productImageUrl }} style={styles.linkPreviewImage} />
                ) : null}
                <View style={styles.linkPreviewBody}>
                  <Text style={styles.linkProductBrand} numberOfLines={1}>
                    {extractedProduct.brand || "브랜드 정보 없음"}
                  </Text>
                  <Text style={styles.linkProductName} numberOfLines={2}>
                    {extractedProduct.productName || "상품명 정보 없음"}
                  </Text>

                  {extractedProduct.mallName || extractedProduct.price ? (
                    <Text style={styles.linkProductMeta} numberOfLines={1}>
                      {[extractedProduct.mallName, extractedProduct.price]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}

                  {extractionSummary ? (
                    <View style={styles.extractionSummaryCard}>
                      <View style={styles.extractionSummaryHeader}>
                        <Feather
                          name={extractionSummary.isComplete ? "check-circle" : "info"}
                          size={15}
                          color={colors.accent}
                        />
                        <Text style={styles.extractionSummaryTitle}>가져온 정보</Text>
                      </View>
                      <View style={styles.extractionStatusGrid}>
                        {extractionSummary.items.map((status) => (
                          <View key={status.key} style={styles.extractionStatusItem}>
                            <Feather
                              name={status.available ? "check" : "minus"}
                              size={13}
                              color={status.available ? colors.accent : colors.mutedText}
                            />
                            <Text style={styles.extractionStatusLabel}>{status.label}</Text>
                            <Text
                              style={[
                                styles.extractionStatusValue,
                                !status.available && styles.extractionStatusValueMissing,
                              ]}
                            >
                              {status.available ? "완료" : "확인 필요"}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.extractionSummaryMessage}>
                        {extractionSummary.message}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        )}
          </>
        )}

        {analysis && (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>
              {analysis.source === "manual"
                ? "직접 등록"
                : "등록 정보 확인"}
            </Text>
            <Text style={styles.analysisText}>저장 전 세 가지만 확인해주세요</Text>
            <Text style={styles.analysisSummaryText}>
              {analysis.source === "manual"
                ? "옷 종류, 대표 색상, 실제로 입기 좋은 계절이 맞으면 바로 저장할 수 있어요."
                : "가져온 결과에서 옷 종류, 대표 색상, 계절만 확인하면 돼요."}
            </Text>

            {analysis.source === "productFallback" ? (
              <View style={styles.partialExtractionNotice}>
                <Feather name="alert-circle" size={14} color={colors.accent} />
                <Text style={styles.partialExtractionNoticeText}>
                  이미지 분석 없이 확인된 상품 정보로 계속해요. 종류, 색상, 계절을 저장 전에 확인해주세요.
                </Text>
              </View>
            ) : null}

            {registrationReviewFields.length > 0 ? (
              <View style={styles.registrationReviewNotice}>
                <Feather name="check-square" size={15} color={colors.warning} />
                <Text style={styles.registrationReviewNoticeText}>
                  저장 전 {getRegistrationReviewLabels(registrationReviewFields).join(", ")}을 확인해주세요.
                </Text>
              </View>
            ) : null}

            <Text style={styles.requiredFieldLabel}>1. 옷 종류</Text>
            {analysis.source === "manual" ? (
              <View style={styles.seasonChipRow}>
                {CATEGORY_OPTIONS.map((category) => {
                  const isActive = selectedCategory === category;

                  return (
                    <Pressable
                      key={category}
                      style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text style={[styles.seasonChipText, isActive && styles.seasonChipTextActive]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <TextInput
                style={styles.sizeInput}
                value={selectedCategory}
                onChangeText={(value) => {
                  setSelectedCategory(value);
                  markClassificationFieldAsEdited("category");
                }}
                placeholder="상의 / 하의 / 신발 / 아우터 / 액세서리"
                placeholderTextColor={colors.secondaryText}
              />
            )}

            <Text style={styles.requiredFieldLabel}>2. 대표 색상</Text>
            <TextInput
              style={styles.sizeInput}
              value={selectedColor}
              onChangeText={(value) => {
                setSelectedColor(value);
                markClassificationFieldAsEdited("color");
              }}
              placeholder="예: 블랙, 화이트, 데님"
              placeholderTextColor={colors.secondaryText}
            />

            <Text style={styles.requiredFieldLabel}>3. 입기 좋은 계절</Text>
            {seasonNeedsReview ? (
              <View style={styles.registrationReviewNotice}>
                <Feather name="alert-circle" size={15} color={colors.warning} />
                <View style={styles.registrationReviewContent}>
                  <Text style={styles.registrationReviewNoticeText}>
                    계절을 정확히 판단하기 어려워요. 실제로 입는 계절을 확인해주세요.
                    {selectedSeasons.length > 0
                      ? `\n추천: ${selectedSeasons.join(" · ")}`
                      : ""}
                  </Text>
                  {selectedSeasons.length > 0 ? (
                    <Pressable
                      style={styles.seasonConfirmButton}
                      onPress={confirmSelectedSeasons}
                    >
                      <Feather name="check" size={13} color={colors.surface} />
                      <Text style={styles.seasonConfirmButtonText}>선택한 계절로 확인</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            <View style={styles.seasonChipRow}>
              {SEASON_OPTIONS.map((season) => {
                const isActive = selectedSeasons.includes(season);

                return (
                  <Pressable
                    key={season}
                    style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                    onPress={() => updateSelectedSeason(season)}
                  >
                    <Text style={[styles.seasonChipText, isActive && styles.seasonChipTextActive]}>
                      {season}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.additionalInfoToggle}
              onPress={() => setShowAdditionalInfo((current) => !current)}
            >
              <View style={styles.additionalInfoToggleTextWrap}>
                <Text style={styles.additionalInfoToggleTitle}>추가 정보</Text>
                <Text style={styles.additionalInfoToggleDescription}>
                  상세 종류, 스타일 태그, 보유 사이즈
                </Text>
              </View>
              <Feather
                name={showAdditionalInfo ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.accent}
              />
            </Pressable>

            {showAdditionalInfo ? (
              <View style={styles.additionalInfoContent}>
                <Text style={styles.seasonLabel}>상세 종류 (선택)</Text>
                <TextInput
                  style={styles.sizeInput}
                  value={selectedDetailCategory}
                  onChangeText={(value) => {
                    setSelectedDetailCategory(value);
                    markClassificationFieldAsEdited("detailCategory");
                  }}
                  placeholder="예: 데님 셔츠, 와이드 슬랙스"
                  placeholderTextColor={colors.secondaryText}
                />

                {analysis.source !== "manual" ? (
                  <>
                    <Text style={styles.seasonLabel}>스타일 태그</Text>
                    <View style={styles.seasonChipRow}>
                      {STYLE_TAG_OPTIONS.map((tag) => {
                        const isActive = selectedStyleTags.includes(tag);

                        return (
                          <Pressable
                            key={tag}
                            style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                            onPress={() => {
                              setHasManuallyEditedStyleTags(true);
                              setSelectedStyleTags((currentTags) =>
                                toggleStyleTag(currentTags, tag)
                              );
                            }}
                          >
                            <Text
                              style={[
                                styles.seasonChipText,
                                isActive && styles.seasonChipTextActive,
                              ]}
                            >
                              {tag}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={styles.analysisHint}>최대 3개까지 선택할 수 있어요.</Text>
                  </>
                ) : null}

                <Text style={styles.seasonLabel}>보유 사이즈 (선택)</Text>
                <View style={styles.seasonChipRow}>
                  {sizeOptions.map((size) => {
                    const isActive = selectedSize === size;

                    return (
                      <Pressable
                        key={size}
                        style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                        onPress={() => setSelectedSize(size)}
                      >
                        <Text
                          style={[
                            styles.seasonChipText,
                            isActive && styles.seasonChipTextActive,
                          ]}
                        >
                          {size}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.sizeInput}
                  value={selectedSize === DEFAULT_SIZE ? "" : selectedSize}
                  onChangeText={(value) => setSelectedSize(value.trim() || DEFAULT_SIZE)}
                  placeholder={DEFAULT_SIZE}
                  placeholderTextColor={colors.secondaryText}
                />
              </View>
            ) : null}
          </View>
        )}

        {progressText ? <Text style={styles.progressText}>{progressText}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            analysis
              ? "옷장에 저장"
              : extractedProduct
                ? "상품 이미지 분석하고 등록 정보 확인"
                : selectedImages.length > 1
                  ? "선택한 사진 분석하기"
                  : "옷 사진 분석하기"
          }
          accessibilityState={{
            disabled: !canContinue || isSaving || isExtractingProduct,
            busy: isSaving,
          }}
          style={[
            styles.primaryButton,
            (!canContinue || isSaving || isExtractingProduct) && styles.primaryButtonDisabled,
          ]}
          onPress={analysis ? () => saveItem() : analyzeItem}
          disabled={!canContinue || isSaving || isExtractingProduct}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <Feather name="save" size={18} color={colors.surface} />
              <Text style={styles.primaryButtonText}>
                {analysis
                  ? "옷장에 저장"
                  : extractedProduct
                    ? "상품 이미지 분석하고 등록 정보 확인"
                    : selectedImages.length > 1
                      ? "선택한 사진 AI 분석하기"
                      : "AI 분석하기"}
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingTop: 34,
    paddingHorizontal: layout.screenPadding,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.divider,
  },
  headerSpacer: { width: 38 },
  headerEyebrow: {
    textAlign: "center",
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headerTitle: {
    textAlign: "center",
    color: colors.primaryText,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  registrationSourceCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
  },
  registrationSourceImage: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.softCard,
    resizeMode: "cover",
  },
  registrationSourceIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
  },
  registrationSourceTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  registrationSourceEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 3,
  },
  registrationSourceTitle: {
    color: colors.primaryText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  registrationSourceReset: {
    flexShrink: 0,
    borderRadius: radius.round,
    backgroundColor: colors.softCard,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
  },
  registrationSourceResetText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  linkHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: layout.cardPadding,
    marginBottom: spacing.control,
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.softCard,
    borderRadius: radius.round,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: spacing.sm,
  },
  recommendedBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "900",
  },
  linkHeroTitle: {
    color: colors.primaryText,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
  },
  linkHeroText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: 8,
  },
  modeSelectionList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.control,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
  },
  modeOptionCardPrimary: {
    paddingVertical: 16,
  },
  modeOptionCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.softCard,
  },
  modeOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.round,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modeOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  modeOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  modeOptionTitle: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "900",
  },
  modeOptionBadge: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    backgroundColor: colors.softCard,
    borderRadius: radius.round,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  modeOptionDescription: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  modeSwitchCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 5,
    gap: spacing.xs,
    marginBottom: spacing.control,
  },
  modeSwitchButton: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  modeSwitchButtonActive: {
    backgroundColor: colors.primaryText,
  },
  modeSwitchText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  modeSwitchTextActive: {
    color: colors.surface,
  },
  uploadCard: {
    height: 280,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  uploadIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  uploadTitle: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: "800",
  },
  uploadText: {
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 42,
  },
  photoButtonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.control,
  },
  photoButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoButtonText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "700",
  },
  linkAddCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 16,
    gap: spacing.control,
  },
  linkAddHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.control,
  },
  linkAddHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  linkAddDescription: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 5,
  },
  linkInput: {
    backgroundColor: colors.background,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.control,
    paddingHorizontal: 13,
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: "700",
  },
  linkExtractButton: {
    height: 46,
    borderRadius: radius.control,
    backgroundColor: colors.primaryText,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  linkExtractButtonDisabled: {
    opacity: 0.65,
  },
  linkExtractButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "800",
  },
  linkSupportText: {
    color: colors.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: -4,
  },
  linkErrorBox: {
    backgroundColor: "#fff7ed",
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: "#f1d4b3",
    padding: spacing.control,
    gap: spacing.sm,
  },
  linkErrorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  linkErrorTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
  },
  linkErrorText: {
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  linkFallbackButton: {
    alignSelf: "flex-start",
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  linkFallbackButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  linkFallbackNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.softCard,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.control,
    marginBottom: spacing.control,
  },
  linkFallbackNoticeText: {
    flex: 1,
    minWidth: 0,
    color: colors.primaryText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  extractedProductCard: {
    backgroundColor: colors.softCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: "hidden",
  },
  linkPreviewImage: {
    width: "100%",
    height: 210,
    resizeMode: "cover",
    backgroundColor: colors.softCard,
  },
  linkPreviewBody: {
    padding: spacing.control,
    gap: spacing.xs,
  },
  partialExtractionNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.softCard,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
  },
  partialExtractionNoticeText: {
    flex: 1,
    minWidth: 0,
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  registrationReviewNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1d4b3",
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
  },
  registrationReviewNoticeText: {
    flex: 1,
    minWidth: 0,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  registrationReviewContent: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  seasonConfirmButton: {
    minHeight: 32,
    borderRadius: 12,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    marginTop: 8,
  },
  seasonConfirmButtonText: {
    color: colors.surface,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  linkProductBrand: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  linkProductName: {
    color: colors.primaryText,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  linkProductMeta: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  extractionSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 11,
    gap: 9,
    marginTop: 4,
  },
  extractionSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  extractionSummaryTitle: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "900",
  },
  extractionStatusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  extractionStatusItem: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.softCard,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  extractionStatusLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.primaryText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  extractionStatusValue: {
    flexShrink: 0,
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
  },
  extractionStatusValueMissing: {
    color: colors.secondaryText,
  },
  extractionSummaryMessage: {
    color: colors.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  selectedListCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.control,
    marginTop: spacing.control,
  },
  selectedListTitle: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  thumbnailRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  thumbnailWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.softCard,
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  thumbnailBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryText,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  thumbnailBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "800",
  },
  analysisCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 16,
    marginTop: spacing.md,
  },
  analysisTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  analysisText: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  analysisSummaryText: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  requiredFieldLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: spacing.control,
  },
  additionalInfoToggle: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 9,
    paddingHorizontal: spacing.control,
    marginTop: 16,
  },
  additionalInfoToggleTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  additionalInfoToggleTitle: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "800",
  },
  additionalInfoToggleDescription: {
    color: colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  additionalInfoContent: {
    paddingTop: 10,
  },
  seasonLabel: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 6,
  },
  seasonChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  seasonChip: {
    borderRadius: radius.round,
    paddingHorizontal: spacing.control,
    paddingVertical: 7,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  seasonChipActive: {
    backgroundColor: colors.primaryText,
    borderColor: colors.primaryText,
  },
  seasonChipText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  seasonChipTextActive: {
    color: colors.surface,
  },
  sizeInput: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.softCard,
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  analysisHint: {
    color: colors.secondaryText,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
  },
  progressText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: spacing.md,
  },
  primaryButton: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryText,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "800",
  },
});
