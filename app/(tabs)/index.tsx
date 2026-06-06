import { getAnalysisHistory } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function getRiskStyle(riskLevel?: string) {
  const risk = String(riskLevel ?? "");

  if (risk.includes("낮음")) {
    return { backgroundColor: "#edf6df", textColor: "#3f6212" };
  }

  if (risk.includes("높음")) {
    return { backgroundColor: "#fee2e2", textColor: "#991b1b" };
  }

  return { backgroundColor: "#fff3d6", textColor: "#92400e" };
}

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const totalCount = recentResults.length;

  const highestScore =
    recentResults.length > 0
      ? Math.max(...recentResults.map((r) => Number(r.score)))
      : 0;

  const averageScore =
    recentResults.length > 0
      ? Math.round(
        recentResults.reduce(
          (sum, r) => sum + Number(r.score),
          0
        ) / recentResults.length
      )
      : 0;

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
      <View style={styles.topBar}>
        <Text style={styles.logo}>NAES</Text>
        <View style={styles.bellButton}>
          <Text style={styles.bellText}>♢</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTextArea}>
          <Text style={styles.heroBadge}>NAES AI</Text>
          <Text style={styles.heroTitle}>오늘의{"\n"}스타일 분석</Text>
          <Text style={styles.heroText}>
            AI 스타일리스트가{"\n"}당신의 코디를 분석합니다.
          </Text>
        </View>

        <View style={styles.heroObject}>
          <Text style={styles.heroObjectIcon}>⌒</Text>
          <Text style={styles.heroObjectSub}>STYLE</Text>
        </View>

        <Text style={styles.heroCircleOne}>◜</Text>
        <Text style={styles.heroCircleTwo}>◝</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>분석 횟수</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{highestScore}</Text>
          <Text style={styles.statLabel}>최고 점수</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{averageScore}</Text>
          <Text style={styles.statLabel}>평균 점수</Text>
        </View>
      </View>

      <View style={styles.uploadCard}>
        {image ? (
          <>
            <Text style={styles.uploadTitle}>선택한 코디 사진</Text>
            <Image source={{ uri: image }} style={styles.selectedImage} />

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
            <Text style={styles.uploadIcon}>＋</Text>
            <Text style={styles.uploadTitle}>오늘 코디 업로드</Text>
            <Text style={styles.uploadText}>
              사진을 업로드하고 AI 분석을 받아보세요.
            </Text>

            <View style={styles.uploadButtonRow}>
              <Pressable style={styles.uploadChoiceButton} onPress={pickImage}>
                <Text style={styles.uploadChoiceIcon}>▧</Text>
                <Text style={styles.uploadChoiceText}>앨범에서 선택</Text>
              </Pressable>

              <Pressable style={styles.uploadChoiceButton} onPress={takePhoto}>
                <Text style={styles.uploadChoiceIcon}>▣</Text>
                <Text style={styles.uploadChoiceText}>촬영하기</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {image && (
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={pickImage}>
            <Text style={styles.primaryButtonText}>사진 변경</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={takePhoto}>
            <Text style={styles.secondaryButtonText}>촬영</Text>
          </Pressable>
        </View>
      )}

      {recentResults.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>최근 분석</Text>

            <Pressable onPress={() => router.push("/history")}>
              <Text style={styles.seeAllText}>전체보기 →</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
          >
            {recentResults.map((item) => {
              const riskStyle = getRiskStyle(item.riskLevel);

              return (
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
                  <View style={[styles.recentRiskPill, { backgroundColor: riskStyle.backgroundColor }]}> 
                    <Text style={[styles.recentRisk, { color: riskStyle.textColor }]}> {item.riskLevel}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f2ee",
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 70,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  logo: {
    color: "#111",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 3,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    alignItems: "center",
    justifyContent: "center",
  },
  bellText: {
    color: "#111",
    fontSize: 18,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: "#111",
    borderRadius: 26,
    padding: 22,
    minHeight: 184,
    marginBottom: 18,
    position: "relative",
    overflow: "hidden",
  },
  heroTextArea: {
    zIndex: 2,
  },
  heroBadge: {
    color: "#caa46a",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 39,
    letterSpacing: -1,
  },
  heroText: {
    marginTop: 13,
    color: "#d8d2ca",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
  },
  heroObject: {
    position: "absolute",
    right: 28,
    top: 50,
    width: 90,
    height: 110,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1.4,
    borderColor: "#caa46a",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  heroObjectIcon: {
    color: "#caa46a",
    fontSize: 29,
    marginBottom: 2,
  },
  heroObjectSub: {
    color: "#caa46a",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroCircleOne: {
    position: "absolute",
    right: 10,
    top: 0,
    color: "#6f5634",
    fontSize: 180,
    opacity: 0.38,
  },
  heroCircleTwo: {
    position: "absolute",
    right: 44,
    top: 24,
    color: "#caa46a",
    fontSize: 130,
    opacity: 0.5,
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 17,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: "#e7e1d8",
  },
  statValue: {
    fontSize: 27,
    fontWeight: "900",
    color: "#111",
  },
  statLabel: {
    fontSize: 12,
    color: "#7c746a",
    marginTop: 5,
    fontWeight: "900",
  },
  uploadCard: {
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 22,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f0eee9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  uploadIcon: {
    fontSize: 38,
    color: "#caa46a",
    fontWeight: "300",
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111",
    marginBottom: 9,
  },
  uploadText: {
    fontSize: 14,
    color: "#6b6258",
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "700",
  },
  uploadButtonRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  uploadChoiceButton: {
    flex: 1,
    backgroundColor: "#f4efe8",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee4d8",
  },
  uploadChoiceIcon: {
    color: "#73522d",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },
  uploadChoiceText: {
    color: "#5b3d1e",
    fontSize: 13,
    fontWeight: "900",
  },
  selectedImage: {
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
    fontWeight: "900",
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
    fontWeight: "900",
  },
  secondaryButton: {
    width: 96,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e1d8",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
  },
  recentSection: {
    marginTop: 18,
    marginBottom: 16,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8c6f47",
  },
  recentList: {
    gap: 12,
  },
  recentImageCard: {
    width: 106,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  recentImage: {
    width: 90,
    height: 116,
    borderRadius: 15,
    backgroundColor: "#ddd",
    marginBottom: 8,
  },
  recentScore: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111",
  },
  recentRiskPill: {
    marginTop: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recentRisk: {
    fontSize: 11,
    fontWeight: "900",
  },
});
