import {
  MATERIAL_SEASON_RULES,
  OUTFIT_DETAIL_RULES,
} from "@/utils/outfitDetailMaterialRules";
import type {
  FashionRuleDimension,
  FashionRuleMetadata,
  OutfitScoreEvidence,
} from "@/utils/fashionCompatibility/types";

export const LEGACY_RULE_IDS = {
  color: {
    blackDenim: "legacy.color.black-denim",
    basicBasic: "legacy.color.basic-basic",
    sameNonBasic: "legacy.color.same-non-basic",
    darkDark: "legacy.color.dark-dark",
    lightLight: "legacy.color.light-light",
    basicOnly: "legacy.color.basic-only",
    singleAccent: "legacy.color.single-accent",
    tooManyColors: "legacy.color.too-many-colors",
    multipleAccents: "legacy.color.multiple-accents",
    matchColors: "legacy.color.match-colors",
    avoidColors: "legacy.color.avoid-colors",
    singleStrongColor: "legacy.color.single-strong-color",
    multipleStrongColors: "legacy.color.multiple-strong-colors",
  },
  style: {
    conflict: "legacy.style.tag-conflict",
    groupMatch: "legacy.style.group-match",
    repeatedThree: "legacy.style.repeated-three",
    repeatedTwo: "legacy.style.repeated-two",
    similarGroup: "legacy.style.similar-group",
    weakConnection: "legacy.style.weak-connection",
    default: "legacy.style.default",
  },
  shape: {
    croppedWide: "legacy.shape.cropped-wide",
    semiOversizedWide: "legacy.shape.semi-oversized-wide",
    oversizedWide: "legacy.shape.oversized-wide",
    regularWide: "legacy.shape.regular-wide",
    looseSlim: "legacy.shape.loose-slim",
    longLong: "legacy.shape.long-long",
    regularBalanced: "legacy.shape.regular-balanced",
    excessiveVolume: "legacy.shape.excessive-volume",
    visualWeightBalanced: "legacy.shape.visual-weight-balanced",
    visualWeightExtreme: "legacy.shape.visual-weight-extreme",
    heavyTopSimpleBottom: "legacy.shape.heavy-top-simple-bottom",
    impressionCroppedWide: "legacy.shape.impression-cropped-wide",
    sourceWeight: "legacy.shape.source-weight",
  },
  fit: {
    volumeBalance: "legacy.fit.volume-balance",
    volumeExtreme: "legacy.fit.volume-extreme",
    shortLong: "legacy.fit.short-long",
    longLong: "legacy.fit.long-long",
    structureConflict: "legacy.fit.structure-conflict",
    drapeSupport: "legacy.fit.drape-support",
    bodyUpperVolume: "legacy.fit.body-upper-volume",
    bodyLowerVolume: "legacy.fit.body-lower-volume",
    sourceWeight: "legacy.fit.source-weight",
  },
  point: {
    low: "legacy.style.point-low",
    single: "legacy.style.point-single",
    double: "legacy.style.point-double",
    multiple: "legacy.style.point-multiple",
    sourceWeight: "legacy.style.point-source-weight",
  },
  occasion: {
    date: "legacy.occasion.date-adjustment",
    clean: "legacy.occasion.clean-adjustment",
    daily: "legacy.occasion.daily-adjustment",
    relaxed: "legacy.occasion.relaxed-adjustment",
    multiplePoints: "legacy.occasion.multiple-points",
    manyColors: "legacy.occasion.many-colors",
  },
  personal: {
    recentWear: "legacy.personal.recent-wear",
    longUnworn: "legacy.personal.long-unworn",
    lowWearCount: "legacy.personal.low-wear-count",
    highWearCount: "legacy.personal.high-wear-count",
    prefer: "legacy.personal.prefer",
    less: "legacy.personal.less",
  },
  environment: {
    temperatureSuitability: "legacy.environment.temperature-suitability",
  },
} as const;

export function getLegacyDetailRuleId(effectId: string) {
  return `legacy.material.detail.${effectId}`;
}

export function getLegacyMaterialSeasonRuleId(
  ruleId: string,
  effect: "positive" | "negative" | "style"
) {
  return `legacy.material.season.${ruleId}.${effect}`;
}

function createLegacyRule(
  id: string,
  dimension: FashionRuleDimension,
  rationale: string,
  knownExceptions?: string[]
): FashionRuleMetadata {
  return {
    id,
    dimension,
    sourceType: "temporary_heuristic",
    sourceReferences: [],
    confidence: 0.35,
    rationale,
    knownExceptions,
    version: "legacy-v1",
    enabled: true,
  };
}

const COLOR_RULES = Object.values(LEGACY_RULE_IDS.color).map((id) =>
  createLegacyRule(
    id,
    "color",
    "현재 운영 엔진의 문자열 기반 색상 조합 점수와 경고를 그대로 기록한다.",
    ["실제 색좌표와 명도·채도·면적 비율을 사용하지 않는다."]
  )
);

const STYLE_RULES = Object.values(LEGACY_RULE_IDS.style).map((id) =>
  createLegacyRule(
    id,
    "style",
    "현재 운영 엔진의 styleTags 그룹 및 반복 횟수 기반 연결 점수를 기록한다.",
    ["태그가 없거나 잘못 분류된 아이템에는 적용 근거가 약하다."]
  )
);

