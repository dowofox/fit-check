import { doesProductSizeRowMatch } from "@/utils/productSizeMeasurements";
import { getRecommendationMaterialText } from "@/utils/productClassification";
import {
  LEGACY_RULE_IDS,
  appendLegacyEvidence,
  isFashionRuleEnabled,
} from "@/utils/fashionCompatibility/ruleRegistry";
import { isLegacyPointItem } from "@/utils/fashionCompatibility/legacyStyleRules";
import type { OutfitScoreEvidence } from "@/utils/fashionCompatibility/types";
import type {
  ClosetItem,
  GarmentProfile,
  UserProfile,
} from "@/utils/storage";

export type ResolvedGarmentProfile = {
  source: "measurement" | "impression" | "fallback";
  silhouette: NonNullable<GarmentProfile["silhouette"]>;
  volume: number;
  visualWeight: number;
  lengthBalance: NonNullable<GarmentProfile["lengthBalance"]>;
  pointLevel: number;
  structure: NonNullable<GarmentProfile["structure"]>;
  drape: NonNullable<GarmentProfile["drape"]>;
};

const garmentSearchTextCache = new WeakMap<ClosetItem, string>();
const resolvedGarmentProfileCache = new WeakMap<
  ClosetItem,
  Partial<Record<"impression" | "fallback", ResolvedGarmentProfile>>
>();

function includesAny(value: string | undefined, keywords: string[]) {
  return keywords.some((keyword) =>
    String(value || "").includes(keyword)
  );
}

