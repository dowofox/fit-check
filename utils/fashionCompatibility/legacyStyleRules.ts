import { isLegacyStrongColor } from "@/utils/fashionCompatibility/legacyColorRules";
import {
  LEGACY_RULE_IDS,
  appendLegacyEvidence,
  isFashionRuleEnabled,
} from "@/utils/fashionCompatibility/ruleRegistry";
import type { OutfitScoreEvidence } from "@/utils/fashionCompatibility/types";
import type { ClosetItem } from "@/utils/storage";

const STYLE_GROUPS = [
  ["캐주얼", "꾸안꾸", "시티보이", "아메카지", "데일리", "편안함"],
  ["스트릿", "고프코어", "테크웨어", "워크웨어"],
  ["포멀", "댄디", "클래식", "모던", "프레피", "미니멀", "깔끔함"],
  ["러블리", "페미닌"],
];
const STYLE_CONFLICT_PAIRS = [
  ["포멀", "스트릿"],
  ["댄디", "스트릿"],
  ["클래식", "고프코어"],
  ["페미닌", "테크웨어"],
  ["러블리", "워크웨어"],
];

const styleGroupCache = new Map<string, string[] | undefined>();
const itemStylesCache = new WeakMap<ClosetItem, string[]>();

export function getLegacyItemStyles(item: ClosetItem) {
  const cachedStyles = itemStylesCache.get(item);
  if (cachedStyles) return cachedStyles;

  const styles = item.styleTags?.length
    ? item.styleTags
    : item.style
      ? [item.style]
      : [];
  itemStylesCache.set(item, styles);
  return styles;
}

export function getLegacyStyleGroup(style?: string) {
  const key = style || "";
  if (!styleGroupCache.has(key)) {
    styleGroupCache.set(
      key,
      STYLE_GROUPS.find((group) => group.includes(key))
    );
  }

  return styleGroupCache.get(key);
}

function getPrimaryStyle(item?: ClosetItem) {
  if (!item) return undefined;
  return getLegacyItemStyles(item)[0];
}

function hasStyleConflict(styles: string[]) {
  return STYLE_CONFLICT_PAIRS.some(
    ([firstStyle, secondStyle]) =>
      styles.some((style) => style.includes(firstStyle)) &&
      styles.some((style) => style.includes(secondStyle))
  );
}

function getStyleGroupName(style?: string) {
  const group = getLegacyStyleGroup(style);

  if (!group) return style || "미분석";
  if (group.includes("캐주얼")) return "캐주얼";
  if (group.includes("스트릿")) return "스트릿";
  if (group.includes("포멀")) return "포멀";
  if (group.includes("러블리")) return "러블리";

  return style || "미분석";
}

function addStyleEvidence(
  evidence: OutfitScoreEvidence[],
  ruleId: string,
  direction: OutfitScoreEvidence["direction"],
  magnitude: number,
  items: ClosetItem[]
) {
  appendLegacyEvidence(evidence, {
    ruleId,
    direction,
    magnitude,
    itemIds: items.map((item) => item.id),
  });
}

function getBaseStyleScore(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  const styles = items
    .flatMap(getLegacyItemStyles)
    .filter((style): style is string => Boolean(style));
  const counts = styles.reduce<Record<string, number>>((acc, style) => {
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, {});
  const maxSameStyleCount = Math.max(0, ...Object.values(counts));
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");
  const topStyle = getPrimaryStyle(top);
  const bottomStyle = getPrimaryStyle(bottom);
  const topStyleGroup = getLegacyStyleGroup(topStyle);
  const bottomStyleGroup = getLegacyStyleGroup(bottomStyle);

  if (
    hasStyleConflict(styles) &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.style.conflict)
  ) {
    warnings.push(
      `${styles.slice(0, 3).join(", ")} 조합은 스타일 방향이 충돌할 수 있어요.`
    );
    addStyleEvidence(
      evidence,
      LEGACY_RULE_IDS.style.conflict,
      "negative",
      5,
      items
    );
    return 5;
  }

  if (
    topStyleGroup &&
    bottomStyleGroup &&
    topStyleGroup === bottomStyleGroup &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.style.groupMatch)
  ) {
    reasons.push(
      `상의와 하의가 모두 ${getStyleGroupName(topStyle)} 계열이라 스타일 방향이 자연스럽게 이어져요.`
    );
    addStyleEvidence(
      evidence,
      LEGACY_RULE_IDS.style.groupMatch,
      "positive",
      0,
      [top, bottom].filter((item): item is ClosetItem => Boolean(item))
    );
  }

  if (
    maxSameStyleCount >= 3 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.style.repeatedThree)
  ) {
    reasons.push(
      `${Object.keys(counts).find((style) => counts[style] === maxSameStyleCount) || "비슷한"} 태그가 여러 아이템에 반복되어 코디 분위기가 분명해요.`
    );
    addStyleEvidence(
      evidence,
      LEGACY_RULE_IDS.style.repeatedThree,
      "positive",
      24,
      items
    );
    return 24;
  }

  if (
    maxSameStyleCount === 2 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.style.repeatedTwo)
  ) {
    reasons.push(
      "같은 스타일 태그가 2개라 조합의 방향성은 충분히 보여요."
    );
    addStyleEvidence(
      evidence,
      LEGACY_RULE_IDS.style.repeatedTwo,
      "positive",
      18,
      items
    );
    return 18;
  }

  const knownGroups = styles
    .map(getLegacyStyleGroup)
    .filter((group): group is string[] => Boolean(group));
  const hasSimilarStyleGroup =
    knownGroups.length >= 2 &&
    knownGroups.some(
      (group) =>
        knownGroups.filter((otherGroup) => otherGroup === group).length >= 2
    );

  if (
    hasSimilarStyleGroup &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.style.similarGroup)
  ) {
    reasons.push(
      "태그가 완전히 같지는 않지만 비슷한 스타일 계열끼리 묶여 있어요."
    );
    addStyleEvidence(
      evidence,
      LEGACY_RULE_IDS.style.similarGroup,
      "positive",
      14,
      items
    );
    return 14;
  }

  if (
    styles.length > 0 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.style.weakConnection)
  ) {
    warnings.push(
      "아이템별 스타일 태그 연결감이 약해서 코디 의도가 흐려질 수 있어요."
    );
    addStyleEvidence(
      evidence,
      LEGACY_RULE_IDS.style.weakConnection,
      "negative",
      4,
      items
    );
  } else {
    addStyleEvidence(
      evidence,
      LEGACY_RULE_IDS.style.default,
      "neutral",
      4,
      items
    );
  }

  return 4;
}

export function isLegacyPointItem(item: ClosetItem) {
  const graphicSize = String(item.graphicSize || "").toLowerCase();
  const hasLargeGraphic =
    item.graphicDetected === true &&
    ["medium", "large", "중간", "큼"].some((size) =>
      graphicSize.includes(size)
    );
  const hasPattern = Boolean(
    item.pattern &&
      !["무지", "없음", "판단 어려움"].includes(item.pattern)
  );

  return hasLargeGraphic || hasPattern || isLegacyStrongColor(item.color);
}

export function evaluateLegacyStyleSupport(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  const styleReasons: string[] = [];
  const styleWarnings: string[] = [];
  const rawStyleScore = getBaseStyleScore(
    items,
    styleReasons,
    styleWarnings,
    evidence
  );

  reasons.push(...styleReasons.slice(0, 1));
  warnings.push(...styleWarnings);
  return Math.max(0, Math.min(5, Math.round(rawStyleScore / 5)));
}
