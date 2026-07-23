import type { ImageSourcePropType } from "react-native";

export type DesignPreviewConceptId =
  | "warm-editorial"
  | "clean-minimal"
  | "soft-utility"
  | "dark-fashion";

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
  code: "A" | "B" | "C" | "D";
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
