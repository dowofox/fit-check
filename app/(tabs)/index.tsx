import BottomNav from "@/components/BottomNav";
import { getOutfitRecommendationResult, OutfitRecommendation } from "@/utils/outfitRecommend";
import { ClosetItem, getClosetItems, getSavedOutfits, getUserProfile, SavedOutfit, UserProfile } from "@/utils/storage";
import { colors, radius, shadow, spacing, typography } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const CLOSET_CATEGORIES = ["상의", "하의", "신발", "아우터"];

function getItemName(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function getCategoryCount(items: ClosetItem[], category: string) {
  return items.filter((item) => item.category === category).length;
}

export default function HomeScreen() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayRecommendation, setTodayRecommendation] = useState<OutfitRecommendation | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function loadDashboard() {
        const [nextClosetItems, nextSavedOutfits, nextProfile] = await Promise.all([
          getClosetItems(),
          getSavedOutfits(),
          getUserProfile(),
        ]);
        const recommendationResult = getOutfitRecommendationResult(nextClosetItems, nextProfile);

        setClosetItems(nextClosetItems);
        setSavedOutfits(nextSavedOutfits);
        setProfile(nextProfile);
        setTodayRecommendation(recommendationResult.recommendations[0] || null);
      }

      loadDashboard();
    }, [])
  );

  async function startAnalysis() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled) {
      router.push({ pathname: "/analyzing", params: { imageUri: result.assets[0].uri } });
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Text style={styles.logoText}>NAES</Text>
          <Pressable style={styles.bellButton}>
            <Feather name="bell" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.greetingArea}>
          <Text style={styles.greeting}>안녕하세요, 도현님</Text>
          <Text style={styles.greetingSub}>오늘도 멋진 하루 되세요!</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <View style={styles.heroTextArea}>
              <Text style={styles.heroEyebrow}>NAES AI STYLIST</Text>
              <Text style={styles.heroTitle}>나만의 AI 스타일리스트</Text>
              <Text style={styles.heroText}>
                오늘의 코디를 분석하고 새로운 스타일을 제안받아보세요.
              </Text>

              <Pressable style={styles.heroButton} onPress={startAnalysis}>
                <Feather name="camera" size={15} color="#fff" />
                <Text style={styles.heroButtonText}>코디 분석하기</Text>
              </Pressable>
            </View>

            <View style={styles.heroVisual}>
              <View style={styles.closetIllustration}>
                <View style={styles.closetRod} />
                <View style={styles.hangerRow}>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <View key={index} style={styles.hangerSet}>
                      <View style={styles.hangerHook} />
                      <View
                        style={[
                          styles.garmentShape,
                          index % 2 === 0 && styles.garmentShapeLight,
                        ]}
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.floorAccent} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>내 옷장 현황</Text>
            <Text style={styles.sectionMeta}>총 {closetItems.length}개</Text>
          </View>

          <View style={styles.closetGrid}>
            {CLOSET_CATEGORIES.map((category) => (
              <View key={category} style={styles.countTile}>
                <Text style={styles.countValue}>{getCategoryCount(closetItems, category)}</Text>
                <Text style={styles.countLabel}>{category}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘의 추천 코디</Text>
            <Pressable onPress={() => router.push("/outfit-recommend")}>
              <Text style={styles.linkText}>추천 보기</Text>
            </Pressable>
          </View>

          {todayRecommendation ? (
            <View>
              <View style={styles.recommendHeader}>
                <View style={styles.scorePill}>
                  <Text style={styles.scoreText}>{todayRecommendation.score}점</Text>
                </View>
                <Text style={styles.recommendGrade}>{todayRecommendation.grade} 등급</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendItems}
              >
                {todayRecommendation.items.slice(0, 4).map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.recommendItem}
                    onPress={() => router.push({ pathname: "/clothes-detail", params: { id: item.id } })}
                  >
                    <Image source={{ uri: item.imageUri }} style={styles.recommendImage} />
                    <Text style={styles.recommendItemName} numberOfLines={1}>
                      {getItemName(item)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <Text style={styles.emptyText}>옷을 더 추가하면 추천을 받을 수 있어요.</Text>
          )}
        </View>

        <View style={styles.savedCard}>
          <View>
            <Text style={styles.sectionTitle}>저장한 코디</Text>
            <Text style={styles.savedCount}>{savedOutfits.length}개 저장됨</Text>
            {profile?.topSize ? (
              <Text style={styles.profileHint}>프로필 상의 {profile.topSize} 기준으로 추천에 활용 중</Text>
            ) : null}
          </View>

          <Pressable style={styles.savedButton} onPress={() => router.push("/saved-outfits")}>
            <Text style={styles.savedButtonText}>바로가기</Text>
            <Feather name="chevron-right" size={17} color="#fff" />
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingTop: 42,
    paddingHorizontal: 20,
    paddingBottom: 78,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerSide: {
    width: 32,
  },
  logoText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  bellButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  greetingArea: {
    marginBottom: 24,
  },
  greeting: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  greetingSub: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    height: 158,
    paddingLeft: 16,
    paddingVertical: 15,
    paddingRight: 0,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: "hidden",
    ...shadow.subtle,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },
  heroTextArea: {
    width: "58%",
    paddingRight: 10,
  },
  heroEyebrow: {
    ...typography.eyebrow,
    color: colors.point,
    marginBottom: 7,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 28,
  },
  heroText: {
    ...typography.body,
    color: colors.subText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    marginBottom: 12,
  },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.text,
    height: 36,
    borderRadius: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  heroVisual: {
    width: "42%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  closetIllustration: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    backgroundColor: "#EDE4D8",
    overflow: "hidden",
    paddingTop: 28,
    paddingLeft: 14,
  },
  closetRod: {
    position: "absolute",
    top: 28,
    left: 16,
    right: 0,
    height: 2,
    backgroundColor: "#B99F7E",
  },
  hangerRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "flex-start",
  },
  hangerSet: {
    width: 15,
    alignItems: "center",
  },
  hangerHook: {
    width: 8,
    height: 10,
    borderTopWidth: 1.4,
    borderLeftWidth: 1.4,
    borderColor: "#8C6F47",
    borderTopLeftRadius: 8,
    transform: [{ rotate: "35deg" }],
    marginBottom: 1,
  },
  garmentShape: {
    width: 13,
    height: 58,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: "#C8B395",
  },
  garmentShapeLight: {
    backgroundColor: "#F7F2EB",
  },
  floorAccent: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 46,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(140, 111, 71, 0.14)",
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.text,
  },
  sectionMeta: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "600",
  },
  closetGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  countTile: {
    flex: 1,
    backgroundColor: colors.softCard,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  countValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  countLabel: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  linkText: {
    color: colors.point,
    fontSize: 13,
    fontWeight: "700",
  },
  recommendHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 10,
  },
  scorePill: {
    backgroundColor: colors.softCard,
    borderRadius: radius.round,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  scoreText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  recommendGrade: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: "600",
  },
  recommendItems: {
    gap: spacing.sm,
    paddingRight: 2,
  },
  recommendItem: {
    width: 62,
  },
  recommendImage: {
    width: 62,
    height: 74,
    borderRadius: radius.md,
    backgroundColor: colors.inactiveTab,
    marginBottom: 5,
  },
  recommendItemName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
  },
  emptyText: {
    ...typography.body,
    color: colors.subText,
  },
  savedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savedCount: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  profileHint: {
    color: colors.point,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 5,
  },
  savedButton: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  savedButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
