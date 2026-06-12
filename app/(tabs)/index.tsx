import BagIcon from "@/assets/icons/bag.svg";
import JacketIcon from "@/assets/icons/jacket.svg";
import PantsIcon from "@/assets/icons/pants.svg";
import ShirtIcon from "@/assets/icons/shirt.svg";
import ShoeIcon from "@/assets/icons/sneakers.svg";
import BottomNav from "@/components/BottomNav";
import { getOutfitRecommendationResult, OutfitRecommendation } from "@/utils/outfitRecommend";
import { ClosetItem, getClosetItems, getSavedOutfits, getUserProfile, SavedOutfit } from "@/utils/storage";
import { colors, typography } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const CLOSET_CATEGORIES = [
  { label: "상의", Icon: ShirtIcon },
  { label: "하의", Icon: PantsIcon },
  { label: "신발", Icon: ShoeIcon },
  { label: "아우터", Icon: JacketIcon },
  { label: "액세서리", Icon: BagIcon },
];

function getCategoryCount(items: ClosetItem[], category: string) {
  return items.filter((item) => item.category === category).length;
}

function getCoreItems(recommendation: OutfitRecommendation) {
  const priority = ["아우터", "상의", "하의", "신발"];

  return priority
    .map((category) => recommendation.items.find((item) => item.category === category))
    .filter((item): item is ClosetItem => Boolean(item))
    .slice(0, 3);
}

function getItemShortLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function RecommendationLookbookCard({ recommendation }: { recommendation: OutfitRecommendation }) {
  const coreItems = getCoreItems(recommendation);
  const top = recommendation.items.find((item) => item.category === "상의");
  const bottom = recommendation.items.find((item) => item.category === "하의");
  const shoes = recommendation.items.find((item) => item.category === "신발");

  return (
    <Pressable
      style={styles.recommendCard}
      onPress={() => router.push("/outfit-recommend")}
    >
      <View style={styles.lookbookImage}>
        <View style={styles.lookbookModelWrap}>
          <View style={styles.lookbookHead} />
          <View style={styles.lookbookBody} />
          <View style={styles.lookbookLegs} />
        </View>

        <View style={styles.itemPreviewRow}>
          {coreItems.map((item) => (
            <Image
              key={item.id}
              source={{ uri: item.imageUri }}
              style={styles.itemPreviewImage}
            />
          ))}
        </View>

        <View style={styles.aiBadge}>
          <Feather name="star" size={10} color={colors.point} />
          <Text style={styles.aiBadgeText}>AI 룩북</Text>
        </View>
      </View>

      <Text style={styles.recommendTitle} numberOfLines={1}>
        {recommendation.title}
      </Text>

      <Text style={styles.recommendItems} numberOfLines={1}>
        {[top, bottom, shoes]
          .filter((item): item is ClosetItem => Boolean(item))
          .map(getItemShortLabel)
          .join(" + ")}
      </Text>

      <View style={styles.recommendTagRow}>
        {recommendation.tags.slice(0, 2).map((tag) => (
          <Text key={tag} style={styles.recommendTag}>
            #{tag}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [todayRecommendations, setTodayRecommendations] = useState<OutfitRecommendation[]>([]);

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
        setTodayRecommendations(recommendationResult.recommendations.slice(0, 5));
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
          <Image
            source={require("@/assets/images/hero-fashion-wide.png")}
            style={styles.heroBackground}
            resizeMode="cover"
          />

          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>나만의 AI 스타일리스트</Text>
            <Text style={styles.heroText}>오늘의 코디를 분석하고{"\n"}새로운 스타일을 제안받아보세요.</Text>

            <Pressable style={styles.heroButton} onPress={startAnalysis}>
              <Text style={styles.heroButtonText}>코디 분석하기</Text>
              <Feather name="arrow-right" size={13} color={colors.card} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>내 옷장 현황</Text>

            <Pressable onPress={() => router.push("/closet")}>
              <View style={styles.moreWrap}>
                <Text style={styles.moreText}>전체 보기</Text>
                <Feather name="chevron-right" size={14} color={colors.point} />
              </View>
            </Pressable>
          </View>

          <View style={styles.closetGrid}>
            {CLOSET_CATEGORIES.map((category) => {
              const Icon = category.Icon;

              return (
                <Pressable
                  key={category.label}
                  style={styles.countTile}
                  onPress={() => router.push({ pathname: "/closet", params: { category: category.label } })}
                >
                  <Icon width={24} height={24} color={colors.point} />
                  <Text style={styles.countLabel}>{category.label}</Text>
                  <Text style={styles.countValue}>{getCategoryCount(closetItems, category.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘의 추천 코디</Text>
            <Pressable style={styles.moreWrap} onPress={() => router.push("/outfit-recommend")}>
              <Text style={styles.moreText}>추천 더보기</Text>
              <Feather name="chevron-right" size={14} color={colors.point} />
            </Pressable>
          </View>

          {todayRecommendations.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendCarousel}
            >
              {todayRecommendations.map((recommendation) => (
                <RecommendationLookbookCard key={recommendation.id} recommendation={recommendation} />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>옷을 더 추가하면 추천을 받을 수 있어요.</Text>
          )}
        </View>

        <View style={styles.savedCard}>
          <View style={styles.savedTextArea}>
            <Text style={styles.savedTitle}>저장한 코디가 {savedOutfits.length}개 있어요</Text>
            <Text style={styles.savedDescription}>나의 다양한 스타일을 확인해보세요.</Text>
          </View>

          <Pressable style={styles.savedActionArea} onPress={() => router.push("/saved-outfits")}>
            <View style={styles.savedIconBox}>
              <Feather name="bookmark" size={17} color={colors.point} />
            </View>

            <View style={styles.savedLink}>
              <Text style={styles.savedLinkText}>바로가기</Text>
              <Feather name="chevron-right" size={14} color={colors.point} />
            </View>
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
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 96,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerSide: {
    width: 32,
  },
  logoText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bellButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  greetingArea: {
    marginBottom: 14,
  },
  greeting: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  greetingSub: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  heroCard: {
    height: 148,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 14,
    position: "relative",
  },
  heroBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 6,
    lineHeight: 21,
  },
  heroText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.subText,
  },
  heroButton: {
    marginTop: 12,
    backgroundColor: colors.text,
    height: 32,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  heroButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
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
  moreWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  moreText: {
    color: colors.point,
    fontSize: 12,
    fontWeight: "600",
  },
  closetGrid: {
    flexDirection: "row",
    gap: 8,
  },
  countTile: {
    flex: 1,
    height: 96,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  countLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  countValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  emptyText: {
    ...typography.body,
    color: colors.subText,
  },
  recommendCarousel: {
    gap: 12,
    paddingRight: 20,
  },
  recommendCard: {
    width: 132,
  },
  lookbookImage: {
    width: 132,
    height: 158,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  lookbookModelWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  lookbookHead: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.inactiveTab,
    marginBottom: 5,
  },
  lookbookBody: {
    width: 44,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.point,
    opacity: 0.22,
  },
  lookbookLegs: {
    width: 34,
    height: 38,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.text,
    opacity: 0.12,
    marginTop: 3,
  },
  itemPreviewRow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  itemPreviewImage: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.softCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.softCard,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  aiBadgeText: {
    color: colors.point,
    fontSize: 9,
    fontWeight: "800",
  },
  recommendTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  recommendItems: {
    color: colors.subText,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 6,
  },
  recommendTagRow: {
    flexDirection: "row",
    gap: 4,
  },
  recommendTag: {
    backgroundColor: colors.softCard,
    color: colors.point,
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  savedCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    marginBottom: 18,
    minHeight: 94,
  },
  savedTextArea: {
    flex: 1,
    paddingRight: 12,
    justifyContent: "center",
  },
  savedTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  savedDescription: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
  },
  savedActionArea: {
    minWidth: 74,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  savedIconBox: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  savedLinkText: {
    color: colors.point,
    fontSize: 12,
    fontWeight: "700",
  },
});
