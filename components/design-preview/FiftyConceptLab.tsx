import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ViewStyle,
  useWindowDimensions,
  View,
} from "react-native";

import {
  DESIGN_PREVIEW_ITEMS,
  DESIGN_PREVIEW_OUTFIT_ITEMS,
} from "@/components/design-preview/designPreviewData";

type LabFamily = "direct" | "visual" | "daily" | "utility" | "experimental";

type LabPalette = {
  background: string;
  surface: string;
  soft: string;
  text: string;
  muted: string;
  accent: string;
  inverse: string;
  border: string;
};

type LabConcept = {
  id: string;
  name: string;
  koreanName: string;
  description: string;
  family: LabFamily;
  variant: number;
  palette: LabPalette;
};

const PALETTES: LabPalette[] = [
  {
    background: "#F5F0E7",
    surface: "#FFFDF8",
    soft: "#EAE1D5",
    text: "#211D18",
    muted: "#766F66",
    accent: "#8B3C2B",
    inverse: "#FFFFFF",
    border: "#D9CFC1",
  },
  {
    background: "#F1F3EF",
    surface: "#FFFFFF",
    soft: "#E1E8E1",
    text: "#142019",
    muted: "#68736C",
    accent: "#2E634B",
    inverse: "#FFFFFF",
    border: "#D2DAD3",
  },
  {
    background: "#F3F3F1",
    surface: "#FFFFFF",
    soft: "#E5E5E1",
    text: "#151617",
    muted: "#6E7071",
    accent: "#17191C",
    inverse: "#FFFFFF",
    border: "#D7D7D2",
  },
  {
    background: "#F4F0EA",
    surface: "#FFFCF7",
    soft: "#E5DCD0",
    text: "#241C18",
    muted: "#786D66",
    accent: "#684737",
    inverse: "#FFFFFF",
    border: "#D8CEC3",
  },
  {
    background: "#EEF1F3",
    surface: "#FFFFFF",
    soft: "#DDE5E9",
    text: "#121A20",
    muted: "#66717A",
    accent: "#1B5D75",
    inverse: "#FFFFFF",
    border: "#D1DADF",
  },
  {
    background: "#F7F3EA",
    surface: "#FFFFFF",
    soft: "#EEE5D5",
    text: "#1E1B16",
    muted: "#756E62",
    accent: "#A66B1F",
    inverse: "#FFFFFF",
    border: "#DDD3C3",
  },
  {
    background: "#121315",
    surface: "#1C1E21",
    soft: "#292C30",
    text: "#F3F0EA",
    muted: "#AAA69E",
    accent: "#D4A15D",
    inverse: "#161719",
    border: "#35383D",
  },
  {
    background: "#F4EDF0",
    surface: "#FFF9FB",
    soft: "#EADDE2",
    text: "#2A1D23",
    muted: "#806F77",
    accent: "#79394F",
    inverse: "#FFFFFF",
    border: "#DACBD1",
  },
  {
    background: "#F0EFE9",
    surface: "#FCFBF6",
    soft: "#DFDED5",
    text: "#1C1D1B",
    muted: "#73746F",
    accent: "#555C3A",
    inverse: "#FFFFFF",
    border: "#D1D0C7",
  },
  {
    background: "#F8F8F6",
    surface: "#FFFFFF",
    soft: "#ECEDEA",
    text: "#111312",
    muted: "#6C716E",
    accent: "#4A55A2",
    inverse: "#FFFFFF",
    border: "#DBDDDA",
  },
];

const GROUPS: {
  family: LabFamily;
  label: string;
  summary: string;
  concepts: [string, string, string][];
}[] = [
  {
    family: "direct",
    label: "직접 선택형",
    summary: "사용자가 원하는 일을 먼저 고르는 구조",
    concepts: [
      ["Two Doors", "두 개의 문", "오늘 코디와 새 상품 핏을 화면 절반씩 나눔"],
      ["Split Horizon", "가로 분할", "위는 오늘 코디, 아래는 새 옷 확인"],
      ["Swipe Choice", "한 장씩 선택", "두 목적을 카드 한 장씩 넘기는 구조"],
      ["Giant Type", "큰 글자 선택", "이미지 없이 두 문장만 크게 제시"],
      ["One Question", "한 가지 질문", "질문 아래 두 답변으로 시작"],
      ["Action Rail", "세로 행동 레일", "왼쪽 번호와 오른쪽 설명을 연결"],
      ["Thumb Dock", "엄지손가락 도크", "하단 두 버튼만으로 모든 행동 시작"],
      ["Voice Prompt", "음성형 진입", "큰 마이크와 짧은 말하기 예시"],
      ["Command Search", "명령 검색", "원하는 일을 검색창에 입력하는 구조"],
      ["Task Stack", "할 일 스택", "오늘 필요한 세 작업을 우선순위로 표시"],
    ],
  },
  {
    family: "visual",
    label: "이미지 중심형",
    summary: "메뉴보다 옷과 코디 이미지를 먼저 보여주는 구조",
    concepts: [
      ["Outfit First", "코디 먼저", "홈 전체를 오늘의 한 코디로 사용"],
      ["Lookbook Cover", "룩북 표지", "잡지 표지처럼 이미지와 타이포를 겹침"],
      ["Wardrobe Stage", "옷장 무대", "내 옷 세 벌을 실제 무대처럼 배치"],
      ["Floating Garments", "떠 있는 옷", "배경 위에 옷을 자유롭게 배치"],
      ["Polaroid Stack", "폴라로이드", "코디 후보를 겹친 사진으로 보여줌"],
      ["Magazine Spread", "매거진 펼침", "이미지와 설명을 좌우 면으로 분리"],
      ["Product Shelf", "상품 선반", "옷을 선반 위 상품처럼 가로 정렬"],
      ["Outfit Collage", "코디 콜라주", "각 아이템을 크기가 다른 조각으로 배치"],
      ["Color Story", "색상 이야기", "오늘의 색 팔레트에서 코디로 진입"],
      ["Mirror Frame", "거울 프레임", "전신 거울 안에 추천 코디를 배치"],
    ],
  },
  {
    family: "daily",
    label: "오늘 중심형",
    summary: "재방문 사용자가 오늘 입을 결과를 즉시 보는 구조",
    concepts: [
      ["Daily Brief", "오늘의 브리핑", "날씨와 추천 한 장을 뉴스처럼 요약"],
      ["Weather First", "날씨 먼저", "기온과 강수 상태가 첫 화면의 중심"],
      ["Calendar Outfit", "달력 코디", "오늘 날짜를 선택하면 코디가 열림"],
      ["Morning Timeline", "아침 타임라인", "날씨부터 저장까지 시간 순서로 안내"],
      ["Week Strip", "일주일 코디", "7일 코디 중 오늘을 강조"],
      ["Occasion Picker", "상황 선택", "출근·데이트·산책 중 먼저 선택"],
      ["Mood Dial", "기분 다이얼", "오늘 원하는 분위기를 원형 선택기로 고름"],
      ["Temperature Scale", "온도 눈금", "온도 구간에 맞는 옷을 선형으로 제안"],
      ["Wear Again", "다시 입기", "최근 만족한 코디를 빠르게 반복"],
      ["Saved First", "저장 코디 먼저", "저장한 코디에서 오늘 입을 옷을 선택"],
    ],
  },
  {
    family: "utility",
    label: "관리·도구형",
    summary: "옷이 많아져도 빠르게 탐색하는 구조",
    concepts: [
      ["Readiness Checklist", "준비 체크", "추천 가능 여부를 체크리스트로 표시"],
      ["Progress Path", "진행 경로", "등록부터 추천까지 한 줄 진행도"],
      ["Minimal Rows", "최소 목록", "카드 없이 행과 구분선만 사용"],
      ["Command Center", "명령 센터", "핵심 수치와 행동을 한 화면에 압축"],
      ["Bento Status", "벤토 현황", "크기가 다른 정보 블록으로 구성"],
      ["Data Strip", "데이터 스트립", "옷장 상태를 수평 숫자 띠로 표현"],
      ["Category Wheel", "카테고리 휠", "상의·하의·신발을 원형으로 탐색"],
      ["Closet Map", "옷장 지도", "카테고리를 공간 지도처럼 배치"],
      ["Quick Filter", "필터 우선", "필터를 먼저 고르면 추천이 나타남"],
      ["Smart Queue", "스마트 대기열", "지금 처리할 항목을 순서대로 제시"],
    ],
  },
  {
    family: "experimental",
    label: "실험형",
    summary: "일반적인 앱 홈에서 벗어난 새로운 진입 방식",
    concepts: [
      ["Bottom Sheet", "바텀시트 홈", "코디 이미지 위에 행동 시트가 올라옴"],
      ["Side Drawer", "사이드 서랍", "왼쪽 좁은 메뉴와 오른쪽 비주얼"],
      ["Fullscreen Prompt", "전체 질문", "화면 전체가 하나의 질문과 답변"],
      ["Card Deck", "카드 덱", "기능을 겹친 카드 순서로 탐색"],
      ["Radial Actions", "원형 행동", "중앙 옷장 주위로 행동을 배치"],
      ["Gesture Cards", "제스처 카드", "좋아요·다른 코디를 좌우 선택"],
      ["Wardrobe Terminal", "옷장 터미널", "명령문과 결과만 보여주는 모노 UI"],
      ["Boutique Counter", "편집숍 카운터", "직원이 추천서를 건네는 듯한 구조"],
      ["Stylist Note", "스타일리스트 메모", "손글씨 메모처럼 오늘의 제안을 전달"],
      ["Zero UI", "하나의 제안", "추천 한 줄과 수락·변경 두 행동만 표시"],
    ],
  },
];

export const LAB_CONCEPTS: LabConcept[] = GROUPS.flatMap(
  (group, groupIndex) =>
    group.concepts.map(([name, koreanName, description], variant) => {
      const number = groupIndex * 10 + variant + 1;
      return {
        id: String(number).padStart(2, "0"),
        name,
        koreanName,
        description,
        family: group.family,
        variant,
        palette: PALETTES[(number - 1) % PALETTES.length],
      };
    })
);

function GarmentImage({
  index,
  style,
  contain = true,
}: {
  index: number;
  style?: object;
  contain?: boolean;
}) {
  const item = DESIGN_PREVIEW_ITEMS[index % DESIGN_PREVIEW_ITEMS.length];
  return (
    <Image
      source={item.image}
      resizeMode={contain ? "contain" : "cover"}
      style={[styles.garmentImage, style]}
    />
  );
}

function PhoneHeader({
  concept,
  light = false,
}: {
  concept: LabConcept;
  light?: boolean;
}) {
  const color = light ? "#FFFFFF" : concept.palette.text;
  return (
    <View style={styles.phoneHeader}>
      <Text style={[styles.phoneLogo, { color }]}>NAES</Text>
      <Text style={[styles.phoneMeta, { color }]}>THU · 24°</Text>
    </View>
  );
}

