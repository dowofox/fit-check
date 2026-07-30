import { hasUserEditedClosetSeason } from "@/utils/closetSeason";
import type { ClosetItem } from "@/utils/storage";

export const OUTFIT_TEMPERATURE_POLICY_VERSION = 1;
export const WEATHER_TEMPERATURE_RANGE_TOLERANCE = 5;
export const NEUTRAL_TEMPERATURE_COMFORT_SCORE = 20;
export const MIN_SAFE_TEMPERATURE_COMFORT_SCORE = 12;

export type OutfitTemperatureWeather = {
  temperature?: number;
  apparentTemperature?: number;
  condition?: string;
  rainChance?: number;
  windSpeed?: number;
  humidity?: number;
};

export type TemperatureSuitabilityStatus =
  | "excellent"
  | "good"
  | "borderline"
  | "poor"
  | "unsafe";

export type ItemWarmthProfile = {
  itemId: string;
  warmthLevel: number;
  source: string;
  conflicts: string[];
  temperatureRangePenalty: number;
  temperatureRangeSoftened: boolean;
  userSeasonOverride: boolean;
  hotWeatherHardConflict: boolean;
};

export type TemperatureSuitabilityAssessment = {
  status: TemperatureSuitabilityStatus;
  score: number;
  maxScore: 25;
  hardBlocked: boolean;
  temperature?: number;
  effectiveTemperature?: number;
  reasons: string[];
  warnings: string[];
  itemAssessments: ItemWarmthProfile[];
};

