import { getFitSuitability } from "@/utils/sizeMatch";
import { ClosetItem, getClosetItems, getUserProfile, updateClosetItem, UserProfile } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
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

type EditableClosetFields = {
  category: string;
  subCategory: string;
  detailCategory: string;
  color: string;
  style: string;
  styleTags: string[];
  seasons: string[];
  fit: string;
  size: string;
  intendedFit: string;
  description: string;
  matchTip: string;
  avoidTip: string;
};

const EMPTY_DRAFT: EditableClosetFields = {
  category: "",
  subCategory: "",
  detailCategory: "",
  color: "",
  style: "",
  styleTags: ["데일리"],
  seasons: ["사계절"],
  fit: "",
  size: "",
  intendedFit: "상관없음",
  description: "",
  matchTip: "",
  avoidTip: "",
};

const STYLE_OPTIONS = [
  "캐주얼",
  "미니멀",
  "스트릿",
  "포멀",
  "스포티",
  "빈티지",
  "아메카지",
  "워크웨어",
  "시티보이",
  "고프코어",
  "테크웨어",
  "프레피",
  "댄디",
  "러블리",
  "페미닌",
  "모던",
  "클래식",
  "꾸안꾸",
  "유니섹스",
  "기타",
];

const INTENDED_FIT_OPTIONS = ["딱 맞게", "여유 있게", "오버핏", "상관없음"];
const SEASON_OPTIONS = ["봄", "여름", "가을", "겨울", "사계절"];
const STYLE_TAG_OPTIONS = [
  "미니멀",
  "캐주얼",
  "스트릿",
  "댄디",
  "포멀",
  "스포티",
  "아메카지",
  "고프코어",
  "빈티지",
  "러블리",
  "페미닌",
  "모던",
  "클래식",
  "데일리",
  "편안함",
  "깔끔함",
  "꾸안꾸",
];

function getItemStyleTags(item: ClosetItem) {
  if (item.styleTags?.length) return item.styleTags;
  if (item.style) return [item.style];

  return ["데일리"];
}

function getItemSeasons(item: ClosetItem) {
  if (item.seasons?.length) return item.seasons;
  if (item.season) {
    const seasons = SEASON_OPTIONS.filter((season) => item.season?.includes(season));

    return seasons.length > 0 ? seasons : ["사계절"];
  }

  return ["사계절"];
}

function toggleSeason(currentSeasons: string[], season: string) {
  if (season === "사계절") return ["사계절"];

  const nextSeasons = currentSeasons.includes(season)
    ? currentSeasons.filter((currentSeason) => currentSeason !== season)
    : [...currentSeasons.filter((currentSeason) => currentSeason !== "사계절"), season];

  return nextSeasons.length > 0 ? nextSeasons : ["사계절"];
}

function toggleStyleTag(currentTags: string[], tag: string) {
  if (currentTags.includes(tag)) {
    const nextTags = currentTags.filter((currentTag) => currentTag !== tag);
    return nextTags.length > 0 ? nextTags : ["데일리"];
  }

  if (currentTags.length >= 3) return currentTags;

  return [...currentTags, tag];
}

function getEditableValues(item: ClosetItem): EditableClosetFields {
  return {
    category: item.category || "",
    subCategory: item.subCategory || "",
    detailCategory: item.detailCategory || "",
    color: item.color || "",
    style: item.style || "",
    styleTags: getItemStyleTags(item),
    seasons: getItemSeasons(item),
    fit: item.fit || "",
    size: item.size || "",
    intendedFit: item.intendedFit || "상관없음",
    description: item.description || "",
    matchTip: item.matchTip || "",
    avoidTip: item.avoidTip || "",
  };
}

