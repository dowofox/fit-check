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
            <Feather
              name="bell"
              size={18}
              color={colors.text}
            />
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
            <Text style={styles.heroTitle}>
              나만의 AI 스타일리스트
            </Text>

            <Text style={styles.heroText}>
              오늘의 코디를 분석하고
              {"\n"}
              새로운 스타일을 제안받아보세요.
            </Text>

            <Pressable
              style={styles.heroButton}
              onPress={startAnalysis}
            >
              <Text style={styles.heroButtonText}>
                코디 분석하기
              </Text>

              <Feather
                name="arrow-right"
                size={13}
                color={colors.card}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>내 옷장 현황</Text>

            <Pressable onPress={() => router.push("/closet")}>
              <View style={styles.moreWrap}>
                <Text style={styles.moreText}>전체 보기</Text>
                <Feather
                  name="chevron-right"
                  size={14}
                  color={colors.point}
                />
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
                  onPress={() =>
                    router.push({
                      pathname: "/closet",
                      params: {
                        category: category.label,
                      },
                    })
                  }
                >
                  <Icon
                    width={24}
                    height={24}
                    color={colors.point}
                  />

                  <Text style={styles.countLabel}>{category.label}</Text>

                  <Text style={styles.countValue}>
                    {getCategoryCount(closetItems, category.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>오늘의 추천 코디</Text>
            <Pressable
              style={styles.moreWrap}
              onPress={() => router.push("/outfit-recommend")}
            >
              <Text style={styles.moreText}>
                추천 더보기
              </Text>

              <Feather
                name="chevron-right"
                size={14}
                color={colors.point}
              />
            </Pressable>
          </View>

          {todayRecommendations.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendCarousel}
            >
              {todayRecommendations.map((recommendation) => (
                <Pressable
                  key={recommendation.id}
                  style={styles.recommendCard}
                  onPress={() => router.push("/outfit-recommend")}
                >
                  <Image
                    source={{ uri: recommendation.items[0]?.imageUri }}
                    style={styles.recommendImage}
                  />

                  <Text style={styles.recommendTitle} numberOfLines={1}>
                    {recommendation.title}
                  </Text>

                  <View style={styles.recommendTagRow}>
                    {recommendation.tags.slice(0, 2).map((tag) => (
                      <Text key={tag} style={styles.recommendTag}>
                        #{tag}
                      </Text>
                    ))}
                  </View>
                </Pressable>
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

  linkText: {
    color: colors.point,
    fontSize: 13,
    fontWeight: "700",
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
  emptyText: {
    ...typography.body,
    color: colors.subText,
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

  countIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
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
  todayCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    height: 120,
    padding: 10,
    gap: 12,
  },

  todayImageWrap: {
    width: "43%",
    height: "100%",
    backgroundColor: colors.softCard,
    borderRadius: 16,
    overflow: "hidden",
  },

  todayMainImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    borderRadius: 14,
    backgroundColor: colors.inactiveTab,
  },

  todayInfo: {
    flex: 1,
    justifyContent: "center",
  },

  todayTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },

  todayScore: {
    color: colors.subText,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },

  tagRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 8,
  },

  tagText: {
    backgroundColor: colors.softCard,
    color: colors.point,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },

  todayButton: {
    backgroundColor: colors.text,
    height: 28,
    borderRadius: 9,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  todayButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "700",
  },
  recommendCarousel: {
    gap: 10,
    paddingRight: 20,
  },

  recommendCard: {
    width: 104,
  },

  recommendImage: {
    width: 104,
    height: 104,
    borderRadius: 14,
    backgroundColor: colors.softCard,
    marginBottom: 7,
  },

  recommendTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 5,
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

});
