import { saveClosetItem } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch("http://localhost:3001/analyze-clothes", {
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
        color: analysis.color || "색상 분석 전",
        style: analysis.style || "스타일 분석 전",
        season: analysis.season || "계절 분석 전",
        fit: analysis.fit || "핏 분석 전",
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