function ChipGroup({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const isActive = value === option;

          return (
            <Pressable
              key={option}
              style={[styles.optionChip, isActive && styles.optionChipActive]}
              onPress={() => onSelect(option)}
            >
              <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiChipGroup({
  label,
  values,
  options,
  onSelect,
}: {
  label: string;
  values: string[];
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const isActive = values.includes(option);

          return (
            <Pressable
              key={option}
              style={[styles.optionChip, isActive && styles.optionChipActive]}
              onPress={() => onSelect(option)}
            >
              <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "분석 전"}</Text>
    </View>
  );
}

function getBooleanLabel(value?: boolean) {
  return value ? "감지됨" : "없음";
}

function getAiAnalysisRows(item: ClosetItem) {
  return [
    { label: "브랜드", value: item.brand || "판단 어려움" },
    { label: "브랜드 신뢰도", value: `${item.brandConfidence ?? 0}%` },
    { label: "로고", value: getBooleanLabel(item.logoDetected) },
    { label: "로고 텍스트", value: item.logoText || "없음" },
    { label: "프린팅/그래픽", value: item.graphicType || "판단 어려움" },
    { label: "그래픽 크기", value: item.graphicSize || "판단 어려움" },
    { label: "소재", value: item.material || "판단 어려움" },
    { label: "패턴", value: item.pattern || "판단 어려움" },
  ];
}

function AiDetailCard({ item }: { item: ClosetItem }) {
  return (
    <View style={styles.aiDetailCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="cpu" size={16} color="#8c6f47" />
        </View>
        <View>
          <Text style={styles.tipTitle}>AI 상세 분석</Text>
          <Text style={styles.aiDetailSubtitle}>브랜드, 로고, 소재 정보를 AI가 추정했어요.</Text>
        </View>
      </View>

      <View style={styles.aiDetailGrid}>
        {getAiAnalysisRows(item).map((row) => (
          <View key={row.label} style={styles.aiDetailPill}>
            <Text style={styles.aiDetailLabel}>{row.label}</Text>
            <Text style={styles.aiDetailValue} numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProductReferenceCard({ item }: { item: ClosetItem }) {
  const candidate = item.selectedProductCandidate;

  if (!candidate) return null;

  return (
    <View style={styles.productReferenceCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name="bookmark" size={16} color="#8c6f47" />
        </View>
        <View>
          <Text style={styles.tipTitle}>참고 상품</Text>
          <Text style={styles.aiDetailSubtitle}>사용자가 직접 선택한 참고용 상품이에요.</Text>
        </View>
      </View>

      <Text style={styles.productReferenceBrand}>{candidate.brand}</Text>
      <Text style={styles.productReferenceName}>{candidate.productName}</Text>
      <Text style={styles.productReferenceReason}>{candidate.reason}</Text>
      {typeof candidate.confidence === "number" && (
        <Text style={styles.productReferenceConfidence}>
          참고 유사도 {Math.round(candidate.confidence * 100)}%
        </Text>
      )}
    </View>
  );
}

function EditRow({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="입력해주세요"
        placeholderTextColor="#b2aaa1"
      />
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

function TipEditCard({
  icon,
  title,
  value,
  onChangeText,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconCircle}>
          <Feather name={icon} size={16} color="#8c6f47" />
        </View>
        <Text style={styles.tipTitle}>{title}</Text>
      </View>
      <TextInput
        style={styles.tipInput}
        value={value}
        onChangeText={onChangeText}
        placeholder="입력해주세요"
        placeholderTextColor="#b2aaa1"
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

export default function ClothesDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<EditableClosetFields>(EMPTY_DRAFT);

  useFocusEffect(
    useCallback(() => {
      async function loadItem() {
        const [closetItems, userProfile] = await Promise.all([
          getClosetItems(),
          getUserProfile(),
        ]);
        const selectedItem = closetItems.find((closetItem) => closetItem.id === id);

        setProfile(userProfile);
        setItem(selectedItem || null);
        if (selectedItem) {
          setDraft(getEditableValues(selectedItem));
        }
        setIsLoaded(true);
      }

      loadItem();
    }, [id])
  );

  function updateDraft<K extends keyof EditableClosetFields>(field: K, value: EditableClosetFields[K]) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function updateDraftSeasons(season: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      seasons: toggleSeason(currentDraft.seasons, season),
    }));
  }

  function updateDraftStyleTags(tag: string) {
    setDraft((currentDraft) => {
      const styleTags = toggleStyleTag(currentDraft.styleTags, tag);

      return {
        ...currentDraft,
        styleTags,
        style: styleTags[0] || currentDraft.style,
      };
    });
  }

  function handleEdit() {
    if (!item) return;

    setDraft(getEditableValues(item));
    setEditMode(true);
  }

  function handleCancel() {
    if (item) {
      setDraft(getEditableValues(item));
    }

    setEditMode(false);
  }

  async function handleSave() {
    if (!item) return;

    try {
      const updatedCloset = await updateClosetItem(item.id, {
        ...draft,
        style: draft.styleTags[0] || draft.style,
        season: draft.seasons.join(", "),
      });
      const updatedItem = updatedCloset.find((closetItem) => closetItem.id === item.id);

      if (!updatedItem) {
        Alert.alert("수정 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      setItem(updatedItem);
      setDraft(getEditableValues(updatedItem));
      setEditMode(false);
    } catch (error) {
      console.log("옷 정보 수정 실패:", error);
      Alert.alert("수정 실패", "옷 정보를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  const fitSuitability = item ? getFitSuitability(item, profile) : null;

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

          {editMode ? (
            <View style={styles.editActionRow}>
              <Pressable style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>취소</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>저장</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>수정</Text>
            </Pressable>
          )}
        </View>

        {item && (
          <>
            <Image source={{ uri: item.cleanImageUri || item.imageUri }} style={styles.heroImage} />

            <View style={styles.summaryCard}>
              <Text style={styles.itemTitle}>
                {item.detailCategory || item.subCategory || item.category}
              </Text>
              <Text style={styles.itemSubtitle}>
                {item.category}{item.color ? ` · ${item.color}` : ""}
              </Text>
            </View>

            <View style={styles.infoCard}>
              {editMode ? (
                <>
                  <EditRow
                    label="종류"
                    value={draft.category}
                    onChangeText={(value) => updateDraft("category", value)}
                  />
                  <EditRow
                    label="기본 종류"
                    value={draft.subCategory}
                    onChangeText={(value) => updateDraft("subCategory", value)}
                  />
                  <EditRow
                    label="상세 종류"
                    value={draft.detailCategory}
                    onChangeText={(value) => updateDraft("detailCategory", value)}
                  />
                  <EditRow
                    label="색상"
                    value={draft.color}
                    onChangeText={(value) => updateDraft("color", value)}
                  />
                  <ChipGroup
                    label="스타일"
                    value={draft.style}
                    options={STYLE_OPTIONS}
                    onSelect={(value) => updateDraft("style", value)}
                  />
                  <MultiChipGroup
                    label="스타일 태그"
                    values={draft.styleTags}
                    options={STYLE_TAG_OPTIONS}
                    onSelect={updateDraftStyleTags}
                  />
                  <MultiChipGroup
                    label="계절"
                    values={draft.seasons}
                    options={SEASON_OPTIONS}
                    onSelect={updateDraftSeasons}
                  />
                  <EditRow
                    label="핏"
                    value={draft.fit}
                    onChangeText={(value) => updateDraft("fit", value)}
                  />
                  <EditRow
                    label="사이즈"
                    value={draft.size}
                    onChangeText={(value) => updateDraft("size", value)}
                  />
                  <ChipGroup
                    label="착용 의도"
                    value={draft.intendedFit}
                    options={INTENDED_FIT_OPTIONS}
                    onSelect={(value) => updateDraft("intendedFit", value)}
                  />
                </>
              ) : (
                <>
                  <DetailRow label="종류" value={item.category} />
                  <DetailRow label="기본 종류" value={item.subCategory} />
                  <DetailRow label="상세 종류" value={item.detailCategory || item.subCategory} />
                  <DetailRow label="색상" value={item.color} />
                  <DetailRow label="스타일" value={item.style} />
                  <DetailRow label="스타일 태그" value={getItemStyleTags(item).map((tag) => `#${tag}`).join(" ")} />
                  <DetailRow label="계절" value={getItemSeasons(item).join(", ")} />
                  <DetailRow label="핏" value={item.fit} />
                  <DetailRow label="사이즈" value={item.size || "사이즈 미입력"} />
                  <DetailRow label="착용 의도" value={item.intendedFit || "상관없음"} />
                </>
              )}
            </View>

            {!editMode && <AiDetailCard item={item} />}

            {!editMode && <ProductReferenceCard item={item} />}

            {!editMode && fitSuitability && (
              <View style={styles.sizeMatchCard}>
                <View style={styles.tipHeader}>
                  <View style={styles.tipIconCircle}>
                    <Feather name="check-square" size={16} color="#8c6f47" />
                  </View>
                  <Text style={styles.tipTitle}>내 사이즈 적합도</Text>
                </View>
                <Text style={styles.sizeMatchStatus}>{fitSuitability.status}</Text>
                <Text style={styles.tipText}>{fitSuitability.description}</Text>
              </View>
            )}

            {editMode ? (
              <>
                <TipEditCard
                  icon="file-text"
                  title="특징"
                  value={draft.description}
                  onChangeText={(value) => updateDraft("description", value)}
                />
                <TipEditCard
                  icon="check-circle"
                  title="매치 팁"
                  value={draft.matchTip}
                  onChangeText={(value) => updateDraft("matchTip", value)}
                />
                <TipEditCard
                  icon="x-circle"
                  title="피하면 좋은 조합"
                  value={draft.avoidTip}
                  onChangeText={(value) => updateDraft("avoidTip", value)}
                />
              </>
            ) : (
              <>
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

  editButton: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  editButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },

  editActionRow: {
    flexDirection: "row",
    gap: 7,
  },

  cancelButton: {
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  cancelButtonText: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },

  saveButton: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },

  saveButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
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

  editRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee7dd",
  },

  textInput: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    color: "#111",
    fontSize: 15,
    fontWeight: "800",
  },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  optionChip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },

  optionChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },

  optionChipText: {
    color: "#111",
    fontSize: 13,
    fontWeight: "900",
  },

  optionChipTextActive: {
    color: "#fff",
  },

  tipCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  sizeMatchCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  aiDetailCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  aiDetailSubtitle: {
    color: "#8a8178",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },

  aiDetailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  aiDetailPill: {
    width: "48%",
    backgroundColor: "#faf8f5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },

  aiDetailLabel: {
    color: "#8a8178",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 5,
  },

  aiDetailValue: {
    color: "#111",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },

  productReferenceCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eee7dd",
    marginBottom: 12,
  },

  productReferenceBrand: {
    color: "#8c6f47",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4,
  },

  productReferenceName: {
    color: "#111",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 7,
  },

  productReferenceReason: {
    color: "#625a51",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },

  productReferenceConfidence: {
    color: "#8c6f47",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
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

  sizeMatchStatus: {
    color: "#111",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

  tipText: {
    color: "#625a51",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
  },

  tipInput: {
    minHeight: 96,
    backgroundColor: "#faf8f5",
    borderWidth: 1,
    borderColor: "#eee7dd",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 13,
    color: "#111",
    fontSize: 14,
    lineHeight: 21,
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
