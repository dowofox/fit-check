import type {
  NamedColorRecord,
  SrgbColor,
} from "@/utils/fashionCompatibility/color/types";

function record(
  canonicalName: string,
  aliases: string[],
  representativeSrgb: SrgbColor,
  confidence = 0.35,
  notes: string[] = []
): NamedColorRecord {
  return Object.freeze({
    canonicalName,
    aliases: Object.freeze(aliases) as unknown as string[],
    representativeSrgb: Object.freeze(representativeSrgb),
    confidence,
    notes: Object.freeze(notes) as unknown as string[],
  });
}

const BROAD_RANGE = ["색상명은 실제 의류 측정값이 아니며 넓은 색 범위를 포함합니다."];

export const NAMED_COLOR_CATALOG: readonly NamedColorRecord[] = Object.freeze([
  record("블랙", ["블랙", "검정", "black"], { r: 18, g: 18, b: 18 }),
  record("빈티지 블랙", ["빈티지 블랙", "vintage black", "워시드 블랙", "washed black"], { r: 53, g: 51, b: 49 }, 0.2, BROAD_RANGE),
  record("화이트", ["화이트", "흰색", "white"], { r: 245, g: 245, b: 243 }),
  record("아이보리", ["아이보리", "ivory", "off white", "off-white", "오프화이트", "ecru"], { r: 238, g: 230, b: 210 }, 0.22, BROAD_RANGE),
  record("크림", ["크림", "cream"], { r: 241, g: 226, b: 193 }, 0.22, BROAD_RANGE),
  record("그레이", ["그레이", "회색", "gray", "grey", "멜란지", "melange"], { r: 128, g: 128, b: 128 }, 0.25, BROAD_RANGE),
  record("라이트그레이", ["라이트그레이", "라이트 그레이", "light gray", "light grey", "lightgray"], { r: 190, g: 190, b: 188 }),
  record("차콜", ["차콜", "charcoal"], { r: 61, g: 64, b: 67 }),
  record("네이비", ["네이비", "navy", "deep navy", "딥 네이비"], { r: 30, g: 45, b: 70 }),
  record("블루", ["블루", "파랑", "blue", "greyish blue", "grayish blue", "그레이시 블루"], { r: 55, g: 105, b: 155 }),
  record("스카이블루", ["스카이블루", "스카이 블루", "sky blue", "light blue", "연한 블루"], { r: 137, g: 190, b: 220 }),
  record("데님", ["데님", "denim", "중청", "워싱 블루", "washing blue"], { r: 70, g: 105, b: 140 }, 0.18, BROAD_RANGE),
  record("연청", ["연청", "light denim"], { r: 135, g: 170, b: 195 }, 0.2, BROAD_RANGE),
  record("진청", ["진청", "dark denim"], { r: 35, g: 67, b: 96 }, 0.2, BROAD_RANGE),
  record("인디고", ["인디고", "indigo"], { r: 42, g: 55, b: 100 }, 0.25, BROAD_RANGE),
  record("베이지", ["베이지", "beige", "tan"], { r: 190, g: 166, b: 125 }, 0.2, BROAD_RANGE),
  record("브라운", ["브라운", "갈색", "brown"], { r: 112, g: 77, b: 52 }, 0.2, BROAD_RANGE),
  record("카키", ["카키", "khaki"], { r: 117, g: 111, b: 74 }, 0.18, BROAD_RANGE),
  record("올리브", ["올리브", "olive"], { r: 92, g: 98, b: 54 }, 0.22, BROAD_RANGE),
  record("그린", ["그린", "초록", "green"], { r: 48, g: 125, b: 78 }),
  record("레드", ["레드", "빨강", "red"], { r: 190, g: 45, b: 45 }),
  record("버건디", ["버건디", "burgundy", "와인", "wine"], { r: 105, g: 35, b: 48 }),
  record("핑크", ["핑크", "분홍", "pink"], { r: 220, g: 130, b: 155 }),
  record("퍼플", ["퍼플", "보라", "purple", "violet"], { r: 115, g: 70, b: 145 }),
  record("옐로우", ["옐로우", "노랑", "yellow"], { r: 230, g: 190, b: 45 }),
  record("오렌지", ["오렌지", "주황", "orange"], { r: 220, g: 110, b: 35 }),
]);

export function normalizeColorAlias(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, " ");
}

const NAMED_COLOR_LOOKUP = new Map<string, NamedColorRecord>();
for (const color of NAMED_COLOR_CATALOG) {
  for (const alias of [color.canonicalName, ...color.aliases]) {
    NAMED_COLOR_LOOKUP.set(normalizeColorAlias(alias), color);
  }
}

export function getNamedColorRecord(label: string) {
  return NAMED_COLOR_LOOKUP.get(normalizeColorAlias(label));
}