function PhoneNav({ concept }: { concept: LabConcept }) {
  const palette = concept.palette;
  return (
    <View
      style={[
        styles.phoneNav,
        {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
      ]}
    >
      {[
        ["home", "홈"],
        ["grid", "옷장"],
        ["plus", "추가"],
        ["star", "코디"],
        ["user", "마이"],
      ].map(([icon, label], index) => (
        <View key={label} style={styles.phoneNavItem}>
          <View
            style={[
              styles.phoneNavIcon,
              index === 2 && {
                backgroundColor: palette.accent,
                borderRadius: concept.variant % 2 === 0 ? 999 : 5,
              },
            ]}
          >
            <Feather
              name={icon as keyof typeof Feather.glyphMap}
              size={index === 2 ? 18 : 15}
              color={
                index === 2
                  ? palette.inverse
                  : index === 0
                    ? palette.accent
                    : palette.muted
              }
            />
          </View>
          <Text
            style={[
              styles.phoneNavLabel,
              { color: index === 0 ? palette.accent : palette.muted },
            ]}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OutfitBoard({
  concept,
  style,
  itemCount = 3,
}: {
  concept: LabConcept;
  style?: object;
  itemCount?: number;
}) {
  return (
    <View
      style={[
        styles.outfitBoard,
        { backgroundColor: concept.palette.soft },
        style,
      ]}
    >
      {DESIGN_PREVIEW_OUTFIT_ITEMS.slice(0, itemCount).map((item, index) => (
        <Image
          key={item.id}
          source={item.image}
          resizeMode="contain"
          style={[
            styles.outfitBoardItem,
            {
              left: index === 0 ? "4%" : index === 1 ? "36%" : "68%",
              top: index === 2 ? "43%" : "8%",
              width: index === 2 ? "28%" : "31%",
              height: index === 2 ? "50%" : "78%",
            },
          ]}
        />
      ))}
    </View>
  );
}

function DirectLayout({ concept }: { concept: LabConcept }) {
  const p = concept.palette;
  const v = concept.variant;

  if (v === 0 || v === 1) {
    const horizontal = v === 1;
    return (
      <View style={styles.phoneFlex}>
        <PhoneHeader concept={concept} />
        <View
          style={[
            styles.directSplit,
            horizontal && styles.directSplitHorizontal,
          ]}
        >
          {[
            ["01", "오늘 코디 찾기", "sun"],
            ["02", "새 상품 핏 보기", "shopping-bag"],
          ].map(([number, title, icon], index) => (
            <View
              key={number}
              style={[
                styles.directDoor,
                {
                  backgroundColor: index === 0 ? p.accent : p.surface,
                  borderColor: p.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.doorNumber,
                  { color: index === 0 ? p.inverse : p.accent },
                ]}
              >
                {number}
              </Text>
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={22}
                color={index === 0 ? p.inverse : p.accent}
              />
              <Text
                style={[
                  styles.doorTitle,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {title}
              </Text>
              <Feather
                name="arrow-right"
                size={18}
                color={index === 0 ? p.inverse : p.text}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 2) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>
          SWIPE TO CHOOSE
        </Text>
        <Text style={[styles.labTitle, { color: p.text }]}>
          지금 필요한 한 가지
        </Text>
        <View style={styles.swipeStack}>
          <View style={[styles.swipeBack, { backgroundColor: p.soft }]} />
          <View style={[styles.swipeCard, { backgroundColor: p.accent }]}>
            <Feather name="sun" size={26} color={p.inverse} />
            <Text style={[styles.swipeTitle, { color: p.inverse }]}>
              오늘 입을 코디
            </Text>
            <Text style={[styles.swipeText, { color: p.inverse }]}>
              오른쪽으로 넘겨 바로 확인
            </Text>
          </View>
        </View>
        <View style={styles.swipeHint}>
          <Feather name="arrow-left" size={16} color={p.muted} />
          <Text style={[styles.smallText, { color: p.muted }]}>다른 목적</Text>
          <Feather name="arrow-right" size={16} color={p.muted} />
        </View>
      </View>
    );
  }

  if (v === 3) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.giantQuestion, { color: p.text }]}>
          오늘{"\n"}입을 옷
        </Text>
        <View style={[styles.giantRule, { backgroundColor: p.text }]} />
        <Text style={[styles.giantQuestion, { color: p.muted }]}>
          새 옷의{"\n"}실제 핏
        </Text>
        <View style={styles.giantFooter}>
          <Text style={[styles.smallText, { color: p.muted }]}>
            원하는 문장을 눌러 시작
          </Text>
          <Feather name="arrow-down" size={18} color={p.accent} />
        </View>
      </View>
    );
  }

  if (v === 4) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <View style={styles.questionCenter}>
          <Text style={[styles.labEyebrow, { color: p.accent }]}>ONE QUESTION</Text>
          <Text style={[styles.questionTitle, { color: p.text }]}>
            지금 가장 궁금한 건 무엇인가요?
          </Text>
        </View>
        {[
          ["오늘 바로 입을 조합", "sun"],
          ["사고 싶은 옷의 핏", "shopping-bag"],
        ].map(([label, icon], index) => (
          <View
            key={label}
            style={[
              styles.answerRow,
              {
                backgroundColor: index === 0 ? p.accent : p.surface,
                borderColor: p.border,
              },
            ]}
          >
            <Feather
              name={icon as keyof typeof Feather.glyphMap}
              size={19}
              color={index === 0 ? p.inverse : p.accent}
            />
            <Text
              style={[
                styles.answerText,
                { color: index === 0 ? p.inverse : p.text },
              ]}
            >
              {label}
            </Text>
            <Feather
              name="chevron-right"
              size={18}
              color={index === 0 ? p.inverse : p.muted}
            />
          </View>
        ))}
      </View>
    );
  }

  if (v === 5) {
    return (
      <View style={styles.railScreen}>
        <View style={[styles.actionRail, { backgroundColor: p.accent }]}>
          <Text style={[styles.railLogo, { color: p.inverse }]}>N</Text>
          {["01", "02", "03"].map((value) => (
            <Text key={value} style={[styles.railNumber, { color: p.inverse }]}>
              {value}
            </Text>
          ))}
        </View>
        <View style={styles.railBody}>
          <Text style={[styles.labEyebrow, { color: p.accent }]}>START HERE</Text>
          <Text style={[styles.labTitle, { color: p.text }]}>
            원하는 일을{"\n"}순서대로 골라요
          </Text>
          {["오늘 코디 찾기", "새 상품 핏 보기", "내 옷장 정리"].map(
            (label, index) => (
              <View
                key={label}
                style={[styles.railRow, { borderBottomColor: p.border }]}
              >
                <Text style={[styles.railRowText, { color: p.text }]}>
                  {label}
                </Text>
                <Feather
                  name={index === 0 ? "arrow-right" : "chevron-right"}
                  size={18}
                  color={index === 0 ? p.accent : p.muted}
                />
              </View>
            )
          )}
        </View>
      </View>
    );
  }

  if (v === 6) {
    return (
      <View style={styles.phoneFlex}>
        <View style={styles.thumbHero}>
          <Image
            source={require("@/assets/images/hero-fashion-wide.png")}
            resizeMode="cover"
            style={styles.fill}
          />
          <View style={styles.imageShade} />
          <View style={styles.thumbHeroCopy}>
            <Text style={styles.thumbLogo}>NAES</Text>
            <Text style={styles.thumbTitle}>내 옷장이{"\n"}답을 알고 있어요</Text>
          </View>
        </View>
        <View style={[styles.thumbDock, { backgroundColor: p.surface }]}>
          {[
            ["sun", "오늘 코디"],
            ["shopping-bag", "새 옷 핏"],
          ].map(([icon, label], index) => (
            <View
              key={label}
              style={[
                styles.thumbAction,
                { backgroundColor: index === 0 ? p.accent : p.soft },
              ]}
            >
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={20}
                color={index === 0 ? p.inverse : p.accent}
              />
              <Text
                style={[
                  styles.thumbActionText,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 7) {
    return (
      <View style={[styles.voiceScreen, { backgroundColor: p.background }]}>
        <PhoneHeader concept={concept} />
        <View style={[styles.voiceCircle, { backgroundColor: p.accent }]}>
          <Feather name="mic" size={34} color={p.inverse} />
        </View>
        <Text style={[styles.voiceTitle, { color: p.text }]}>
          “오늘 출근할 때{"\n"}뭐 입지?”
        </Text>
        <Text style={[styles.voiceHint, { color: p.muted }]}>
          말하거나 아래 예시를 눌러보세요.
        </Text>
        <View style={styles.voiceExamples}>
          {["데이트 코디", "비 오는 날", "새 바지 핏"].map((label) => (
            <View
              key={label}
              style={[styles.voiceChip, { borderColor: p.border }]}
            >
              <Text style={[styles.voiceChipText, { color: p.text }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 8) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.searchHeroTitle, { color: p.text }]}>
          무엇을 할까요?
        </Text>
        <View
          style={[
            styles.commandSearch,
            { backgroundColor: p.surface, borderColor: p.text },
          ]}
        >
          <Feather name="search" size={19} color={p.text} />
          <Text style={[styles.commandPlaceholder, { color: p.muted }]}>
            예: 오늘 출근 코디
          </Text>
          <View style={[styles.commandKey, { backgroundColor: p.soft }]}>
            <Text style={[styles.commandKeyText, { color: p.text }]}>↵</Text>
          </View>
        </View>
        <Text style={[styles.labEyebrow, { color: p.muted }]}>QUICK COMMANDS</Text>
        {["오늘 코디 추천", "상품 링크 분석", "옷장 검색"].map(
          (label, index) => (
            <View
              key={label}
              style={[styles.commandRow, { borderBottomColor: p.border }]}
            >
              <Text style={[styles.commandIndex, { color: p.accent }]}>
                /{index + 1}
              </Text>
              <Text style={[styles.commandRowText, { color: p.text }]}>
                {label}
              </Text>
            </View>
          )
        )}
      </View>
    );
  }

  return (
    <View style={styles.phoneContent}>
      <PhoneHeader concept={concept} />
      <Text style={[styles.labEyebrow, { color: p.accent }]}>TODAY&apos;S TASKS</Text>
      <Text style={[styles.labTitle, { color: p.text }]}>
        지금 필요한 것부터
      </Text>
      <View style={styles.taskStack}>
        {[
          ["01", "오늘 코디 확인", "날씨에 맞는 조합이 준비됐어요"],
          ["02", "새 상품 핏 보기", "링크를 붙여넣으면 돼요"],
          ["03", "옷장 한 벌 보완", "신발을 추가하면 더 정확해져요"],
        ].map(([number, title, text], index) => (
          <View
            key={number}
            style={[
              styles.taskCard,
              {
                backgroundColor: index === 0 ? p.accent : p.surface,
                borderColor: p.border,
                marginLeft: index * 8,
              },
            ]}
          >
            <Text
              style={[
                styles.taskNumber,
                { color: index === 0 ? p.inverse : p.accent },
              ]}
            >
              {number}
            </Text>
            <View style={styles.flexOne}>
              <Text
                style={[
                  styles.taskTitle,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {title}
              </Text>
              <Text
                style={[
                  styles.taskText,
                  { color: index === 0 ? p.inverse : p.muted },
                ]}
              >
                {text}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function VisualLayout({ concept }: { concept: LabConcept }) {
  const p = concept.palette;
  const v = concept.variant;

  if (v === 0) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>TODAY&apos;S LOOK</Text>
        <OutfitBoard concept={concept} style={styles.visualHeroBoard} />
        <Text style={[styles.visualTitle, { color: p.text }]}>
          아이보리 니트와 차콜 슬랙스
        </Text>
        <Text style={[styles.smallText, { color: p.muted }]}>
          지금 날씨에 가장 자연스러운 조합
        </Text>
        <View style={[styles.visualAction, { borderTopColor: p.text }]}>
          <Text style={[styles.visualActionText, { color: p.text }]}>
            이 코디 자세히 보기
          </Text>
          <Feather name="arrow-right" size={17} color={p.text} />
        </View>
      </View>
    );
  }

  if (v === 1) {
    return (
      <View style={styles.phoneFlex}>
        <View style={styles.coverHero}>
          <Image
            source={require("@/assets/images/hero-fashion-wide.png")}
            resizeMode="cover"
            style={styles.fill}
          />
          <View style={styles.coverShade} />
          <View style={styles.coverMasthead}>
            <Text style={styles.coverLogo}>NAES</Text>
            <Text style={styles.coverIssue}>ISSUE 014</Text>
          </View>
          <View style={styles.coverCopy}>
            <Text style={styles.coverKicker}>THE DAILY EDIT</Text>
            <Text style={styles.coverTitle}>가볍게{"\n"}입는 목요일</Text>
            <Text style={styles.coverLink}>오늘의 룩 열기 →</Text>
          </View>
        </View>
      </View>
    );
  }

  if (v === 2) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>내 옷장 무대</Text>
        <View style={[styles.stageBoard, { backgroundColor: p.soft }]}>
          <View style={[styles.stageLine, { backgroundColor: p.border }]} />
          <GarmentImage index={1} style={styles.stageGarmentLeft} />
          <GarmentImage index={3} style={styles.stageGarmentCenter} />
          <GarmentImage index={5} style={styles.stageGarmentRight} />
          <View style={[styles.stageTicket, { backgroundColor: p.surface }]}>
            <Text style={[styles.labEyebrow, { color: p.accent }]}>12 LOOKS</Text>
            <Text style={[styles.stageTicketText, { color: p.text }]}>
              오늘 조합 가능
            </Text>
          </View>
        </View>
        <View style={[styles.visualAction, { borderTopColor: p.text }]}>
          <Text style={[styles.visualActionText, { color: p.text }]}>
            옷으로 코디 만들기
          </Text>
          <Feather name="arrow-right" size={17} color={p.text} />
        </View>
      </View>
    );
  }

  if (v === 3) {
    return (
      <View style={[styles.floatScreen, { backgroundColor: p.soft }]}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.floatTitle, { color: p.text }]}>
          오늘의 옷이{"\n"}도착했어요
        </Text>
        <GarmentImage index={0} style={styles.floatOne} />
        <GarmentImage index={4} style={styles.floatTwo} />
        <GarmentImage index={5} style={styles.floatThree} />
        <View style={[styles.floatLabel, { backgroundColor: p.accent }]}>
          <Text style={[styles.floatLabelText, { color: p.inverse }]}>
            코디 확인 →
          </Text>
        </View>
      </View>
    );
  }

  if (v === 4) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>3 LOOKS FOR TODAY</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>마음에 드는 사진을 골라요</Text>
        <View style={styles.polaroidStage}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                styles.polaroid,
                {
                  backgroundColor: p.surface,
                  transform: [
                    {
                      rotate: index === 0 ? "-7deg" : index === 2 ? "7deg" : "0deg",
                    },
                  ],
                  left: index * 62,
                  top: index === 1 ? 20 : 54,
                  zIndex: index === 1 ? 3 : 1,
                },
              ]}
            >
              <GarmentImage index={index + 1} style={styles.polaroidImage} />
              <Text style={[styles.polaroidText, { color: p.text }]}>
                LOOK {index + 1}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.smallText, { color: p.muted, textAlign: "center" }]}>
          사진을 눌러 아이템과 이유를 확인
        </Text>
      </View>
    );
  }

  if (v === 5) {
    return (
      <View style={styles.spreadScreen}>
        <View style={[styles.spreadImageSide, { backgroundColor: p.soft }]}>
          <GarmentImage index={1} style={styles.spreadTop} />
          <GarmentImage index={3} style={styles.spreadBottom} />
          <Text style={[styles.spreadPage, { color: p.accent }]}>14</Text>
        </View>
        <View style={[styles.spreadCopySide, { backgroundColor: p.surface }]}>
          <Text style={[styles.phoneLogo, { color: p.text }]}>NAES</Text>
          <Text style={[styles.labEyebrow, { color: p.accent }]}>THE EDIT</Text>
          <Text style={[styles.spreadTitle, { color: p.text }]}>
            부드러운 상의와{"\n"}선이 긴 하의
          </Text>
          <Text style={[styles.smallText, { color: p.muted }]}>
            오늘은 두 아이템의 균형만 기억하세요.
          </Text>
          <Feather name="arrow-down-right" size={22} color={p.accent} />
        </View>
      </View>
    );
  }

  if (v === 6) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>오늘의 선반</Text>
        <View style={styles.shelfArea}>
          {[1, 3, 5].map((itemIndex, index) => (
            <View key={itemIndex} style={styles.shelfSlot}>
              <GarmentImage index={itemIndex} style={styles.shelfItem} />
              <Text style={[styles.shelfLabel, { color: p.text }]}>
                {["상의", "하의", "신발"][index]}
              </Text>
            </View>
          ))}
          <View style={[styles.shelfLine, { backgroundColor: p.text }]} />
        </View>
        <View style={[styles.shelfSummary, { backgroundColor: p.surface }]}>
          <Text style={[styles.labEyebrow, { color: p.accent }]}>ONE SET READY</Text>
          <Text style={[styles.visualTitle, { color: p.text }]}>
            이대로 꺼내 입으면 돼요
          </Text>
        </View>
      </View>
    );
  }

  if (v === 7) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>오늘의 조각</Text>
        <View style={styles.collage}>
          <GarmentImage index={0} style={styles.collageLarge} />
          <GarmentImage index={3} style={styles.collageTall} />
          <GarmentImage index={5} style={styles.collageSmall} />
          <View style={[styles.collageText, { backgroundColor: p.accent }]}>
            <Text style={[styles.labEyebrow, { color: p.inverse }]}>CASUAL / CLEAN</Text>
            <Text style={[styles.collageTextTitle, { color: p.inverse }]}>
              세 조각으로 완성
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (v === 8) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>COLOR STORY</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>
          오늘은 이 색으로 입어요
        </Text>
        <View style={styles.colorBands}>
          {["#ECE5D7", "#46484B", "#F6F4EF", "#9AA2A7"].map((color, index) => (
            <View
              key={color}
              style={[
                styles.colorBand,
                { backgroundColor: color, flex: 4 - index * 0.5 },
              ]}
            >
              <Text
                style={[
                  styles.colorBandLabel,
                  { color: index === 1 ? "#FFFFFF" : "#26231F" },
                ]}
              >
                {["IVORY", "CHARCOAL", "WHITE", "DENIM"][index]}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.colorStoryRow}>
          <GarmentImage index={1} style={styles.colorStoryItem} />
          <GarmentImage index={3} style={styles.colorStoryItem} />
          <Text style={[styles.smallText, { color: p.muted }]}>
            팔레트로 코디 보기 →
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.phoneContent}>
      <PhoneHeader concept={concept} />
      <Text style={[styles.labEyebrow, { color: p.accent }]}>MIRROR CHECK</Text>
      <View style={[styles.mirrorFrame, { borderColor: p.text }]}>
        <View style={[styles.mirrorInner, { backgroundColor: p.soft }]}>
          <GarmentImage index={1} style={styles.mirrorTop} />
          <GarmentImage index={3} style={styles.mirrorBottom} />
          <GarmentImage index={5} style={styles.mirrorShoes} />
        </View>
      </View>
      <View style={styles.mirrorCaption}>
        <Text style={[styles.visualTitle, { color: p.text }]}>오늘의 거울</Text>
        <Text style={[styles.smallText, { color: p.muted }]}>
          이 조합으로 입어볼까요? →
        </Text>
      </View>
    </View>
  );
}

function DailyLayout({ concept }: { concept: LabConcept }) {
  const p = concept.palette;
  const v = concept.variant;

  if (v === 0) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.muted }]}>THURSDAY, JUNE 14</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>오늘의 브리핑</Text>
        <OutfitBoard concept={concept} style={styles.dailyBoard} />
        <View style={styles.briefingCopy}>
          <Text style={[styles.visualTitle, { color: p.text }]}>
            24° · 맑음 · 단정한 데일리
          </Text>
          <Text style={[styles.smallText, { color: p.muted }]}>
            긴 하의와 가벼운 상의가 가장 자연스러워요.
          </Text>
        </View>
      </View>
    );
  }

  if (v === 1) {
    return (
      <View style={[styles.weatherScreen, { backgroundColor: p.accent }]}>
        <PhoneHeader concept={concept} light />
        <View style={styles.weatherHero}>
          <Feather name="sun" size={54} color={p.inverse} />
          <Text style={[styles.weatherValue, { color: p.inverse }]}>24°</Text>
          <Text style={[styles.weatherCopy, { color: p.inverse }]}>
            얇은 상의 · 긴 하의{"\n"}아우터는 필요 없어요
          </Text>
        </View>
        <View style={[styles.weatherRecommendation, { backgroundColor: p.surface }]}>
          <GarmentImage index={1} style={styles.weatherItem} />
          <View style={styles.flexOne}>
            <Text style={[styles.labEyebrow, { color: p.accent }]}>WEAR THIS</Text>
            <Text style={[styles.taskTitle, { color: p.text }]}>
              아이보리 반팔 니트
            </Text>
          </View>
          <Feather name="arrow-right" size={18} color={p.text} />
        </View>
      </View>
    );
  }

  if (v === 2) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>6월의 코디</Text>
        <View style={styles.calendarWeek}>
          {["월", "화", "수", "목", "금", "토", "일"].map((day, index) => (
            <View
              key={day}
              style={[
                styles.calendarDay,
                index === 3 && { backgroundColor: p.accent },
              ]}
            >
              <Text
                style={[
                  styles.calendarDayLabel,
                  { color: index === 3 ? p.inverse : p.muted },
                ]}
              >
                {day}
              </Text>
              <Text
                style={[
                  styles.calendarDate,
                  { color: index === 3 ? p.inverse : p.text },
                ]}
              >
                {11 + index}
              </Text>
            </View>
          ))}
        </View>
        <OutfitBoard concept={concept} style={styles.calendarOutfit} />
        <Text style={[styles.visualTitle, { color: p.text }]}>
          목요일의 가벼운 미니멀
        </Text>
        <Text style={[styles.smallText, { color: p.muted }]}>
          금요일 코디 미리 보기 →
        </Text>
      </View>
    );
  }

  if (v === 3) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>아침 준비</Text>
        <View style={styles.timeline}>
          {[
            ["07:30", "날씨 확인", "24° · 맑음", "sun"],
            ["07:32", "코디 선택", "니트 + 슬랙스", "check-circle"],
            ["07:35", "저장", "오늘 입었어요", "bookmark"],
          ].map(([time, title, text, icon], index) => (
            <View key={time} style={styles.timelineRow}>
              <View style={styles.timelineTrack}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: index === 1 ? p.accent : p.soft },
                  ]}
                >
                  <Feather
                    name={icon as keyof typeof Feather.glyphMap}
                    size={14}
                    color={index === 1 ? p.inverse : p.accent}
                  />
                </View>
                {index < 2 ? (
                  <View style={[styles.timelineLine, { backgroundColor: p.border }]} />
                ) : null}
              </View>
              <Text style={[styles.timelineTime, { color: p.muted }]}>{time}</Text>
              <View style={styles.flexOne}>
                <Text style={[styles.taskTitle, { color: p.text }]}>{title}</Text>
                <Text style={[styles.smallText, { color: p.muted }]}>{text}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 4) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>THIS WEEK</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>7일 옷장</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {["MON", "TUE", "WED", "THU", "FRI"].map((day, index) => (
            <View
              key={day}
              style={[
                styles.weekCard,
                {
                  backgroundColor: index === 3 ? p.accent : p.surface,
                  borderColor: p.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.labEyebrow,
                  { color: index === 3 ? p.inverse : p.muted },
                ]}
              >
                {day}
              </Text>
              <GarmentImage index={index + 1} style={styles.weekImage} />
              <Text
                style={[
                  styles.weekLabel,
                  { color: index === 3 ? p.inverse : p.text },
                ]}
              >
                {index === 3 ? "오늘" : "보기"}
              </Text>
            </View>
          ))}
        </ScrollView>
        <Text style={[styles.smallText, { color: p.muted }]}>
          목요일 코디가 선택되어 있어요.
        </Text>
      </View>
    );
  }

  if (v === 5) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>
          오늘 어디에 가나요?
        </Text>
        <View style={styles.occasionGrid}>
          {[
            ["briefcase", "출근", "단정하게"],
            ["heart", "데이트", "부드럽게"],
            ["coffee", "카페", "편안하게"],
            ["wind", "산책", "가볍게"],
          ].map(([icon, title, text], index) => (
            <View
              key={title}
              style={[
                styles.occasionCard,
                {
                  backgroundColor: index === 0 ? p.accent : p.surface,
                  borderColor: p.border,
                },
              ]}
            >
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={20}
                color={index === 0 ? p.inverse : p.accent}
              />
              <Text
                style={[
                  styles.occasionTitle,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {title}
              </Text>
              <Text
                style={[
                  styles.smallText,
                  { color: index === 0 ? p.inverse : p.muted },
                ]}
              >
                {text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 6) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>
          오늘 원하는 분위기
        </Text>
        <View style={[styles.moodDial, { borderColor: p.border }]}>
          <View style={[styles.moodCenter, { backgroundColor: p.accent }]}>
            <Text style={[styles.moodCenterText, { color: p.inverse }]}>
              깔끔한
            </Text>
          </View>
          {([
            ["편안한", styles.moodTop],
            ["캐주얼", styles.moodRight],
            ["포멀", styles.moodBottom],
            ["스트릿", styles.moodLeft],
          ] satisfies [string, ViewStyle][]).map(([label, position]) => (
            <Text
              key={String(label)}
              style={[styles.moodLabel, position, { color: p.muted }]}
            >
              {label}
            </Text>
          ))}
        </View>
        <View style={[styles.moodResult, { backgroundColor: p.soft }]}>
          <Text style={[styles.taskTitle, { color: p.text }]}>
            깔끔한 조합 3개 준비됨
          </Text>
          <Feather name="arrow-right" size={17} color={p.text} />
        </View>
      </View>
    );
  }

  if (v === 7) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>CURRENT 24°</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>온도로 고르는 옷</Text>
        <View style={styles.temperatureScale}>
          <View style={[styles.temperatureLine, { backgroundColor: p.border }]} />
          {[10, 15, 20, 24, 30].map((value) => (
            <View key={value} style={styles.temperatureMark}>
              <View
                style={[
                  styles.temperatureDot,
                  { backgroundColor: value === 24 ? p.accent : p.surface },
                ]}
              />
              <Text style={[styles.temperatureValue, { color: p.text }]}>
                {value}°
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.temperaturePick, { backgroundColor: p.soft }]}>
          <GarmentImage index={1} style={styles.temperatureItem} />
          <View style={styles.flexOne}>
            <Text style={[styles.labEyebrow, { color: p.accent }]}>24° PICK</Text>
            <Text style={[styles.taskTitle, { color: p.text }]}>
              얇은 반팔 니트
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (v === 8) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.muted }]}>WORN 8 DAYS AGO</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>이 조합, 다시 입을까요?</Text>
        <OutfitBoard concept={concept} style={styles.repeatBoard} />
        <View style={styles.repeatActions}>
          <View style={[styles.repeatButton, { backgroundColor: p.accent }]}>
            <Feather name="check" size={17} color={p.inverse} />
            <Text style={[styles.repeatButtonText, { color: p.inverse }]}>
              오늘 다시 입기
            </Text>
          </View>
          <View style={[styles.repeatIconButton, { borderColor: p.border }]}>
            <Feather name="shuffle" size={17} color={p.text} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.phoneContent}>
      <PhoneHeader concept={concept} />
      <Text style={[styles.labEyebrow, { color: p.accent }]}>SAVED LOOKS · 12</Text>
      <Text style={[styles.labTitle, { color: p.text }]}>저장한 코디에서 시작</Text>
      <View style={styles.savedPreviewRow}>
        {[0, 1].map((index) => (
          <View
            key={index}
            style={[styles.savedPreview, { backgroundColor: p.surface }]}
          >
            <GarmentImage index={index + 1} style={styles.savedPreviewImage} />
            <Text style={[styles.savedPreviewTitle, { color: p.text }]}>
              {index === 0 ? "미니멀 출근 룩" : "편안한 데일리"}
            </Text>
          </View>
        ))}
      </View>
      <View style={[styles.visualAction, { borderTopColor: p.text }]}>
        <Text style={[styles.visualActionText, { color: p.text }]}>
          오늘 입기 좋은 순서로 보기
        </Text>
        <Feather name="arrow-right" size={17} color={p.text} />
      </View>
    </View>
  );
}

