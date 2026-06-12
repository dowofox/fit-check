import BottomNav from "@/components/BottomNav";
import { colors, radius, shadow, typography } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function OutfitHubScreen() {
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>OUTFIT</Text>
        <Text style={styles.title}>코디</Text>
        <Text style={styles.subtitle}>추천받고, 저장한 조합을 다시 확인해보세요.</Text>

        <Pressable style={styles.primaryCard} onPress={() => router.push("/outfit-recommend")}>
          <View style={styles.iconBox}>
            <Feather name="layers" size={18} color={colors.text} />
          </View>
          <View style={styles.cardTextArea}>
            <Text style={styles.cardTitle}>코디 추천 받기</Text>
            <Text style={styles.cardText}>내 옷장 기반으로 오늘 입기 좋은 조합을 찾아요.</Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.subText} />
        </Pressable>

        <Pressable style={styles.primaryCard} onPress={() => router.push("/saved-outfits")}>
          <View style={styles.iconBox}>
            <Feather name="bookmark" size={18} color={colors.text} />
          </View>
          <View style={styles.cardTextArea}>
            <Text style={styles.cardTitle}>저장한 코디</Text>
            <Text style={styles.cardText}>마음에 든 코디와 어울리는 신발 추천을 확인해요.</Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.subText} />
        </Pressable>
      </ScrollView>

      <BottomNav activeTab="outfit" />
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
    paddingBottom: 78,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.point,
    marginBottom: 5,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.subText,
    marginTop: 8,
    marginBottom: 15,
  },
  primaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    ...shadow.subtle,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.softCard,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextArea: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardText: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
});
