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

export default function AddClothesScreen() {
  const [imageUri, setImageUri] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function saveItem() {
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

      await saveClosetItem({
        id: Date.now().toString(),
        imageUri,
        category: analysis.category || "기타",
        subCategory: analysis.subCategory || "분석 전",
        detailCategory: analysis.detailCategory || analysis.subCategory || "상세 분류 전",
        color: analysis.color || "색상 분석 전",
        style: analysis.style || "스타일 분석 전",
        season: analysis.season || "계절 분석 전",
        fit: analysis.fit || "핏 분석 전",
        size: analysis.size || "사이즈 미입력",
        description: analysis.description || "옷 특징을 분석하지 못했어요.",
        matchTip: analysis.matchTip || "어울리는 조합을 분석하지 못했어요.",
        avoidTip: analysis.avoidTip || "피하면 좋은 조합을 분석하지 못했어요.",
        createdAt: new Date().toISOString(),
      });

      router.replace("/closet");
    } catch (error) {
      console.log("옷 분석 저장 실패:", error);
      Alert.alert("저장 실패", "옷 분석 중 문제가 생겼어요. 다시 시도해주세요.");
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

        <Pressable
          style={[styles.primaryButton, (!imageUri || isSaving) && styles.primaryButtonDisabled]}
          onPress={saveItem}
          disabled={!imageUri || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="save" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>AI 분석 후 저장</Text>
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