function getGarmentSearchText(item: ClosetItem) {
  const cachedText = garmentSearchTextCache.get(item);
  if (cachedText !== undefined) return cachedText;

  const resolvedMaterial = getRecommendationMaterialText(item);
  const text = [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.fit,
    item.description,
    resolvedMaterial,
    item.styleProfile?.fit,
    item.styleProfile?.silhouette,
    item.styleProfile?.lengthType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  garmentSearchTextCache.set(item, text);
  return text;
}

function getFallbackSilhouette(
  item: ClosetItem
): ResolvedGarmentProfile["silhouette"] {
  const text = getGarmentSearchText(item);

  if (includesAny(text, ["크롭", "짧은 기장", "cropped"])) {
    return "cropped";
  }
  if (
    includesAny(text, ["세미오버", "세미 오버", "semi oversized"])
  ) {
    return "semiOversized";
  }
  if (
    item.category === "하의" &&
    includesAny(text, ["루즈", "배기", "loose", "relaxed", "baggy"])
  ) {
    return "wide";
  }
  if (
    includesAny(text, ["오버핏", "오버사이즈", "루즈", "oversized"])
  ) {
    return "oversized";
  }
  if (
    includesAny(text, [
      "와이드",
      "배기",
      "벌룬",
      "배럴",
      "커브드",
      "큐롯",
      "balloon",
      "barrel",
      "curved",
      "culotte",
      "wide",
    ])
  ) {
    return "wide";
  }
  if (
    includesAny(text, [
      "슬림",
      "스키니",
      "타이트",
      "레깅스",
      "제깅스",
      "slim",
      "leggings",
      "jeggings",
    ])
  ) {
    return "slim";
  }
  if (includesAny(text, ["롱", "긴 기장", "맥시", "long"])) {
    return "long";
  }

  return "regular";
}

function getFallbackLengthBalance(
  item: ClosetItem,
  silhouette: ResolvedGarmentProfile["silhouette"]
): ResolvedGarmentProfile["lengthBalance"] {
  const text = getGarmentSearchText(item);
  const isShortBottom =
    item.category === "하의" &&
    includesAny(text, [
      "반바지",
      "쇼츠",
      "버뮤다",
      "카프리",
      "7부 팬츠",
      "칠부 팬츠",
      "shorts",
      "bermuda",
      "capri",
    ]);

  if (
    silhouette === "cropped" ||
    includesAny(text, ["크롭", "숏", "짧은 기장"]) ||
    isShortBottom
  ) {
    return "short";
  }
  if (
    silhouette === "long" ||
    includesAny(text, ["롱", "맥시", "긴 기장"])
  ) {
    return "long";
  }
  return "regular";
}

function getFallbackStructure(
  item: ClosetItem
): ResolvedGarmentProfile["structure"] {
  const text = getGarmentSearchText(item);

  if (
    includesAny(text, [
      "데님",
      "가죽",
      "레더",
      "캔버스",
      "테일러드",
      "블레이저",
    ])
  ) {
    return "stiff";
  }
  if (
    includesAny(text, [
      "니트",
      "린넨",
      "레이온",
      "실크",
      "저지",
      "부드러운",
    ])
  ) {
    return "soft";
  }
  return "normal";
}

export function getLegacyCurrentSizeMeasurement(item: ClosetItem) {
  const sizeGuide = item.confirmedProduct?.productSizeGuide;

  if (!sizeGuide?.sizes?.length || !item.size) return undefined;
  return sizeGuide.sizes.find((measurement) =>
    doesProductSizeRowMatch(measurement, item.size)
  );
}

function getMeasuredVolume(item: ClosetItem) {
  const measurement = getLegacyCurrentSizeMeasurement(item);
  if (!measurement) return undefined;

  if (item.category === "상의" || item.category === "아우터") {
    if (typeof measurement.chest !== "number") return undefined;
    if (measurement.chest >= 62) return 8;
    if (measurement.chest >= 57) return 6;
    if (measurement.chest <= 50) return 2;
    return 4;
  }

  if (item.category === "하의") {
    if (
      (typeof measurement.thigh === "number" &&
        measurement.thigh >= 35) ||
      (typeof measurement.hem === "number" && measurement.hem >= 26)
    ) {
      return 8;
    }
    if (
      typeof measurement.thigh === "number" &&
      measurement.thigh <= 28 &&
      typeof measurement.hem === "number" &&
      measurement.hem <= 19
    ) {
      return 2;
    }
  }

  return undefined;
}

function getMeasuredLengthBalance(
  item: ClosetItem
): ResolvedGarmentProfile["lengthBalance"] | undefined {
  const totalLength = getLegacyCurrentSizeMeasurement(item)?.totalLength;
  if (typeof totalLength !== "number") return undefined;

  if (item.category === "상의" || item.category === "아우터") {
    if (totalLength <= 58) return "short";
    if (totalLength >= 75) return "long";
  }
  if (item.category === "하의") {
    if (totalLength <= 90) return "short";
    if (totalLength >= 105) return "long";
  }

  return "regular";
}

export function getResolvedLegacyGarmentProfile(
  item: ClosetItem,
  useImpression = true
): ResolvedGarmentProfile {
  const cacheKey = useImpression ? "impression" : "fallback";
  const cachedProfile = resolvedGarmentProfileCache.get(item)?.[cacheKey];
  if (cachedProfile) return cachedProfile;

  const explicitProfile = item.garmentProfile;
  const impressionProfile = useImpression ? explicitProfile : undefined;
  const currentMeasurement = getLegacyCurrentSizeMeasurement(item);
  const measuredVolume = getMeasuredVolume(item);
  const source: ResolvedGarmentProfile["source"] = currentMeasurement
    ? "measurement"
    : explicitProfile
      ? "impression"
      : "fallback";
  const fallbackSilhouette = getFallbackSilhouette(item);
  const silhouette =
    measuredVolume !== undefined
      ? item.category === "하의"
        ? measuredVolume >= 7
          ? "wide"
          : measuredVolume <= 2
            ? "slim"
            : fallbackSilhouette
        : measuredVolume >= 8
          ? "oversized"
          : measuredVolume >= 6
            ? "semiOversized"
            : measuredVolume <= 2
              ? "slim"
              : fallbackSilhouette
      : impressionProfile?.silhouette || fallbackSilhouette;
  const lengthBalance =
    getMeasuredLengthBalance(item) ||
    getFallbackLengthBalance(item, silhouette);
  const structure =
    impressionProfile?.structure || getFallbackStructure(item);
  const text = getGarmentSearchText(item);
  const defaultVolume: Record<
    ResolvedGarmentProfile["silhouette"],
    number
  > = {
    slim: 2,
    regular: 4,
    semiOversized: 6,
    oversized: 8,
    wide: 8,
    cropped: 4,
    long: 6,
  };
  const defaultVisualWeight =
    structure === "stiff" ||
    includesAny(text, ["패딩", "코트", "울", "두꺼운"])
      ? 7
      : structure === "soft"
        ? 4
        : 5;
  const fallbackPointLevel =
    (isLegacyPointItem(item) ? 6 : 2) +
    (item.graphicDetected &&
    String(item.graphicSize || "").includes("큼")
      ? 2
      : 0);
  const baseVolume = measuredVolume ?? defaultVolume[silhouette];
  const impressionVolume =
    typeof impressionProfile?.volume === "number"
      ? impressionProfile.volume
      : baseVolume;
  const basePointLevel = Math.min(10, fallbackPointLevel);
  const impressionPointLevel =
    typeof impressionProfile?.pointLevel === "number"
      ? impressionProfile.pointLevel
      : basePointLevel;

  const resolvedProfile: ResolvedGarmentProfile = {
    source,
    silhouette,
    volume: Math.round(baseVolume * 0.75 + impressionVolume * 0.25),
    visualWeight:
      impressionProfile?.visualWeight ?? Math.min(10, defaultVisualWeight),
    lengthBalance,
    pointLevel: Math.round(
      basePointLevel * 0.75 + impressionPointLevel * 0.25
    ),
    structure,
    drape:
      impressionProfile?.drape ||
      (structure === "soft"
        ? "high"
        : structure === "stiff"
          ? "low"
          : "medium"),
  };
  const cachedProfiles = resolvedGarmentProfileCache.get(item) || {};
  cachedProfiles[cacheKey] = resolvedProfile;
  resolvedGarmentProfileCache.set(item, cachedProfiles);
  return resolvedProfile;
}

export function getLegacyProfileSourceWeight(
  source: ResolvedGarmentProfile["source"]
) {
  if (source === "measurement") return 1;
  if (source === "impression") return 0.5;
  return 0.25;
}

function blendScoreBySource(
  score: number,
  neutralScore: number,
  maximumScore: number,
  sources: ResolvedGarmentProfile["source"][]
) {
  const averageWeight =
    sources.reduce(
      (total, source) => total + getLegacyProfileSourceWeight(source),
      0
    ) / Math.max(1, sources.length);
  const blendedScore =
    neutralScore + (score - neutralScore) * averageWeight;

  return Math.max(
    0,
    Math.min(maximumScore, Math.round(blendedScore))
  );
}

function sourceDiagnostics(
  topProfile: ResolvedGarmentProfile,
  bottomProfile: ResolvedGarmentProfile
) {
  return {
    topProfileSource:
      topProfile.source === "measurement"
        ? "product_measurement"
        : topProfile.source === "impression"
          ? "image_analysis"
          : "text_fallback",
    bottomProfileSource:
      bottomProfile.source === "measurement"
        ? "product_measurement"
        : bottomProfile.source === "impression"
          ? "image_analysis"
          : "text_fallback",
    usedTextFallback:
      topProfile.source === "fallback" ||
      bottomProfile.source === "fallback",
    inputConfidence:
      (getLegacyProfileSourceWeight(topProfile.source) +
        getLegacyProfileSourceWeight(bottomProfile.source)) /
      2,
  };
}

function addShapeEvidence(
  evidence: OutfitScoreEvidence[],
  ruleId: string,
  direction: OutfitScoreEvidence["direction"],
  magnitude: number,
  top: ClosetItem,
  bottom: ClosetItem,
  topProfile: ResolvedGarmentProfile,
  bottomProfile: ResolvedGarmentProfile
) {
  appendLegacyEvidence(evidence, {
    ruleId,
    direction,
    magnitude,
    itemIds: [top.id, bottom.id],
    diagnostics: sourceDiagnostics(topProfile, bottomProfile),
  });
}

export function evaluateLegacySilhouette(
  top: ClosetItem,
  bottom: ClosetItem,
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  const topProfile = getResolvedLegacyGarmentProfile(top);
  const bottomProfile = getResolvedLegacyGarmentProfile(bottom);
  const topLoose = ["semiOversized", "oversized"].includes(
    topProfile.silhouette
  );
  const bottomWide = bottomProfile.silhouette === "wide";
  const bottomSlim = bottomProfile.silhouette === "slim";
  let score = 25;

  if (
    topProfile.silhouette === "cropped" &&
    bottomWide &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.croppedWide)
  ) {
    score = 35;
    reasons.push(
      "짧은 상의와 와이드 하의가 만나 상하 비율과 실루엣 균형이 좋아요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.croppedWide,
      "positive",
      10,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (topLoose && bottomWide) {
    const ruleId =
      topProfile.silhouette === "semiOversized"
        ? LEGACY_RULE_IDS.shape.semiOversizedWide
        : LEGACY_RULE_IDS.shape.oversizedWide;
    if (isFashionRuleEnabled(ruleId)) {
      score =
        topProfile.silhouette === "semiOversized" ? 34 : 31;
      reasons.push(
        topProfile.silhouette === "semiOversized"
          ? "상의가 세미오버핏이라 와이드 하의와 실루엣 균형이 좋아요."
          : "여유 있는 상의와 와이드 하의가 자연스러운 볼륨 흐름을 만들어요."
      );
      addShapeEvidence(
        evidence,
        ruleId,
        "positive",
        score - 25,
        top,
        bottom,
        topProfile,
        bottomProfile
      );
    }
  } else if (
    ["slim", "regular"].includes(topProfile.silhouette) &&
    bottomWide &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.regularWide)
  ) {
    score = 32;
    reasons.push(
      "상체는 정돈되고 하체에 여유가 있어 실루엣 대비가 안정적이에요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.regularWide,
      "positive",
      7,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (
    topLoose &&
    bottomSlim &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.looseSlim)
  ) {
    score = 19;
    warnings.push(
      "상의 볼륨에 비해 하의가 지나치게 슬림해 상하 균형이 끊겨 보일 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.looseSlim,
      "negative",
      6,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (
    topProfile.lengthBalance === "long" &&
    bottomProfile.lengthBalance === "long" &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.longLong)
  ) {
    score = 18;
    warnings.push(
      "상의와 하의 기장이 모두 길어 전체 비율이 무겁고 답답해 보일 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.longLong,
      "negative",
      7,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (
    topProfile.silhouette === "regular" &&
    ["regular", "slim"].includes(bottomProfile.silhouette) &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.regularBalanced)
  ) {
    score = 29;
    reasons.push(
      "상의와 하의의 기본 실루엣이 정돈되어 무난하게 이어져요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.regularBalanced,
      "positive",
      4,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }

  if (
    topProfile.volume >= 7 &&
    bottomProfile.volume >= 7 &&
    topProfile.lengthBalance !== "short" &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.excessiveVolume)
  ) {
    score -= 8;
    warnings.push(
      "두 아이템 모두 볼륨이 커서 전체 실루엣이 부해 보일 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.excessiveVolume,
      "negative",
      8,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }

  const visualWeightDifference = Math.abs(
    topProfile.visualWeight - bottomProfile.visualWeight
  );
  if (
    visualWeightDifference <= 2 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.visualWeightBalanced)
  ) {
    score += 2;
    reasons.push(
      "상의와 하의의 시각적 무게감이 비슷해 한쪽으로 치우치지 않아요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.visualWeightBalanced,
      "positive",
      2,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (
    visualWeightDifference >= 6 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.visualWeightExtreme)
  ) {
    score -= 5;
    warnings.push(
      "상의와 하의의 시각적 무게감 차이가 커서 조합이 따로 보일 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.visualWeightExtreme,
      "negative",
      5,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (
    topProfile.visualWeight >= 7 &&
    bottomProfile.pointLevel <= 4 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.shape.heavyTopSimpleBottom)
  ) {
    reasons.push(
      "상의의 시각적 무게감이 강해서 하의는 단순한 실루엣으로 받쳐주는 조합이에요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.shape.heavyTopSimpleBottom,
      "neutral",
      0,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }

  const impressionSilhouettes = [
    top.garmentProfile?.silhouette,
    bottom.garmentProfile?.silhouette,
  ].filter(Boolean);
  if (impressionSilhouettes.length > 0) {
    const impressionSupportsBalance =
      top.garmentProfile?.silhouette === "cropped" &&
      bottomProfile.silhouette === "wide";
    if (
      impressionSupportsBalance &&
      isFashionRuleEnabled(
        LEGACY_RULE_IDS.shape.impressionCroppedWide
      )
    ) {
      score += 1;
      addShapeEvidence(
        evidence,
        LEGACY_RULE_IDS.shape.impressionCroppedWide,
        "positive",
        1,
        top,
        bottom,
        topProfile,
        bottomProfile
      );
    }
  }

  const rawScore = blendScoreBySource(score, 25, 35, [
    topProfile.source,
    bottomProfile.source,
  ]);
  addShapeEvidence(
    evidence,
    LEGACY_RULE_IDS.shape.sourceWeight,
    "neutral",
    rawScore - score,
    top,
    bottom,
    topProfile,
    bottomProfile
  );
  return Math.round((rawScore / 35) * 25);
}

export function evaluateLegacyWearFit(
  top: ClosetItem,
  bottom: ClosetItem,
  profile: UserProfile | null | undefined,
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  const topProfile = getResolvedLegacyGarmentProfile(top, false);
  const bottomProfile = getResolvedLegacyGarmentProfile(bottom, false);
  const volumeDifference = Math.abs(
    topProfile.volume - bottomProfile.volume
  );
  const bodyType = profile?.bodyType || "";
  let score = 18;

  if (
    volumeDifference <= 3 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.volumeBalance)
  ) {
    score += 3;
    reasons.push(
      "상하의 볼륨 차이가 과하지 않아 착장 구성의 연결감이 좋아요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.volumeBalance,
      "positive",
      3,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (
    volumeDifference >= 6 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.volumeExtreme)
  ) {
    score -= 4;
    warnings.push(
      "상하의 볼륨 차이가 커서 착장 구성에서 한쪽만 과장되어 보일 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.volumeExtreme,
      "negative",
      4,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }

  if (
    topProfile.lengthBalance === "short" &&
    bottomProfile.lengthBalance === "long" &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.shortLong)
  ) {
    score += 3;
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.shortLong,
      "positive",
      3,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }
  if (
    topProfile.lengthBalance === "long" &&
    bottomProfile.lengthBalance === "long" &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.longLong)
  ) {
    score -= 4;
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.longLong,
      "negative",
      4,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }
  if (
    topProfile.structure === "stiff" &&
    bottomProfile.structure === "stiff" &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.structureConflict)
  ) {
    score -= 2;
    warnings.push(
      "상하의가 모두 각이 강해 움직임이 딱딱하고 무거워 보일 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.structureConflict,
      "negative",
      2,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  } else if (
    (topProfile.drape === "high" ||
      bottomProfile.drape === "high") &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.drapeSupport)
  ) {
    score += 1;
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.drapeSupport,
      "positive",
      1,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }
  if (
    (bodyType.includes("상체") ||
      bodyType.includes("역삼각")) &&
    getLegacyCurrentSizeMeasurement(top) &&
    topProfile.volume >= 7 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.bodyUpperVolume)
  ) {
    score -= 2;
    warnings.push(
      "현재 체형 정보에서는 상의 볼륨이 상체를 더 크게 보이게 할 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.bodyUpperVolume,
      "negative",
      2,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }
  if (
    (bodyType.includes("하체") ||
      bodyType.includes("삼각")) &&
    getLegacyCurrentSizeMeasurement(bottom) &&
    bottomProfile.volume >= 8 &&
    isFashionRuleEnabled(LEGACY_RULE_IDS.fit.bodyLowerVolume)
  ) {
    score -= 2;
    warnings.push(
      "현재 체형 정보에서는 하의 볼륨이 하체를 더 무겁게 보이게 할 수 있어요."
    );
    addShapeEvidence(
      evidence,
      LEGACY_RULE_IDS.fit.bodyLowerVolume,
      "negative",
      2,
      top,
      bottom,
      topProfile,
      bottomProfile
    );
  }

  const measurementCount = [topProfile, bottomProfile].filter(
    (itemProfile) => itemProfile.source === "measurement"
  ).length;
  const measurementWeight = 0.25 + measurementCount * 0.375;
  const weightedScore = 18 + (score - 18) * measurementWeight;
  addShapeEvidence(
    evidence,
    LEGACY_RULE_IDS.fit.sourceWeight,
    "neutral",
    weightedScore - score,
    top,
    bottom,
    topProfile,
    bottomProfile
  );

  return Math.max(
    0,
    Math.min(20, Math.round((weightedScore / 25) * 20))
  );
}

export function evaluateLegacyPointBalance(
  items: ClosetItem[],
  reasons: string[],
  warnings: string[],
  evidence: OutfitScoreEvidence[]
) {
  const profiles = items.map((item) =>
    getResolvedLegacyGarmentProfile(item)
  );
  const weightedPointLevels = profiles.map((profile) => {
    const neutralPointLevel = 4;
    return (
      neutralPointLevel +
      (profile.pointLevel - neutralPointLevel) *
        getLegacyProfileSourceWeight(profile.source)
    );
  });
  const strongPointItems = weightedPointLevels.filter(
    (pointLevel) => pointLevel >= 7
  );
  const totalPointLevel = weightedPointLevels.reduce(
    (total, pointLevel) => total + pointLevel,
    0
  );
  let rawPointScore: number;
  let ruleId: string;
  let direction: OutfitScoreEvidence["direction"];

  if (
    strongPointItems.length === 0 &&
    totalPointLevel <= items.length * 4
  ) {
    reasons.push(
      "포인트 강도가 낮아 다른 요소와 충돌하지 않는 안정적인 조합이에요."
    );
    rawPointScore = 13;
    ruleId = LEGACY_RULE_IDS.point.low;
    direction = "positive";
  } else if (strongPointItems.length === 1) {
    reasons.push(
      "포인트 아이템은 하나만 두고 나머지를 차분하게 받쳐 시선이 정돈돼요."
    );
    rawPointScore = 15;
    ruleId = LEGACY_RULE_IDS.point.single;
    direction = "positive";
  } else if (strongPointItems.length === 2) {
    warnings.push(
      "포인트가 강한 아이템이 두 개라 실제 착용 시 조금 복잡해 보일 수 있어요."
    );
    rawPointScore = 8;
    ruleId = LEGACY_RULE_IDS.point.double;
    direction = "negative";
  } else {
    warnings.push(
      "포인트가 강한 아이템이 많아 코디의 중심이 분산될 수 있어요."
    );
    rawPointScore = 3;
    ruleId = LEGACY_RULE_IDS.point.multiple;
    direction = "negative";
  }

  appendLegacyEvidence(evidence, {
    ruleId,
    direction,
    magnitude: Math.abs(rawPointScore - 10),
    itemIds: items.map((item) => item.id),
  });
  const blendedScore = blendScoreBySource(
    rawPointScore,
    10,
    15,
    profiles.map((profile) => profile.source)
  );
  appendLegacyEvidence(evidence, {
    ruleId: LEGACY_RULE_IDS.point.sourceWeight,
    direction: "neutral",
    magnitude: blendedScore - rawPointScore,
    itemIds: items.map((item) => item.id),
    diagnostics: {
      usedTextFallback: profiles.some(
        (profile) => profile.source === "fallback"
      ),
      inputConfidence:
        profiles.reduce(
          (total, profile) =>
            total + getLegacyProfileSourceWeight(profile.source),
          0
        ) / Math.max(1, profiles.length),
    },
  });
  return Math.round((blendedScore / 15) * 10);
}
