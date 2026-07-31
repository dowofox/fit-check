import {
  LEGACY_RULE_IDS,
  appendLegacyEvidence,
  isFashionRuleEnabled,
} from "@/utils/fashionCompatibility/ruleRegistry";
import type { OutfitScoreEvidence } from "@/utils/fashionCompatibility/types";
import type { ClosetItem } from "@/utils/storage";

const BASIC_COLORS = [
  "블랙",
  "화이트",
  "아이보리",
  "베이지",
  "그레이",
  "네이비",
  "데님",
];
const DARK_COLORS = ["블랙", "네이비", "차콜"];
const LIGHT_COLORS = [
  "화이트",
  "아이보리",
  "베이지",
  "크림",
  "라이트그레이",
];
const STRONG_COLORS = [
  "레드",
  "빨강",
  "오렌지",
  "주황",
  "옐로우",
  "노랑",
  "그린",
  "초록",
  "블루",
  "파랑",
  "퍼플",
  "보라",
  "핑크",
  "형광",
  "네온",
];

const basicColorCache = new Map<string, boolean>();

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

function getItemLabel(item: ClosetItem) {
  return item.detailCategory || item.subCategory || item.category || "아이템";
}

export function isLegacyStrongColor(color?: string) {
  return STRONG_COLORS.some((keyword) =>
    String(color || "").includes(keyword)
  );
}

export function isLegacyBasicColor(color?: string) {
  const key = color || "";
  if (!basicColorCache.has(key)) {
    basicColorCache.set(key, BASIC_COLORS.includes(key));
  }

  return basicColorCache.get(key) || false;
}

function addColorEvidence(
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

function getBaseColorScore(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  const colors = uniqueValues(items.map((item) => item.color));
  const basicColorCount = colors.filter((color) =>
    BASIC_COLORS.includes(color)
  ).length;
  const accentColorCount = colors.length - basicColorCount;
  const top = items.find((item) => item.category === "상의");
  const bottom = items.find((item) => item.category === "하의");
  const topColor = top?.color;
  const bottomColor = bottom?.color;

  if (topColor && bottomColor) {
    const topIsBasic = isLegacyBasicColor(topColor);
    const bottomIsBasic = isLegacyBasicColor(bottomColor);
    const bottomLabel = bottom ? getItemLabel(bottom) : "";
    const hasDenimBottom =
      bottomColor.includes("데님") ||
      bottomLabel.includes("데님") ||
      bottomLabel.includes("청바지");

    if (
      topColor.includes("블랙") &&
      hasDenimBottom &&
      isFashionRuleEnabled(LEGACY_RULE_IDS.color.blackDenim)
    ) {
      reasons.push(
        "검정 상의와 데님 하의 조합이라 캐주얼하게 안정적이에요."
      );
      addColorEvidence(
        evidence,
        LEGACY_RULE_IDS.color.blackDenim,
        "positive",
        25,
        [top, bottom]
      );
      return 25;
    }

    if (
      topIsBasic &&
      bottomIsBasic &&
      topColor !== bottomColor &&
      isFashionRuleEnabled(LEGACY_RULE_IDS.color.basicBasic)
    ) {
      reasons.push(
        `${topColor} 상의와 ${bottomColor} 하의 조합이라 과하지 않고 안정적이에요.`
      );
      addColorEvidence(
        evidence,
        LEGACY_RULE_IDS.color.basicBasic,
        "positive",
        23,
        [top, bottom]
      );
      return 23;
    }

    if (
      topColor === bottomColor &&
      !topColor.includes("블랙") &&
      !topColor.includes("화이트") &&
      isFashionRuleEnabled(LEGACY_RULE_IDS.color.sameNonBasic)
    ) {
      warnings.push(
        `상의와 하의가 모두 ${topColor} 계열이라 실루엣이 뭉쳐 보일 수 있어요.`
      );
      addColorEvidence(
        evidence,
        LEGACY_RULE_IDS.color.sameNonBasic,
        "negative",
        15,
        [top, bottom]
      );
      return 10;
    }

    if (
      DARK_COLORS.some((color) => topColor.includes(color)) &&
      DARK_COLORS.some((color) => bottomColor.includes(color)) &&
      isFashionRuleEnabled(LEGACY_RULE_IDS.color.darkDark)
    ) {
      warnings.push(
        "상의와 하의가 모두 어두운 색이라 답답하게 보일 수 있어요."
      );
      addColorEvidence(
        evidence,
        LEGACY_RULE_IDS.color.darkDark,
        "negative",
        12,
        [top, bottom]
      );
      return 13;
    }

    if (
      LIGHT_COLORS.some((color) => topColor.includes(color)) &&
      LIGHT_COLORS.some((color) => bottomColor.includes(color)) &&
      isFashionRuleEnabled(LEGACY_RULE_IDS.color.lightLight)
    ) {
      reasons.push("밝은 톤끼리 이어져 부드럽고 깨끗한 인상이에요.");
      addColorEvidence(
        evidence,
        LEGACY_RULE_IDS.color.lightLight,
        "positive",
        20,
        [top, bottom]
      );
      return 20;
    }
  }

  if (
    (colors.length === 0 || accentColorCount === 0) &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.color.basicOnly)
  ) {
    reasons.push(
      "무채색이나 베이직 컬러 중심이라 색 조합이 안정적이에요."
    );
    addColorEvidence(
      evidence,
      LEGACY_RULE_IDS.color.basicOnly,
      "positive",
      24,
      items
    );
    return 24;
  }

  if (
    accentColorCount === 1 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.color.singleAccent)
  ) {
    reasons.push(
      "베이직 컬러 위에 포인트 컬러가 하나라 부담 없이 개성을 줄 수 있어요."
    );
    addColorEvidence(
      evidence,
      LEGACY_RULE_IDS.color.singleAccent,
      "positive",
      20,
      items
    );
    return 20;
  }

  if (
    colors.length >= 4 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.color.tooManyColors)
  ) {
    warnings.push(
      "다만 색상이 여러 개라 실제 착용 시 산만해 보일 수 있어요."
    );
    addColorEvidence(
      evidence,
      LEGACY_RULE_IDS.color.tooManyColors,
      "negative",
      19,
      items
    );
    return 6;
  }

  warnings.push(
    "색 포인트가 둘 이상이라 조합이 조금 복잡해 보일 수 있어요."
  );
  addColorEvidence(
    evidence,
    LEGACY_RULE_IDS.color.multipleAccents,
    "negative",
    15,
    items
  );
  return 10;
}

