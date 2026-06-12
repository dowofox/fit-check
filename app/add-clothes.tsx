import { saveClosetItem } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
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
  View,
} from "react-native";

const ANALYZE_CLOTHES_URL = "http://192.168.219.104:3001/analyze-clothes";
const SEASON_OPTIONS = ["봄", "여름", "가을", "겨울", "사계절"];

type ClothesAnalysis = {
  category?: string;
  subCategory?: string;
  detailCategory?: string;
  color?: string;
  style?: string;
  season?: string;
  seasons?: string[];
  fit?: string;
  size?: string;
  description?: string;
  matchTip?: string;
  avoidTip?: string;
};

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

export default function AddClothesScreen() {
  const [imageUri, setImageUri] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [analysis, setAnalysis] = useState<ClothesAnalysis | null>(null);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(["사계절"]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setAnalysis(null);
      setSelectedSeasons(["사계절"]);
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
      setImageUri(result.assets[0].uri);
      setAnalysis(null);
      setSelectedSeasons(["사계절"]);
    }
  }

  async function analyzeItem() {
    if (!imageUri || isSaving) return;

    try {
      setIsSaving(true);

      const imageResponse = await fetch(imageUri);
      const imageBlob = await imageResponse.blob();

      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64);
        };

        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      const response = await fetch(ANALYZE_CLOTHES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      });

      const analysis = await response.json();

      setAnalysis(analysis);
      setSelectedSeasons(normalizeSeasons(analysis.seasons || analysis.season));
    } catch (error) {
      console.log("옷 분석 실패:", error);
      Alert.alert("분석 실패", "옷 분석 중 문제가 생겼어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveItem() {
    if (!imageUri || !analysis || isSaving) return;

    try {
      setIsSaving(true);

      await saveClosetItem({
        id: Date.now().toString(),
        imageUri,
        category: analysis.category || "기타",
        subCategory: analysis.subCategory || "분석 전",
        detailCategory: analysis.detailCategory || analysis.subCategory || "상세 분류 전",
        color: analysis.color || "색상 분석 전",
        style: analysis.style || "스타일 분석 전",
        season: selectedSeasons.join(", "),
        seasons: selectedSeasons,
        fit: analysis.fit || "핏 분석 전",
        size: analysis.size || "사이즈 미입력",
        description: analysis.description || "옷 특징을 분석하지 못했어요.",
        matchTip: analysis.matchTip || "어울리는 조합을 분석하지 못했어요.",
        avoidTip: analysis.avoidTip || "피하면 좋은 조합을 분석하지 못했어요.",
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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

        {analysis && (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>AI 분석 결과</Text>
            <Text style={styles.analysisText}>
              {analysis.detailCategory || analysis.subCategory || analysis.category || "옷 종류 분석 전"}
            </Text>

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
          </View>
        )}

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
                {analysis ? "선택한 계절로 저장" : "AI 분석하기"}
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

  uploadCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    minHeight: 360,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 16,
    overflow: "hidden",
  },

  uploadIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    borderWidth: 1,
    borderColor: "#e6d9cb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  uploadTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },

  uploadText: {
    fontSize: 14,
    color: "#6b6258",
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },

  previewImage: {
    width: "100%",
    height: 360,
    borderRadius: 22,
    backgroundColor: "#ddd",
  },

  photoButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  photoButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  photoButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },

  analysisCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },

  analysisTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },

  analysisText: {
    color: "#6b6258",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },

  seasonLabel: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
  },

  seasonChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  seasonChip: {
    backgroundColor: "#faf8f5",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },

  seasonChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },

  seasonChipText: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },

  seasonChipTextActive: {
    color: "#fff",
  },

  primaryButton: {
    backgroundColor: "#111",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  primaryButtonDisabled: {
    opacity: 0.35,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
});