const PADDING_KEYWORDS = [
  "패딩",
  "puffer",
  "구스 다운",
  "구스다운",
  "덕 다운",
  "덕다운",
  "다운 패딩",
  "다운패딩",
  "다운 자켓",
  "다운 재킷",
  "다운 점퍼",
  "다운 베스트",
  "down jacket",
  "down parka",
  "down vest",
  "충전재",
];
const VERY_WARM_KEYWORDS = [
  "플리스",
  "후리스",
  "fleece",
  "기모",
  "보아",
  "무스탕",
  "shearling",
  "방한",
  "발열",
  "헤비 니트",
  "헤비니트",
  "heavy knit",
  "헤비 코듀로이",
  "헤비코듀로이",
  "heavy corduroy",
  "두꺼운 울",
  "두꺼운울",
  "퍼 안감",
  "퍼안감",
  "퍼 부츠",
  "퍼부츠",
  "faux fur",
  "fur lining",
  "fur boots",
];
const SLEEVELESS_KEYWORDS = [
  "민소매",
  "슬리브리스",
  "나시",
  "탱크탑",
  "sleeveless",
  "tank top",
];
const SHORT_SLEEVE_KEYWORDS = [
  "반팔",
  "숏슬리브",
  "숏 슬리브",
  "short sleeve",
  "short-sleeve",
  "하프 슬리브",
];
const BREATHABLE_KEYWORDS = [
  "린넨",
  "리넨",
  "linen",
  "메시",
  "mesh",
  "시어서커",
  "seersucker",
  "통기성",
  "여름용",
  "서머",
  "summer",
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getTemperatureSearchText(item: ClosetItem) {
  return [
    item.confirmedProduct?.productName,
    item.category,
    item.subCategory,
    item.detailCategory,
    item.material,
    item.confirmedProduct?.materialComposition?.summary,
    item.description,
    item.pattern,
    item.styleProfile?.sleeveLength,
    item.styleProfile?.lengthType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/다운타운/g, "")
    .replace(/기모노/g, "")
    .replace(/퍼플/g, "")
    .replace(/라이트 플리스/g, "")
    .replace(/light fleece/g, "");
}

function getTemperatureRangePenalty(
  item: ClosetItem,
  effectiveTemperature?: number
) {
  if (typeof effectiveTemperature !== "number") {
    return { penalty: 0, softened: false };
  }

  const range = item.styleProfile?.temperatureRange;
  const distance =
    typeof range?.min === "number" && effectiveTemperature < range.min
      ? range.min - effectiveTemperature
      : typeof range?.max === "number" && effectiveTemperature > range.max
        ? effectiveTemperature - range.max
        : 0;
  if (distance === 0) return { penalty: 0, softened: false };

  const rawPenalty =
    distance <= 3 ? 1 : distance <= 6 ? 3 : distance <= 9 ? 5 : 7;
  const penalty = hasUserEditedClosetSeason(item)
    ? Math.max(1, Math.ceil(rawPenalty / 2))
    : rawPenalty;

  return {
    penalty,
    softened: distance <= WEATHER_TEMPERATURE_RANGE_TOLERANCE ||
      hasUserEditedClosetSeason(item),
  };
}

export function getEffectiveOutfitTemperature(
  weather?: OutfitTemperatureWeather | null
) {
  if (typeof weather?.apparentTemperature === "number") {
    return weather.apparentTemperature;
  }
  if (typeof weather?.temperature !== "number") return undefined;

  let effectiveTemperature = weather.temperature;
  if (
    typeof weather.windSpeed === "number" &&
    weather.windSpeed >= 20 &&
    effectiveTemperature <= 15
  ) {
    effectiveTemperature -= 2;
  }
  if (
    (weather.rainChance || 0) >= 60 &&
    effectiveTemperature <= 15
  ) {
    effectiveTemperature -= 1;
  }
  return effectiveTemperature;
}

export function getItemWarmthProfile(
  item: ClosetItem,
  weather?: OutfitTemperatureWeather | null
): ItemWarmthProfile {
  const text = getTemperatureSearchText(item);
  const isSleeveless = includesAny(text, SLEEVELESS_KEYWORDS);
  const isShortSleeve = includesAny(text, SHORT_SLEEVE_KEYWORDS);
  const isBreathable = includesAny(text, BREATHABLE_KEYWORDS);
  const isPadding = includesAny(text, PADDING_KEYWORDS);
  const isVeryWarm = includesAny(text, VERY_WARM_KEYWORDS);
  let warmthLevel =
    item.category === "아우터"
      ? 5
      : item.category === "하의"
        ? 3
        : item.category === "신발"
          ? 2
          : item.category === "상의"
            ? 3
            : 0;
  let source = "category";

  if (isSleeveless) {
    warmthLevel = 1;
    source = "detail";
  } else if (isShortSleeve) {
    warmthLevel = 2;
    source = "detail";
  } else if (includesAny(text, ["맨투맨", "스웨트", "후드", "hoodie"])) {
    warmthLevel = 5.5;
    source = "detail";
  } else if (includesAny(text, ["니트", "스웨터", "sweater"])) {
    warmthLevel = 5;
    source = "detail";
  } else if (includesAny(text, ["셔츠", "블라우스", "긴팔", "long sleeve"])) {
    warmthLevel = 3.5;
    source = "detail";
  }

  if (includesAny(text, ["반바지", "쇼츠", "shorts"])) {
    warmthLevel = 1.5;
    source = "detail";
  } else if (includesAny(text, ["데님", "청바지", "denim"])) {
    warmthLevel = Math.max(warmthLevel, 4);
    source = "detail";
  }

  if (isPadding) {
    warmthLevel = 9.5;
    source = "detail/material";
  } else if (isVeryWarm) {
    warmthLevel = Math.max(warmthLevel, 7);
    source = "detail/material";
  } else if (includesAny(text, ["코트", "coat"])) {
    warmthLevel = Math.max(warmthLevel, 7);
    source = "detail";
  } else if (includesAny(text, ["가디건", "재킷", "자켓", "점퍼", "jacket"])) {
    warmthLevel = Math.max(warmthLevel, 5);
    source = "detail";
  }

  if (isBreathable) {
    warmthLevel -= 1.5;
    source = "detail/material";
  }
  if (
    includesAny(text, ["울", "모 ", "wool", "캐시미어", "cashmere"]) &&
    !isShortSleeve &&
    !isSleeveless &&
    !isBreathable
  ) {
    warmthLevel += 1.5;
    source = "material";
  }

  const effectiveTemperature = getEffectiveOutfitTemperature(weather);
  const range = getTemperatureRangePenalty(item, effectiveTemperature);
  const hotWeatherHardConflict =
    typeof effectiveTemperature === "number" &&
    ((effectiveTemperature >= 28 && isPadding) ||
      (effectiveTemperature >= 30 && isVeryWarm));
  const conflicts: string[] = [];
  if (hotWeatherHardConflict) {
    conflicts.push("현재 기온에 비해 보온성이 지나치게 높아요.");
  }
  if (range.penalty > 0) {
    conflicts.push("분석된 적정 기온과 현재 체감온도에 차이가 있어요.");
  }

  return {
    itemId: item.id,
    warmthLevel: Math.max(0, Math.min(10, Math.round(warmthLevel * 10) / 10)),
    source,
    conflicts,
    temperatureRangePenalty: range.penalty,
    temperatureRangeSoftened: range.softened,
    userSeasonOverride: hasUserEditedClosetSeason(item),
    hotWeatherHardConflict,
  };
}

function getTargetWarmth(temperature: number) {
  if (temperature >= 30) return 4.5;
  if (temperature >= 28) return 5.5;
  if (temperature >= 24) return 7;
  if (temperature >= 20) return 8.5;
  if (temperature >= 16) return 10;
  if (temperature >= 11) return 12;
  if (temperature >= 6) return 15;
  if (temperature >= 1) return 18;
  return 20;
}

function getComfortScore(difference: number) {
  if (difference <= 1.5) return 25;
  if (difference <= 3) return 22;
  if (difference <= 5) return 17;
  if (difference <= 7) return 12;
  if (difference <= 9) return 8;
  return 4;
}

function getStatus(
  score: number,
  hardBlocked: boolean
): TemperatureSuitabilityStatus {
  if (hardBlocked) return "unsafe";
  if (score >= 23) return "excellent";
  if (score >= 19) return "good";
  if (score >= 12) return "borderline";
  return "poor";
}

function isWetWeather(weather?: OutfitTemperatureWeather | null) {
  const condition = weather?.condition?.toLowerCase() || "";
  return (
    (weather?.rainChance || 0) >= 60 ||
    ["비", "눈", "rain", "snow"].some((keyword) =>
      condition.includes(keyword)
    )
  );
}

export function assessItemTemperatureSuitability(
  item: ClosetItem,
  weather?: OutfitTemperatureWeather | null
): TemperatureSuitabilityAssessment {
  const effectiveTemperature = getEffectiveOutfitTemperature(weather);
  const itemAssessment = getItemWarmthProfile(item, weather);
  const hardBlocked = itemAssessment.hotWeatherHardConflict;
  const score = Math.max(
    0,
    25 - itemAssessment.temperatureRangePenalty -
      (hardBlocked ? 25 : 0)
  );

  return {
    status: getStatus(score, hardBlocked),
    score,
    maxScore: 25,
    hardBlocked,
    temperature: weather?.temperature,
    effectiveTemperature,
    reasons: [],
    warnings: hardBlocked ? itemAssessment.conflicts : [],
    itemAssessments: [itemAssessment],
  };
}

export function assessOutfitTemperatureSuitability(
  items: ClosetItem[],
  weather?: OutfitTemperatureWeather | null
): TemperatureSuitabilityAssessment {
  const effectiveTemperature = getEffectiveOutfitTemperature(weather);
  const itemAssessments = items.map((item) =>
    getItemWarmthProfile(item, weather)
  );
  if (typeof effectiveTemperature !== "number") {
    return {
      status: "good",
      score: NEUTRAL_TEMPERATURE_COMFORT_SCORE,
      maxScore: 25,
      hardBlocked: false,
      temperature: weather?.temperature,
      effectiveTemperature,
      reasons: [],
      warnings: [],
      itemAssessments,
    };
  }

  const top = items.find((item) => item.category === "상의");
  const outers = items.filter((item) => item.category === "아우터");
  const topWarmth =
    itemAssessments.find((assessment) => assessment.itemId === top?.id)
      ?.warmthLevel || 0;
  const outerWarmth = outers.reduce((total, outer) => {
    const warmth =
      itemAssessments.find((assessment) => assessment.itemId === outer.id)
        ?.warmthLevel || 0;
    return total + warmth;
  }, 0);
  const totalWarmth = itemAssessments.reduce((total, assessment) => {
    const item = items.find((candidate) => candidate.id === assessment.itemId);
    if (item?.category === "액세서리") return total;
    if (item?.category === "신발") return total + assessment.warmthLevel * 0.3;
    return total + assessment.warmthLevel;
  }, 0);
  const targetWarmth = getTargetWarmth(effectiveTemperature);
  const warmthDifference = Math.abs(totalWarmth - targetWarmth);
  const hasHotWeatherHardConflict = itemAssessments.some(
    (assessment) => assessment.hotWeatherHardConflict
  );
  const hasOuter = outers.length > 0;
  const wetWeather = isWetWeather(weather);
  const hardBlocked =
    hasHotWeatherHardConflict ||
    (effectiveTemperature >= 30 && totalWarmth >= 12) ||
    (effectiveTemperature <= 5 && !hasOuter && topWarmth <= 2.5) ||
    (effectiveTemperature <= 0 && totalWarmth < 10) ||
    (effectiveTemperature <= 5 && wetWeather && !hasOuter);
  const rangePenalty = Math.min(
    8,
    Math.round(
      itemAssessments.reduce(
        (total, assessment) => total + assessment.temperatureRangePenalty,
        0
      ) / Math.max(1, itemAssessments.length)
    )
  );
  const wetPenalty =
    wetWeather && effectiveTemperature <= 15 && !hasOuter ? 4 : 0;
  const score = hardBlocked
    ? 0
    : Math.max(
        0,
        Math.min(
          25,
          getComfortScore(warmthDifference) - rangePenalty - wetPenalty
        )
      );
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (hardBlocked) {
    warnings.push(
      effectiveTemperature >= 24
        ? "현재 체감온도에는 보온성이 너무 높은 조합이라 추천에서 제외했어요."
        : "현재 체감온도에는 보온이 부족한 조합이라 추천에서 제외했어요."
    );
  } else if (score >= 19) {
    if (effectiveTemperature >= 24) {
      reasons.push(
        `오늘 ${Math.round(effectiveTemperature)}℃ 체감온도에 맞춰 가벼운 조합으로 구성했어요.`
      );
    } else if (hasOuter) {
      reasons.push(
        `오늘 ${Math.round(effectiveTemperature)}℃ 체감온도에 맞춰 아우터를 함께 구성했어요.`
      );
    } else {
      reasons.push("오늘 체감온도에 부담 없이 입을 수 있는 보온도의 조합이에요.");
    }
  } else if (totalWarmth > targetWarmth) {
    warnings.push("낮에는 조금 더울 수 있어 겹쳐 입은 옷은 벗어 조절하는 편이 좋아요.");
  } else {
    warnings.push("현재 체감온도에는 조금 쌀쌀할 수 있어 얇은 겉옷이 필요해요.");
  }

  if (wetWeather && effectiveTemperature <= 15 && hasOuter) {
    reasons.push("비나 눈과 낮은 체감온도를 고려해 아우터가 있는 조합을 골랐어요.");
  }
  const hasBrightShoes = items.some(
    (item) =>
      item.category === "신발" &&
      ["화이트", "아이보리", "크림", "베이지"].some((color) =>
        String(item.color || "").includes(color)
      )
  );
  if (wetWeather && hasBrightShoes) {
    warnings.push(
      "비 예보가 있어 밝은 흰 신발은 오염이 신경 쓰일 수 있어요."
    );
  }
  if (
    itemAssessments.some(
      (assessment) =>
        assessment.temperatureRangeSoftened &&
        assessment.userSeasonOverride
    )
  ) {
    reasons.push("직접 설정한 계절을 우선하고 분석된 적정 기온은 참고만 했어요.");
  }

  return {
    status: getStatus(score, hardBlocked),
    score,
    maxScore: 25,
    hardBlocked,
    temperature: weather?.temperature,
    effectiveTemperature,
    reasons,
    warnings,
    itemAssessments,
  };
}
