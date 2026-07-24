import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { DESIGN_PREVIEW_ITEMS } from "@/components/design-preview/designPreviewData";

type OutfitOption = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  itemIndexes: number[];
};

const DAYS = [
  { label: "월", date: 20 },
  { label: "화", date: 21 },
  { label: "수", date: 22 },
  { label: "목", date: 23 },
  { label: "금", date: 24 },
  { label: "토", date: 25 },
  { label: "일", date: 26 },
];

const OUTFITS: OutfitOption[] = [
  {
    id: "quiet-office",
    title: "가벼운 미니멀 출근 룩",
    description: "얇은 니트와 차콜 팬츠라 24°의 실내외 이동에 편안해요.",
    tags: ["출근", "미니멀"],
    itemIndexes: [1, 3, 5],
  },
  {
    id: "clean-denim",
    title: "단정한 데님 데일리 룩",
    description: "네이비 셔츠와 밝은 데님으로 금요일 분위기를 가볍게 맞췄어요.",
    tags: ["데일리", "깔끔함"],
    itemIndexes: [0, 4, 5],
  },
  {
    id: "soft-layer",
    title: "편안한 소프트 레이어 룩",
    description: "후디와 트렌치를 겹쳐 퇴근 후 저녁 일정까지 자연스러워요.",
    tags: ["편안함", "저녁 약속"],
    itemIndexes: [2, 6, 3],
  },
];

function OutfitImage({
  index,
  style,
}: {
  index: number;
  style: object;
}) {
  const item = DESIGN_PREVIEW_ITEMS[index];

  return (
    <Image
      source={item.image}
      resizeMode="contain"
      style={[styles.outfitImage, style]}
    />
  );
}

