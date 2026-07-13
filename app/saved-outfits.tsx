import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import { getShoeRecommendationsForOutfit } from "@/utils/outfitRecommend";
import {
  ClosetItem,
  deleteSavedOutfit,
  getClosetItems,
  getSavedOutfits,
  SavedOutfit,
  updateSavedOutfit,
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
  TextInput,
  View,
} from "react-native";

type SavedOutfitWithItems = SavedOutfit & {
  items: ClosetItem[];
};

function getItemName(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category;
}

function getDefaultOutfitName(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "저장한 코디";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `코디 ${year}.${month}.${day}`;
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
  onUpdate,
  allClosetItems,
}: {
  outfit: SavedOutfitWithItems;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string, memo: string) => void;
  allClosetItems: ClosetItem[];
}) {
  const outfitName = outfit.name || getDefaultOutfitName(outfit.createdAt);
  const outfitMemo = outfit.memo || "";
  const shoeRecommendations = getShoeRecommendationsForOutfit(outfit.items, allClosetItems);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(outfitName);
  const [memoInput, setMemoInput] = useState(outfitMemo);

  function handleCancelEdit() {
    setNameInput(outfitName);
    setMemoInput(outfitMemo);
    setIsEditing(false);
  }

  function handleSaveEdit() {
    const nextName = nameInput.trim() || outfitName;
    const nextMemo = memoInput.trim();

    onUpdate(outfit.id, nextName, nextMemo);
    setIsEditing(false);
  }

  return (
    <View style={styles.outfitCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardEyebrow}>SAVED OUTFIT</Text>
          <Text style={styles.cardTitle}>{outfitName}</Text>
          <Text style={styles.cardSubTitle}>아이템 {outfit.items.length}개</Text>
        </View>

        <View style={styles.savedStatusIcon}>
          <Feather name="bookmark" size={17} color="#8c6f47" />
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editBox}>
          <Text style={styles.inputLabel}>이름</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="코디 이름"
            placeholderTextColor="#aaa"
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>메모</Text>
          <TextInput
            value={memoInput}
            onChangeText={setMemoInput}
            placeholder="메모를 입력해보세요"
            placeholderTextColor="#aaa"
            style={[styles.textInput, styles.memoInput]}
            multiline
          />

          <View style={styles.editButtonRow}>
            <Pressable style={styles.cancelEditButton} onPress={handleCancelEdit}>
              <Text style={styles.cancelEditButtonText}>취소</Text>
            </Pressable>
            <Pressable style={styles.saveEditButton} onPress={handleSaveEdit}>
              <Text style={styles.saveEditButtonText}>저장</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.memoBox}>
          <Text style={styles.memoLabel}>메모</Text>
          <Text style={styles.memoText}>{outfitMemo || "메모가 없어요"}</Text>
        </View>
      )}

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

      {(shoeRecommendations.currentShoes.length > 0 || shoeRecommendations.recommendations.length > 0) && (
        <View style={styles.shoeSection}>
          <View style={styles.shoeSectionHeader}>
            <Feather name="shopping-bag" size={16} color="#111" />
            <Text style={styles.shoeSectionTitle}>어울리는 신발</Text>
          </View>

          {shoeRecommendations.currentShoes.length > 0 && (
            <View style={styles.currentShoeBox}>
              <Text style={styles.currentShoeLabel}>현재 신발</Text>
              {shoeRecommendations.currentShoes.map((recommendation) => (
                <Pressable
                  key={recommendation.shoe.id}
                  style={styles.shoeRow}
                  onPress={() =>
                    router.push({
                      pathname: "/clothes-detail",
                      params: { id: recommendation.shoe.id },
                    })
                  }
                >
                  <Image
                    source={{ uri: recommendation.shoe.imageUri }}
                    style={styles.shoeImage}
                  />
                  <View style={styles.shoeInfo}>
                    <Text style={styles.shoeName} numberOfLines={1}>
                      {getItemName(recommendation.shoe)}
                    </Text>
                    <Text style={styles.shoeReason} numberOfLines={2}>
                      {recommendation.reason}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {shoeRecommendations.recommendations.length > 0 && (
            <View style={styles.shoeList}>
              <Text style={styles.recommendedShoeLabel}>추천 신발</Text>
              {shoeRecommendations.recommendations.map((recommendation) => (
                <Pressable
                  key={recommendation.shoe.id}
                  style={styles.shoeRow}
                  onPress={() =>
                    router.push({
                      pathname: "/clothes-detail",
                      params: { id: recommendation.shoe.id },
                    })
                  }
                >
                  <Image
                    source={{ uri: recommendation.shoe.imageUri }}
                    style={styles.shoeImage}
                  />
                  <View style={styles.shoeInfo}>
                    <Text style={styles.shoeName} numberOfLines={1}>
                      {getItemName(recommendation.shoe)}
                    </Text>
                    <Text style={styles.shoeReason} numberOfLines={2}>
                      {recommendation.reason}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

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

      {!isEditing && (
        <Pressable
          style={styles.editButton}
          onPress={() => setIsEditing(true)}
        >
          <Feather name="edit-3" size={17} color="#111" />
          <Text style={styles.editButtonText}>이름/메모 수정</Text>
        </Pressable>
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
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  async function loadSavedOutfits() {
    const [outfits, closetItems] = await Promise.all([
      getSavedOutfits(),
      getClosetItems(),
    ]);

    setClosetItems(closetItems);
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
          setClosetItems(closetItems);
          setSavedOutfits(matchSavedOutfits(updatedOutfits, closetItems));
        },
      },
    ]);
  }

  async function handleUpdateOutfit(id: string, name: string, memo: string) {
    const updatedOutfits = await updateSavedOutfit(id, { name, memo });
    const closetItems = await getClosetItems();
    setClosetItems(closetItems);
    setSavedOutfits(matchSavedOutfits(updatedOutfits, closetItems));
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
        <Text style={styles.headerTitle}>코디</Text>

        <View style={styles.topActionRow}>
          <Pressable style={styles.recommendTab} onPress={() => router.push("/outfit-recommend")}>
            <Feather name="star" size={15} color="#fff" />
            <Text style={styles.recommendTabText}>코디 추천</Text>
          </Pressable>

          <View style={styles.savedTab}>
            <Feather name="bookmark" size={15} color="#8C6F47" />
            <Text style={styles.savedTabText}>저장한 코디</Text>
          </View>
        </View>

        <View style={styles.savedTitleRow}>
          <Text style={styles.savedTitle}>저장한 코디</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{savedOutfits.length}</Text>
          </View>
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
                onUpdate={handleUpdateOutfit}
                allClosetItems={closetItems}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <BottomNav activeTab="outfit" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F2EB" },
  container: {
    flexGrow: 1,
    paddingTop: 42,
    paddingHorizontal: 20,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  headerTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 28,
  },
  topActionRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 30,
  },
  recommendTab: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  recommendTabText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  savedTab: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#F4EEE7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  savedTabText: {
    color: "#8C6F47",
    fontSize: 14,
    fontWeight: "700",
  },
  savedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  savedTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "700",
  },
  countPill: {
    minWidth: 26,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: "#EFE8DE",
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    color: "#8C6F47",
    fontSize: 12,
    fontWeight: "700",
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
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  cardTitle: {
    color: "#111",
    fontSize: 21,
    fontWeight: "900",
  },
  cardSubTitle: {
    color: "#6b6258",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
  savedStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#f4eee7",
    alignItems: "center",
    justifyContent: "center",
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
  memoBox: {
    backgroundColor: "#faf8f5",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  memoLabel: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
  },
  memoText: {
    color: "#625a51",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  editBox: {
    backgroundColor: "#faf8f5",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  inputLabel: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7,
  },
  textInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: "#111",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 12,
  },
  memoInput: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  shoeSection: {
    backgroundColor: "#faf8f5",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  shoeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  shoeSectionTitle: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },
  currentShoeBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    padding: 10,
    marginBottom: 9,
  },
  currentShoeLabel: {
    color: "#9b7a4b",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 8,
  },
  shoeList: {
    gap: 8,
  },
  recommendedShoeLabel: {
    color: "#9b7a4b",
    fontSize: 10,
    fontWeight: "900",
  },
  shoeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shoeImage: {
    width: 58,
    height: 70,
    borderRadius: 14,
    backgroundColor: "#ddd",
  },
  shoeInfo: {
    flex: 1,
  },
  shoeName: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4,
  },
  shoeReason: {
    color: "#625a51",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  editButtonRow: {
    flexDirection: "row",
    gap: 8,
  },
  cancelEditButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelEditButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
  },
  saveEditButton: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveEditButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
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
  editButton: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  editButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "900",
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
