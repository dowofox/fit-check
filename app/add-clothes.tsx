import { API_ENDPOINTS } from "@/utils/api";
import { normalizeProductColor } from "@/utils/color";
import {
  getRegistrationReviewLabels,
  normalizeClosetRegistrationBasics,
  normalizeClosetSeasons,
} from "@/utils/closetRegistration";
import {
  applyProductAnalysisTarget,
  getProductAnalysisTarget,
  getProductClassificationNotice,
  inferProductAttributesFromConfirmedProduct,
} from "@/utils/productClassification";
import {
  getConfirmedProductSeasonInference,
  resolveRegistrationSeasonInference,
} from "@/utils/seasonInference";
import { getProductSizeGuideStatusMessage } from "@/utils/productSizeGuideStatus";
import { normalizeSize } from "@/utils/sizeMatch";
import { saveClosetItem } from "@/utils/storage";
import type {
  AnalysisConfidence,
  AnalysisQuality,
  ClosetItem,
  ConfirmedProduct,
  GarmentProfile,
  ProductCandidate,
  ProductClassificationField,
  ProductSizeGuide,
  SeasonSource,
  StyleProfile,
} from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
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
const DEFAULT_SIZE = "사이즈 미입력";
const TOP_SIZE_OPTIONS = ["FREE", "S", "M", "L", "XL", "2XL", "3XL"];
const BOTTOM_SIZE_OPTIONS = ["FREE", "28", "29", "30", "31", "32", "33", "34", "36"];
const SHOE_SIZE_OPTIONS = ["FREE", "250", "255", "260", "265", "270", "275", "280", "285"];
const COMMON_SIZE_OPTIONS = [
  ...TOP_SIZE_OPTIONS,
  ...BOTTOM_SIZE_OPTIONS,
  ...SHOE_SIZE_OPTIONS,
].filter((value, index, array) => array.indexOf(value) === index);

function normalizeClosetSize(size?: string) {
  const value = size?.trim();
  if (!value || value === DEFAULT_SIZE) return DEFAULT_SIZE;
  return normalizeSize(value) || DEFAULT_SIZE;
}
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

type ClothesAnalysis = {
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

type EncodedImage = {
  base64: string;
  mimeType: string;
};

type SelectedImage = {
  uri: string;
};

type AddMode = "photo" | "link" | "manual";

type ExtractedProduct = {
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

type ProductLinkFailureKind =
  | "invalid_link"
  | "unsupported_shop"
  | "connection"
  | "missing_image"
  | "unknown";

type ProductLinkFailure = {
  kind: ProductLinkFailureKind;
  title: string;
  message: string;
};

type ProductExtractionErrorResponse = {
  error?: string;
  message?: string;
};

function getProductLinkFailure(
  errorCode?: string,
  status?: number
): ProductLinkFailure {
  if (
    status === 400 ||
    [
      "product_url_required",
      "invalid_product_url",
      "unsupported_product_url_protocol",
    ].includes(errorCode || "")
  ) {
    return {
      kind: "invalid_link",
      title: "링크를 확인해주세요",
      message: "상품 페이지의 전체 주소를 다시 붙여넣어 주세요.",
    };
  }

  if (status === 422 || errorCode === "product_information_not_found") {
    return {
      kind: "unsupported_shop",
      title: "이 쇼핑몰은 자동 등록이 어려워요",
      message: "등록에 필요한 상품 정보를 찾지 못했어요. 사진으로 빠르게 등록할 수 있어요.",
    };
  }

  if (
    ["product_page_unreachable", "product_page_timeout"].includes(errorCode || "") ||
    status === 502 ||
    status === 504
  ) {
    return {
      kind: "connection",
      title: "상품 페이지에 연결하지 못했어요",
      message: "네트워크 상태를 확인한 뒤 다시 시도하거나 사진으로 등록해주세요.",
    };
  }

  return {
    kind: "unknown",
    title: "상품 정보를 가져오지 못했어요",
    message: "잠시 후 다시 시도하거나 사진으로 빠르게 등록해주세요.",
  };
}

function getImageDataFromDataUrl(dataUrl: string): EncodedImage {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] || "image/jpeg";

  return {
    base64,
    mimeType,
  };
}

async function encodeImageUri(uri: string) {
  const imageResponse = await fetch(uri);
  const imageBlob = await imageResponse.blob();

  return new Promise<EncodedImage>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(getImageDataFromDataUrl(result));
    };

    reader.onerror = reject;
    reader.readAsDataURL(imageBlob);
  });
}

