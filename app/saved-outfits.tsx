import {
  ClosetItem,
  deleteSavedOutfit,
  getClosetItems,
  getSavedOutfits,
  SavedOutfit,
} from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type SavedOutfitWithItems = SavedOutfit & {
  items: ClosetItem[];
};

function getItemName(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function matchSavedOutfits(savedOutfits: SavedOutfit[], closetItems: ClosetItem[]) {
  return savedOutfits.map((outfit) => ({
    ...outfit,
    items: outfit.itemIds
      .map((itemId) => closetItems.find((item) => item.id === itemId))
      .filter((item): item is ClosetItem => Boolean(item)),
  }));
}

function SavedOutfitCard({
  outfit,
  onDelete,
}: {
  outfit: SavedOutfitWithItems;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={styles.outfitCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardEyebrow}>SAVED OUTFIT</Text>
          <Text style={styles.cardTitle}>{outfit.grade} 등급</Text>
        </View>

        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{outfit.score}</Text>
          <Text style={styles.scoreUnit}>점</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.itemList}
      >
        {outfit.items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.itemCard}
            onPress={() =>
              router.push({
                pathname: "/clothes-detail",
                params: { id: item.id },
              })
            }
          >
            <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
            <Text style={styles.itemName} numberOfLines={1}>
              {getItemName(item)}
            </Text>
            <Text style={styles.itemMeta} numberOfLines={1}>
              {item.category}
              {item.color ? ` · ${item.color}` : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {outfit.reasons.length > 0 && (
        <View style={styles.noteBox}>
          <View style={styles.noteHeader}>
            <Feather name="check-circle" size={16} color="#111" />
            <Text style={styles.noteTitle}>추천 이유</Text>
          </View>
          {outfit.reasons.map((reason) => (
            <Text key={reason} style={styles.noteText}>
              - {reason}
            </Text>
          ))}
        </View>
      )}

      {outfit.warnings.length > 0 && (
        <View style={styles.warningBox}>
          <View style={styles.noteHeader}>
            <Feather name="alert-circle" size={16} color="#8c6f47" />
            <Text style={styles.noteTitle}>주의사항</Text>
          </View>
          {outfit.warnings.map((warning) => (
            <Text key={warning} style={styles.noteText}>
              - {warning}
            </Text>
          ))}
        </View>
      )}

      <Pressable
        style={styles.deleteButton}
        onPress={() => onDelete(outfit.id)}
      >
        <Feather name="trash-2" size={17} color="#991b1b" />
        <Text style={styles.deleteButtonText}>삭제</Text>
      </Pressable>
    </View>
  );
}

export default function SavedOutfitsScreen() {
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfitWithItems[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  async function loadSavedOutfits() {
    const [outfits, closetItems] = await Promise.all([
      getSavedOutfits(),
      getClosetItems(),
    ]);

    setSavedOutfits(matchSavedOutfits(outfits, closetItems));
    setIsLoaded(true);
  }

  function handleDeleteOutfit(id: string) {
    Alert.alert("저장한 코디를 삭제할까요?", "삭제하면 저장 목록에서 사라져요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const updatedOutfits = await deleteSavedOutfit(id);
          const closetItems = await getClosetItems();
          setSavedOutfits(matchSavedOutfits(updatedOutfits, closetItems));
        },
      },
    ]);
  }

  useFocusEffect(
    useCallback(() => {
      loadSavedOutfits();
    }, [])
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#111" />
          </Pressable>

          <View>
            <Text style={styles.headerEyebrow}>SAVED</Text>
            <Text style={styles.headerTitle}>저장한 코디</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {isLoaded && savedOutfits.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="bookmark" size={26} color="#8c6f47" />
            </View>
            <Text style={styles.emptyTitle}>저장한 코디가 없어요</Text>
            <Text style={styles.emptyText}>
              코디 추천 화면에서 마음에 드는 조합을 저장하면 여기에 모아볼 수 있어요.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push("/outfit-recommend")}
            >
              <Feather name="layers" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>코디 추천 받기</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listArea}>
            {savedOutfits.map((outfit) => (
              <SavedOutfitCard
                key={outfit.id}
                outfit={outfit}
                onDelete={handleDeleteOutfit}
              />
            ))}
          </View>
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
  listArea: {
    gap: 14,
  },
  outfitCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eee7dd",
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardEyebrow: {
    color: "#9b7a4b",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardTitle: {
    color: "#111",
    fontSize: 21,
    fontWeight: "900",
  },
  scoreBadge: {
    minWidth: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  scoreUnit: {
    color: "#d8d2ca",
    fontSize: 10,
    fontWeight: "900",
  },
  itemList: {
    gap: 10,
    paddingRight: 2,
    marginBottom: 14,
  },
  itemCard: {
    width: 104,
  },
  itemImage: {
    width: 104,
    height: 128,
    borderRadius: 18,
    backgroundColor: "#ddd",
    marginBottom: 8,
  },
  itemName: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },
  itemMeta: {
    color: "#777",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  noteBox: {
    backgroundColor: "#faf8f5",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: "#f8f1e8",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  noteTitle: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },
  noteText: {
    color: "#625a51",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteButtonText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
  },
  emptyIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    borderWidth: 1,
    borderColor: "#e6d9cb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: "#6b6258",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: "#111",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
});
