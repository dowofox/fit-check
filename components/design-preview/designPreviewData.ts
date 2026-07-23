import type { ImageSourcePropType } from "react-native";

export type DesignPreviewConceptId =
  | "warm-editorial"
  | "clean-minimal"
  | "soft-utility"
  | "dark-fashion"
  | "editorial-noir"
  | "guided-flow"
  | "visual-journal"
  | "quiet-system"
  | "dual-canvas"
  | "wardrobe-stage"
  | "daily-brief"
  | "style-concierge";

export type DesignPreviewScreenId =
  | "home"
  | "closet"
  | "readiness"
  | "ready"
  | "result"
  | "add"
  | "detail"
  | "profile";

export type DesignPreviewTokens = {
  id: DesignPreviewConceptId;
  code:
    | "A"
    | "B"
    | "C"
    | "D"
    | "E"
    | "F"
    | "G"
    | "H"
    | "I"
    | "J"
    | "K"
    | "L";
  name: string;
  summary: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  warning: string;
  success: string;
  border: string;
  radius: number;
  cardRadius: number;
  imageRadius: number;
  shadowOpacity: number;
};

export type DesignPreviewItem = {
  id: string;
  name: string;
  category: string;
  meta: string;
  image: ImageSourcePropType;
};

export const DESIGN_PREVIEW_CONCEPTS: DesignPreviewTokens[] = [
  {
    id: "warm-editorial",
    code: "A",
    name: "Warm Editorial",
    summary: "넓은 여백과 큰 이미지로 읽는 패션 에디토리얼",
    background: "#F3EDE5",
    surface: "#FFFDF9",
    surfaceAlt: "#E9DED1",
    text: "#251D17",
    muted: "#74685E",
    accent: "#79563D",
    accentText: "#FFFDF9",
    warning: "#A55438",
    success: "#55705A",
    border: "#D8C9BB",
    radius: 10,
    cardRadius: 22,
    imageRadius: 16,
    shadowOpacity: 0.04,
  },
  {
    id: "clean-minimal",
    code: "B",
    name: "Clean Minimal",
    summary: "선명한 정보 계층과 빠른 탐색을 위한 플랫 UI",
    background: "#F5F6F7",
    surface: "#FFFFFF",
    surfaceAlt: "#ECEFF2",
    text: "#111419",
    muted: "#626B75",
    accent: "#1F5FCC",
    accentText: "#FFFFFF",
    warning: "#B5473D",
    success: "#2D7652",
    border: "#D7DCE1",
    radius: 6,
    cardRadius: 10,
    imageRadius: 6,
    shadowOpacity: 0,
  },
  {
    id: "soft-utility",
    code: "C",
    name: "Soft Utility",
    summary: "준비도와 다음 행동을 바로 보여주는 친절한 대시보드",
    background: "#EDF3EF",
    surface: "#FFFFFF",
    surfaceAlt: "#DCE8E0",
    text: "#17231B",
    muted: "#66746A",
    accent: "#39745A",
    accentText: "#FFFFFF",
    warning: "#B86635",
    success: "#2C7A54",
    border: "#CDDCD2",
    radius: 16,
    cardRadius: 22,
    imageRadius: 18,
    shadowOpacity: 0.035,
  },
  {
    id: "dark-fashion",
    code: "D",
    name: "Dark Fashion",
    summary: "룩북처럼 강한 이미지와 타이포그래피에 집중한 다크 UI",
    background: "#0B0C0E",
    surface: "#17191C",
    surfaceAlt: "#23262A",
    text: "#F4F0E9",
    muted: "#A8A39C",
    accent: "#D1A05C",
    accentText: "#111111",
    warning: "#FF9164",
    success: "#85C49A",
    border: "#33363B",
    radius: 8,
    cardRadius: 14,
    imageRadius: 8,
    shadowOpacity: 0,
  },
  {
    id: "editorial-noir",
    code: "E",
    name: "Editorial Noir",
    summary: "Warm Editorial의 여백에 Dark Fashion의 룩북 대비를 더한 조합",
    background: "#F2EBE2",
    surface: "#FFFDF8",
    surfaceAlt: "#E5D9CB",
    text: "#211B17",
    muted: "#756A61",
    accent: "#17181A",
    accentText: "#F8F1E8",
    warning: "#A6533B",
    success: "#54705A",
    border: "#D6C7B8",
    radius: 10,
    cardRadius: 20,
    imageRadius: 12,
    shadowOpacity: 0.035,
  },
  {
    id: "guided-flow",
    code: "F",
    name: "Guided Flow",
    summary: "처음 쓰는 사람도 다음 행동을 놓치지 않는 단계형 스타일 가이드",
    background: "#F4F1EA",
    surface: "#FFFFFF",
    surfaceAlt: "#E9EEE9",
    text: "#17221E",
    muted: "#6C756F",
    accent: "#194C3D",
    accentText: "#FFFFFF",
    warning: "#D05D45",
    success: "#2F785D",
    border: "#D7DDD7",
    radius: 12,
    cardRadius: 18,
    imageRadius: 14,
    shadowOpacity: 0.025,
  },
  {
    id: "visual-journal",
    code: "G",
    name: "Visual Journal",
    summary: "룩 이미지와 짧은 문장으로 선택을 이끄는 패션 저널",
    background: "#F1EDE4",
    surface: "#FFFCF6",
    surfaceAlt: "#E2DACD",
    text: "#211D1A",
    muted: "#766D65",
    accent: "#6B2737",
    accentText: "#FFF9F0",
    warning: "#A84C36",
    success: "#4C6B57",
    border: "#D3C9BA",
    radius: 6,
    cardRadius: 16,
    imageRadius: 8,
    shadowOpacity: 0.02,
  },
  {
    id: "quiet-system",
    code: "H",
    name: "Quiet System",
    summary: "두 가지 핵심 행동과 선명한 목록으로 정리한 조용한 시스템 UI",
    background: "#F2F4F3",
    surface: "#FFFFFF",
    surfaceAlt: "#E5E9E7",
    text: "#111715",
    muted: "#65706B",
    accent: "#0F6873",
    accentText: "#FFFFFF",
    warning: "#B4503C",
    success: "#33745D",
    border: "#D4DAD7",
    radius: 8,
    cardRadius: 12,
    imageRadius: 6,
    shadowOpacity: 0,
  },
  {
    id: "dual-canvas",
    code: "I",
    name: "Dual Canvas",
    summary: "두 개의 큰 선택지만 남긴 대담한 분할형 홈",
    background: "#F2EFE7",
    surface: "#FFFEFA",
    surfaceAlt: "#E7E0D4",
    text: "#171713",
    muted: "#706D65",
    accent: "#B44732",
    accentText: "#FFFFFF",
    warning: "#B44732",
    success: "#426C59",
    border: "#D8D1C5",
    radius: 6,
    cardRadius: 8,
    imageRadius: 4,
    shadowOpacity: 0,
  },
  {
    id: "wardrobe-stage",
    code: "J",
    name: "Wardrobe Stage",
    summary: "메뉴보다 내 옷을 먼저 보여주는 비주얼 옷장 무대",
    background: "#F6F6F2",
    surface: "#FFFFFF",
    surfaceAlt: "#E8EBE5",
    text: "#16201B",
    muted: "#6F7973",
    accent: "#376550",
    accentText: "#FFFFFF",
    warning: "#C26048",
    success: "#376550",
    border: "#D9DDD7",
    radius: 14,
    cardRadius: 18,
    imageRadius: 12,
    shadowOpacity: 0.02,
  },
  {
    id: "daily-brief",
    code: "K",
    name: "Daily Brief",
    summary: "홈을 오늘의 룩 한 장과 짧은 브리핑으로 시작하는 구조",
    background: "#EFEDE8",
    surface: "#FAFAF7",
    surfaceAlt: "#DDDCD6",
    text: "#161719",
    muted: "#6F706F",
    accent: "#1C1E22",
    accentText: "#FFFFFF",
    warning: "#B4583F",
    success: "#4C6A56",
    border: "#D3D1CB",
    radius: 8,
    cardRadius: 12,
    imageRadius: 8,
    shadowOpacity: 0.025,
  },
  {
    id: "style-concierge",
    code: "L",
    name: "Style Concierge",
    summary: "사용자의 목적을 질문하고 한 단계씩 안내하는 컨시어지형 UI",
    background: "#F8F4EC",
    surface: "#FFFDF8",
    surfaceAlt: "#EEE7DC",
    text: "#231D18",
    muted: "#746D66",
    accent: "#594534",
    accentText: "#FFFFFF",
    warning: "#A9533E",
    success: "#506A58",
    border: "#DDD3C7",
    radius: 12,
    cardRadius: 16,
    imageRadius: 10,
    shadowOpacity: 0.02,
  },
];

