import { saveClosetItem } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function AddClothesScreen() {
  const [imageUri, setImageUri] = useState("");

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
    if (!imageUri) return;

    await saveClosetItem({
      id: Date.now().toString(),
      imageUri,
      category: "상의",
      subCategory: "분석 전",
      color: "색상 분석 전",
      style: "스타일 분석 전",
      season: "계절 분석 전",
      fit: "핏 분석 전",
      createdAt: new Date().toISOString(),
    });

    router.replace("/closet");
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
                단일 옷 사진을 선택해주세요. 나중에 AI가 종류, 색상, 스타일을 자동 분석하게 됩니다.
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>임시 저장 정보</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>카테고리</Text>
            <Text style={styles.infoValue}>상의</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>상태</Text>
            <Text style={styles.infoValue}>AI 분석 전</Text>
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, !imageUri && styles.primaryButtonDisabled]}
          onPress={saveItem}
          disabled={!imageUri}
        >
          <Feather name="save" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>옷장에 저장</Text>
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

  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 14,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
  },

  infoLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#777",
  },

  infoValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111",
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