import { getAnalysisHistory } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.logo}>NAES</Text>
          <Pressable style={styles.alertButton}>
            <Feather name="bell" size={18} color="#111" />
          </Pressable>
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
            <Text style={styles.heroObjectLogo}>N</Text>
            <Text style={styles.heroObjectSub}>STYLE</Text>
            <Text style={styles.heroObjectSmall}>EST. 2026</Text>
          </View>

          <View style={styles.heroArcLarge} />
          <View style={styles.heroArcSmall} />
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalCount}</Text>
            <Text style={styles.statLabel}>분석</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{highestScore}</Text>
              <Text style={styles.statUnit}>점</Text>
            </View>
            <Text style={styles.statLabel}>최고</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{averageScore}</Text>
              <Text style={styles.statUnit}>점</Text>
            </View>
            <Text style={styles.statLabel}>평균</Text>
          </View>
        </View>

        <View style={styles.uploadCard}>
          {image ? (
            <View style={styles.selectedContent}>
              <Image source={{ uri: image }} style={styles.selectedImage} />

              <View style={styles.selectedInfo}>
                <Text style={styles.uploadEyebrow}>READY TO ANALYZE</Text>
                <Text style={styles.uploadTitle}>선택한 코디 사진</Text>
                <Text style={styles.uploadText}>
                  사진이 준비됐어요. AI 분석을 시작해보세요.
                </Text>

                <Pressable style={styles.analyzeButton} onPress={() =>
                  router.push({
                    pathname: "/analyzing",
                    params: { imageUri: image },
                  })
                }>
                  <Text style={styles.analyzeButtonText}>AI 분석하기</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.uploadIconCircle}>
                <Feather name="plus" size={25} color="#8c6f47" />
              </View>
              <Text style={styles.uploadTitle}>오늘 어떤 스타일인가요?</Text>
              <Text style={styles.uploadTextCenter}>
                사진 한 장으로 AI 스타일 분석을 시작해보세요.
              </Text>

              <View style={styles.uploadButtonRow}>
                <Pressable style={styles.uploadChoiceButton} onPress={pickImage}>
                  <Feather name="image" size={23} color="#73522d" />
                  <Text style={styles.uploadChoiceText}>앨범에서 선택</Text>
                </Pressable>

                <Pressable style={styles.uploadChoiceButton} onPress={takePhoto}>
                  <Feather name="camera" size={23} color="#73522d" />
                  <Text style={styles.uploadChoiceText}>촬영하기</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {image && (
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={pickImage}>
              <Feather name="image" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>사진 변경</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={takePhoto}>
              <Feather name="camera" size={18} color="#111" />
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
                      <Text style={[styles.recentRisk, { color: riskStyle.textColor }]}>{item.riskLevel}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <View style={styles.navItemActive}>
          <View style={styles.activeIconCircle}>
            <Feather name="home" size={18} color="#fff" />
          </View>
          <Text style={styles.navTextActive}>홈</Text>
        </View>
        <View style={styles.navItem}>
          <Feather name="search" size={20} color="#8c8c8c" />
          <Text style={styles.navText}>분석</Text>
        </View>
        <Pressable style={styles.navItem} onPress={() => router.push("/history")}>
          <Feather name="archive" size={20} color="#8c8c8c" />
          <Text style={styles.navText}>기록</Text>
        </Pressable>
        <View style={styles.navItem}>
          <Feather name="user" size={20} color="#8c8c8c" />
          <Text style={styles.navText}>마이</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f2ee",
  },
  container: {
    flexGrow: 1,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 88,
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
  alertButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  heroCard: {
    backgroundColor: "#111",
    borderRadius: 28,
    padding: 24,
    minHeight: 210,
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
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 43,
    letterSpacing: -1.2,
  },
  heroText: {
    marginTop: 16,
    color: "#d8d2ca",
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "800",
  },
  heroObject: {
    position: "absolute",
    right: 30,
    top: 52,
    width: 96,
    height: 118,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1.4,
    borderColor: "#caa46a",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  heroObjectLogo: {
    color: "#caa46a",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 5,
  },
  heroObjectSub: {
    color: "#caa46a",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroObjectSmall: {
    color: "#8f744e",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 7,
  },
  heroArcLarge: {
    position: "absolute",
    right: -26,
    top: -18,
    width: 190,
    height: 190,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#6f5634",
    opacity: 0.55,
  },
  heroArcSmall: {
    position: "absolute",
    right: 16,
    top: 28,
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#caa46a",
    opacity: 0.55,
  },
  statsCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 26,
    paddingVertical: 16,
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
  statValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  statValue: {
    fontSize: 25,
    fontWeight: "900",
    color: "#111",
  },
  statUnit: {
    fontSize: 11,
    fontWeight: "900",
    color: "#111",
    marginLeft: 2,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#7c746a",
    marginTop: 4,
    fontWeight: "900",
  },
  uploadCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 18,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f0eee9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 16,
    elevation: 2,
  },
  selectedContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  selectedImage: {
    width: 112,
    height: 148,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  selectedInfo: {
    flex: 1,
  },
  uploadEyebrow: {
    color: "#9b7a4b",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  uploadIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    borderWidth: 1,
    borderColor: "#e6d9cb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
    marginBottom: 7,
  },
  uploadText: {
    fontSize: 13,
    color: "#6b6258",
    lineHeight: 20,
    fontWeight: "700",
  },
  uploadTextCenter: {
    fontSize: 13,
    color: "#6b6258",
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
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
    gap: 7,
    borderWidth: 1,
    borderColor: "#eee4d8",
  },
  uploadChoiceText: {
    color: "#5b3d1e",
    fontSize: 13,
    fontWeight: "900",
  },
  analyzeButton: {
    alignSelf: "flex-start",
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 14,
  },
  analyzeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#111",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    width: 104,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e1d8",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
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
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
  },
  seeAllText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#8c6f47",
  },
  recentList: {
    gap: 12,
  },
  recentImageCard: {
    width: 108,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  recentImage: {
    width: 92,
    height: 116,
    borderRadius: 16,
    backgroundColor: "#ddd",
    marginBottom: 8,
  },
  recentScore: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
  recentRiskPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recentRisk: {
    fontSize: 11,
    fontWeight: "900",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 66,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderColor: "#eee7dd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 8,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 54,
    gap: 3,
  },
  navItemActive: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 54,
    gap: 3,
  },
  activeIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  navTextActive: {
    color: "#111",
    fontSize: 10,
    fontWeight: "900",
  },
  navText: {
    color: "#8c8c8c",
    fontSize: 10,
    fontWeight: "900",
  },
});