function UtilityLayout({ concept }: { concept: LabConcept }) {
  const p = concept.palette;
  const v = concept.variant;
  const counts = [
    ["상의", "4/3"],
    ["하의", "4/3"],
    ["신발", "2/2"],
    ["조합", "12/6"],
  ];

  if (v === 0) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>추천 준비 체크</Text>
        <View style={[styles.checklist, { borderTopColor: p.text }]}>
          {counts.map(([label, value]) => (
            <View key={label} style={[styles.checkRow, { borderBottomColor: p.border }]}>
              <View style={[styles.checkCircle, { backgroundColor: p.accent }]}>
                <Feather name="check" size={13} color={p.inverse} />
              </View>
              <Text style={[styles.checkLabel, { color: p.text }]}>{label}</Text>
              <Text style={[styles.checkValue, { color: p.accent }]}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.fullButton, { backgroundColor: p.accent }]}>
          <Text style={[styles.fullButtonText, { color: p.inverse }]}>
            오늘 코디 보기
          </Text>
        </View>
      </View>
    );
  }

  if (v === 1) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>3 STEPS</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>추천까지 가는 길</Text>
        <View style={styles.progressPath}>
          {[
            ["01", "옷 등록", true],
            ["02", "준비 확인", true],
            ["03", "코디 선택", false],
          ].map(([number, label, complete], index) => (
            <View key={String(number)} style={styles.pathRow}>
              <View style={styles.pathTrack}>
                <View
                  style={[
                    styles.pathDot,
                    {
                      backgroundColor: complete ? p.accent : p.surface,
                      borderColor: p.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pathNumber,
                      { color: complete ? p.inverse : p.accent },
                    ]}
                  >
                    {number}
                  </Text>
                </View>
                {index < 2 ? (
                  <View style={[styles.pathLine, { backgroundColor: p.border }]} />
                ) : null}
              </View>
              <Text style={[styles.pathLabel, { color: p.text }]}>{label}</Text>
              <Feather
                name={complete ? "check" : "arrow-right"}
                size={17}
                color={complete ? p.accent : p.muted}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 2) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <View style={[styles.minimalRows, { borderTopColor: p.text }]}>
          {[
            ["01", "오늘 코디", "3개 준비"],
            ["02", "새 상품 핏", "링크 입력"],
            ["03", "내 옷장", "18벌"],
            ["04", "저장 코디", "12개"],
          ].map(([number, label, value]) => (
            <View
              key={number}
              style={[styles.minimalRow, { borderBottomColor: p.border }]}
            >
              <Text style={[styles.minimalNumber, { color: p.accent }]}>
                {number}
              </Text>
              <Text style={[styles.minimalLabel, { color: p.text }]}>{label}</Text>
              <Text style={[styles.minimalValue, { color: p.muted }]}>{value}</Text>
              <Feather name="chevron-right" size={17} color={p.muted} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 3) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>COMMAND CENTER</Text>
        <View style={styles.commandMetrics}>
          {[
            ["18", "옷"],
            ["12", "코디"],
            ["3", "오늘 추천"],
          ].map(([value, label], index) => (
            <View
              key={label}
              style={[
                styles.commandMetric,
                {
                  backgroundColor: index === 0 ? p.accent : p.surface,
                  borderColor: p.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.commandMetricValue,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {value}
              </Text>
              <Text
                style={[
                  styles.commandMetricLabel,
                  { color: index === 0 ? p.inverse : p.muted },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.commandMain, { backgroundColor: p.surface }]}>
          <Feather name="star" size={24} color={p.accent} />
          <Text style={[styles.visualTitle, { color: p.text }]}>
            오늘 추천 열기
          </Text>
          <Feather name="arrow-right" size={18} color={p.text} />
        </View>
      </View>
    );
  }

  if (v === 4) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>한눈에 보는 오늘</Text>
        <View style={styles.bento}>
          <View style={[styles.bentoLarge, { backgroundColor: p.accent }]}>
            <Text style={[styles.bentoKicker, { color: p.inverse }]}>TODAY</Text>
            <Text style={[styles.bentoLargeTitle, { color: p.inverse }]}>
              코디 3개
            </Text>
            <Feather name="arrow-up-right" size={20} color={p.inverse} />
          </View>
          <View style={[styles.bentoSmall, { backgroundColor: p.soft }]}>
            <Text style={[styles.bentoValue, { color: p.text }]}>24°</Text>
            <Text style={[styles.smallText, { color: p.muted }]}>맑음</Text>
          </View>
          <View style={[styles.bentoSmall, { backgroundColor: p.surface }]}>
            <Text style={[styles.bentoValue, { color: p.text }]}>18</Text>
            <Text style={[styles.smallText, { color: p.muted }]}>옷장</Text>
          </View>
          <View style={[styles.bentoWide, { backgroundColor: p.surface }]}>
            <Feather name="shopping-bag" size={18} color={p.accent} />
            <Text style={[styles.taskTitle, { color: p.text }]}>새 상품 핏 보기</Text>
          </View>
        </View>
      </View>
    );
  }

  if (v === 5) {
    return (
      <View style={styles.phoneFlex}>
        <PhoneHeader concept={concept} />
        <View style={[styles.dataStrip, { backgroundColor: p.accent }]}>
          {counts.map(([label, value]) => (
            <View key={label} style={styles.dataStripItem}>
              <Text style={[styles.dataStripValue, { color: p.inverse }]}>
                {value.split("/")[0]}
              </Text>
              <Text style={[styles.dataStripLabel, { color: p.inverse }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.dataBody}>
          <Text style={[styles.labTitle, { color: p.text }]}>
            옷장은 준비됐어요
          </Text>
          <Text style={[styles.smallText, { color: p.muted }]}>
            지금 날씨에 맞는 조합부터 확인하세요.
          </Text>
          <OutfitBoard concept={concept} style={styles.dataBoard} />
        </View>
      </View>
    );
  }

  if (v === 6) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>옷장 휠</Text>
        <View style={[styles.categoryWheel, { borderColor: p.border }]}>
          <View style={[styles.wheelCenter, { backgroundColor: p.accent }]}>
            <Text style={[styles.wheelCenterText, { color: p.inverse }]}>18벌</Text>
          </View>
          {([
            ["상의", styles.wheelTop],
            ["하의", styles.wheelRight],
            ["신발", styles.wheelBottom],
            ["아우터", styles.wheelLeft],
          ] satisfies [string, ViewStyle][]).map(([label, position], index) => (
            <View
              key={String(label)}
              style={[
                styles.wheelCategory,
                position,
                { backgroundColor: index === 0 ? p.accent : p.surface },
              ]}
            >
              <Text
                style={[
                  styles.wheelCategoryText,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 7) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>옷장 지도</Text>
        <View style={[styles.closetMap, { backgroundColor: p.soft }]}>
          {([
            ["상의 6", styles.mapTop],
            ["하의 5", styles.mapBottom],
            ["신발 3", styles.mapShoes],
            ["아우터 4", styles.mapOuter],
          ] satisfies [string, ViewStyle][]).map(([label, position], index) => (
            <View
              key={String(label)}
              style={[
                styles.mapZone,
                position,
                {
                  backgroundColor: index === 0 ? p.accent : p.surface,
                  borderColor: p.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.mapZoneText,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.smallText, { color: p.muted }]}>
          영역을 눌러 옷을 탐색하거나 추천에 사용해요.
        </Text>
      </View>
    );
  }

  if (v === 8) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>FILTER FIRST</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>오늘의 조건</Text>
        {[
          ["상황", "출근"],
          ["느낌", "깔끔한"],
          ["날씨", "24° · 맑음"],
        ].map(([label, value]) => (
          <View key={label} style={[styles.filterFirstRow, { borderBottomColor: p.border }]}>
            <Text style={[styles.filterFirstLabel, { color: p.muted }]}>{label}</Text>
            <Text style={[styles.filterFirstValue, { color: p.text }]}>{value}</Text>
            <Feather name="chevron-down" size={17} color={p.muted} />
          </View>
        ))}
        <View style={[styles.fullButton, { backgroundColor: p.accent }]}>
          <Text style={[styles.fullButtonText, { color: p.inverse }]}>
            이 조건으로 코디 찾기
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.phoneContent}>
      <PhoneHeader concept={concept} />
      <Text style={[styles.labEyebrow, { color: p.accent }]}>SMART QUEUE</Text>
      <Text style={[styles.labTitle, { color: p.text }]}>지금 할 일</Text>
      {[
        ["NOW", "오늘 코디 확인", "3개 준비"],
        ["NEXT", "신발 한 켤레 추가", "추천 다양성 향상"],
        ["LATER", "데이터 백업", "최근 백업 없음"],
      ].map(([tag, title, text], index) => (
        <View
          key={tag}
          style={[
            styles.queueRow,
            {
              backgroundColor: index === 0 ? p.accent : p.surface,
              borderColor: p.border,
            },
          ]}
        >
          <Text
            style={[
              styles.queueTag,
              { color: index === 0 ? p.inverse : p.accent },
            ]}
          >
            {tag}
          </Text>
          <View style={styles.flexOne}>
            <Text
              style={[
                styles.queueTitle,
                { color: index === 0 ? p.inverse : p.text },
              ]}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.smallText,
                { color: index === 0 ? p.inverse : p.muted },
              ]}
            >
              {text}
            </Text>
          </View>
          <Feather
            name="arrow-right"
            size={17}
            color={index === 0 ? p.inverse : p.muted}
          />
        </View>
      ))}
    </View>
  );
}

function ExperimentalLayout({ concept }: { concept: LabConcept }) {
  const p = concept.palette;
  const v = concept.variant;

  if (v === 0) {
    return (
      <View style={styles.phoneFlex}>
        <View style={styles.sheetHero}>
          <Image
            source={require("@/assets/images/hero-fashion-wide.png")}
            resizeMode="cover"
            style={styles.fill}
          />
          <View style={styles.sheetHeroTop}>
            <Text style={styles.thumbLogo}>NAES</Text>
            <Text style={styles.phoneMeta}>24°</Text>
          </View>
        </View>
        <View style={[styles.bottomSheet, { backgroundColor: p.surface }]}>
          <View style={[styles.sheetHandle, { backgroundColor: p.border }]} />
          <Text style={[styles.labTitle, { color: p.text }]}>무엇을 할까요?</Text>
          {["오늘 코디 찾기", "새 상품 핏 보기"].map((label, index) => (
            <View
              key={label}
              style={[
                styles.sheetAction,
                { backgroundColor: index === 0 ? p.accent : p.soft },
              ]}
            >
              <Text
                style={[
                  styles.sheetActionText,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {label}
              </Text>
              <Feather
                name="arrow-right"
                size={17}
                color={index === 0 ? p.inverse : p.text}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (v === 1) {
    return (
      <View style={styles.drawerScreen}>
        <View style={[styles.sideDrawer, { backgroundColor: p.accent }]}>
          <Text style={[styles.drawerLogo, { color: p.inverse }]}>N</Text>
          {["sun", "grid", "shopping-bag", "user"].map((icon, index) => (
            <View
              key={icon}
              style={[
                styles.drawerIcon,
                index === 0 && { backgroundColor: "rgba(255,255,255,0.16)" },
              ]}
            >
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={18}
                color={p.inverse}
              />
            </View>
          ))}
        </View>
        <View style={styles.drawerBody}>
          <Text style={[styles.labEyebrow, { color: p.accent }]}>TODAY</Text>
          <Text style={[styles.labTitle, { color: p.text }]}>바로 입을 한 벌</Text>
          <OutfitBoard concept={concept} style={styles.drawerBoard} />
          <Text style={[styles.visualTitle, { color: p.text }]}>
            단정한 데일리 룩
          </Text>
          <Text style={[styles.smallText, { color: p.muted }]}>
            왼쪽 메뉴로 다른 기능 이동
          </Text>
        </View>
      </View>
    );
  }

  if (v === 2) {
    return (
      <View style={[styles.fullPrompt, { backgroundColor: p.accent }]}>
        <Text style={[styles.fullPromptLogo, { color: p.inverse }]}>NAES</Text>
        <Text style={[styles.fullPromptQuestion, { color: p.inverse }]}>
          오늘{"\n"}무엇을{"\n"}입을까요?
        </Text>
        <View style={styles.fullPromptAnswers}>
          <Text style={[styles.fullPromptAnswer, { color: p.inverse }]}>
            내 옷으로 추천 →
          </Text>
          <Text style={[styles.fullPromptAnswer, { color: p.inverse }]}>
            새 옷 핏 확인 →
          </Text>
        </View>
      </View>
    );
  }

  if (v === 3) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>카드를 한 장씩</Text>
        <View style={styles.deckArea}>
          {[2, 1, 0].map((index) => (
            <View
              key={index}
              style={[
                styles.deckCard,
                {
                  backgroundColor: index === 0 ? p.accent : index === 1 ? p.soft : p.surface,
                  top: index * 18,
                  left: index * 10,
                  right: index * 10,
                  zIndex: 3 - index,
                },
              ]}
            >
              <Text
                style={[
                  styles.deckNumber,
                  { color: index === 0 ? p.inverse : p.accent },
                ]}
              >
                0{index + 1}
              </Text>
              <Text
                style={[
                  styles.deckTitle,
                  { color: index === 0 ? p.inverse : p.text },
                ]}
              >
                {["오늘 코디", "새 상품 핏", "내 옷장"][index]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.smallText, { color: p.muted, textAlign: "center" }]}>
          위 카드를 끌어 다음 기능 보기
        </Text>
      </View>
    );
  }

  if (v === 4) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labTitle, { color: p.text }]}>내 옷장 중심</Text>
        <View style={styles.radialArea}>
          <View style={[styles.radialCenter, { backgroundColor: p.accent }]}>
            <Feather name="grid" size={28} color={p.inverse} />
            <Text style={[styles.radialCenterText, { color: p.inverse }]}>18벌</Text>
          </View>
          {([
            ["sun", "오늘", styles.radialTop],
            ["shopping-bag", "핏", styles.radialRight],
            ["bookmark", "저장", styles.radialBottom],
            ["search", "검색", styles.radialLeft],
          ] satisfies [string, string, ViewStyle][]).map(
            ([icon, label, position]) => (
            <View
              key={String(label)}
              style={[
                styles.radialAction,
                position,
                { backgroundColor: p.surface, borderColor: p.border },
              ]}
            >
              <Feather
                name={icon as keyof typeof Feather.glyphMap}
                size={17}
                color={p.accent}
              />
              <Text style={[styles.radialLabel, { color: p.text }]}>{label}</Text>
            </View>
            )
          )}
        </View>
      </View>
    );
  }

  if (v === 5) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>SWIPE YOUR LOOK</Text>
        <View style={[styles.gestureCard, { backgroundColor: p.soft }]}>
          <GarmentImage index={1} style={styles.gestureTop} />
          <GarmentImage index={3} style={styles.gestureBottom} />
          <View style={[styles.gestureBadge, { backgroundColor: p.surface }]}>
            <Text style={[styles.taskTitle, { color: p.text }]}>
              미니멀 데일리
            </Text>
          </View>
        </View>
        <View style={styles.gestureActions}>
          <View style={[styles.gestureAction, { borderColor: p.border }]}>
            <Feather name="x" size={22} color={p.muted} />
          </View>
          <Text style={[styles.smallText, { color: p.muted }]}>좌우로 선택</Text>
          <View style={[styles.gestureAction, { backgroundColor: p.accent }]}>
            <Feather name="check" size={22} color={p.inverse} />
          </View>
        </View>
      </View>
    );
  }

  if (v === 6) {
    return (
      <View style={[styles.terminalScreen, { backgroundColor: p.background }]}>
        <Text style={[styles.terminalLogo, { color: p.accent }]}>
          NAES_WARDROBE
        </Text>
        <Text style={[styles.terminalLine, { color: p.muted }]}>
          $ weather --today
        </Text>
        <Text style={[styles.terminalResult, { color: p.text }]}>
          24C / CLEAR / NO OUTER
        </Text>
        <Text style={[styles.terminalLine, { color: p.muted }]}>
          $ outfit --best
        </Text>
        <Text style={[styles.terminalResult, { color: p.text }]}>
          IVORY_KNIT{"\n"}CHARCOAL_SLACKS{"\n"}WHITE_SNEAKERS
        </Text>
        <View style={[styles.terminalCommand, { borderColor: p.accent }]}>
          <Text style={[styles.terminalPrompt, { color: p.accent }]}>$</Text>
          <Text style={[styles.terminalInput, { color: p.text }]}>
            open outfit_
          </Text>
        </View>
      </View>
    );
  }

  if (v === 7) {
    return (
      <View style={styles.phoneContent}>
        <PhoneHeader concept={concept} />
        <Text style={[styles.labEyebrow, { color: p.accent }]}>PRIVATE APPOINTMENT</Text>
        <Text style={[styles.labTitle, { color: p.text }]}>
          오늘의 셀렉션이{"\n"}준비됐습니다
        </Text>
        <View style={[styles.boutiqueCounter, { backgroundColor: p.soft }]}>
          <View style={[styles.counterTop, { backgroundColor: p.text }]} />
          <GarmentImage index={1} style={styles.counterItemOne} />
          <GarmentImage index={3} style={styles.counterItemTwo} />
          <View style={[styles.counterCard, { backgroundColor: p.surface }]}>
            <Text style={[styles.labEyebrow, { color: p.accent }]}>FOR DOHYEON</Text>
            <Text style={[styles.smallText, { color: p.text }]}>
              차분하고 단정한 목요일
            </Text>
          </View>
        </View>
        <Text style={[styles.visualActionText, { color: p.text }]}>
          셀렉션 확인하기 →
        </Text>
      </View>
    );
  }

  if (v === 8) {
    return (
      <View style={[styles.noteScreen, { backgroundColor: p.background }]}>
        <View style={styles.noteTop}>
          <Text style={[styles.phoneLogo, { color: p.text }]}>NAES</Text>
          <Text style={[styles.noteDate, { color: p.muted }]}>06.14</Text>
        </View>
        <View style={[styles.stylistNote, { backgroundColor: p.surface }]}>
          <Text style={[styles.noteGreeting, { color: p.text }]}>
            도현님께,
          </Text>
          <Text style={[styles.noteBody, { color: p.text }]}>
            오늘은 아이보리 니트에{"\n"}차콜 슬랙스를 입어보세요.{"\n\n"}
            날씨가 맑아서 아우터 없이도{"\n"}충분히 자연스러워요.
          </Text>
          <Text style={[styles.noteSign, { color: p.accent }]}>— NAES</Text>
        </View>
        <Text style={[styles.noteLink, { color: p.text }]}>
          옷 펼쳐보기 →
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.zeroScreen, { backgroundColor: p.background }]}>
      <Text style={[styles.zeroLogo, { color: p.text }]}>NAES</Text>
      <View style={styles.zeroCenter}>
        <Text style={[styles.zeroWeather, { color: p.muted }]}>24° · 맑음</Text>
        <Text style={[styles.zeroSuggestion, { color: p.text }]}>
          오늘은{"\n"}아이보리 니트와{"\n"}차콜 슬랙스.
        </Text>
      </View>
      <View style={[styles.zeroActions, { borderTopColor: p.text }]}>
        <Text style={[styles.zeroAction, { color: p.text }]}>입을게요</Text>
        <Text style={[styles.zeroAction, { color: p.muted }]}>다른 제안</Text>
      </View>
    </View>
  );
}

function LabPhone({ concept }: { concept: LabConcept }) {
  let content;
  if (concept.family === "direct") {
    content = <DirectLayout concept={concept} />;
  } else if (concept.family === "visual") {
    content = <VisualLayout concept={concept} />;
  } else if (concept.family === "daily") {
    content = <DailyLayout concept={concept} />;
  } else if (concept.family === "utility") {
    content = <UtilityLayout concept={concept} />;
  } else {
    content = <ExperimentalLayout concept={concept} />;
  }

  const immersive =
    (concept.family === "visual" && concept.variant === 1) ||
    (concept.family === "experimental" &&
      [0, 1, 2, 6, 8, 9].includes(concept.variant));

  return (
    <View style={[styles.phone, { backgroundColor: concept.palette.background }]}>
      <View style={styles.phoneViewport}>{content}</View>
      {!immersive ? <PhoneNav concept={concept} /> : null}
    </View>
  );
}

function ConceptThumbnail({
  concept,
  selected,
  onPress,
}: {
  concept: LabConcept;
  selected: boolean;
  onPress: () => void;
}) {
  const p = concept.palette;
  const blocks = concept.variant % 5;
  return (
    <Pressable
      style={[
        styles.conceptCard,
        {
          backgroundColor: selected ? p.text : "#FFFFFF",
          borderColor: selected ? p.text : "#DDDAD4",
        },
      ]}
      onPress={onPress}
    >
      <View style={[styles.thumbnail, { backgroundColor: p.background }]}>
        <View style={[styles.thumbHeaderLine, { backgroundColor: p.text }]} />
        {blocks === 0 ? (
          <View style={styles.thumbSplit}>
            <View style={[styles.thumbBlock, { backgroundColor: p.accent }]} />
            <View style={[styles.thumbBlock, { backgroundColor: p.surface }]} />
          </View>
        ) : blocks === 1 ? (
          <View style={[styles.thumbHeroBlock, { backgroundColor: p.soft }]}>
            <View style={[styles.thumbTinyOne, { backgroundColor: p.surface }]} />
            <View style={[styles.thumbTinyTwo, { backgroundColor: p.accent }]} />
          </View>
        ) : blocks === 2 ? (
          <View style={styles.thumbRows}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[
                  styles.thumbRow,
                  { backgroundColor: index === 0 ? p.accent : p.surface },
                ]}
              />
            ))}
          </View>
        ) : blocks === 3 ? (
          <View style={styles.thumbBento}>
            <View style={[styles.thumbBentoLarge, { backgroundColor: p.accent }]} />
            <View style={[styles.thumbBentoSmall, { backgroundColor: p.soft }]} />
            <View style={[styles.thumbBentoSmall, { backgroundColor: p.surface }]} />
          </View>
        ) : (
          <View style={styles.thumbCenter}>
            <View style={[styles.thumbCircle, { backgroundColor: p.accent }]} />
            <View style={[styles.thumbCenterLine, { backgroundColor: p.text }]} />
            <View style={[styles.thumbCenterLine, { backgroundColor: p.border }]} />
          </View>
        )}
      </View>
      <View style={styles.conceptCardCopy}>
        <Text
          style={[
            styles.conceptNumber,
            { color: selected ? "#FFFFFF" : p.accent },
          ]}
        >
          {concept.id}
        </Text>
        <Text
          style={[
            styles.conceptName,
            { color: selected ? "#FFFFFF" : "#171717" },
          ]}
          numberOfLines={1}
        >
          {concept.koreanName}
        </Text>
        <Text
          style={[
            styles.conceptEnglish,
            { color: selected ? "#C9C9C9" : "#777777" },
          ]}
          numberOfLines={1}
        >
          {concept.name}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FiftyConceptLab() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    standalone?: string | string[];
  }>();
  const { width } = useWindowDimensions();
  const requestedId = Array.isArray(params.id) ? params.id[0] : params.id;
  const standaloneParam = Array.isArray(params.standalone)
    ? params.standalone[0]
    : params.standalone;
  const selected =
    LAB_CONCEPTS.find((concept) => concept.id === requestedId) ||
    LAB_CONCEPTS[0];
  const desktop = width >= 960;

  if (standaloneParam === "1") {
    return (
      <View style={styles.standalonePage}>
        <LabPhone concept={selected} />
      </View>
    );
  }

  function selectConcept(id: string) {
    router.replace({
      pathname: "/design-preview/lab",
      params: { id },
    });
  }

  return (
    <View style={styles.labPage}>
      <ScrollView
        style={styles.labScroll}
        contentContainerStyle={styles.labScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.labHeader}>
          <View style={styles.labHeaderTop}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.push("/design-preview")}
            >
              <Feather name="arrow-left" size={18} color="#171717" />
            </Pressable>
            <Text style={styles.labHeaderMeta}>NAES CONCEPT LAB · 50</Text>
          </View>
          <Text style={styles.labPageTitle}>완전히 다른 50가지 시작 화면</Text>
          <Text style={styles.labPageDescription}>
            색만 바꾼 시안이 아니라, 앱에 들어와 첫 행동을 선택하는 방식 자체를
            다르게 만들었습니다. 번호를 누르면 실제 휴대폰 비율로 확인할 수
            있습니다.
          </Text>
        </View>

        <View
          style={[
            styles.labLayout,
            desktop ? styles.labLayoutDesktop : styles.labLayoutMobile,
          ]}
        >
          <View style={styles.wall}>
            {GROUPS.map((group) => {
              const concepts = LAB_CONCEPTS.filter(
                (concept) => concept.family === group.family
              );
              return (
                <View key={group.family} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <View>
                      <Text style={styles.groupTitle}>{group.label}</Text>
                      <Text style={styles.groupSummary}>{group.summary}</Text>
                    </View>
                    <Text style={styles.groupCount}>10</Text>
                  </View>
                  <View style={styles.conceptGrid}>
                    {concepts.map((concept) => (
                      <ConceptThumbnail
                        key={concept.id}
                        concept={concept}
                        selected={concept.id === selected.id}
                        onPress={() => selectConcept(concept.id)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          <View
            style={[
              styles.previewColumn,
              desktop ? styles.previewColumnDesktop : undefined,
            ]}
          >
            <View style={styles.previewCopy}>
              <Text style={styles.previewNumber}>{selected.id}</Text>
              <View style={styles.previewTitleArea}>
                <Text style={styles.previewTitle}>{selected.koreanName}</Text>
                <Text style={styles.previewEnglish}>{selected.name}</Text>
              </View>
            </View>
            <Text style={styles.previewDescription}>{selected.description}</Text>
            <View style={styles.phoneFrame}>
              <LabPhone concept={selected} />
            </View>
            <View style={styles.previewPager}>
              <Pressable
                style={styles.pagerButton}
                onPress={() => {
                  const index = LAB_CONCEPTS.indexOf(selected);
                  selectConcept(
                    LAB_CONCEPTS[
                      (index - 1 + LAB_CONCEPTS.length) % LAB_CONCEPTS.length
                    ].id
                  );
                }}
              >
                <Feather name="arrow-left" size={17} color="#171717" />
                <Text style={styles.pagerText}>이전</Text>
              </Pressable>
              <Text style={styles.pagerPosition}>
                {Number(selected.id)} / 50
              </Text>
              <Pressable
                style={styles.pagerButton}
                onPress={() => {
                  const index = LAB_CONCEPTS.indexOf(selected);
                  selectConcept(
                    LAB_CONCEPTS[(index + 1) % LAB_CONCEPTS.length].id
                  );
                }}
              >
                <Text style={styles.pagerText}>다음</Text>
                <Feather name="arrow-right" size={17} color="#171717" />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  labPage: {
    flex: 1,
    backgroundColor: "#EBE9E4",
  },
  standalonePage: {
    flex: 1,
    width: "100%",
    maxWidth: 390,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
  },
  labScroll: {
    flex: 1,
  },
  labScrollContent: {
    width: "100%",
    maxWidth: 1500,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 60,
  },
  labHeader: {
    maxWidth: 720,
    marginBottom: 30,
  },
  labHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  labHeaderMeta: {
    color: "#6C6964",
    fontSize: 10,
    fontWeight: "900",
  },
  labPageTitle: {
    color: "#171717",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
  },
  labPageDescription: {
    color: "#66635F",
    maxWidth: 680,
    marginTop: 10,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: "600",
  },
  labLayout: {
    alignItems: "flex-start",
    gap: 28,
  },
  labLayoutDesktop: {
    flexDirection: "row",
  },
  labLayoutMobile: {
    flexDirection: "column-reverse",
  },
  wall: {
    flex: 1,
    minWidth: 0,
    gap: 34,
  },
  group: {
    gap: 14,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#CAC7C1",
    paddingBottom: 9,
  },
  groupTitle: {
    color: "#171717",
    fontSize: 18,
    fontWeight: "900",
  },
  groupSummary: {
    color: "#77736D",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
  groupCount: {
    color: "#88847E",
    fontSize: 11,
    fontWeight: "900",
  },
  conceptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  conceptCard: {
    width: 148,
    padding: 7,
    borderWidth: 1,
    borderRadius: 10,
  },
  thumbnail: {
    height: 108,
    padding: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  thumbHeaderLine: {
    width: 24,
    height: 3,
    borderRadius: 2,
    marginBottom: 8,
  },
  thumbSplit: {
    flex: 1,
    gap: 4,
  },
  thumbBlock: {
    flex: 1,
    borderRadius: 3,
  },
  thumbHeroBlock: {
    flex: 1,
    position: "relative",
    borderRadius: 4,
  },
  thumbTinyOne: {
    position: "absolute",
    width: "42%",
    height: "64%",
    left: 8,
    top: 9,
    borderRadius: 3,
  },
  thumbTinyTwo: {
    position: "absolute",
    width: "34%",
    height: "48%",
    right: 8,
    bottom: 8,
    borderRadius: 3,
  },
  thumbRows: {
    flex: 1,
    gap: 5,
  },
  thumbRow: {
    flex: 1,
    borderRadius: 3,
  },
  thumbBento: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  thumbBentoLarge: {
    width: "61%",
    height: "100%",
    borderRadius: 3,
  },
  thumbBentoSmall: {
    width: "34%",
    height: "47%",
    borderRadius: 3,
  },
  thumbCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  thumbCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  thumbCenterLine: {
    width: "66%",
    height: 3,
    borderRadius: 2,
  },
  conceptCardCopy: {
    paddingHorizontal: 2,
    paddingTop: 7,
  },
  conceptNumber: {
    fontSize: 9,
    fontWeight: "900",
  },
  conceptName: {
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  conceptEnglish: {
    fontSize: 8,
    fontWeight: "600",
    marginTop: 1,
  },
  previewColumn: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
  },
  previewColumnDesktop: {
    position: "sticky" as never,
    top: 24,
  },
  previewCopy: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 13,
  },
  previewNumber: {
    color: "#171717",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  previewTitleArea: {
    paddingBottom: 2,
  },
  previewTitle: {
    color: "#171717",
    fontSize: 17,
    fontWeight: "900",
  },
  previewEnglish: {
    color: "#77736D",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  previewDescription: {
    color: "#66635F",
    marginTop: 8,
    marginBottom: 14,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },
  phoneFrame: {
    width: 390,
    maxWidth: "100%",
    height: 844,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CAC7C1",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
  },
  previewPager: {
    minHeight: 52,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pagerButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pagerText: {
    color: "#171717",
    fontSize: 11,
    fontWeight: "800",
  },
  pagerPosition: {
    color: "#77736D",
    fontSize: 10,
    fontWeight: "800",
  },
  phone: {
    flex: 1,
  },
  phoneViewport: {
    flex: 1,
    minHeight: 0,
  },
  phoneFlex: {
    flex: 1,
  },
  phoneContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
  },
  phoneHeader: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  phoneLogo: {
    fontSize: 15,
    fontWeight: "900",
  },
  phoneMeta: {
    fontSize: 9,
    fontWeight: "800",
  },
  phoneNav: {
    height: 72,
    paddingHorizontal: 10,
    paddingTop: 7,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  phoneNavItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  phoneNavIcon: {
    width: 34,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneNavLabel: {
    fontSize: 9,
    fontWeight: "700",
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  garmentImage: {
    backgroundColor: "transparent",
  },
  labEyebrow: {
    fontSize: 9,
    fontWeight: "900",
    marginBottom: 6,
  },
  labTitle: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    marginBottom: 17,
  },
  smallText: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "600",
  },
  outfitBoard: {
    position: "relative",
    overflow: "hidden",
  },
  outfitBoardItem: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  directSplit: {
    flex: 1,
    gap: 1,
  },
  directSplitHorizontal: {
    flexDirection: "row",
  },
  directDoor: {
    flex: 1,
    padding: 20,
    borderWidth: 1,
    justifyContent: "space-between",
  },
  doorNumber: {
    fontSize: 11,
    fontWeight: "900",
  },
  doorTitle: {
    maxWidth: 180,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
  },
  swipeStack: {
    height: 420,
    marginTop: 16,
    position: "relative",
  },
  swipeBack: {
    position: "absolute",
    left: 22,
    right: 22,
    top: 24,
    bottom: 0,
    borderRadius: 18,
    transform: [{ rotate: "3deg" }],
  },
  swipeCard: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 22,
    padding: 24,
    borderRadius: 18,
    justifyContent: "flex-end",
  },
  swipeTitle: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 16,
  },
  swipeText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 6,
  },
  swipeHint: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  giantQuestion: {
    fontSize: 42,
    lineHeight: 47,
    fontWeight: "900",
    marginVertical: 24,
  },
  giantRule: {
    height: 1,
  },
  giantFooter: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  questionCenter: {
    minHeight: 250,
    justifyContent: "center",
  },
  questionTitle: {
    maxWidth: 300,
    fontSize: 33,
    lineHeight: 40,
    fontWeight: "900",
  },
  answerRow: {
    minHeight: 76,
    paddingHorizontal: 15,
    marginBottom: 9,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  answerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  railScreen: {
    flex: 1,
    flexDirection: "row",
  },
  actionRail: {
    width: 62,
    paddingTop: 26,
    alignItems: "center",
    gap: 58,
  },
  railLogo: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 28,
  },
  railNumber: {
    fontSize: 10,
    fontWeight: "900",
  },
  railBody: {
    flex: 1,
    padding: 22,
  },
  railRow: {
    minHeight: 84,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  railRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  thumbHero: {
    flex: 1,
    position: "relative",
  },
  thumbHeroCopy: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 26,
  },
  thumbLogo: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  thumbTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    marginTop: 145,
  },
  thumbDock: {
    minHeight: 154,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  thumbAction: {
    flex: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  thumbActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  voiceScreen: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  voiceCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    marginTop: 95,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceTitle: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 28,
  },
  voiceHint: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 11,
  },
  voiceExamples: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
    marginTop: 26,
  },
  voiceChip: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderRadius: 17,
    justifyContent: "center",
  },
  voiceChipText: {
    fontSize: 10,
    fontWeight: "700",
  },
  searchHeroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    marginTop: 40,
    marginBottom: 22,
  },
  commandSearch: {
    minHeight: 58,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 34,
  },
  commandPlaceholder: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  commandKey: {
    width: 28,
    height: 28,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  commandKeyText: {
    fontSize: 12,
    fontWeight: "900",
  },
  commandRow: {
    minHeight: 62,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  commandIndex: {
    width: 24,
    fontSize: 10,
    fontWeight: "900",
  },
  commandRowText: {
    fontSize: 13,
    fontWeight: "800",
  },
  taskStack: {
    gap: 10,
    marginTop: 14,
  },
  taskCard: {
    minHeight: 112,
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    gap: 13,
  },
  taskNumber: {
    fontSize: 10,
    fontWeight: "900",
  },
  taskTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  taskText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 5,
  },
  visualHeroBoard: {
    height: 360,
    borderRadius: 16,
    marginBottom: 15,
  },
  visualTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },
  visualAction: {
    minHeight: 56,
    marginTop: 17,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  visualActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  coverHero: {
    flex: 1,
    position: "relative",
  },
  coverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  coverMasthead: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverLogo: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  coverIssue: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  coverCopy: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 32,
  },
  coverKicker: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  coverTitle: {
    color: "#FFFFFF",
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "900",
    marginTop: 8,
  },
  coverLink: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 20,
  },
  stageBoard: {
    height: 405,
    borderRadius: 20,
    position: "relative",
    overflow: "hidden",
  },
  stageLine: {
    position: "absolute",
    height: 1,
    left: 24,
    right: 24,
    top: 62,
  },
  stageGarmentLeft: {
    position: "absolute",
    width: 142,
    height: 230,
    left: 10,
    top: 44,
  },
  stageGarmentCenter: {
    position: "absolute",
    width: 142,
    height: 240,
    right: 25,
    top: 45,
  },
  stageGarmentRight: {
    position: "absolute",
    width: 105,
    height: 90,
    right: 15,
    bottom: 20,
  },
  stageTicket: {
    position: "absolute",
    left: 17,
    bottom: 18,
    width: 142,
    minHeight: 70,
    padding: 12,
    borderRadius: 13,
  },
  stageTicketText: {
    fontSize: 12,
    fontWeight: "900",
  },
  floatScreen: {
    flex: 1,
    padding: 20,
    position: "relative",
    overflow: "hidden",
  },
  floatTitle: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
  },
  floatOne: {
    position: "absolute",
    width: 180,
    height: 230,
    left: -5,
    top: 210,
    transform: [{ rotate: "-6deg" }],
  },
  floatTwo: {
    position: "absolute",
    width: 170,
    height: 250,
    right: -6,
    top: 250,
    transform: [{ rotate: "5deg" }],
  },
  floatThree: {
    position: "absolute",
    width: 125,
    height: 105,
    left: 135,
    bottom: 72,
    transform: [{ rotate: "-2deg" }],
  },
  floatLabel: {
    position: "absolute",
    right: 20,
    bottom: 20,
    minHeight: 42,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  floatLabelText: {
    fontSize: 11,
    fontWeight: "900",
  },
  polaroidStage: {
    height: 430,
    position: "relative",
    marginTop: 10,
  },
  polaroid: {
    position: "absolute",
    width: 190,
    height: 270,
    padding: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  polaroidImage: {
    width: "100%",
    height: 220,
  },
  polaroidText: {
    fontSize: 9,
    fontWeight: "900",
    marginTop: 10,
  },
  spreadScreen: {
    flex: 1,
    flexDirection: "row",
  },
  spreadImageSide: {
    width: "53%",
    padding: 12,
    position: "relative",
  },
  spreadCopySide: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    gap: 12,
  },
  spreadTop: {
    position: "absolute",
    width: "82%",
    height: 310,
    top: 75,
    left: 15,
  },
  spreadBottom: {
    position: "absolute",
    width: "84%",
    height: 280,
    bottom: 35,
    left: 14,
  },
  spreadPage: {
    position: "absolute",
    left: 14,
    bottom: 12,
    fontSize: 10,
    fontWeight: "900",
  },
  spreadTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  shelfArea: {
    height: 390,
    flexDirection: "row",
    alignItems: "flex-end",
    position: "relative",
    gap: 6,
  },
  shelfSlot: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 35,
  },
  shelfItem: {
    width: "100%",
    height: 250,
  },
  shelfLabel: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 8,
  },
  shelfLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 28,
    height: 2,
  },
  shelfSummary: {
    minHeight: 95,
    padding: 15,
    justifyContent: "center",
  },
  collage: {
    height: 500,
    position: "relative",
  },
  collageLarge: {
    position: "absolute",
    width: "58%",
    height: 285,
    left: 0,
    top: 0,
  },
  collageTall: {
    position: "absolute",
    width: "39%",
    height: 360,
    right: 0,
    top: 0,
  },
  collageSmall: {
    position: "absolute",
    width: "46%",
    height: 150,
    left: 0,
    bottom: 0,
  },
  collageText: {
    position: "absolute",
    width: "50%",
    minHeight: 125,
    right: 0,
    bottom: 0,
    padding: 14,
    justifyContent: "flex-end",
  },
  collageTextTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  colorBands: {
    height: 360,
    flexDirection: "row",
    marginTop: 10,
  },
  colorBand: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  colorBandLabel: {
    fontSize: 8,
    fontWeight: "900",
    transform: [{ rotate: "-90deg" }],
  },
  colorStoryRow: {
    minHeight: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorStoryItem: {
    width: 72,
    height: 95,
  },
  mirrorFrame: {
    height: 460,
    padding: 9,
    borderWidth: 2,
    borderTopLeftRadius: 130,
    borderTopRightRadius: 130,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  mirrorInner: {
    flex: 1,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    position: "relative",
  },
  mirrorTop: {
    position: "absolute",
    width: 150,
    height: 210,
    left: 25,
    top: 60,
  },
  mirrorBottom: {
    position: "absolute",
    width: 140,
    height: 230,
    right: 20,
    top: 95,
  },
  mirrorShoes: {
    position: "absolute",
    width: 120,
    height: 80,
    left: 110,
    bottom: 20,
  },
  mirrorCaption: {
    marginTop: 14,
  },
  dailyBoard: {
    height: 340,
    borderRadius: 12,
  },
  briefingCopy: {
    paddingVertical: 16,
    gap: 5,
  },
  weatherScreen: {
    flex: 1,
    padding: 20,
  },
  weatherHero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weatherValue: {
    fontSize: 84,
    lineHeight: 92,
    fontWeight: "900",
  },
  weatherCopy: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  weatherRecommendation: {
    minHeight: 112,
    padding: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  weatherItem: {
    width: 78,
    height: 88,
  },
  calendarWeek: {
    minHeight: 74,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  calendarDay: {
    width: 44,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  calendarDayLabel: {
    fontSize: 8,
    fontWeight: "800",
  },
  calendarDate: {
    fontSize: 12,
    fontWeight: "900",
  },
  calendarOutfit: {
    height: 350,
    borderRadius: 15,
    marginBottom: 14,
  },
  timeline: {
    marginTop: 14,
  },
  timelineRow: {
    minHeight: 132,
    flexDirection: "row",
    gap: 11,
  },
  timelineTrack: {
    width: 38,
    alignItems: "center",
  },
  timelineDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 1,
    flex: 1,
  },
  timelineTime: {
    width: 44,
    fontSize: 9,
    fontWeight: "800",
    paddingTop: 8,
  },
  weekStrip: {
    gap: 10,
    paddingRight: 18,
    marginTop: 8,
  },
  weekCard: {
    width: 148,
    height: 360,
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
  },
  weekImage: {
    width: "100%",
    height: 270,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
  },
  occasionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  occasionCard: {
    width: "48%",
    height: 180,
    padding: 15,
    borderWidth: 1,
    borderRadius: 16,
    justifyContent: "flex-end",
  },
  occasionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 20,
  },
  moodDial: {
    width: 310,
    height: 310,
    borderRadius: 155,
    borderWidth: 1,
    alignSelf: "center",
    marginTop: 18,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  moodCenter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: "center",
    justifyContent: "center",
  },
  moodCenterText: {
    fontSize: 15,
    fontWeight: "900",
  },
  moodLabel: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "800",
  },
  moodTop: { top: 24 },
  moodRight: { right: 20, top: 145 },
  moodBottom: { bottom: 24 },
  moodLeft: { left: 20, top: 145 },
  moodResult: {
    minHeight: 68,
    paddingHorizontal: 15,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },
  temperatureScale: {
    height: 290,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    paddingHorizontal: 8,
  },
  temperatureLine: {
    position: "absolute",
    left: 15,
    right: 15,
    top: 132,
    height: 2,
  },
  temperatureMark: {
    alignItems: "center",
    gap: 12,
  },
  temperatureDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#BEBDB8",
  },
  temperatureValue: {
    fontSize: 11,
    fontWeight: "900",
  },
  temperaturePick: {
    minHeight: 120,
    padding: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  temperatureItem: {
    width: 94,
    height: 100,
  },
  repeatBoard: {
    height: 385,
    borderRadius: 18,
    marginTop: 12,
  },
  repeatActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  repeatButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  repeatButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  repeatIconButton: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  savedPreviewRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  savedPreview: {
    flex: 1,
    padding: 8,
    borderRadius: 12,
  },
  savedPreviewImage: {
    width: "100%",
    height: 310,
  },
  savedPreviewTitle: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 8,
  },
  checklist: {
    borderTopWidth: 1,
    marginTop: 12,
  },
  checkRow: {
    minHeight: 74,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  checkValue: {
    fontSize: 11,
    fontWeight: "900",
  },
  fullButton: {
    minHeight: 54,
    marginTop: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fullButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
  progressPath: {
    marginTop: 22,
  },
  pathRow: {
    minHeight: 150,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },
  pathTrack: {
    width: 48,
    alignItems: "center",
  },
  pathDot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pathNumber: {
    fontSize: 10,
    fontWeight: "900",
  },
  pathLine: {
    width: 1,
    flex: 1,
  },
  pathLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
    paddingTop: 11,
  },
  minimalRows: {
    borderTopWidth: 2,
    marginTop: 30,
  },
  minimalRow: {
    minHeight: 104,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  minimalNumber: {
    width: 26,
    fontSize: 10,
    fontWeight: "900",
  },
  minimalLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
  },
  minimalValue: {
    fontSize: 10,
    fontWeight: "700",
  },
  commandMetrics: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  commandMetric: {
    flex: 1,
    height: 126,
    padding: 13,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "flex-end",
  },
  commandMetricValue: {
    fontSize: 31,
    fontWeight: "900",
  },
  commandMetricLabel: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
  },
  commandMain: {
    minHeight: 150,
    padding: 18,
    borderRadius: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  bento: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  bentoLarge: {
    width: "64%",
    height: 250,
    padding: 17,
    borderRadius: 16,
    justifyContent: "flex-end",
  },
  bentoKicker: {
    fontSize: 9,
    fontWeight: "900",
  },
  bentoLargeTitle: {
    fontSize: 25,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 12,
  },
  bentoSmall: {
    width: "33%",
    height: 120,
    padding: 14,
    borderRadius: 16,
    justifyContent: "flex-end",
  },
  bentoValue: {
    fontSize: 25,
    fontWeight: "900",
  },
  bentoWide: {
    flex: 1,
    minWidth: "60%",
    height: 120,
    padding: 15,
    borderRadius: 16,
    justifyContent: "center",
    gap: 9,
  },
  dataStrip: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
  },
  dataStripItem: {
    flex: 1,
    alignItems: "center",
  },
  dataStripValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  dataStripLabel: {
    fontSize: 8,
    fontWeight: "800",
    marginTop: 3,
  },
  dataBody: {
    flex: 1,
    padding: 20,
  },
  dataBoard: {
    height: 370,
    borderRadius: 15,
    marginTop: 20,
  },
  categoryWheel: {
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    alignSelf: "center",
    marginTop: 28,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  wheelCenter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelCenterText: {
    fontSize: 16,
    fontWeight: "900",
  },
  wheelCategory: {
    position: "absolute",
    minWidth: 72,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelCategoryText: {
    fontSize: 10,
    fontWeight: "900",
  },
  wheelTop: { top: 22 },
  wheelRight: { right: 3, top: 140 },
  wheelBottom: { bottom: 22 },
  wheelLeft: { left: 3, top: 140 },
  closetMap: {
    height: 450,
    borderRadius: 18,
    position: "relative",
  },
  mapZone: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    justifyContent: "flex-end",
  },
  mapZoneText: {
    fontSize: 12,
    fontWeight: "900",
  },
  mapTop: { left: 12, top: 12, width: "58%", height: "47%" },
  mapBottom: { right: 12, bottom: 12, width: "58%", height: "47%" },
  mapShoes: { right: 12, top: 12, width: "34%", height: "34%" },
  mapOuter: { left: 12, bottom: 12, width: "34%", height: "34%" },
  filterFirstRow: {
    minHeight: 82,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  filterFirstLabel: {
    width: 70,
    fontSize: 10,
    fontWeight: "700",
  },
  filterFirstValue: {
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
  },
  queueRow: {
    minHeight: 102,
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 10,
  },
  queueTag: {
    width: 36,
    fontSize: 8,
    fontWeight: "900",
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  sheetHero: {
    height: 500,
    position: "relative",
  },
  sheetHeroTop: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bottomSheet: {
    flex: 1,
    marginTop: -30,
    padding: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetAction: {
    minHeight: 64,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  drawerScreen: {
    flex: 1,
    flexDirection: "row",
  },
  sideDrawer: {
    width: 68,
    paddingTop: 28,
    alignItems: "center",
    gap: 22,
  },
  drawerLogo: {
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 42,
  },
  drawerIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerBody: {
    flex: 1,
    padding: 20,
  },
  drawerBoard: {
    height: 430,
    marginTop: 20,
    marginBottom: 15,
  },
  fullPrompt: {
    flex: 1,
    padding: 22,
  },
  fullPromptLogo: {
    fontSize: 17,
    fontWeight: "900",
  },
  fullPromptQuestion: {
    fontSize: 48,
    lineHeight: 51,
    fontWeight: "900",
    marginTop: 135,
  },
  fullPromptAnswers: {
    marginTop: "auto",
    marginBottom: 28,
    gap: 18,
  },
  fullPromptAnswer: {
    fontSize: 14,
    fontWeight: "800",
  },
  deckArea: {
    height: 450,
    position: "relative",
    marginTop: 20,
  },
  deckCard: {
    position: "absolute",
    height: 330,
    padding: 20,
    borderRadius: 18,
    justifyContent: "flex-end",
  },
  deckNumber: {
    fontSize: 10,
    fontWeight: "900",
  },
  deckTitle: {
    fontSize: 26,
    fontWeight: "900",
    marginTop: 7,
  },
  radialArea: {
    width: 330,
    height: 330,
    alignSelf: "center",
    marginTop: 42,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  radialCenter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: "center",
    justifyContent: "center",
  },
  radialCenterText: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  radialAction: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  radialLabel: {
    fontSize: 9,
    fontWeight: "800",
  },
  radialTop: { top: 0 },
  radialRight: { right: 0, top: 127 },
  radialBottom: { bottom: 0 },
  radialLeft: { left: 0, top: 127 },
  gestureCard: {
    height: 440,
    borderRadius: 22,
    marginTop: 14,
    position: "relative",
  },
  gestureTop: {
    position: "absolute",
    width: 170,
    height: 230,
    left: 10,
    top: 35,
  },
  gestureBottom: {
    position: "absolute",
    width: 165,
    height: 250,
    right: 5,
    top: 68,
  },
  gestureBadge: {
    position: "absolute",
    left: 15,
    right: 15,
    bottom: 15,
    minHeight: 62,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
  },
  gestureActions: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  gestureAction: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  terminalScreen: {
    flex: 1,
    padding: 22,
  },
  terminalLogo: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 54,
  },
  terminalLine: {
    fontFamily: "monospace",
    fontSize: 11,
    marginTop: 20,
  },
  terminalResult: {
    fontFamily: "monospace",
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "900",
    marginTop: 8,
  },
  terminalCommand: {
    minHeight: 54,
    marginTop: "auto",
    marginBottom: 30,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  terminalPrompt: {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "900",
  },
  terminalInput: {
    fontFamily: "monospace",
    fontSize: 12,
  },
  boutiqueCounter: {
    height: 410,
    marginTop: 25,
    position: "relative",
  },
  counterTop: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 58,
    height: 2,
  },
  counterItemOne: {
    position: "absolute",
    width: 150,
    height: 230,
    left: 10,
    top: 40,
  },
  counterItemTwo: {
    position: "absolute",
    width: 150,
    height: 240,
    right: 15,
    top: 55,
  },
  counterCard: {
    position: "absolute",
    left: 30,
    right: 30,
    bottom: 22,
    minHeight: 90,
    padding: 15,
    justifyContent: "center",
  },
  noteScreen: {
    flex: 1,
    padding: 22,
  },
  noteTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  noteDate: {
    fontSize: 10,
    fontWeight: "700",
  },
  stylistNote: {
    marginTop: 72,
    minHeight: 430,
    padding: 25,
    transform: [{ rotate: "-1.5deg" }],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
  },
  noteGreeting: {
    fontSize: 18,
    fontWeight: "800",
  },
  noteBody: {
    fontSize: 16,
    lineHeight: 29,
    fontWeight: "600",
    marginTop: 35,
  },
  noteSign: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 34,
    textAlign: "right",
  },
  noteLink: {
    marginTop: 35,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  zeroScreen: {
    flex: 1,
    padding: 22,
  },
  zeroLogo: {
    fontSize: 15,
    fontWeight: "900",
  },
  zeroCenter: {
    flex: 1,
    justifyContent: "center",
  },
  zeroWeather: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 15,
  },
  zeroSuggestion: {
    fontSize: 35,
    lineHeight: 43,
    fontWeight: "900",
  },
  zeroActions: {
    minHeight: 76,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  zeroAction: {
    fontSize: 12,
    fontWeight: "900",
  },
});