export function legacyColorValuesMatch(
  firstColor?: string,
  secondColor?: string
) {
  const first = String(firstColor || "").trim();
  const second = String(secondColor || "").trim();
  return Boolean(
    first && second && (first.includes(second) || second.includes(first))
  );
}

function getColorScore(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  let score = getBaseColorScore(items, reasons, warnings, evidence);
  const itemColors = items
    .map((item) => item.color)
    .filter((color): color is string => Boolean(color));
  const strongColorCount = itemColors.filter(isLegacyStrongColor).length;
  let matchColorCount = 0;
  let avoidColorCount = 0;

  items.forEach((item) => {
    const otherColors = items
      .filter((otherItem) => otherItem.id !== item.id)
      .map((otherItem) => otherItem.color)
      .filter((color): color is string => Boolean(color));

    if (
      (item.styleProfile?.matchColors || []).some((color) =>
        otherColors.some((otherColor) =>
          legacyColorValuesMatch(color, otherColor)
        )
      )
    ) {
      matchColorCount += 1;
    }

    if (
      (item.styleProfile?.avoidColors || []).some((color) =>
        otherColors.some((otherColor) =>
          legacyColorValuesMatch(color, otherColor)
        )
      )
    ) {
      avoidColorCount += 1;
    }
  });

  if (
    matchColorCount > 0 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.color.matchColors)
  ) {
    const adjustment = Math.min(4, matchColorCount * 2);
    score += adjustment;
    reasons.push(
      "아이템의 AI 색상 프로필에서 추천한 색 조합이 실제 코디에 반영됐어요."
    );
    addColorEvidence(
      evidence,
      LEGACY_RULE_IDS.color.matchColors,
      "positive",
      adjustment,
      items
    );
  }

  if (
    avoidColorCount > 0 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.color.avoidColors)
  ) {
    const adjustment = Math.min(8, avoidColorCount * 4);
    score -= adjustment;
    warnings.push(
      "일부 아이템의 피할 색상 정보와 겹쳐 색 조합 점수를 낮췄어요."
    );
    addColorEvidence(
      evidence,
      LEGACY_RULE_IDS.color.avoidColors,
      "negative",
      adjustment,
      items
    );
  }

  if (
    strongColorCount === 1 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.color.singleStrongColor)
  ) {
    score += 1;
    reasons.push(
      "강한 색상은 하나만 사용해 포인트가 분명하고 과하지 않아요."
    );
    addColorEvidence(
      evidence,
      LEGACY_RULE_IDS.color.singleStrongColor,
      "positive",
      1,
      items
    );
  } else if (
    strongColorCount >= 2 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.color.multipleStrongColors)
  ) {
    score -= 5;
    warnings.push(
      "강한 색상이 2개 이상이라 서로 경쟁하고 산만해 보일 수 있어요."
    );
    addColorEvidence(
      evidence,
      LEGACY_RULE_IDS.color.multipleStrongColors,
      "negative",
      5,
      items
    );
  }

  return Math.max(0, Math.min(25, score));
}

export function evaluateLegacyColorSupport(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  const colorReasons: string[] = [];
  const colorWarnings: string[] = [];
  const rawColorScore = getColorScore(
    items,
    colorReasons,
    colorWarnings,
    evidence
  );

  reasons.push(...colorReasons.slice(0, 1));
  warnings.push(...colorWarnings);
  return Math.max(0, Math.min(10, Math.round(rawColorScore * 0.4)));
}
