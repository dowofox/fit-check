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
          <View>
            <Text style={styles.greeting}>안녕하세요, 도현님</Text>
            <Text style={styles.greetingSub}>오늘도 멋진 하루 되세요!</Text>
          </View>

          <Pressable style={styles.profileBadge} onPress={() => router.push("/profile")}>
            <Feather name="user" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>NAES AI STYLIST</Text>
          <Text style={styles.heroTitle}>나만의 AI 스타일리스트</Text>
          <Text style={styles.heroText}>
            오늘의 코디를 분석하고 새로운 스타일을 제안받아보세요.
          </Text>

          <Pressable style={styles.heroButton} onPress={startAnalysis}>
            <Feather name="camera" size={18} color="#fff" />
            <Text style={styles.heroButtonText}>코디 분석하기</Text>
          </Pressable>
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
    paddingTop: 34,
    paddingHorizontal: 20,
    paddingBottom: 88,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  greeting: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  greetingSub: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
  },
  profileBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.round,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow.subtle,
  },
  heroEyebrow: {
    ...typography.eyebrow,
    color: colors.point,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  heroText: {
    ...typography.body,
    color: colors.subText,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
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
    paddingVertical: 12,
    alignItems: "center",
  },
  countValue: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
  },
  countLabel: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
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
    marginBottom: spacing.md,
  },
  scorePill: {
    backgroundColor: colors.softCard,
    borderRadius: radius.round,
    paddingVertical: 6,
    paddingHorizontal: 10,
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
    width: 74,
  },
  recommendImage: {
    width: 74,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.inactiveTab,
    marginBottom: 7,
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
    padding: 16,
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
    marginTop: 6,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  savedButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