function PhoneNav() {
  const items = [
    ["home", "홈"],
    ["grid", "옷장"],
    ["plus", "추가"],
    ["star", "코디"],
    ["user", "마이"],
  ] as const;

  return (
    <View style={styles.phoneNav}>
      {items.map(([icon, label], index) => {
        const active = index === 0;
        const center = index === 2;
        return (
          <View key={label} style={styles.navItem}>
            <View
              style={[
                styles.navIcon,
                center && styles.navIconCenter,
                active && !center && styles.navIconActive,
              ]}
            >
              <Feather
                name={icon}
                size={center ? 17 : 15}
                color={center ? "#FFFFFF" : active ? "#1D1D1B" : "#99938B"}
              />
            </View>
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TodayPickPhone({ compact }: { compact: boolean }) {
  const [selectedDay, setSelectedDay] = useState(4);
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const outfit = OUTFITS[outfitIndex];

  const contextLabel = useMemo(() => {
    if (selectedDay === 4) return "24° · 출근 · 맑음";
    if (selectedDay >= 5) return "26° · 가벼운 외출";
    return "23° · 일상 일정";
  }, [selectedDay]);

  function selectDay(index: number) {
    setSelectedDay(index);
    setOutfitIndex(index % OUTFITS.length);
    setSelectedOutfitId(null);
  }

  function showNextOutfit() {
    setOutfitIndex((current) => (current + 1) % OUTFITS.length);
    setSelectedOutfitId(null);
  }

  function selectOutfit() {
    setSelectedOutfitId(outfit.id);
  }

  return (
    <View style={styles.phone}>
      <View style={[styles.phoneContent, compact && styles.phoneContentCompact]}>
        <View style={styles.phoneHeader}>
          <Text style={styles.logo}>NAES</Text>
          <Pressable style={styles.headerIcon}>
            <Feather name="bell" size={17} color="#1D1D1B" />
          </Pressable>
        </View>

        <View style={styles.todayHeading}>
          <View style={styles.todayHeadingCopy}>
            <Text style={styles.eyebrow}>TODAY · JUL 24</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>
              오늘 입을 한 벌
            </Text>
          </View>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepCurrent}>1</Text>
            <Text style={styles.stepTotal}> / 3</Text>
          </View>
        </View>

        <View style={[styles.week, compact && styles.weekCompact]}>
          {DAYS.map((day, index) => {
            const selected = index === selectedDay;
            return (
              <Pressable
                key={day.label}
                style={[styles.day, selected && styles.daySelected]}
                onPress={() => selectDay(index)}
              >
                <Text style={[styles.dayLabel, selected && styles.dayTextSelected]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayDate, selected && styles.dayTextSelected]}>
                  {day.date}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.contextRow}>
          <View style={styles.contextDot}>
            <Feather name="sun" size={13} color="#75563C" />
          </View>
          <Text style={styles.contextText}>{contextLabel}</Text>
          <Text style={styles.contextEdit}>조건 변경</Text>
        </View>

        <View style={styles.cardStage}>
          <View style={styles.cardBehind} />
          <View style={[styles.outfitCard, compact && styles.outfitCardCompact]}>
            <View style={styles.imageStage}>
              <OutfitImage index={outfit.itemIndexes[0]} style={styles.topImage} />
              <OutfitImage
                index={outfit.itemIndexes[1]}
                style={styles.bottomImage}
              />
              <OutfitImage
                index={outfit.itemIndexes[2]}
                style={styles.shoesImage}
              />
              <View style={styles.cardCount}>
                <Text style={styles.cardCountText}>{outfitIndex + 1} / 3</Text>
              </View>
            </View>
            <View style={styles.cardCopy}>
              <View style={styles.tagRow}>
                {outfit.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.outfitTitle}>{outfit.title}</Text>
              <Text
                style={styles.outfitDescription}
                numberOfLines={compact ? 1 : 2}
              >
                {outfit.description}
              </Text>
            </View>
          </View>
        </View>

        {selectedOutfitId === outfit.id ? (
          <View style={styles.selectedBanner}>
            <View style={styles.selectedIcon}>
              <Feather name="check" size={15} color="#FFFFFF" />
            </View>
            <View style={styles.selectedCopy}>
              <Text style={styles.selectedTitle}>금요일 코디로 선택했어요</Text>
              <Text style={styles.selectedText}>저장한 코디에서 다시 볼 수 있어요.</Text>
            </View>
            <Pressable onPress={() => setSelectedOutfitId(null)}>
              <Text style={styles.undoText}>취소</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.actions, compact && styles.actionsCompact]}>
            <Pressable style={styles.rejectButton} onPress={showNextOutfit}>
              <Feather name="x" size={19} color="#6F6A64" />
              <Text style={styles.rejectText}>다른 코디</Text>
            </Pressable>
            <Pressable style={styles.acceptButton} onPress={selectOutfit}>
              <Feather name="check" size={19} color="#FFFFFF" />
              <Text style={styles.acceptText}>이 코디 선택</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.gestureHint}>
          카드를 좌우로 넘겨도 코디를 바꿀 수 있어요
        </Text>
      </View>
      <PhoneNav />
    </View>
  );
}

export default function TodayPickPreview() {
  const params = useLocalSearchParams<{ standalone?: string | string[] }>();
  const { width, height } = useWindowDimensions();
  const standaloneParam = Array.isArray(params.standalone)
    ? params.standalone[0]
    : params.standalone;
  const desktop = width >= 920 && standaloneParam !== "1";
  const compact = height < 820;

  if (!desktop) {
    return (
      <View style={styles.standalonePage}>
        <TodayPickPhone compact={compact} />
      </View>
    );
  }

  return (
    <View style={styles.previewPage}>
      <View style={styles.rationale}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.push("/design-preview/lab?id=23")}
        >
          <Feather name="arrow-left" size={17} color="#1D1D1B" />
          <Text style={styles.backText}>50개 시안으로</Text>
        </Pressable>
        <Text style={styles.previewEyebrow}>RECOMMENDED HYBRID · 23 + 46</Text>
        <Text style={styles.previewTitle}>오늘 한 장</Text>
        <Text style={styles.previewDescription}>
          일정으로 오늘의 조건을 고르고, 한 번에 코디 한 장만 비교합니다.
          달력과 선택 카드가 서로 다른 역할을 맡아 처음 쓰는 사람도 흐름을
          놓치지 않아요.
        </Text>

        <View style={styles.flow}>
          {[
            ["01", "날짜 선택", "주간 일정에서 입을 날을 고릅니다."],
            ["02", "한 장 비교", "조건에 맞는 코디를 하나씩 봅니다."],
            ["03", "확정", "마음에 들면 오늘 코디로 저장합니다."],
          ].map(([number, title, text]) => (
            <View key={number} style={styles.flowRow}>
              <Text style={styles.flowNumber}>{number}</Text>
              <View style={styles.flowCopy}>
                <Text style={styles.flowTitle}>{title}</Text>
                <Text style={styles.flowText}>{text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.decisionNote}>
          <Text style={styles.decisionLabel}>제가 추천하는 이유</Text>
          <Text style={styles.decisionText}>
            23번의 정보 구조는 재방문에 강하고, 46번의 선택 방식은 설명을
            읽지 않아도 이해됩니다. 스와이프만 강제하지 않고 버튼을 함께 둬
            초보자와 익숙한 사용자 모두 편하게 쓸 수 있습니다.
          </Text>
        </View>
      </View>

      <View style={styles.phoneFrame}>
        <TodayPickPhone compact={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewPage: {
    flex: 1,
    minHeight: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 72,
    paddingHorizontal: 40,
    paddingVertical: 32,
    backgroundColor: "#EAE7E1",
  },
  rationale: {
    width: 420,
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  backText: {
    color: "#55504A",
    fontSize: 12,
    fontWeight: "700",
  },
  previewEyebrow: {
    color: "#8C6F47",
    fontSize: 10,
    fontWeight: "800",
  },
  previewTitle: {
    color: "#171716",
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "900",
    marginTop: 10,
  },
  previewDescription: {
    color: "#66615B",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "600",
    marginTop: 14,
  },
  flow: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "#CFCAC2",
  },
  flowRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#CFCAC2",
  },
  flowNumber: {
    width: 30,
    color: "#8C6F47",
    fontSize: 11,
    fontWeight: "900",
  },
  flowCopy: {
    flex: 1,
    minWidth: 0,
  },
  flowTitle: {
    color: "#1D1D1B",
    fontSize: 14,
    fontWeight: "800",
  },
  flowText: {
    color: "#77716A",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 3,
  },
  decisionNote: {
    marginTop: 24,
    padding: 18,
    borderRadius: 4,
    backgroundColor: "#F6F2EB",
  },
  decisionLabel: {
    color: "#8C6F47",
    fontSize: 10,
    fontWeight: "800",
  },
  decisionText: {
    color: "#504B45",
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 7,
  },
  phoneFrame: {
    width: 390,
    height: 844,
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#C9C4BC",
    backgroundColor: "#F8F6F1",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  standalonePage: {
    flex: 1,
    width: "100%",
    maxWidth: 390,
    alignSelf: "center",
    backgroundColor: "#F8F6F1",
  },
  phone: {
    flex: 1,
    backgroundColor: "#F8F6F1",
  },
  phoneContent: {
    flex: 1,
    minHeight: 0,
    paddingTop: 22,
    paddingHorizontal: 17,
    paddingBottom: 9,
  },
  phoneContentCompact: {
    paddingTop: 14,
  },
  phoneHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    color: "#1D1D1B",
    fontSize: 15,
    fontWeight: "900",
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  todayHeading: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  todayHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: "#8C6F47",
    fontSize: 8,
    fontWeight: "900",
  },
  title: {
    color: "#171716",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingBottom: 3,
  },
  stepCurrent: {
    color: "#1D1D1B",
    fontSize: 18,
    fontWeight: "900",
  },
  stepTotal: {
    color: "#AAA39A",
    fontSize: 10,
    fontWeight: "700",
  },
  week: {
    minHeight: 60,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekCompact: {
    minHeight: 54,
    marginTop: 8,
  },
  day: {
    width: 43,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  daySelected: {
    backgroundColor: "#1D1D1B",
  },
  dayLabel: {
    color: "#9B958E",
    fontSize: 8,
    fontWeight: "800",
  },
  dayDate: {
    color: "#4D4944",
    fontSize: 12,
    fontWeight: "900",
  },
  dayTextSelected: {
    color: "#FFFFFF",
  },
  contextRow: {
    minHeight: 40,
    marginTop: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: "#EEE7DC",
  },
  contextDot: {
    width: 25,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#FFFDF9",
  },
  contextText: {
    flex: 1,
    minWidth: 0,
    color: "#514A42",
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 8,
  },
  contextEdit: {
    color: "#8C6F47",
    fontSize: 9,
    fontWeight: "800",
  },
  cardStage: {
    flex: 1,
    minHeight: 0,
    marginTop: 13,
    position: "relative",
  },
  cardBehind: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 8,
    bottom: -5,
    borderRadius: 18,
    backgroundColor: "#DDD5CA",
    transform: [{ rotate: "-1.2deg" }],
  },
  outfitCard: {
    flex: 1,
    minHeight: 350,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3DED6",
  },
  outfitCardCompact: {
    minHeight: 310,
  },
  imageStage: {
    flex: 1,
    minHeight: 0,
    position: "relative",
    backgroundColor: "#E8E1D6",
  },
  outfitImage: {
    position: "absolute",
  },
  topImage: {
    width: "46%",
    height: "80%",
    left: 6,
    top: 3,
  },
  bottomImage: {
    width: "45%",
    height: "88%",
    right: 8,
    top: 7,
  },
  shoesImage: {
    width: "31%",
    height: "38%",
    right: 12,
    bottom: 1,
  },
  cardCount: {
    position: "absolute",
    right: 10,
    top: 10,
    minWidth: 38,
    height: 24,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  cardCountText: {
    color: "#403A34",
    fontSize: 8,
    fontWeight: "900",
  },
  cardCopy: {
    minHeight: 114,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tagRow: {
    flexDirection: "row",
    gap: 5,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F2EEE8",
  },
  tagText: {
    color: "#7B6C5B",
    fontSize: 8,
    fontWeight: "800",
  },
  outfitTitle: {
    color: "#1D1D1B",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    marginTop: 8,
  },
  outfitDescription: {
    color: "#77716A",
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  actions: {
    minHeight: 62,
    marginTop: 11,
    flexDirection: "row",
    gap: 8,
  },
  actionsCompact: {
    minHeight: 54,
    marginTop: 8,
  },
  rejectButton: {
    width: 110,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#D8D2CA",
    backgroundColor: "#FFFFFF",
  },
  rejectText: {
    color: "#6F6A64",
    fontSize: 11,
    fontWeight: "800",
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 17,
    backgroundColor: "#1D1D1B",
  },
  acceptText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  selectedBanner: {
    minHeight: 62,
    marginTop: 11,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 17,
    backgroundColor: "#1D1D1B",
  },
  selectedIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#8C6F47",
  },
  selectedCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitle: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  selectedText: {
    color: "#BEB9B1",
    fontSize: 8,
    fontWeight: "600",
    marginTop: 2,
  },
  undoText: {
    color: "#D6BC97",
    fontSize: 9,
    fontWeight: "800",
  },
  gestureHint: {
    color: "#9D9790",
    fontSize: 8,
    textAlign: "center",
    fontWeight: "600",
    marginTop: 6,
  },
  phoneNav: {
    height: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E3DED6",
    backgroundColor: "#FFFDF9",
  },
  navItem: {
    width: 54,
    alignItems: "center",
    gap: 3,
  },
  navIcon: {
    width: 28,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconCenter: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: "#8C6F47",
  },
  navIconActive: {
    borderRadius: 14,
    backgroundColor: "#F0E9DF",
  },
  navLabel: {
    color: "#99938B",
    fontSize: 8,
    fontWeight: "700",
  },
  navLabelActive: {
    color: "#1D1D1B",
    fontWeight: "900",
  },
});