async function requestClothesAnalysis(uri: string, product?: ExtractedProduct | null) {
  const encodedImage = await encodeImageUri(uri);
  const productContext = product
    ? getProductAnalysisTarget({
        productName: product.productName,
        productCategory: product.productCategory,
        brand: product.brand,
        productColor: product.productColor,
        materialComposition: product.materialComposition,
      })
    : undefined;

  const response = await fetch(API_ENDPOINTS.analyzeClothes, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: encodedImage.base64,
      imageMimeType: encodedImage.mimeType,
      ...(productContext ? { productContext } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Analyze clothes failed: ${response.status}`);
  }

  const analysis = await response.json();

  return applyProductAnalysisTarget(analysis as ClothesAnalysis, productContext);
}

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

function getMaterialPreviewText(materialComposition?: ConfirmedProduct["materialComposition"]) {
  const summary = materialComposition?.summary?.trim();
  if (!summary) return "";

  const totalPercentage = materialComposition?.items?.reduce(
    (total, item) =>
      typeof item.percentage === "number" ? total + item.percentage : total,
    0
  );

  if (typeof totalPercentage === "number" && totalPercentage > 105) {
    return "소재 정보 확인 필요";
  }

  return summary;
}

function getSizeGuidePreviewText(product?: ExtractedProduct | null) {
  if (!product) return "";

  return getProductSizeGuideStatusMessage(
    product.sizeGuideStatus,
    Boolean(product.productSizeGuide?.sizes?.length)
  );
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

  await saveClosetItem({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imageUri,
    cleanImageUri,
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
    seasonNeedsReview: analysis.seasonNeedsReview ?? registration.reviewFields.includes("season"),
    fit: analysis.fit || "핏 미분석",
    size: normalizeClosetSize(size),
    ...getAnalysisDetailFields(analysis),
    styleProfile: analysis.styleProfile || undefined,
    garmentProfile: analysis.garmentProfile || undefined,
    description: generalizeBrandTerms(analysis.description, "옷 특징을 분석하지 못했어요."),
    matchTip: generalizeBrandTerms(analysis.matchTip, "어울리는 조합을 분석하지 못했어요."),
    avoidTip: generalizeBrandTerms(analysis.avoidTip, "피하면 좋은 조합을 분석하지 못했어요."),
    createdAt: new Date().toISOString(),
  });

  return {
    needsSeasonReview:
      analysis.seasonNeedsReview === true || registration.reviewFields.includes("season"),
  };
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
  const [manuallyEditedClassificationFields, setManuallyEditedClassificationFields] =
    useState<ProductClassificationField[]>([]);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
  const [productUrlInput, setProductUrlInput] = useState("");
  const [productLinkFailure, setProductLinkFailure] = useState<ProductLinkFailure | null>(null);
  const [extractedProduct, setExtractedProduct] = useState<ExtractedProduct | null>(null);

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
    setManuallyEditedClassificationFields([]);
    setSelectedSize(DEFAULT_SIZE);
  }

  function switchAddMode(nextMode: AddMode) {
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
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: !extractedProduct,
      selectionLimit: extractedProduct ? 1 : 0,
      quality: 0.8,
    });

    if (!result.canceled) {
      const images = result.assets.map((asset) => ({ uri: asset.uri }));

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
      setManuallyEditedClassificationFields([]);
      setSelectedSize(DEFAULT_SIZE);
    }
  }

  async function takePhoto() {
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
      setManuallyEditedClassificationFields([]);
      setSelectedSize(DEFAULT_SIZE);
    }
  }

  async function extractProductFromUrl() {
    const productUrl = productUrlInput.trim();

    if (!productUrl) {
      setProductLinkFailure(getProductLinkFailure("product_url_required", 400));
      return;
    }

    if (isExtractingProduct) return;

    try {
      setIsExtractingProduct(true);
      setProductLinkFailure(null);
      setExtractedProduct(null);
      setImageUri("");
      setSelectedImages([]);
      resetAnalysisState();

      const response = await fetch(API_ENDPOINTS.extractProduct, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: productUrl }),
      });

      if (!response.ok) {
        const errorResponse = (await response.json().catch(() => ({}))) as ProductExtractionErrorResponse;
        setProductLinkFailure(getProductLinkFailure(errorResponse.error, response.status));
        return;
      }

      const product = (await response.json()) as ExtractedProduct;

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
      console.error("상품 정보 추출 실패:", error);
      setProductLinkFailure(getProductLinkFailure("product_page_unreachable"));
    } finally {
      setIsExtractingProduct(false);
    }
  }

  async function analyzeItem() {
    if (!imageUri || isSaving) return;

    if (selectedImages.length > 1) {
      await analyzeAndSaveBatch();
      return;
    }

    try {
      setIsSaving(true);
      const nextAnalysis = await requestClothesAnalysis(imageUri, extractedProduct);
      applyAnalysisToForm({ ...nextAnalysis, source: "image" });
    } catch (error) {
      console.error("옷 분석 실패:", error);

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
      setIsSaving(false);
    }
  }

  async function analyzeAndSaveBatch() {
    if (selectedImages.length === 0 || isSaving) return;

    let savedCount = 0;
    let failedCount = 0;
    let seasonReviewCount = 0;

    try {
      setIsSaving(true);
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
          console.error("[add-clothes] batch item failed", {
            index: index + 1,
            uri: selectedImage.uri,
            error,
          });
        }
      }

      setProgressText(`완료: ${savedCount}/${selectedImages.length} 저장`);

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

        if (failedCount > 0) {
          Alert.alert("일괄 저장 완료", `${savedCount}개 저장, ${failedCount}개 실패했어요.`);
        }

        router.replace("/closet");
        return;
      }

      Alert.alert("저장 실패", "선택한 사진을 저장하지 못했어요. 서버 로그를 확인해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveItem(allowUncertainValues = false) {
    if ((!imageUri && addMode !== "manual") || !analysis || isSaving) return;

    if (addMode === "manual" && !selectedCategory.trim()) {
      Alert.alert("종류를 선택해주세요", "옷의 카테고리를 선택해야 저장할 수 있어요.");
      return;
    }

    if (addMode === "manual" && !selectedColor.trim()) {
      Alert.alert("색상을 입력해주세요", "대표 색상을 입력하면 코디 추천에 활용할 수 있어요.");
      return;
    }

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
    const resolvedSeasons = resolvedSeasonInference.seasons;
    const resolvedSeasonSource = resolvedSeasonInference.source;
    const resolvedSeasonNeedsReview = resolvedSeasonInference.needsReview;
    const registration = normalizeClosetRegistrationBasics({
      category: selectedCategory || analysis.category,
      color: selectedColor || analysis.color,
      seasons: resolvedSeasons,
    });
    const reviewFields = [...registration.reviewFields];
    if (resolvedSeasonNeedsReview && !reviewFields.includes("season")) {
      reviewFields.push("season");
    }

    if (!allowUncertainValues && reviewFields.length > 0) {
      Alert.alert(
        "등록 정보를 확인해주세요",
        `${getRegistrationReviewLabels(reviewFields).join(", ")} 정보가 불확실해요. 수정하거나 현재 값으로 저장할 수 있어요.`,
        [
          { text: "돌아가기", style: "cancel" },
          { text: "현재 값으로 저장", onPress: () => void saveItem(true) },
        ]
      );
      return;
    }

    try {
      setIsSaving(true);
      const cleanImageUri = await getOptionalCleanImageUri(analysis);
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
        id: Date.now().toString(),
        imageUri,
        cleanImageUri,
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
        size: normalizeClosetSize(selectedSize),
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
        createdAt: new Date().toISOString(),
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

      await saveClosetItem(finalItem);

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
      console.error("옷 저장 실패:", error);
      Alert.alert("저장 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  const sizeOptions = getSizeOptions(selectedCategory || analysis?.category);
  const canContinue = addMode === "manual" ? Boolean(analysis) : Boolean(imageUri);
  const registrationReviewFields = analysis
    ? (() => {
        const fields = normalizeClosetRegistrationBasics({
        category: selectedCategory || analysis.category,
        color: selectedColor || analysis.color,
        seasons: selectedSeasons,
        }).reviewFields;
        if (seasonNeedsReview && !fields.includes("season")) fields.push("season");
        return fields;
      })()
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom + 56, 96) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#111" />
          </Pressable>

          <View>
            <Text style={styles.headerEyebrow}>ADD CLOTHES</Text>
            <Text style={styles.headerTitle}>옷 추가</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.linkHeroCard}>
          <View style={styles.recommendedBadge}>
            <Feather name="check" size={12} color="#8c6f47" />
            <Text style={styles.recommendedBadgeText}>가장 정확해요</Text>
          </View>
          <Text style={styles.linkHeroTitle}>상품 링크로 정확하게 등록</Text>
          <Text style={styles.linkHeroText}>
            상품 링크를 붙여넣으면 공식 상품명, 브랜드, 이미지, 소재와 실측표를 가져와 더 정확한 코디와 사이즈 추천에 활용해요.
          </Text>
        </View>

        <View style={styles.modeSelectionList}>
          <Pressable
            style={[
              styles.modeOptionCard,
              styles.modeOptionCardPrimary,
              addMode === "link" && styles.modeOptionCardActive,
            ]}
            onPress={() => switchAddMode("link")}
          >
            <View style={styles.modeOptionIcon}>
              <Feather name="link" size={18} color="#8c6f47" />
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
            {addMode === "link" ? <Feather name="check-circle" size={18} color="#8c6f47" /> : null}
          </Pressable>

          <Pressable
            style={[styles.modeOptionCard, addMode === "photo" && styles.modeOptionCardActive]}
            onPress={() => switchAddMode("photo")}
          >
            <View style={styles.modeOptionIcon}>
              <Feather name="camera" size={18} color="#8c6f47" />
            </View>
            <View style={styles.modeOptionTextWrap}>
              <Text style={styles.modeOptionTitle}>사진으로 빠르게 추가</Text>
              <Text style={styles.modeOptionDescription}>
                링크가 없는 옷을 사진으로 간단히 등록해요.
              </Text>
            </View>
            {addMode === "photo" ? <Feather name="check-circle" size={18} color="#8c6f47" /> : null}
          </Pressable>

          <Pressable
            style={[styles.modeOptionCard, addMode === "manual" && styles.modeOptionCardActive]}
            onPress={() => switchAddMode("manual")}
          >
            <View style={styles.modeOptionIcon}>
              <Feather name="edit-3" size={18} color="#8c6f47" />
            </View>
            <View style={styles.modeOptionTextWrap}>
              <Text style={styles.modeOptionTitle}>직접 입력해서 추가</Text>
              <Text style={styles.modeOptionDescription}>
                링크와 사진이 없을 때 필요한 정보만 입력해요.
              </Text>
            </View>
            {addMode === "manual" ? <Feather name="check-circle" size={18} color="#8c6f47" /> : null}
          </Pressable>
        </View>

        {addMode === "photo" && (
          <>
        {extractedProduct ? (
          <View style={styles.linkFallbackNotice}>
            <Feather name="check-circle" size={17} color="#8c6f47" />
            <Text style={styles.linkFallbackNoticeText}>
              가져온 상품 정보는 유지됐어요. 옷 사진을 추가하면 함께 저장해요.
            </Text>
          </View>
        ) : null}
        <Pressable style={styles.uploadCard} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <>
              <View style={styles.uploadIconCircle}>
                <Feather name="image" size={28} color="#8c6f47" />
              </View>
              <Text style={styles.uploadTitle}>옷 사진 선택</Text>
              <Text style={styles.uploadText}>
                사진으로는 종류, 색상 등 기본 정보를 빠르게 등록해요. 정확한 실측과 소재 정보는 상품 링크가 더 정확해요.
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.photoButtonRow}>
          <Pressable style={styles.photoButton} onPress={pickImage}>
            <Feather name="image" size={18} color="#111" />
            <Text style={styles.photoButtonText}>앨범에서 선택</Text>
          </Pressable>

          <Pressable style={styles.photoButton} onPress={takePhoto}>
            <Feather name="camera" size={18} color="#111" />
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
                <Feather name="link" size={24} color="#8c6f47" />
              </View>
              <View style={styles.linkAddHeaderText}>
                <Text style={styles.uploadTitle}>상품 정보 불러오기</Text>
                <Text style={styles.linkAddDescription}>
                  무신사 등 일부 쇼핑몰 링크는 상품 정보를 자동으로 가져오지 못할 수 있어요.
                </Text>
              </View>
            </View>

            <TextInput
              style={styles.linkInput}
              value={productUrlInput}
              onChangeText={(value) => {
                setProductUrlInput(value);
                setProductLinkFailure(null);
              }}
              placeholder="무신사 등 상품 링크를 붙여넣어 주세요"
              placeholderTextColor="#b2aaa1"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.linkSupportText}>
              상품 페이지 URL을 길게 눌러 붙여넣거나 공유 링크를 붙여넣어 주세요.
            </Text>

            <Pressable
              style={[
                styles.linkExtractButton,
                isExtractingProduct && styles.linkExtractButtonDisabled,
              ]}
              onPress={extractProductFromUrl}
              disabled={isExtractingProduct}
            >
              {isExtractingProduct ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="download" size={16} color="#fff" />
              )}
              <Text style={styles.linkExtractButtonText}>
                {isExtractingProduct ? "가져오는 중..." : "상품 정보 가져오기"}
              </Text>
            </Pressable>

            {productLinkFailure ? (
              <View style={styles.linkErrorBox}>
                <View style={styles.linkErrorHeader}>
                  <Feather name="alert-circle" size={17} color="#b45309" />
                  <Text style={styles.linkErrorTitle}>{productLinkFailure.title}</Text>
                </View>
                <Text style={styles.linkErrorText}>{productLinkFailure.message}</Text>
                <Pressable style={styles.linkFallbackButton} onPress={switchToPhotoFallback}>
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
                  {extractedProduct.extractionStatus === "partial" ? (
                    <View style={styles.partialExtractionNotice}>
                      <Feather name="info" size={14} color="#8c6f47" />
                      <Text style={styles.partialExtractionNoticeText}>
                        일부 공식 정보만 확인했어요. 비어 있는 정보는 저장 후 옷 상세에서 수정할 수 있어요.
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.linkProductBrand} numberOfLines={1}>
                    {extractedProduct.brand || "브랜드 정보 없음"}
                  </Text>
                  <Text style={styles.linkProductName} numberOfLines={2}>
                    {extractedProduct.productName || "상품명 정보 없음"}
                  </Text>

                  <View style={styles.linkPreviewMetaList}>
                    <Text style={styles.linkPreviewMetaText}>
                      쇼핑몰: {extractedProduct.mallName || "확인 필요"}
                    </Text>
                    <Text style={styles.linkPreviewMetaText}>
                      가격: {extractedProduct.price || "확인 필요"}
                    </Text>
                    <Text style={styles.linkPreviewMetaText}>
                      소재: {getMaterialPreviewText(extractedProduct.materialComposition) || "확인 필요"}
                    </Text>
                    <Text style={styles.linkPreviewMetaText}>
                      {getSizeGuidePreviewText(extractedProduct)}
                    </Text>
                  </View>

                  <Text style={styles.linkProductUrl} numberOfLines={1}>
                    {extractedProduct.productUrl}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {analysis && (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>
              {analysis.source === "manual"
                ? "직접 등록 정보"
                : extractedProduct
                  ? "등록 정보 확인"
                  : "빠른 등록 정보"}
            </Text>
            <Text style={styles.analysisText}>
              {analysis.detailCategory || analysis.subCategory || analysis.category || "옷 종류 분석 전"}
            </Text>
            <Text style={styles.analysisSummaryText}>
              {analysis.source === "manual"
                ? "사진 없이 저장할 최소 정보예요. 종류, 색상, 계절과 보유 사이즈를 확인해주세요."
                : extractedProduct
                ? "공식 상품 정보는 위 미리보기를 기준으로 저장돼요. 아래 종류, 색상, 계절과 보유 사이즈를 확인해주세요."
                : "사진 등록은 종류, 색상, 계절, 스타일 같은 기본 정보만 빠르게 확인해요. 실측과 공식 소재가 필요하면 상품 링크 등록을 사용해주세요."}
            </Text>

            {analysis.source === "productFallback" ? (
              <View style={styles.partialExtractionNotice}>
                <Feather name="alert-circle" size={14} color="#8c6f47" />
                <Text style={styles.partialExtractionNoticeText}>
                  이미지 분석 없이 확인된 상품 정보로 계속해요. 종류, 색상, 계절을 저장 전에 확인해주세요.
                </Text>
              </View>
            ) : null}

            {registrationReviewFields.length > 0 ? (
              <View style={styles.registrationReviewNotice}>
                <Feather name="check-square" size={15} color="#b45309" />
                <Text style={styles.registrationReviewNoticeText}>
                  저장 전 {getRegistrationReviewLabels(registrationReviewFields).join(", ")}을 확인해주세요.
                </Text>
              </View>
            ) : null}

            <Text style={styles.seasonLabel}>카테고리</Text>
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
                placeholderTextColor="#777064"
              />
            )}

            <Text style={styles.seasonLabel}>
              {analysis.source === "manual" ? "상세 종류 (선택)" : "상세 종류"}
            </Text>
            <TextInput
              style={styles.sizeInput}
              value={selectedDetailCategory}
              onChangeText={(value) => {
                setSelectedDetailCategory(value);
                markClassificationFieldAsEdited("detailCategory");
              }}
              placeholder="예: 데님 셔츠, 와이드 슬랙스"
              placeholderTextColor="#777064"
            />

            <Text style={styles.seasonLabel}>색상</Text>
            <TextInput
              style={styles.sizeInput}
              value={selectedColor}
              onChangeText={(value) => {
                setSelectedColor(value);
                markClassificationFieldAsEdited("color");
              }}
              placeholder="예: 블랙, 화이트, 데님"
              placeholderTextColor="#777064"
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
                          setSelectedStyleTags((currentTags) => toggleStyleTag(currentTags, tag));
                        }}
                      >
                        <Text style={[styles.seasonChipText, isActive && styles.seasonChipTextActive]}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.analysisHint}>최대 3개까지 선택할 수 있어요.</Text>
              </>
            ) : null}

            <Text style={styles.seasonLabel}>입기 좋은 계절</Text>
            {seasonNeedsReview ? (
              <View style={styles.registrationReviewNotice}>
                <Feather name="alert-circle" size={15} color="#b45309" />
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
                      <Feather name="check" size={13} color="#fff" />
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

            <Text style={styles.seasonLabel}>사이즈</Text>
            <View style={styles.seasonChipRow}>
              {sizeOptions.map((size) => {
                const isActive = selectedSize === size;

                return (
                  <Pressable
                    key={size}
                    style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                    onPress={() => setSelectedSize(size)}
                  >
                    <Text style={[styles.seasonChipText, isActive && styles.seasonChipTextActive]}>
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
              placeholderTextColor="#777064"
            />

            {analysis.cleanImageBase64 && (
              <Text style={styles.analysisHint}>배경제거 결과가 있지만 현재는 원본 사진으로 저장돼요.</Text>
            )}
          </View>
        )}

        {progressText ? <Text style={styles.progressText}>{progressText}</Text> : null}

        <Pressable
          style={[
            styles.primaryButton,
            (!canContinue || isSaving || isExtractingProduct) && styles.primaryButtonDisabled,
          ]}
          onPress={analysis ? () => saveItem() : analyzeItem}
          disabled={!canContinue || isSaving || isExtractingProduct}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="save" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {analysis
                  ? analysis.source === "manual"
                    ? "직접 입력한 옷 저장"
                    : "선택한 정보로 저장"
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
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  container: {
    flexGrow: 1,
    paddingTop: 34,
    paddingHorizontal: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e8ded2",
  },
  headerSpacer: { width: 38 },
  headerEyebrow: {
    textAlign: "center",
    color: "#8c6f47",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headerTitle: {
    textAlign: "center",
    color: "#111",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  linkHeroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e8ded2",
    padding: 18,
    marginBottom: 12,
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f4eee7",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: 10,
  },
  recommendedBadgeText: {
    color: "#8c6f47",
    fontSize: 11,
    fontWeight: "900",
  },
  linkHeroTitle: {
    color: "#111",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
  },
  linkHeroText: {
    color: "#777064",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: 8,
  },
  modeSelectionList: {
    gap: 10,
    marginBottom: 14,
  },
  modeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e8ded2",
    padding: 14,
  },
  modeOptionCardPrimary: {
    paddingVertical: 16,
  },
  modeOptionCardActive: {
    borderColor: "#8c6f47",
    backgroundColor: "#fbf8f3",
  },
  modeOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#f4eee7",
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
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },
  modeOptionBadge: {
    color: "#8c6f47",
    fontSize: 10,
    fontWeight: "900",
    backgroundColor: "#f4eee7",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  modeOptionDescription: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  modeSwitchCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e8ded2",
    padding: 5,
    gap: 6,
    marginBottom: 12,
  },
  modeSwitchButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  modeSwitchButtonActive: {
    backgroundColor: "#111",
  },
  modeSwitchText: {
    color: "#8c6f47",
    fontSize: 13,
    fontWeight: "800",
  },
  modeSwitchTextActive: {
    color: "#fff",
  },
  uploadCard: {
    height: 280,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ded2",
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
    backgroundColor: "#f4eee7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  uploadTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "800",
  },
  uploadText: {
    color: "#777064",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 42,
  },
  photoButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  photoButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ded2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoButtonText: {
    color: "#111",
    fontSize: 13,
    fontWeight: "700",
  },
  linkAddCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e8ded2",
    padding: 16,
    gap: 12,
  },
  linkAddHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linkAddHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  linkAddDescription: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 5,
  },
  linkInput: {
    backgroundColor: "#f7f2eb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8ded2",
    paddingVertical: 12,
    paddingHorizontal: 13,
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },
  linkExtractButton: {
    height: 46,
    borderRadius: 16,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  linkExtractButtonDisabled: {
    opacity: 0.65,
  },
  linkExtractButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  linkSupportText: {
    color: "#777064",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: -4,
  },
  linkErrorBox: {
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1d4b3",
    padding: 12,
    gap: 10,
  },
  linkErrorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  linkErrorTitle: {
    flex: 1,
    minWidth: 0,
    color: "#8a3f08",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
  },
  linkErrorText: {
    color: "#b45309",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  linkFallbackButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ded2",
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  linkFallbackButtonText: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
  },
  linkFallbackNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f4eee7",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8ded2",
    padding: 12,
    marginBottom: 12,
  },
  linkFallbackNoticeText: {
    flex: 1,
    minWidth: 0,
    color: "#625a51",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  extractedProductCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e8ded2",
    overflow: "hidden",
  },
  linkPreviewImage: {
    width: "100%",
    height: 210,
    resizeMode: "cover",
    backgroundColor: "#f4eee7",
  },
  linkPreviewBody: {
    padding: 12,
    gap: 6,
  },
  partialExtractionNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#f4eee7",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  partialExtractionNoticeText: {
    flex: 1,
    minWidth: 0,
    color: "#777064",
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
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  registrationReviewNoticeText: {
    flex: 1,
    minWidth: 0,
    color: "#b45309",
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
    backgroundColor: "#8c6f47",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  seasonConfirmButtonText: {
    color: "#fff",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  linkProductBrand: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "800",
  },
  linkProductName: {
    color: "#111",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  linkProductUrl: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  linkPreviewMetaList: {
    gap: 4,
    marginTop: 4,
    marginBottom: 2,
  },
  linkPreviewMetaText: {
    color: "#625a51",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  selectedListCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e8ded2",
    padding: 12,
    marginTop: 12,
  },
  selectedListTitle: {
    color: "#111",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
  },
  thumbnailRow: {
    flexDirection: "row",
    gap: 10,
  },
  thumbnailWrap: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f4eee7",
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
    borderRadius: 10,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  thumbnailBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  analysisCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e8ded2",
    padding: 16,
    marginTop: 14,
  },
  analysisTitle: {
    color: "#8c6f47",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 6,
  },
  analysisText: {
    color: "#111",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  analysisSummaryText: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: 14,
  },
  seasonLabel: {
    color: "#111",
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#f4eee7",
    borderWidth: 1,
    borderColor: "#e8ded2",
  },
  seasonChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  seasonChipText: {
    color: "#111",
    fontSize: 12,
    fontWeight: "700",
  },
  seasonChipTextActive: {
    color: "#fff",
  },
  sizeInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8ded2",
    backgroundColor: "#f4eee7",
    color: "#111",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 14,
    marginTop: 10,
  },
  analysisHint: {
    color: "#777064",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
  },
  progressText: {
    color: "#8c6f47",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 14,
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#111",
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
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
