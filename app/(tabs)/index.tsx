import { getAnalysisHistory } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadRecent = async () => {
        const history = await getAnalysisHistory();
        setRecentResults(history.slice(0, 10));
      };

      loadRecent();
    }, [])
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      alert("카메라 권한이 필요해.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

      <View style={styles.heroCard}>
        <Text style={styles.heroBadge}>NAES AI</Text>

        <Text style={styles.heroTitle}>
          오늘 코디는 몇 점?
        </Text>

        <Text style={styles.heroText}>
          당신만의 스타일리스트가 실패 위험, 코디 포인트, 문제점을 솔직하게 분석해드려요.
        </Text>
      </View>

      <View style={styles.uploadCard}>

        {image ? (
          <>
            <Text style={styles.cardTitle}>선택한 코디 사진</Text>
            <Image source={{ uri: image }} style={styles.image} />

            <Pressable style={styles.analyzeButton} onPress={() =>
              router.push({
                pathname: "/analyzing",
                params: { imageUri: image },
              })
            }>
              <Text style={styles.analyzeButtonText}>AI 분석하기</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.emptyIcon}>👕</Text>
            <Text style={styles.cardTitle}>
              오늘 코디를 보여주세요
            </Text>

            <Text style={styles.emptyText}>
              전신 사진일수록 더 정확한 분석 결과를 받을 수 있어요.
            </Text>
          </>
        )}
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={pickImage}>
          <Text style={styles.primaryButtonText}>
            {image ? "사진 변경" : "앨범에서 선택"}
          </Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={takePhoto}>
          <Text style={styles.secondaryButtonText}>촬영</Text>
        </Pressable>
      </View>

      {recentResults.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>최근 분석</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
          >
            {recentResults.map((item) => (
              <Pressable
                key={item.id}
                style={styles.recentImageCard}
                onPress={() =>
                  router.push({
                    pathname: "/result",
                    params: item,
                  })
                }
              >
                <Image source={{ uri: item.imageUri }} style={styles.recentImage} />
                <Text style={styles.recentScore}>{item.score}점</Text>
                <Text style={styles.recentRisk}>
                  실패 위험 {item.riskLevel}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f4f4f5",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 70,
  },
  heroCard: {
    backgroundColor: "#111",
    borderRadius: 26,
    padding: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  heroBadge: {
    color: "#a3e635",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 30,
  },
  heroText: {
    marginTop: 10,
    color: "#d1d5db",
    fontSize: 14,
    lineHeight: 22,
  },
  uploadCard: {
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 22,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
  },
  image: {
    width: 150,
    height: 200,
    borderRadius: 20,
    marginBottom: 16,
  },
  analyzeButton: {
    width: "100%",
    backgroundColor: "#111",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  analyzeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#111",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    width: 96,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111",
    marginBottom: 10,
  },
  recentScore: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111",
  },
  recentSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  recentList: {
    gap: 12,
  },
  recentImageCard: {
    width: 130,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 8,
    alignItems: "center",
  },
  recentImage: {
    width: 114,
    height: 145,
    borderRadius: 14,
    backgroundColor: "#ddd",
    marginBottom: 6,
  },
  recentRisk: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
    fontWeight: "700",
  },
});