import { ClosetItem, getClosetItems } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "분석 전"}</Text>
    </View>
  );
}

function TipCard({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text?: string;
}) {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name={icon} size={16} color="#8c6f47" />
        </View>
        <Text style={styles.tipTitle}>{title}</Text>
      </View>
      <Text style={styles.tipText}>{text || "분석 전"}</Text>
    </View>
  );
}

export default function ClothesDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadItem() {
        const closetItems = await getClosetItems();
        const selectedItem = closetItems.find((closetItem) => closetItem.id === id);

        setItem(selectedItem || null);
        setIsLoaded(true);
      }

      loadItem();
    }, [id])
  );

  if (isLoaded && !item) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Feather name="chevron-left" size={22} color="#111" />
            </Pressable>

            <View>
              <Text style={styles.headerEyebrow}>CLOTHES DETAIL</Text>
              <Text style={styles.headerTitle}>옷 상세</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.emptyCard}>
            <Feather name="alert-circle" size={28} color="#8c6f47" />
            <Text style={styles.emptyTitle}>옷 정보를 찾을 수 없어요</Text>
            <Text style={styles.emptyText}>옷장 화면에서 다시 선택해주세요.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#111" />
          </Pressable>

          <View>
            <Text style={styles.headerEyebrow}>CLOTHES DETAIL</Text>
            <Text style={styles.headerTitle}>옷 상세</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {item && (
          <>
            <Image source={{ uri: item.imageUri }} style={styles.heroImage} />

            <View style={styles.summaryCard}>
              <Text style={styles.itemTitle}>
                {item.detailCategory || item.subCategory || item.category}
              </Text>
              <Text style={styles.itemSubtitle}>
                {item.category}{item.color ? ` · ${item.color}` : ""}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <DetailRow label="종류" value={item.category} />
              <DetailRow label="상세 종류" value={item.detailCategory || item.subCategory} />
              <DetailRow label="색상" value={item.color} />
              <DetailRow label="스타일" value={item.style} />
              <DetailRow label="계절" value={item.season} />
              <DetailRow label="핏" value={item.fit} />
            </View>

            <TipCard
              icon="file-text"
              title="특징"
              text={item.description}
            />
            <TipCard
              icon="check-circle"
              title="매치 팁"
              text={item.matchTip}
            />
            <TipCard
              icon="x-circle"
              title="피하면 좋은 조합"
              text={item.avoidTip}
            />
          </>
        )}
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

  heroImage: {
    width: "100%",
    height: 390,
    borderRadius: 28,
    backgroundColor: "#ddd",
    marginBottom: 16,
  },

  summaryCard: {
    backgroundColor: "#111",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },

  itemTitle: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
    marginBottom: 6,
  },

  itemSubtitle: {
    color: "#d8d2ca",
    fontSize: 15,
    fontWeight: "800",
  },

  infoCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 14,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#eee7dd",
  },

  detailLabel: {
    color: "#8a8178",
    fontSize: 14,
    fontWeight: "900",
  },

  detailValue: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
  },

  tipCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },

  tipIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    alignItems: "center",
    justifyContent: "center",
  },

  tipTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
  },

  tipText: {
    color: "#625a51",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },

  emptyTitle: {
    color: "#111",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 7,
  },

  emptyText: {
    color: "#6b6258",
    fontSize: 14,
    fontWeight: "700",
  },
});