const SHAPE_RULES = Object.values(LEGACY_RULE_IDS.shape).map((id) =>
  createLegacyRule(
    id,
    id.includes("source-weight") ? "silhouette" : "proportion",
    "현재 운영 엔진의 실측·사진 인상·텍스트 fallback 기반 실루엣 규칙을 기록한다.",
    ["상품별 패턴과 실제 착용 자세는 반영하지 않는다."]
  )
);

const FIT_RULES = Object.values(LEGACY_RULE_IDS.fit).map((id) =>
  createLegacyRule(
    id,
    "fit",
    "현재 운영 엔진의 볼륨·기장·구조·드레이프 및 체형 보정을 기록한다.",
    ["사용자 신체 정보와 상품 실측이 부족하면 fallback 영향이 커진다."]
  )
);

const POINT_RULES = Object.values(LEGACY_RULE_IDS.point).map((id) =>
  createLegacyRule(
    id,
    "style",
    "현재 운영 엔진의 그래픽·패턴·색상 기반 포인트 강도 규칙을 기록한다.",
    ["포인트가 차지하는 실제 면적은 반영하지 않는다."]
  )
);

const OCCASION_RULES = Object.values(LEGACY_RULE_IDS.occasion).map((id) =>
  createLegacyRule(
    id,
    "occasion",
    "현재 상황별 키워드 점수와 포인트·색상 수 감점을 기록한다.",
    ["상황 의도와 장소의 세부 dress code는 구분하지 않는다."]
  )
);

const PERSONAL_RULES = Object.values(LEGACY_RULE_IDS.personal).map((id) =>
  createLegacyRule(
    id,
    "personal",
    "현재 저장·착용 이력과 사용자의 추천 선호에 따른 정렬 보정을 기록한다."
  )
);

const ENVIRONMENT_RULES = Object.values(LEGACY_RULE_IDS.environment).map((id) =>
  createLegacyRule(
    id,
    "environment",
    "공통 온도 적합성 모듈의 현재 점수와 hard block 결과를 기록한다."
  )
);

const DETAIL_RULES = Array.from(
  new Set(
    OUTFIT_DETAIL_RULES.flatMap((rule) =>
      rule.effects.map((effect) => getLegacyDetailRuleId(effect.id))
    )
  )
).map((id) =>
  createLegacyRule(
    id,
    "material",
    "현재 detailCategory·소재·동반 아이템 조건에 따른 가감점을 기록한다.",
    ["detailCategory와 소재 신호가 같은 특징을 중복 반영할 수 있다."]
  )
);

const MATERIAL_SEASON_METADATA = MATERIAL_SEASON_RULES.flatMap((rule) => {
  const metadata: FashionRuleMetadata[] = [];

  if (rule.positiveSeasons?.length) {
    metadata.push(
      createLegacyRule(
        getLegacyMaterialSeasonRuleId(rule.id, "positive"),
        "material",
        "현재 소재와 계절의 긍정 가점을 기록한다."
      )
    );
  }
  if (rule.negativeSeasons?.length) {
    metadata.push(
      createLegacyRule(
        getLegacyMaterialSeasonRuleId(rule.id, "negative"),
        "material",
        "현재 소재와 계절의 부정 가점을 기록한다."
      )
    );
  }
  if (rule.styleTags?.length && rule.styleScore) {
    metadata.push(
      createLegacyRule(
        getLegacyMaterialSeasonRuleId(rule.id, "style"),
        "material",
        "현재 소재와 styleTags 연결 가점을 기록한다."
      )
    );
  }

  return metadata;
});

export const LEGACY_FASHION_RULES: readonly FashionRuleMetadata[] = [
  ...COLOR_RULES,
  ...STYLE_RULES,
  ...SHAPE_RULES,
  ...FIT_RULES,
  ...POINT_RULES,
  ...DETAIL_RULES,
  ...MATERIAL_SEASON_METADATA,
  ...OCCASION_RULES,
  ...PERSONAL_RULES,
  ...ENVIRONMENT_RULES,
];

const RULES_BY_ID = new Map(
  LEGACY_FASHION_RULES.map((rule) => [rule.id, rule] as const)
);

export function getFashionRuleMetadata(ruleId: string) {
  return RULES_BY_ID.get(ruleId);
}

export function listFashionRulesByDimension(
  dimension: FashionRuleDimension
) {
  return LEGACY_FASHION_RULES.filter((rule) => rule.dimension === dimension);
}

export function isFashionRuleEnabled(ruleId: string) {
  return RULES_BY_ID.get(ruleId)?.enabled === true;
}

type EvidenceInput = {
  ruleId: string;
  direction: OutfitScoreEvidence["direction"];
  magnitude: number;
  itemIds: string[];
  messageKey?: string;
  diagnostics?: OutfitScoreEvidence["diagnostics"];
};

export function appendLegacyEvidence(
  evidence: OutfitScoreEvidence[],
  input: EvidenceInput
) {
  const metadata = getFashionRuleMetadata(input.ruleId);
  if (!metadata?.enabled) return;

  evidence.push({
    id: `${input.ruleId}:${evidence.length}`,
    ruleId: input.ruleId,
    dimension: metadata.dimension,
    direction: input.direction,
    magnitude: input.magnitude,
    confidence: metadata.confidence,
    sourceType: metadata.sourceType,
    itemIds: [...new Set(input.itemIds)].sort(),
    messageKey: input.messageKey || input.ruleId,
    diagnostics: input.diagnostics,
  });
}