export const DESIGN_PREVIEW_SCREENS: {
  id: DesignPreviewScreenId;
  label: string;
}[] = [
  { id: "home", label: "홈" },
  { id: "closet", label: "옷장" },
  { id: "readiness", label: "추천 준비 부족" },
  { id: "ready", label: "추천 가능" },
  { id: "result", label: "추천 결과" },
  { id: "add", label: "옷 추가" },
  { id: "detail", label: "옷 상세" },
  { id: "profile", label: "프로필" },
];

export const DESIGN_PREVIEW_ITEMS: DesignPreviewItem[] = [
  {
    id: "shirt",
    name: "네이비 옥스포드 셔츠",
    category: "상의",
    meta: "네이비 · 사계절",
    image: require("@/assets/design-preview/navy-shirt.png"),
  },
  {
    id: "knit",
    name: "아이보리 반팔 니트",
    category: "상의",
    meta: "아이보리 · 봄/여름",
    image: require("@/assets/design-preview/ivory-knit.png"),
  },
  {
    id: "hoodie",
    name: "그레이 후드",
    category: "상의",
    meta: "그레이 · 가을/겨울",
    image: require("@/assets/design-preview/gray-hoodie.png"),
  },
  {
    id: "trousers",
    name: "차콜 와이드 슬랙스",
    category: "하의",
    meta: "차콜 · 사계절",
    image: require("@/assets/design-preview/charcoal-trousers.png"),
  },
  {
    id: "jeans",
    name: "미드블루 스트레이트 데님",
    category: "하의",
    meta: "데님 · 사계절",
    image: require("@/assets/design-preview/blue-jeans.png"),
  },
  {
    id: "sneakers",
    name: "화이트 레더 스니커즈",
    category: "신발",
    meta: "화이트 · 사계절",
    image: require("@/assets/design-preview/white-sneakers.png"),
  },
  {
    id: "trench",
    name: "토프 트렌치코트",
    category: "아우터",
    meta: "토프 · 봄/가을",
    image: require("@/assets/design-preview/taupe-trench.png"),
  },
  {
    id: "bag",
    name: "블랙 레더 크로스백",
    category: "액세서리",
    meta: "블랙 · 사계절",
    image: require("@/assets/design-preview/black-crossbody.png"),
  },
  {
    id: "cap",
    name: "브라운 워시드 볼캡",
    category: "액세서리",
    meta: "브라운 · 사계절",
    image: require("@/assets/design-preview/brown-cap.png"),
  },
];

export const DESIGN_PREVIEW_OUTFIT_ITEMS = [
  DESIGN_PREVIEW_ITEMS[1],
  DESIGN_PREVIEW_ITEMS[3],
  DESIGN_PREVIEW_ITEMS[5],
  DESIGN_PREVIEW_ITEMS[6],
];

export const DESIGN_PREVIEW_READINESS = {
  tops: 1,
  bottoms: 2,
  shoes: 0,
  outers: 0,
  coreCombinations: 2,
  requirements: {
    tops: 3,
    bottoms: 3,
    shoes: 2,
    outers: 1,
    coreCombinations: 6,
  },
};

export const DESIGN_PREVIEW_READY = {
  tops: 4,
  bottoms: 4,
  shoes: 2,
  outers: 2,
  coreCombinations: 12,
};

export function getDesignPreviewConcept(value?: string) {
  return (
    DESIGN_PREVIEW_CONCEPTS.find((concept) => concept.id === value) ||
    DESIGN_PREVIEW_CONCEPTS[0]
  );
}

export function getDesignPreviewScreen(
  value?: string
): DesignPreviewScreenId {
  return DESIGN_PREVIEW_SCREENS.some((screen) => screen.id === value)
    ? (value as DesignPreviewScreenId)
    : "home";
}
