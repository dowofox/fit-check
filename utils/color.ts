type ColorNormalizationRule = {
  color: string;
  patterns: RegExp[];
};

const COLOR_NORMALIZATION_RULES: ColorNormalizationRule[] = [
  {
    color: "블루",
    patterns: [/\b(?:greyish|grayish)[\s-]*blue\b/i, /그레이시\s*블루/],
  },
  {
    color: "아이보리",
    patterns: [/\boff[\s-]*white\b/i, /\bivory\b/i, /\becru\b/i, /아이보리/],
  },
  { color: "크림", patterns: [/\bcream\b/i, /크림/] },
  {
    color: "라이트그레이",
    patterns: [/\blight[\s-]*(?:grey|gray)\b/i, /라이트\s*그레이/],
  },
  { color: "차콜", patterns: [/\bcharcoal\b/i, /차콜/] },
  { color: "네이비", patterns: [/\bnavy\b/i, /네이비/] },
  { color: "데님", patterns: [/\bdenim\b/i, /데님/] },
  { color: "블랙", patterns: [/\bblack\b/i, /블랙|검정/] },
  { color: "화이트", patterns: [/\bwhite\b/i, /화이트|흰색/] },
  { color: "베이지", patterns: [/\bbeige\b/i, /\btan\b/i, /베이지/] },
  { color: "그레이", patterns: [/\bgrey\b/i, /\bgray\b/i, /그레이|회색/] },
  { color: "블루", patterns: [/\bblue\b/i, /블루|파랑/] },
  { color: "레드", patterns: [/\bred\b/i, /레드|빨강/] },
  { color: "오렌지", patterns: [/\borange\b/i, /오렌지|주황/] },
  { color: "옐로우", patterns: [/\byellow\b/i, /옐로우|노랑/] },
  { color: "그린", patterns: [/\bgreen\b/i, /그린|초록/] },
  { color: "퍼플", patterns: [/\bpurple\b/i, /\bviolet\b/i, /퍼플|보라/] },
  { color: "핑크", patterns: [/\bpink\b/i, /핑크/] },
  { color: "브라운", patterns: [/\bbrown\b/i, /브라운|갈색/] },
  { color: "카키", patterns: [/\bkhaki\b/i, /카키/] },
  { color: "올리브", patterns: [/\bolive\b/i, /올리브/] },
];

export function normalizeProductColor(value?: string) {
  const rawColor = value?.replace(/\s+/g, " ").trim();
  if (!rawColor) return undefined;

  const matchedRule = COLOR_NORMALIZATION_RULES.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(rawColor))
  );

  return matchedRule?.color || rawColor;
}
