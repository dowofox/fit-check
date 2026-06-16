import { saveClosetItem } from "@/utils/storage";
import type { AnalysisConfidence, AnalysisQuality, ProductCandidate, StyleProfile } from "@/utils/storage";
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

const ANALYZE_CLOTHES_URL = "http://192.168.219.104:3001/analyze-clothes";
const AUTO_APPLY_BACKGROUND_REMOVAL = false;
const SEASON_OPTIONS = ["봄", "여름", "가을", "겨울", "사계절"];
const DEFAULT_SIZE = "사이즈 미입력";
const TOP_SIZE_OPTIONS = ["S", "M", "L", "XL", "2XL", "3XL"];
const BOTTOM_SIZE_OPTIONS = ["28", "29", "30", "31", "32", "33", "34", "36"];
const SHOE_SIZE_OPTIONS = ["250", "255", "260", "265", "270", "275", "280", "285"];
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

type ClothesAnalysis = {
  category?: string;
  subCategory?: string;
  detailCategory?: string;
  color?: string;
  style?: string;
  styleTags?: string[];
  season?: string;
  seasons?: string[];
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

async function requestClothesAnalysis(uri: string) {
  const encodedImage = await encodeImageUri(uri);

  console.log("[add-clothes] analyze request", {
    mimeType: encodedImage.mimeType,
    base64Length: encodedImage.base64.length,
  });

  const response = await fetch(ANALYZE_CLOTHES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: encodedImage.base64,
      imageMimeType: encodedImage.mimeType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Analyze clothes failed: ${response.status}`);
  }

  const analysis = await response.json();

  console.log("[add-clothes] analyze response", {
    hasCleanImage: Boolean(analysis.cleanImageBase64),
    cleanImageLength: analysis.cleanImageBase64?.length || 0,
  });

  return analysis as ClothesAnalysis;
}

function normalizeSeasons(seasonValue?: string | string[]) {
  if (Array.isArray(seasonValue)) {
    const matchedSeasons = SEASON_OPTIONS.filter((option) =>
      seasonValue.some((season) => season.includes(option))
    );

    return matchedSeasons.length > 0 ? matchedSeasons : ["사계절"];
  }

  if (!seasonValue) return ["사계절"];

  const matchedSeasons = SEASON_OPTIONS.filter((option) => seasonValue.includes(option));

  return matchedSeasons.length > 0 ? matchedSeasons : ["사계절"];
}

function toggleSeason(currentSeasons: string[], season: string) {
  if (season === "사계절") return ["사계절"];

  const nextSeasons = currentSeasons.includes(season)
    ? currentSeasons.filter((currentSeason) => currentSeason !== season)
    : [...currentSeasons.filter((currentSeason) => currentSeason !== "사계절"), season];

  return nextSeasons.length > 0 ? nextSeasons : ["사계절"];
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

async function saveCleanImageToFile(base64?: string | null) {
  if (!base64) {
    console.log("[add-clothes] clean image missing, original image will be saved");
    return undefined;
  }

  try {
    const fileUri = `${FileSystem.documentDirectory}clean-clothes-${Date.now()}.png`;

    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log("[add-clothes] clean image saved", {
      fileUri,
      base64Length: base64.length,
    });

    return fileUri;
  } catch (error) {
    console.log("배경제거 이미지 저장 실패:", error);
    return undefined;
  }
}

async function getOptionalCleanImageUri(analysis: ClothesAnalysis) {
  if (!AUTO_APPLY_BACKGROUND_REMOVAL) {
    if (analysis.cleanImageBase64) {
      console.log("[add-clothes] clean image received but auto apply is disabled");
    }

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
  seasons = normalizeSeasons(analysis.seasons || analysis.season),
  styleTags = normalizeStyleTags(analysis.styleTags, analysis.style),
  size = DEFAULT_SIZE
) {
  const cleanImageUri = await getOptionalCleanImageUri(analysis);

  await saveClosetItem({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imageUri,
    cleanImageUri,
    category: analysis.category || "기타",
    subCategory: generalizeBrandTerms(analysis.subCategory, "분석 전"),
    detailCategory: generalizeBrandTerms(
      analysis.detailCategory || analysis.subCategory,
      "상세 분류 전"
    ),
    color: analysis.color || "색상 미분석",
    style: styleTags[0] || analysis.style || "스타일 미분석",
    styleTags,
    season: seasons.join(", "),
    seasons,
    fit: analysis.fit || "핏 미분석",
    size: size.trim() || DEFAULT_SIZE,
    ...getAnalysisDetailFields(analysis),
    styleProfile: analysis.styleProfile || undefined,
    description: generalizeBrandTerms(analysis.description, "옷 특징을 분석하지 못했어요."),
    matchTip: generalizeBrandTerms(analysis.matchTip, "어울리는 조합을 분석하지 못했어요."),
    avoidTip: generalizeBrandTerms(analysis.avoidTip, "피하면 좋은 조합을 분석하지 못했어요."),
    createdAt: new Date().toISOString(),
  });
}

export default function AddClothesScreen() {
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [analysis, setAnalysis] = useState<ClothesAnalysis | null>(null);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(["사계절"]);
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(["데일리"]);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
  const [selectedProductCandidate, setSelectedProductCandidate] = useState<ProductCandidate | null>(null);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 0.8,
    });

    if (!result.canceled) {
      const images = result.assets.map((asset) => ({ uri: asset.uri }));

      setSelectedImages(images);
      setImageUri(images[0]?.uri || "");
      setAnalysis(null);
      setProgressText("");
      setSelectedSeasons(["사계절"]);
      setSelectedStyleTags(["데일리"]);
      setSelectedSize(DEFAULT_SIZE);
      setSelectedProductCandidate(null);
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
      setSelectedSeasons(["사계절"]);
      setSelectedStyleTags(["데일리"]);
      setSelectedSize(DEFAULT_SIZE);
      setSelectedProductCandidate(null);
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

      const encodedImage = await encodeImageUri(imageUri);

      console.log("[add-clothes] analyze request", {
        mimeType: encodedImage.mimeType,
        base64Length: encodedImage.base64.length,
      });

      const response = await fetch(ANALYZE_CLOTHES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: encodedImage.base64,
          imageMimeType: encodedImage.mimeType,
        }),
      });

      const analysis = await response.json();

      console.log("[add-clothes] analyze response", {
        hasCleanImage: Boolean(analysis.cleanImageBase64),
        cleanImageLength: analysis.cleanImageBase64?.length || 0,
      });

      setAnalysis(analysis);
      setSelectedSeasons(normalizeSeasons(analysis.seasons || analysis.season));
      setSelectedStyleTags(normalizeStyleTags(analysis.styleTags, analysis.style));
      setSelectedSize(DEFAULT_SIZE);
      setSelectedProductCandidate(null);
    } catch (error) {
      console.log("옷 분석 실패:", error);
      Alert.alert("분석 실패", "옷 분석 중 문제가 생겼어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  async function analyzeAndSaveBatch() {
    if (selectedImages.length === 0 || isSaving) return;

    let savedCount = 0;
    let failedCount = 0;

    try {
      setIsSaving(true);
      setAnalysis(null);

      for (const [index, selectedImage] of selectedImages.entries()) {
        setProgressText(`${index + 1}/${selectedImages.length} 분석 중`);

        try {
          const analysis = await requestClothesAnalysis(selectedImage.uri);
          await saveAnalyzedClosetItem(selectedImage.uri, analysis);
          savedCount += 1;
        } catch (error) {
          failedCount += 1;
          console.log("[add-clothes] batch item failed", {
            index: index + 1,
            uri: selectedImage.uri,
            error,
          });
        }
      }

      setProgressText(`완료: ${savedCount}/${selectedImages.length} 저장`);

      if (savedCount > 0) {
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

  async function saveItem() {
    if (!imageUri || !analysis || isSaving) return;

    try {
      setIsSaving(true);
      const cleanImageUri = await getOptionalCleanImageUri(analysis);

      await saveClosetItem({
        id: Date.now().toString(),
        imageUri,
        cleanImageUri,
        category: analysis.category || "기타",
        subCategory: generalizeBrandTerms(analysis.subCategory, "분석 전"),
        detailCategory: generalizeBrandTerms(
          analysis.detailCategory || analysis.subCategory,
          "상세 분류 전"
        ),
        color: analysis.color || "색상 분석 전",
        style: selectedStyleTags[0] || analysis.style || "스타일 분석 전",
        styleTags: selectedStyleTags,
        season: selectedSeasons.join(", "),
        seasons: selectedSeasons,
        fit: analysis.fit || "핏 분석 전",
        size: selectedSize.trim() || DEFAULT_SIZE,
        ...getAnalysisDetailFields(analysis),
        styleProfile: analysis.styleProfile || undefined,
        description: generalizeBrandTerms(analysis.description, "옷 특징을 분석하지 못했어요."),
        matchTip: generalizeBrandTerms(analysis.matchTip, "어울리는 조합을 분석하지 못했어요."),
        avoidTip: generalizeBrandTerms(analysis.avoidTip, "피하면 좋은 조합을 분석하지 못했어요."),
        selectedProductCandidate: selectedProductCandidate || undefined,
        createdAt: new Date().toISOString(),
      });

      router.replace("/closet");
    } catch (error) {
      console.log("옷 저장 실패:", error);
      Alert.alert("저장 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  const sizeOptions = getSizeOptions(analysis?.category);

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
                단일 옷 사진을 선택해주세요. AI가 종류, 색상, 스타일을 자동 분석해요.
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

        {analysis && (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>AI 분석 결과</Text>
            <Text style={styles.analysisText}>
              {analysis.detailCategory || analysis.subCategory || analysis.category || "옷 종류 분석 전"}
            </Text>

            <Text style={styles.seasonLabel}>비슷한 상품 예시</Text>
            <Pressable
              style={[
                styles.productCandidateCard,
                !selectedProductCandidate && styles.productCandidateCardActive,
              ]}
              onPress={() => setSelectedProductCandidate(null)}
            >
              <View style={styles.productCandidateHeader}>
                <Text style={styles.productCandidateTitle}>선택 안 함</Text>
                {!selectedProductCandidate && (
                  <Feather name="check-circle" size={16} color="#8c6f47" />
                )}
              </View>
              <Text style={styles.productCandidateReason}>
                브랜드나 상품명을 참고용으로 저장하지 않아요.
              </Text>
            </Pressable>

            {analysis.productCandidates?.length ? (
              <View style={styles.productCandidateList}>
                {analysis.productCandidates.map((candidate, index) => {
                  const isActive =
                    selectedProductCandidate?.brand === candidate.brand &&
                    selectedProductCandidate?.productName === candidate.productName;

                  return (
                    <Pressable
                      key={`${candidate.brand}-${candidate.productName}-${index}`}
                      style={[
                        styles.productCandidateCard,
                        isActive && styles.productCandidateCardActive,
                      ]}
                      onPress={() => setSelectedProductCandidate(candidate)}
                    >
                      <View style={styles.productCandidateHeader}>
                        <Text style={styles.productCandidateTitle} numberOfLines={1}>
                          {candidate.brand}
                        </Text>
                        {isActive && <Feather name="check-circle" size={16} color="#8c6f47" />}
                      </View>
                      <Text style={styles.productCandidateName} numberOfLines={1}>
                        {candidate.productName}
                      </Text>
                      <Text style={styles.productCandidateReason} numberOfLines={2}>
                        {candidate.reason}
                      </Text>
                      {typeof candidate.confidence === "number" && (
                        <Text style={styles.productCandidateConfidence}>
                          참고 유사도 {Math.round(candidate.confidence * 100)}%
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.analysisHint}>
                확실한 참고 상품 후보가 없으면 표시하지 않아요.
              </Text>
            )}

            <Text style={styles.seasonLabel}>스타일 태그</Text>
            <View style={styles.seasonChipRow}>
              {STYLE_TAG_OPTIONS.map((tag) => {
                const isActive = selectedStyleTags.includes(tag);

                return (
                  <Pressable
                    key={tag}
                    style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                    onPress={() => setSelectedStyleTags((currentTags) => toggleStyleTag(currentTags, tag))}
                  >
                    <Text style={[styles.seasonChipText, isActive && styles.seasonChipTextActive]}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.analysisHint}>최대 3개까지 선택할 수 있어요.</Text>

            <Text style={styles.seasonLabel}>계절</Text>
            <View style={styles.seasonChipRow}>
              {SEASON_OPTIONS.map((season) => {
                const isActive = selectedSeasons.includes(season);

                return (
                  <Pressable
                    key={season}
                    style={[styles.seasonChip, isActive && styles.seasonChipActive]}
                    onPress={() => setSelectedSeasons((currentSeasons) => toggleSeason(currentSeasons, season))}
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
          style={[styles.primaryButton, (!imageUri || isSaving) && styles.primaryButtonDisabled]}
          onPress={analysis ? saveItem : analyzeItem}
          disabled={!imageUri || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="save" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {analysis ? "선택한 정보로 저장" : selectedImages.length > 1 ? "선택한 사진 AI 분석하기" : "AI 분석하기"}
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
    marginBottom: 16,
  },
  productCandidateList: {
    gap: 8,
    marginBottom: 8,
  },
  productCandidateCard: {
    backgroundColor: "#f4eee7",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8ded2",
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  productCandidateCardActive: {
    backgroundColor: "#fff",
    borderColor: "#8c6f47",
  },
  productCandidateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  productCandidateTitle: {
    flex: 1,
    color: "#111",
    fontSize: 13,
    fontWeight: "800",
  },
  productCandidateName: {
    color: "#111",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  productCandidateReason: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 5,
  },
  productCandidateConfidence: {
    color: "#8c6f47",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
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
