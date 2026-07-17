import {
  ClosetItem,
  FitAnalysisProfile,
  FitMeasurements,
  ProductSizeMeasurement,
  UserProfile,
} from "@/utils/storage";
import { getValidProductSizeRows } from "@/utils/productSizeMeasurements";

const LETTER_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const TOP_LETTER_SIZE_VALUE: Record<string, number> = {
  XS: 85,
  S: 90,
  M: 95,
  L: 100,
  XL: 105,
  XXL: 110,
  XXXL: 115,
};

const NAMED_SIZE_ALIASES: Record<string, string> = {
  XSMALL: "XS",
  EXTRASMALL: "XS",
  SMALL: "S",
  MEDIUM: "M",
  LARGE: "L",
  XLARGE: "XL",
  EXTRALARGE: "XL",
  XXLARGE: "XXL",
  DOUBLEEXTRALARGE: "XXL",
  EXTRAEXTRALARGE: "XXL",
  "2XLARGE": "XXL",
  "2EXTRALARGE": "XXL",
  XXXLARGE: "XXXL",
  TRIPLEEXTRALARGE: "XXXL",
  EXTRAEXTRAEXTRALARGE: "XXXL",
  "3XLARGE": "XXXL",
  "3EXTRALARGE": "XXXL",
};

function getNamedSizeAlias(size?: string) {
  const compactSize = String(size || "")
    .trim()
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[\s/_-]+/g, "");

  return NAMED_SIZE_ALIASES[compactSize];
}

export function normalizeSize(size?: string) {
  const namedSizeAlias = getNamedSizeAlias(size);
  if (namedSizeAlias) return namedSizeAlias;

  const upperSize = String(size || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/X-LARGE/g, "XL")
    .replace(/LARGE/g, "L")
    .replace(/MEDIUM/g, "M")
    .replace(/SMALL/g, "S");
  const compactFreeSize = upperSize
    .replace(/\(?\d{1,3}(?:\.\d+)?[~～\-–—]\d{1,3}(?:\.\d+)?\)?/g, "")
    .replace(/\(\d{1,3}(?:\.\d+)?\)/g, "")
    .replace(/[-_/]+/g, "");

  if (
    [
      "FREE",
      "F",
      "FREESIZE",
      "프리",
      "프리사이즈",
      "ONESIZE",
      "ONESIZEFITSALL",
      "원사이즈",
      "OS",
      "OSFA",
    ].includes(compactFreeSize)
  ) {
    return "FREE";
  }

  if (upperSize === "2XL") return "XXL";
  if (upperSize === "3XL") return "XXXL";

  return upperSize;
}

export const CLOSET_SIZE_NOT_ENTERED_LABEL = "사이즈 미입력";

export function normalizeClosetItemSize(size?: string) {
  const trimmedSize = size?.trim();
  if (!trimmedSize || trimmedSize === CLOSET_SIZE_NOT_ENTERED_LABEL) return undefined;

  return normalizeSize(trimmedSize) || undefined;
}

export function hasSelectedClosetSize(size?: string) {
  return Boolean(normalizeClosetItemSize(size));
}

export function resolveClosetSizeAfterMeasurementSave(
  currentSize?: string,
  measurementSize?: string
) {
  return (
    normalizeClosetItemSize(currentSize) ||
    normalizeClosetItemSize(measurementSize)
  );
}

function getSizeAliases(size?: string) {
  const normalizedSize = normalizeSize(size);
  if (!normalizedSize || normalizedSize === "사이즈미입력") return [];

  const aliases = new Set<string>([normalizedSize]);
  const letterSizeMatches = normalizedSize.match(/(?:[2-5]XL|XXXL|XXL|XL|XS|S|M|L)/g) || [];
  const numericSizeMatches = normalizedSize.match(/\d{1,3}(?:\.\d+)?/g) || [];

  letterSizeMatches.forEach((matchedSize) => aliases.add(normalizeSize(matchedSize)));
  numericSizeMatches.forEach((matchedSize) => aliases.add(matchedSize));

  return [...aliases];
}

function areSameSizeLabels(firstSize?: string, secondSize?: string) {
  const firstAliases = getSizeAliases(firstSize);
  const secondAliases = new Set(getSizeAliases(secondSize));

  return firstAliases.some((alias) => secondAliases.has(alias));
}

function getNumericSizeValue(size?: string) {
  const normalizedSize = normalizeSize(size);
  return /^\d{1,3}(?:\.\d+)?$/.test(normalizedSize)
    ? Number(normalizedSize)
    : undefined;
}

function isSizeWithinNumericRange(
  size: string | undefined,
  numericRange?: ProductSizeMeasurement["numericRange"]
) {
  const numericSize = getNumericSizeValue(size);

  return (
    numericSize !== undefined &&
    numericRange !== undefined &&
    numericSize >= numericRange.min &&
    numericSize <= numericRange.max
  );
}

function doesMeasurementMatchSize(
  measurement: ProductSizeMeasurement,
  size?: string
) {
  const targetAliases = getSizeAliases(size);
  if (targetAliases.length === 0) return false;

  const measurementAliases = [
    measurement.size,
    measurement.displaySize,
    measurement.rawSize,
  ].flatMap((measurementSize) => getSizeAliases(measurementSize));

  return (
    measurementAliases.some((alias) => targetAliases.includes(alias)) ||
    isSizeWithinNumericRange(size, measurement.numericRange)
  );
}

function getProfileSize(item: ClosetItem, profile?: UserProfile | null) {
  if (!profile) return "";

  if (item.category === "하의") return profile.bottomSize || "";
  if (item.category === "신발") return profile.shoeSize || "";

  return profile.topSize || "";
}

function isTopSizeCategory(category?: string) {
  return category === "상의" || category === "아우터";
}

function getTopSizeValue(size?: string) {
  const normalizedSize = normalizeSize(size);
  const numericSize = Number(normalizedSize);

  if (Number.isFinite(numericSize)) return numericSize;

  return TOP_LETTER_SIZE_VALUE[normalizedSize] ?? null;
}

function compareSize(profileSize?: string, itemSize?: string, category?: string) {
  const normalizedProfileSize = normalizeSize(profileSize);
  const normalizedItemSize = normalizeSize(itemSize);

  if (isTopSizeCategory(category)) {
    const profileTopSize = getTopSizeValue(normalizedProfileSize);
    const itemTopSize = getTopSizeValue(normalizedItemSize);

    if (profileTopSize !== null && itemTopSize !== null) {
      return Math.sign(itemTopSize - profileTopSize);
    }
  }

  const profileNumber = Number(normalizedProfileSize);
  const itemNumber = Number(normalizedItemSize);

  if (Number.isFinite(profileNumber) && Number.isFinite(itemNumber)) {
    return Math.sign(itemNumber - profileNumber);
  }

  const profileIndex = LETTER_SIZE_ORDER.indexOf(normalizedProfileSize);
  const itemIndex = LETTER_SIZE_ORDER.indexOf(normalizedItemSize);

  if (profileIndex < 0 || itemIndex < 0) return null;

  return Math.sign(itemIndex - profileIndex);
}

export type MeasurementComparison = {
  key: keyof FitMeasurements;
  label: string;
  userValue: number;
  garmentValue: number;
  difference: number;
};

export type MeasurementComparisonResult = {
  fitProfile?: FitAnalysisProfile;
  comparisons: MeasurementComparison[];
  unavailableFields: string[];
  lengthResult: LengthResult;
  widthResult: WidthResult;
  fitResult: FitResult;
  description: string;
};

export type LengthResult = "short" | "regular" | "long" | "tooLong" | "unknown";
export type WidthResult =
  | "small"
  | "fitted"
  | "comfortable"
  | "relaxed"
  | "oversized"
  | "unknown";
export type FitResult =
  | "small"
  | "fitted"
  | "regular"
  | "semiOversized"
  | "oversized"
  | "unknown";

export type SizeRecommendation = {
  size: string;
  displaySize?: string;
  score: number;
  rank: number;
  fitResult: FitResult;
  lengthResult: LengthResult;
  widthResult: WidthResult;
  reasons: string[];
};

export type SizeRecommendationResult = {
  recommendedSize?: string;
  recommendedDisplaySize?: string;
  sizeRecommendations: SizeRecommendation[];
  missingFields: string[];
  missingProductFields?: string[];
  blockedReason?:
    | "missing_profile_measurements"
    | "missing_product_measurements";
};

export type SizeRecommendationContext = {
  referenceItem?: ClosetItem | null;
};

export function getSizeRecommendationMissingInfo(
  result: SizeRecommendationResult
) {
  if (result.blockedReason === "missing_product_measurements") {
    const fields = result.missingProductFields?.filter(Boolean) || [];
    const fieldText = fields.length > 0 ? fields.join(" · ") : "주요 상품 실측";

    return {
      kind: "product" as const,
      title: "상품 실측을 추가해주세요",
      description: `추천에 필요한 상품 실측: ${fieldText}. 이 값이 없어 사이즈를 추측하지 않았어요.`,
      actionLabel: "실측 직접 입력",
    };
  }

  if (
    result.blockedReason === "missing_profile_measurements" ||
    result.missingFields.length > 0
  ) {
    const fieldText = result.missingFields.filter(Boolean).join(" · ");

    return {
      kind: "profile" as const,
      title: "내 신체 치수를 입력해주세요",
      description: `추천에 필요한 프로필 정보: ${fieldText}. 입력하면 상품 실측과 비교할 수 있어요.`,
      actionLabel: "프로필 입력하기",
    };
  }

  return null;
}

export type FitSuitabilityBlockedReason =
  | "missing_item_size"
  | "missing_profile_measurements"
  | "missing_product_measurements"
  | "unmatched_item_size";

export type FitSuitabilityResult = {
  status: string;
  description: string;
  lengthResult: LengthResult;
  widthResult: WidthResult;
  fitResult: FitResult;
  measurementComparison: MeasurementComparisonResult;
  blockedReason?: FitSuitabilityBlockedReason;
};

type WidthAnalysis = {
  result: WidthResult;
  description: string;
  shoulderDescription?: string;
  chestDescription?: string;
};

function parseMeasurement(value?: string | number) {
  const parsedValue = Number(String(value || "").replace(",", ".").trim());
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

function getCurrentProductMeasurement(item: ClosetItem) {
  const sizes = getValidProductSizeRows(item.confirmedProduct?.productSizeGuide);

  if (getSizeAliases(item.size).length === 0) return undefined;
  return sizes.find((measurement) => doesMeasurementMatchSize(measurement, item.size));
}

export function getUserFitMeasurements(profile?: UserProfile | null): FitMeasurements {
  if (!profile) return {};

  return {
    shoulder: parseMeasurement(profile.shoulderWidth),
    chest: parseMeasurement(profile.chestCircumference),
    sleeve: parseMeasurement(profile.armLength),
    waist: parseMeasurement(profile.waistCircumference),
    hip: parseMeasurement(profile.hipCircumference),
    thigh: parseMeasurement(profile.thighCircumference),
    inseam: parseMeasurement(profile.inseam),
  };
}

function getComparableUserMeasurements(profile?: UserProfile | null): FitMeasurements {
  const measurements = getUserFitMeasurements(profile);

  return {
    shoulder: measurements.shoulder,
    chest: measurements.chest !== undefined ? measurements.chest / 2 : undefined,
    sleeve: measurements.sleeve,
    waist: measurements.waist !== undefined ? measurements.waist / 2 : undefined,
    hip: measurements.hip !== undefined ? measurements.hip / 2 : undefined,
    thigh: measurements.thigh !== undefined ? measurements.thigh / 2 : undefined,
  };
}

function isBottomCategory(item: ClosetItem) {
  return item.category === "하의";
}

function isUpperCategory(item: ClosetItem) {
  return item.category === "상의" || item.category === "아우터";
}

function isShoeCategory(item: ClosetItem) {
  return item.category === "신발";
}

type SleeveType = "sleeveless" | "short" | "elbow" | "threeQuarter" | "long" | "unknown";

const SLEEVE_TYPE_KEYWORDS: Record<Exclude<SleeveType, "unknown">, string[]> = {
  sleeveless: [
    "민소매",
    "슬리브리스",
    "나시",
    "탱크탑",
    "베스트",
    "sleeveless",
    "tank top",
  ],
  short: [
    "반팔",
    "숏슬리브",
    "숏 슬리브",
    "short sleeve",
    "short-sleeve",
    "하프 슬리브",
    "half sleeve",
  ],
  elbow: ["5부", "오부", "팔꿈치", "elbow sleeve"],
  threeQuarter: ["7부", "칠부", "three quarter", "3/4 sleeve"],
  long: ["긴팔", "롱슬리브", "롱 슬리브", "long sleeve", "long-sleeve"],
};

function getSleeveTypeSourceText(item: ClosetItem) {
  return [
    item.detailCategory,
    item.subCategory,
    item.category,
    item.confirmedProduct?.productName,
    item.inferredProductName,
    item.styleProfile?.sleeveLength,
    item.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesSleeveKeyword(sourceText: string, sleeveType: Exclude<SleeveType, "unknown">) {
  return SLEEVE_TYPE_KEYWORDS[sleeveType].some((keyword) =>
    sourceText.includes(keyword.toLowerCase())
  );
}

function getSleeveType(item: ClosetItem): SleeveType {
  const sourceText = getSleeveTypeSourceText(item);

  if (includesSleeveKeyword(sourceText, "sleeveless")) return "sleeveless";
  if (includesSleeveKeyword(sourceText, "short")) return "short";
  if (includesSleeveKeyword(sourceText, "threeQuarter")) return "threeQuarter";
  if (includesSleeveKeyword(sourceText, "elbow")) return "elbow";
  if (includesSleeveKeyword(sourceText, "long")) return "long";

  return "unknown";
}

function shouldCompareUserSleeve(item: ClosetItem) {
  return isUpperCategory(item) && getSleeveType(item) === "long";
}

function shouldCompareReferenceSleeve(item: ClosetItem, referenceItem?: ClosetItem | null) {
  if (!referenceItem || !isUpperCategory(item) || !isUpperCategory(referenceItem)) return false;

  const itemSleeveType = getSleeveType(item);
  const referenceSleeveType = getSleeveType(referenceItem);

  return itemSleeveType !== "unknown" && itemSleeveType === referenceSleeveType;
}

export function isAccessoryOrBagItem(
  item: Pick<ClosetItem, "category" | "subCategory" | "detailCategory">
) {
  const categoryText = [item.category, item.subCategory, item.detailCategory]
    .filter(Boolean)
    .join(" ");

  return [
    "액세서리",
    "악세서리",
    "가방",
    "백팩",
    "크로스백",
    "숄더백",
    "토트백",
    "메신저백",
    "웨이스트백",
    "클러치",
    "파우치",
  ].some((keyword) => categoryText.includes(keyword));
}

function getIntendedLengthOffset(intendedFit?: string) {
  if (intendedFit === "오버핏") return 3;
  if (intendedFit === "여유 있게") return 1.5;
  return 0;
}

type BottomLengthReference =
  | {
      source: "reference_clothing" | "preferred_pants_total_length" | "body_estimate";
      targetLength: number;
      descriptionBasis: string;
    }
  | null;

type BottomLengthAnalysis = {
  result: LengthResult;
  description: string;
  reference: BottomLengthReference;
  difference?: number;
};

function getValidMeasurementValue(value?: number) {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function getBottomReferenceMeasurement(
  item: ClosetItem,
  context?: SizeRecommendationContext
) {
  const referenceItem = context?.referenceItem;
  if (
    !referenceItem ||
    referenceItem.id === item.id ||
    !isBottomCategory(referenceItem)
  ) {
    return undefined;
  }

  return getReferenceProductMeasurement(referenceItem);
}

function getBottomLengthReference(
  item: ClosetItem,
  garmentMeasurement: ProductSizeMeasurement,
  profile?: UserProfile | null,
  context?: SizeRecommendationContext
): BottomLengthReference {
  if (!isBottomCategory(item)) return null;

  const referenceTotalLength = getValidMeasurementValue(
    getBottomReferenceMeasurement(item, context)?.totalLength
  );
  if (referenceTotalLength !== undefined) {
    return {
      source: "reference_clothing",
      targetLength: referenceTotalLength,
      descriptionBasis: "기준 바지 총장",
    };
  }

  const preferredPantsTotalLength = parseMeasurement(profile?.preferredPantsTotalLength);
  if (preferredPantsTotalLength !== undefined) {
    return {
      source: "preferred_pants_total_length",
      targetLength: preferredPantsTotalLength,
      descriptionBasis: "평소 잘 맞는 바지 총장",
    };
  }

  const userInseam = parseMeasurement(profile?.inseam);
  const userHeight = parseMeasurement(profile?.height);
  const intendedOffset = getIntendedLengthOffset(item.intendedFit);

  if (
    userInseam !== undefined &&
    typeof garmentMeasurement.rise === "number" &&
    garmentMeasurement.rise > 0
  ) {
    return {
      source: "body_estimate",
      targetLength: userInseam + garmentMeasurement.rise + intendedOffset,
      descriptionBasis: "내 인심",
    };
  }

  if (userHeight !== undefined) {
    return {
      source: "body_estimate",
      targetLength: userHeight * 0.59 + intendedOffset,
      descriptionBasis: "내 키",
    };
  }

  return null;
}

function getBottomLengthReason(reference: BottomLengthReference, difference: number) {
  if (!reference) return "";

  const absoluteDifference = Math.abs(Number(difference.toFixed(1)));
  if (absoluteDifference <= 0.4) {
    return `${reference.descriptionBasis}과 거의 같아요.`;
  }

  return difference < 0
    ? `${reference.descriptionBasis}보다 총장이 ${absoluteDifference}cm 짧아요.`
    : `${reference.descriptionBasis}보다 총장이 ${absoluteDifference}cm 길어요.`;
}

function getBottomLengthScoreFromDifference(difference: number, maxScore: number) {
  return maxScore * Math.max(0, 1 - Math.abs(difference) / 7);
}

function hasBottomLengthReferenceInput(
  item: ClosetItem,
  profile?: UserProfile | null,
  context?: SizeRecommendationContext
) {
  return (
    getValidMeasurementValue(getBottomReferenceMeasurement(item, context)?.totalLength) !==
      undefined ||
    parseMeasurement(profile?.preferredPantsTotalLength) !== undefined
  );
}

function getBottomLengthAnalysis(
  item: ClosetItem,
  garmentMeasurement: ProductSizeMeasurement,
  profile?: UserProfile | null,
  context?: SizeRecommendationContext
): BottomLengthAnalysis {
  if (!isBottomCategory(item) || typeof garmentMeasurement.totalLength !== "number") {
    return { result: "unknown", description: "", reference: null };
  }

  const reference = getBottomLengthReference(item, garmentMeasurement, profile, context);
  if (!reference) {
    return {
      result: "unknown",
      description: "총장은 확인되지만 기준 옷 총장, 평소 바지 총장, 키 또는 인심 정보가 없어 길이감을 정확히 비교하기 어려워요.",
      reference: null,
    };
  }

  const difference = garmentMeasurement.totalLength - reference.targetLength;
  const lengthReason = getBottomLengthReason(reference, difference);

  if (difference < -4) {
    return {
      result: "short",
      description: `${lengthReason} 발목이 드러나는 짧은 길이감일 수 있어요.`,
      reference,
      difference,
    };
  }

  if (difference <= 3) {
    return {
      result: "regular",
      description: `${lengthReason} 자연스럽게 떨어지는 기본 길이감이에요.`,
      reference,
      difference,
    };
  }

  if (difference <= 7) {
    return {
      result: "long",
      description: `${lengthReason} 발등에 살짝 쌓이는 길이감이에요.`,
      reference,
      difference,
    };
  }

  return {
    result: "tooLong",
    description: `${lengthReason} 밑단이 많이 쌓이거나 수선이 필요할 수 있어요.`,
    reference,
    difference,
  };
}

function getUpperLengthAnalysis(
  item: ClosetItem,
  garmentMeasurement: ProductSizeMeasurement,
  profile?: UserProfile | null
): { result: LengthResult; description: string } {
  if (!isUpperCategory(item) || typeof garmentMeasurement.totalLength !== "number") {
    return { result: "unknown", description: "" };
  }

  const userHeight = parseMeasurement(profile?.height);
  if (userHeight === undefined) {
    return {
      result: "unknown",
      description: "총장은 확인됐지만 키 정보가 없어 상의 길이감을 비교하기 어려워요.",
    };
  }

  const lengthRatio = garmentMeasurement.totalLength / userHeight;
  const roundedLength = Number(garmentMeasurement.totalLength.toFixed(1));

  if (lengthRatio < 0.35) {
    return {
      result: "short",
      description: `총장 ${roundedLength}cm로 내 키 대비 허리선 부근에 오는 크롭 또는 짧은 기장일 가능성이 높아요.`,
    };
  }

  if (lengthRatio <= 0.45) {
    return {
      result: "regular",
      description: `총장 ${roundedLength}cm로 내 키에 무난하게 맞는 레귤러 기장에 가까워요.`,
    };
  }

  if (lengthRatio <= 0.68) {
    return {
      result: "long",
      description: `총장 ${roundedLength}cm로 내 키 대비 엉덩이를 덮는 롱기장에 가까워요.`,
    };
  }

  return {
    result: "tooLong",
    description: `총장 ${roundedLength}cm로 내 키 대비 상당히 긴 기장이어서 옷 종류에 따라 길게 느껴질 수 있어요.`,
  };
}

function getSleeveDescription(
  item: ClosetItem,
  comparisons: MeasurementComparison[]
) {
  if (!shouldCompareUserSleeve(item)) return "";

  const sleeveComparison = comparisons.find((comparison) => comparison.key === "sleeve");
  if (!sleeveComparison) return "";

  const difference = Number(sleeveComparison.difference.toFixed(1));
  if (difference < -2) {
    return `소매가 내 팔 길이보다 ${Math.abs(difference)}cm 짧아 손목이 드러날 수 있어요.`;
  }
  if (difference > 3) {
    return `소매가 내 팔 길이보다 ${difference}cm 길어 손등을 덮을 수 있어요.`;
  }
  return "소매 길이는 내 팔 길이와 비슷해 무난할 가능성이 높아요.";
}

function getUpperWidthAnalysis(
  item: ClosetItem,
  comparisons: MeasurementComparison[]
): WidthAnalysis {
  if (!isUpperCategory(item)) return { result: "unknown", description: "" };

  const shoulder = comparisons.find((comparison) => comparison.key === "shoulder");
  const chest = comparisons.find((comparison) => comparison.key === "chest");
  if (!shoulder && !chest) return { result: "unknown", description: "" };

  let shoulderResult: WidthResult = "unknown";
  let shoulderDescription = "";

  if (shoulder) {
    const difference = Number(shoulder.difference.toFixed(1));
    if (difference < -1) shoulderResult = "small";
    else if (difference <= 1.5) shoulderResult = "fitted";
    else if (difference <= 4) shoulderResult = "relaxed";
    else shoulderResult = "oversized";

    shoulderDescription =
      shoulderResult === "small"
        ? `어깨가 내 어깨너비보다 ${Math.abs(difference)}cm 좁아 끼거나 당길 수 있어요.`
        : shoulderResult === "fitted"
          ? "어깨 실측이 내 어깨너비와 비슷해 정핏에 가까워요."
          : shoulderResult === "relaxed"
            ? `어깨가 내 어깨너비보다 ${difference}cm 넓어 세미오버 느낌이 날 수 있어요.`
            : `어깨가 내 어깨너비보다 ${difference}cm 넓어 드롭된 오버핏으로 보일 가능성이 높아요.`;
  }

  let chestResult: WidthResult = "unknown";
  let chestDescription = "";

  if (chest) {
    const difference = Number(chest.difference.toFixed(1));
    if (difference < 0) chestResult = "small";
    else if (difference <= 2) chestResult = "fitted";
    else if (difference <= 6) chestResult = "comfortable";
    else if (difference <= 10) chestResult = "relaxed";
    else chestResult = "oversized";

    chestDescription =
      chestResult === "small"
        ? `가슴단면이 내 가슴 기준보다 ${Math.abs(difference)}cm 작아 품이 타이트할 수 있어요.`
        : chestResult === "fitted"
          ? "가슴 품의 여유가 적어 몸에 맞게 떨어질 가능성이 높아요."
          : chestResult === "comfortable"
            ? `가슴단면에 ${difference}cm 정도 여유가 있어 편안한 품이에요.`
            : chestResult === "relaxed"
              ? `가슴단면에 ${difference}cm 여유가 있어 넉넉한 품이에요.`
              : `가슴단면에 ${difference}cm 이상 여유가 있어 품이 크게 느껴질 수 있어요.`;
  }

  let result = shoulderResult !== "unknown" ? shoulderResult : chestResult;

  // Shoulder is the primary upper-body fit signal. Chest only overrides when it is tight,
  // or softly raises a fitted shoulder when the body width is notably roomy.
  if (chestResult === "small") result = "small";
  else if (result === "fitted" && (chestResult === "relaxed" || chestResult === "oversized")) {
    result = "comfortable";
  }

  return {
    result,
    description: [shoulderDescription, chestDescription].filter(Boolean).join(" "),
    shoulderDescription,
    chestDescription,
  };
}

function getBottomWidthScore(difference: number, key: keyof FitMeasurements) {
  if (key === "waist") return difference;
  if (key === "hip") return difference - 2;
  if (key === "thigh") return difference - 1.5;
  return difference;
}

function getWidthAnalysis(
  item: ClosetItem,
  comparisons: MeasurementComparison[]
): WidthAnalysis {
  const isBottom = isBottomCategory(item);
  if (!isBottom) return getUpperWidthAnalysis(item, comparisons);

  const widthKeys: (keyof FitMeasurements)[] = ["waist", "hip", "thigh"];
  const widthComparisons = comparisons.filter((comparison) =>
    widthKeys.includes(comparison.key)
  );

  if (widthComparisons.length === 0) {
    return { result: "unknown", description: "" };
  }

  const weightedScores = widthComparisons.map((comparison) => {
    const weight =
      comparison.key === "waist"
        ? 2
        : comparison.key === "hip"
          ? 1.5
          : 1;

    return {
      score: getBottomWidthScore(comparison.difference, comparison.key),
      weight,
    };
  });
  const score =
    weightedScores.reduce((sum, value) => sum + value.score * value.weight, 0) /
    weightedScores.reduce((sum, value) => sum + value.weight, 0);
  const waistComparison = widthComparisons.find((comparison) => comparison.key === "waist");
  const primaryComparison = waistComparison || widthComparisons[0];
  const primaryDifference = Number(primaryComparison.difference.toFixed(1));
  const hasTightCriticalArea = widthComparisons.some((comparison) => {
    if (comparison.key === "waist") return comparison.difference < -1;
    if (comparison.key === "hip" || comparison.key === "thigh") {
      return comparison.difference < 0;
    }
    return false;
  });

  let result: WidthResult;
  if (hasTightCriticalArea || score < -1) result = "small";
  else if (score <= 1) result = "fitted";
  else if (score <= 3.5) result = "comfortable";
  else if (score <= 7) result = "relaxed";
  else result = "oversized";

  if (waistComparison) {
    const waistDescription =
      primaryDifference < -1
        ? `허리단면이 내 허리 기준보다 ${Math.abs(primaryDifference)}cm 작아 조일 수 있어요.`
        : primaryDifference > 4
          ? `허리단면은 내 허리 기준 ${primaryDifference}cm 여유가 있어 벨트가 필요할 수 있어요.`
          : `허리단면은 내 허리 기준 ${Math.max(0, primaryDifference)}cm 여유로 무난하게 맞을 가능성이 높아요.`;

    const lowerBodyComparisons = widthComparisons.filter(
      (comparison) => comparison.key === "hip" || comparison.key === "thigh"
    );
    const lowerBodyDescription = lowerBodyComparisons.some(
      (comparison) => comparison.difference < 0
    )
      ? "엉덩이 또는 허벅지 단면도 여유가 부족해 움직일 때 타이트할 수 있어요."
      : lowerBodyComparisons.length > 0
        ? "엉덩이와 허벅지 단면에는 움직일 여유가 있어요."
        : "";

    return {
      result,
      description: [waistDescription, lowerBodyDescription].filter(Boolean).join(" "),
    };
  }

  const widthLabel =
    result === "small"
      ? "작게"
      : result === "fitted"
        ? "슬림하게"
        : result === "comfortable"
          ? "적당히"
          : result === "relaxed"
            ? "여유 있게"
            : "크게";
  return {
    result,
    description: `${primaryComparison.label} 실측을 기준으로 몸에 ${widthLabel} 맞을 가능성이 높아요.`,
  };
}

function getAutomaticFitResult(lengthResult: LengthResult, widthResult: WidthResult): FitResult {
  if (lengthResult === "short") return "small";
  if (lengthResult === "tooLong") return "oversized";
  if (widthResult === "small") return "small";
  if (widthResult === "oversized") return "oversized";
  if (widthResult === "relaxed" || lengthResult === "long") return "semiOversized";
  if (widthResult === "fitted") return "fitted";
  if (widthResult === "comfortable" || lengthResult === "regular") return "regular";
  return "unknown";
}

function getUpperAutomaticFitResult(
  lengthResult: LengthResult,
  widthResult: WidthResult
): FitResult {
  // Upper-body fit follows shoulder width first, then length, chest ease and sleeve length.
  if (widthResult === "small") return "small";
  if (widthResult === "oversized") return "oversized";
  if (widthResult === "relaxed") return "semiOversized";
  if (widthResult === "comfortable") {
    return lengthResult === "tooLong" ? "semiOversized" : "regular";
  }
  if (widthResult === "fitted") {
    if (lengthResult === "tooLong" || lengthResult === "long") return "semiOversized";
    return "fitted";
  }

  if (lengthResult === "tooLong") return "oversized";
  if (lengthResult === "long") return "semiOversized";
  if (lengthResult === "short" || lengthResult === "regular") return "regular";
  return "unknown";
}

function toFitAnalysisProfileResult(fitResult: FitResult): FitAnalysisProfile["fitResult"] {
  if (fitResult === "regular") return "comfortable";
  if (fitResult === "semiOversized") return "relaxed";
  return fitResult;
}

const COMPARISON_FIELDS: {
  key: keyof FitMeasurements;
  productKey: keyof ProductSizeMeasurement;
  label: string;
}[] = [
  { key: "shoulder", productKey: "shoulder", label: "어깨" },
  { key: "chest", productKey: "chest", label: "가슴" },
  { key: "sleeve", productKey: "sleeve", label: "팔 길이" },
  { key: "waist", productKey: "waist", label: "허리" },
  { key: "hip", productKey: "hip", label: "엉덩이" },
  { key: "thigh", productKey: "thigh", label: "허벅지" },
];

export function getMeasurementComparison(
  item: ClosetItem,
  profile?: UserProfile | null,
  context?: SizeRecommendationContext
): MeasurementComparisonResult {
  const garmentMeasurement = getCurrentProductMeasurement(item);
  const userMeasurements = getUserFitMeasurements(profile);
  const comparableUserMeasurements = getComparableUserMeasurements(profile);

  if (!garmentMeasurement) {
    return {
      comparisons: [],
      unavailableFields: ["현재 옷 사이즈의 상품 실측"],
      lengthResult: "unknown",
      widthResult: "unknown",
      fitResult: "unknown",
      description: "선택한 사이즈와 일치하는 상품 실측이 없어 자동 핏을 판단하기 어려워요.",
    };
  }

  const comparisons: MeasurementComparison[] = [];
  const unavailableFields: string[] = [];
  const canCompareUserSleeve = shouldCompareUserSleeve(item);

  COMPARISON_FIELDS.forEach(({ key, productKey, label }) => {
    if (key === "sleeve" && !canCompareUserSleeve) return;

    const userValue = comparableUserMeasurements[key];
    const garmentValue = garmentMeasurement[productKey];

    if (
      typeof userValue === "number" &&
      typeof garmentValue === "number" &&
      garmentValue > 0
    ) {
      comparisons.push({
        key,
        label,
        userValue,
        garmentValue,
        difference: Number((garmentValue - userValue).toFixed(1)),
      });
      return;
    }

    unavailableFields.push(label);
  });

  const lengthAnalysis = isBottomCategory(item)
    ? getBottomLengthAnalysis(item, garmentMeasurement, profile, context)
    : getUpperLengthAnalysis(item, garmentMeasurement, profile);
  const widthAnalysis = getWidthAnalysis(item, comparisons);
  const fitResult = isUpperCategory(item)
    ? getUpperAutomaticFitResult(lengthAnalysis.result, widthAnalysis.result)
    : getAutomaticFitResult(lengthAnalysis.result, widthAnalysis.result);
  const sleeveDescription = getSleeveDescription(item, comparisons);
  const description = (
    isUpperCategory(item)
      ? [
          widthAnalysis.shoulderDescription,
          lengthAnalysis.description,
          widthAnalysis.chestDescription,
          sleeveDescription,
        ]
      : [lengthAnalysis.description, widthAnalysis.description]
  )
    .filter(Boolean)
    .join(" ");
  const sourceSize = garmentMeasurement.size || item.size || "";
  return {
    fitProfile: {
      sourceSize,
      userMeasurements,
      garmentMeasurements: {
        shoulder: garmentMeasurement.shoulder,
        chest: garmentMeasurement.chest,
        sleeve: garmentMeasurement.sleeve,
        waist: garmentMeasurement.waist,
        hip: garmentMeasurement.hip,
        thigh: garmentMeasurement.thigh,
        rise: garmentMeasurement.rise,
        totalLength: garmentMeasurement.totalLength,
        footLength: garmentMeasurement.footLength,
      },
      fitResult: toFitAnalysisProfileResult(fitResult),
    },
    comparisons,
    unavailableFields,
    lengthResult: lengthAnalysis.result,
    widthResult: widthAnalysis.result,
    fitResult,
    description:
      description || "상품 실측은 있지만 비교 가능한 내 신체 치수가 부족해 자동 핏을 판단하기 어려워요.",
  };
}

type FitPreference = "fitted" | "regular" | "relaxed" | "oversized";

function getFitPreference(intendedFit?: string): FitPreference {
  if (intendedFit === "딱 맞게") return "fitted";
  if (intendedFit === "여유 있게") return "relaxed";
  if (intendedFit === "오버핏") return "oversized";
  return "regular";
}

function getRequiredProfileFields(
  item: ClosetItem,
  profile?: UserProfile | null,
  context?: SizeRecommendationContext
) {
  if (isBottomCategory(item)) {
    const hasLengthReference = hasBottomLengthReferenceInput(item, profile, context);

    return [
      !parseMeasurement(profile?.waistCircumference) ? "허리둘레" : "",
      !parseMeasurement(profile?.hipCircumference) ? "엉덩이둘레" : "",
      !parseMeasurement(profile?.thighCircumference) ? "허벅지둘레" : "",
      !hasLengthReference &&
      !parseMeasurement(profile?.inseam) &&
      !parseMeasurement(profile?.height)
        ? "인심 또는 키"
        : "",
    ].filter(Boolean);
  }

  if (isUpperCategory(item)) {
    return [
      !parseMeasurement(profile?.shoulderWidth) ? "어깨너비" : "",
      !parseMeasurement(profile?.chestCircumference) ? "가슴둘레" : "",
      !parseMeasurement(profile?.height) ? "키" : "",
      shouldCompareUserSleeve(item) && !parseMeasurement(profile?.armLength) ? "팔 길이" : "",
    ].filter(Boolean);
  }

  return [];
}

function getLengthScore(
  result: LengthResult,
  preference: FitPreference,
  maxScore: number
) {
  const ratios: Record<FitPreference, Record<LengthResult, number>> = {
    fitted: { short: 0.45, regular: 1, long: 0.6, tooLong: 0.15, unknown: 0 },
    regular: { short: 0.5, regular: 1, long: 0.7, tooLong: 0.2, unknown: 0 },
    relaxed: { short: 0.35, regular: 0.9, long: 1, tooLong: 0.45, unknown: 0 },
    oversized: { short: 0.2, regular: 0.78, long: 1, tooLong: 0.7, unknown: 0 },
  };

  return maxScore * ratios[preference][result];
}

function getTargetEase(
  category: "upper" | "bottom",
  key: keyof FitMeasurements,
  preference: FitPreference
) {
  const targets = {
    upper: {
      shoulder: { fitted: 0, regular: 1, relaxed: 2.5, oversized: 5 },
      chest: { fitted: 1.5, regular: 3, relaxed: 6, oversized: 9 },
      sleeve: { fitted: 0, regular: 0.5, relaxed: 1.5, oversized: 2.5 },
    },
    bottom: {
      waist: { fitted: 0.5, regular: 1.5, relaxed: 2.5, oversized: 4 },
      hip: { fitted: 1.5, regular: 3, relaxed: 5, oversized: 7 },
      thigh: { fitted: 1, regular: 2, relaxed: 3.5, oversized: 5 },
    },
  } as const;

  const categoryTargets = targets[category] as Partial<
    Record<keyof FitMeasurements, Record<FitPreference, number>>
  >;
  return categoryTargets[key]?.[preference] ?? 0;
}

function getEaseScore(
  difference: number | undefined,
  target: number,
  tolerance: number,
  maxScore: number
) {
  if (difference === undefined) return 0;

  const distance = Math.abs(difference - target);
  let score = maxScore * Math.max(0, 1 - distance / tolerance);

  if (difference < 0) {
    score *= Math.max(0.2, 1 - Math.abs(difference) / tolerance);
  }

  return score;
}

function getFitPreferenceScore(fitResult: FitResult, preference: FitPreference) {
  const scores: Record<FitPreference, Partial<Record<FitResult, number>>> = {
    fitted: { fitted: 5, regular: 4, semiOversized: 1, oversized: 0, small: 0 },
    regular: { fitted: 3.5, regular: 5, semiOversized: 3, oversized: 0.5, small: 0 },
    relaxed: { fitted: 1, regular: 4, semiOversized: 5, oversized: 3, small: 0 },
    oversized: { fitted: 0.5, regular: 2.5, semiOversized: 5, oversized: 4, small: 0 },
  };

  return scores[preference][fitResult] ?? 0;
}

function getIntendedFitReason(fitResult: FitResult, intendedFit?: string) {
  if (intendedFit === "딱 맞게" && (fitResult === "fitted" || fitResult === "regular")) {
    return "원하는 딱 맞는 착용감에 가까운 실측이에요.";
  }
  if (
    intendedFit === "여유 있게" &&
    (fitResult === "regular" || fitResult === "semiOversized")
  ) {
    return "원하는 여유 있는 착용감에 가까운 실측이에요.";
  }
  if (
    intendedFit === "오버핏" &&
    (fitResult === "semiOversized" || fitResult === "oversized")
  ) {
    return "원하는 오버핏에 가까운 실측이에요.";
  }
  return "길이와 품의 실측 균형을 함께 반영했어요.";
}

function getSizeDisplayName(measurement: ProductSizeMeasurement) {
  if (
    [measurement.size, measurement.displaySize, measurement.rawSize].some(
      (size) => normalizeSize(size) === "FREE"
    )
  ) {
    return "FREE";
  }

  return measurement.displaySize || measurement.rawSize || measurement.size;
}

function getMeasurementDifference(
  comparison: MeasurementComparisonResult,
  key: keyof FitMeasurements
) {
  return comparison.comparisons.find((value) => value.key === key)?.difference;
}

function getNumericRangeReferenceBonus(
  item: ClosetItem,
  measurement: ProductSizeMeasurement,
  profile?: UserProfile | null
) {
  if (!isBottomCategory(item) || !measurement.numericRange) return 0;

  const profileBottomSize = getNumericSizeValue(profile?.bottomSize);
  if (profileBottomSize === undefined) return 0;

  return profileBottomSize >= measurement.numericRange.min &&
    profileBottomSize <= measurement.numericRange.max
    ? 1
    : 0;
}

type ReferenceMeasurementKey =
  | "totalLength"
  | "shoulder"
  | "chest"
  | "sleeve"
  | "waist"
  | "hip"
  | "thigh"
  | "rise"
  | "hem"
  | "footLength";

type ReferenceMeasurementComparison = {
  key: ReferenceMeasurementKey;
  referenceValue: number;
  candidateValue: number;
  difference: number;
};

type ReferenceSizeComparisonResult = {
  score: number;
  comparisons: ReferenceMeasurementComparison[];
  reasons: string[];
};

const REFERENCE_MEASUREMENT_TOLERANCE: Record<ReferenceMeasurementKey, number> = {
  totalLength: 6,
  shoulder: 4,
  chest: 8,
  sleeve: 4,
  waist: 5,
  hip: 7,
  thigh: 5,
  rise: 4,
  hem: 5,
  footLength: 5,
};

const BOTTOM_REFERENCE_WEIGHTS: Partial<Record<ReferenceMeasurementKey, number>> = {
  totalLength: 35,
  waist: 25,
  hip: 18,
  thigh: 14,
  rise: 5,
  hem: 3,
};

const UPPER_REFERENCE_WEIGHTS: Partial<Record<ReferenceMeasurementKey, number>> = {
  chest: 30,
  shoulder: 25,
  totalLength: 25,
  sleeve: 20,
};

const REFERENCE_FIELD_LABELS: Record<ReferenceMeasurementKey, string> = {
  totalLength: "총장",
  shoulder: "어깨",
  chest: "가슴 단면",
  sleeve: "소매 길이",
  waist: "허리 단면",
  hip: "엉덩이 단면",
  thigh: "허벅지 단면",
  rise: "밑위",
  hem: "밑단",
  footLength: "발길이",
};

function getReferenceWeights(item: ClosetItem) {
  if (isBottomCategory(item)) return BOTTOM_REFERENCE_WEIGHTS;
  if (isUpperCategory(item)) return UPPER_REFERENCE_WEIGHTS;
  return {};
}

function getReferenceFitOffset(item: ClosetItem, key: ReferenceMeasurementKey) {
  const appliesToWidth =
    (isUpperCategory(item) && (key === "shoulder" || key === "chest")) ||
    (isBottomCategory(item) && (key === "waist" || key === "hip" || key === "thigh"));
  if (!appliesToWidth) return 0;

  const preference = getFitPreference(item.intendedFit);
  if (preference === "relaxed") return 1.5;
  if (preference === "oversized") return 3;
  return 0;
}

function getReferenceProductMeasurement(referenceItem?: ClosetItem | null) {
  if (!referenceItem?.size) return undefined;
  return getCurrentProductMeasurement(referenceItem);
}

function isComparableReferenceCategory(item: ClosetItem, referenceItem: ClosetItem) {
  return item.category === referenceItem.category;
}

function getMeasurementValue(
  measurement: ProductSizeMeasurement,
  key: ReferenceMeasurementKey
) {
  const value = measurement[key];
  return typeof value === "number" && value > 0 ? value : undefined;
}

function getRequiredProductMeasurementLabels(item: ClosetItem) {
  if (isBottomCategory(item)) {
    return ["총장", "허리 단면", "엉덩이 또는 허벅지 단면"];
  }

  if (isUpperCategory(item)) {
    return ["총장", "어깨", "가슴 단면"];
  }

  return [];
}

function getMissingProductMeasurementFields(
  item: ClosetItem,
  measurement?: ProductSizeMeasurement
) {
  if (!measurement) return getRequiredProductMeasurementLabels(item);

  if (isBottomCategory(item)) {
    return [
      getMeasurementValue(measurement, "totalLength") ? "" : "총장",
      getMeasurementValue(measurement, "waist") ? "" : "허리 단면",
      getMeasurementValue(measurement, "hip") || getMeasurementValue(measurement, "thigh")
        ? ""
        : "엉덩이 또는 허벅지 단면",
    ].filter(Boolean);
  }

  if (isUpperCategory(item)) {
    return [
      getMeasurementValue(measurement, "totalLength") ? "" : "총장",
      getMeasurementValue(measurement, "shoulder") ? "" : "어깨",
      getMeasurementValue(measurement, "chest") ? "" : "가슴 단면",
    ].filter(Boolean);
  }

  return [];
}

function hasReliableProductMeasurements(
  item: ClosetItem,
  measurement?: ProductSizeMeasurement
) {
  return getMissingProductMeasurementFields(item, measurement).length === 0;
}

function getClosestMissingProductFields(
  item: ClosetItem,
  measurements: ProductSizeMeasurement[]
) {
  if (measurements.length === 0) return getRequiredProductMeasurementLabels(item);

  return measurements
    .map((measurement) => getMissingProductMeasurementFields(item, measurement))
    .sort((first, second) => first.length - second.length)[0];
}

function getReferenceDifferenceReason(
  item: ClosetItem,
  comparison: ReferenceMeasurementComparison
) {
  const label = REFERENCE_FIELD_LABELS[comparison.key];
  const absoluteDifference = Math.abs(Number(comparison.difference.toFixed(1)));
  const itemLabel = isBottomCategory(item)
    ? "기준 바지"
    : isUpperCategory(item)
      ? "기준 옷"
      : "기준 아이템";

  if (absoluteDifference <= 0.4) {
    return `${label}은 ${itemLabel}과 거의 비슷해요.`;
  }

  const direction = comparison.difference > 0 ? "길거나 넓어요" : "짧거나 작아요";
  return `${itemLabel}보다 ${label}이 ${absoluteDifference}cm ${direction}.`;
}

function getReferenceComparison(
  item: ClosetItem,
  candidateMeasurement: ProductSizeMeasurement,
  referenceItem?: ClosetItem | null
): ReferenceSizeComparisonResult | null {
  if (
    !referenceItem ||
    referenceItem.id === item.id ||
    !isComparableReferenceCategory(item, referenceItem) ||
    isAccessoryOrBagItem(item) ||
    isAccessoryOrBagItem(referenceItem)
  ) {
    return null;
  }

  const referenceMeasurement = getReferenceProductMeasurement(referenceItem);
  if (!referenceMeasurement) return null;
  if (
    !hasReliableProductMeasurements(item, candidateMeasurement) ||
    !hasReliableProductMeasurements(referenceItem, referenceMeasurement)
  ) {
    return null;
  }

  const weights = getReferenceWeights(item);
  const comparisons: ReferenceMeasurementComparison[] = [];
  let weightedScoreSum = 0;
  let usedWeightSum = 0;

  Object.entries(weights).forEach(([key, weight]) => {
    const measurementKey = key as ReferenceMeasurementKey;
    if (
      measurementKey === "sleeve" &&
      !shouldCompareReferenceSleeve(item, referenceItem)
    ) {
      return;
    }

    const candidateValue = getMeasurementValue(candidateMeasurement, measurementKey);
    const referenceValue = getMeasurementValue(referenceMeasurement, measurementKey);

    if (candidateValue === undefined || referenceValue === undefined || !weight) return;

    const targetValue = referenceValue + getReferenceFitOffset(item, measurementKey);
    const fieldScore = Math.max(
      0,
      100 -
        (Math.abs(candidateValue - targetValue) /
          REFERENCE_MEASUREMENT_TOLERANCE[measurementKey]) *
          100
    );

    comparisons.push({
      key: measurementKey,
      referenceValue,
      candidateValue,
      difference: Number((candidateValue - referenceValue).toFixed(1)),
    });
    weightedScoreSum += fieldScore * weight;
    usedWeightSum += weight;
  });

  if (comparisons.length === 0 || usedWeightSum <= 0) return null;

  const sortedComparisons = [...comparisons].sort(
    (first, second) =>
      (weights[second.key] || 0) - (weights[first.key] || 0)
  );

  return {
    score: Math.max(0, Math.min(100, Math.round(weightedScoreSum / usedWeightSum))),
    comparisons,
    reasons: sortedComparisons
      .slice(0, 2)
      .map((comparison) => getReferenceDifferenceReason(item, comparison)),
  };
}

function uniqueReasons(reasons: string[]) {
  return reasons.filter(
    (reason, index, allReasons) => reason && allReasons.indexOf(reason) === index
  );
}

function scoreSizeMeasurement(
  item: ClosetItem,
  measurement: ProductSizeMeasurement,
  profile?: UserProfile | null,
  context?: SizeRecommendationContext,
  canUseProfileMeasurements = true
): Omit<SizeRecommendation, "rank"> {
  const productSizeGuide = item.confirmedProduct?.productSizeGuide;
  const measurementItem: ClosetItem = {
    ...item,
    size: measurement.size,
    confirmedProduct: item.confirmedProduct
      ? {
          ...item.confirmedProduct,
          productSizeGuide: {
            ...productSizeGuide,
            sizes: [measurement],
          },
        }
      : item.confirmedProduct,
  };
  const comparison = getMeasurementComparison(measurementItem, profile, context);
  const preference = getFitPreference(item.intendedFit);
  const referenceComparison = getReferenceComparison(
    item,
    measurement,
    context?.referenceItem
  );
  let score = 0;

  if (canUseProfileMeasurements) {
    if (isBottomCategory(item)) {
      const bottomLengthReference = getBottomLengthReference(
        item,
        measurement,
        profile,
        context
      );
      const bottomLengthDifference =
        bottomLengthReference && typeof measurement.totalLength === "number"
          ? measurement.totalLength - bottomLengthReference.targetLength
          : undefined;

      score += bottomLengthDifference !== undefined
        ? getBottomLengthScoreFromDifference(bottomLengthDifference, 40)
        : getLengthScore(comparison.lengthResult, preference, 40);
      score += getEaseScore(
        getMeasurementDifference(comparison, "waist"),
        getTargetEase("bottom", "waist", preference),
        5,
        24
      );
      score += getEaseScore(
        getMeasurementDifference(comparison, "hip"),
        getTargetEase("bottom", "hip", preference),
        8,
        16
      );
      score += getEaseScore(
        getMeasurementDifference(comparison, "thigh"),
        getTargetEase("bottom", "thigh", preference),
        6,
        12
      );
      score += typeof measurement.rise === "number" && measurement.rise > 0 ? 1.5 : 0;
      score += typeof measurement.hem === "number" && measurement.hem > 0 ? 1.5 : 0;
    } else {
      score += getEaseScore(
        getMeasurementDifference(comparison, "shoulder"),
        getTargetEase("upper", "shoulder", preference),
        6,
        30
      );
      score += getLengthScore(comparison.lengthResult, preference, 28);
      score += getEaseScore(
        getMeasurementDifference(comparison, "chest"),
        getTargetEase("upper", "chest", preference),
        10,
        22
      );
      score += shouldCompareUserSleeve(item)
        ? getEaseScore(
            getMeasurementDifference(comparison, "sleeve"),
            getTargetEase("upper", "sleeve", preference),
            5,
            15
          )
        : 15;
    }

    score += getFitPreferenceScore(comparison.fitResult, preference);
    score += getNumericRangeReferenceBonus(item, measurement, profile);
  }

  if (referenceComparison) {
    score = canUseProfileMeasurements
      ? referenceComparison.score * 0.55 + score * 0.45
      : referenceComparison.score;
  }

  return {
    size: measurement.size,
    displaySize: getSizeDisplayName(measurement),
    score: Math.max(0, Math.min(100, Math.round(score))),
    fitResult: comparison.fitResult,
    lengthResult: comparison.lengthResult,
    widthResult: comparison.widthResult,
    reasons: uniqueReasons([
      ...(referenceComparison?.reasons || []),
      ...(canUseProfileMeasurements
        ? [
            comparison.description,
            getIntendedFitReason(comparison.fitResult, item.intendedFit),
          ]
        : []),
    ]),
  };
}

export function getRecommendedProductSize(
  item: ClosetItem,
  profile?: UserProfile | null,
  context?: SizeRecommendationContext
): SizeRecommendationResult {
  if (isAccessoryOrBagItem(item) || isShoeCategory(item)) {
    return { sizeRecommendations: [], missingFields: [] };
  }

  if (!isBottomCategory(item) && !isUpperCategory(item)) {
    return { sizeRecommendations: [], missingFields: [] };
  }

  const missingFields = getRequiredProfileFields(item, profile, context);
  const sizeRows = getValidProductSizeRows(item.confirmedProduct?.productSizeGuide).filter(
    (measurement) =>
      Boolean(measurement.size) &&
      [
        measurement.totalLength,
        measurement.shoulder,
        measurement.chest,
        measurement.sleeve,
        measurement.waist,
        measurement.hip,
        measurement.thigh,
      ].some((value) => typeof value === "number" && value > 0)
  );
  const reliableSizeRows = sizeRows.filter((measurement) =>
    hasReliableProductMeasurements(item, measurement)
  );

  if (reliableSizeRows.length === 0) {
    return {
      sizeRecommendations: [],
      missingFields: [],
      missingProductFields: getClosestMissingProductFields(item, sizeRows),
      blockedReason: "missing_product_measurements",
    };
  }

  const hasReferenceComparison = reliableSizeRows.some((measurement) =>
    Boolean(getReferenceComparison(item, measurement, context?.referenceItem))
  );

  if (missingFields.length > 0 && !hasReferenceComparison) {
    return {
      sizeRecommendations: [],
      missingFields,
      blockedReason: "missing_profile_measurements",
    };
  }

  const canUseProfileMeasurements = missingFields.length === 0;
  const scoredRows = reliableSizeRows
    .map((measurement) =>
      scoreSizeMeasurement(item, measurement, profile, context, canUseProfileMeasurements)
    )
    .sort((first, second) => second.score - first.score)
    .map((recommendation, index) => ({ ...recommendation, rank: index + 1 }));
  const recommended = scoredRows[0];

  return {
    recommendedSize: recommended?.size,
    recommendedDisplaySize: recommended?.displaySize || recommended?.size,
    sizeRecommendations: scoredRows,
    missingFields: hasReferenceComparison ? [] : missingFields,
  };
}

function getFitStatus(fitResult: FitResult, intendedFit: string) {
  if (fitResult === "small") return "작을 수 있어요";

  if (intendedFit === "오버핏") {
    if (fitResult === "oversized" || fitResult === "semiOversized") {
      return "오버핏으로 입기 좋아요";
    }
    if (fitResult === "fitted") return "원하는 오버핏보다 작을 수 있어요";
  }

  if (intendedFit === "여유 있게") {
    if (fitResult === "semiOversized" || fitResult === "regular") {
      return "여유 있게 입기 좋아요";
    }
    if (fitResult === "oversized") return "생각보다 많이 여유로울 수 있어요";
  }

  if (intendedFit === "딱 맞게") {
    if (fitResult === "fitted" || fitResult === "regular") return "딱 맞게 입기 좋아요";
    if (fitResult === "oversized" || fitResult === "semiOversized") {
      return "원하는 핏보다 클 수 있어요";
    }
  }

  const statuses: Record<FitResult, string> = {
    small: "작을 수 있어요",
    fitted: "몸에 맞는 슬림한 핏이에요",
    regular: "무난한 정핏에 가까워요",
    semiOversized: "적당히 여유 있는 핏이에요",
    oversized: "크고 여유 있는 핏이에요",
    unknown: "정확한 실측 비교가 더 필요해요",
  };

  return statuses[fitResult];
}

export function getFitSuitability(
  item: ClosetItem,
  profile?: UserProfile | null
): FitSuitabilityResult {
  if (isAccessoryOrBagItem(item)) {
    return {
      status: "의류 핏 분석 대상이 아니에요",
      description:
        "액세서리와 가방의 크기 정보는 의류 실측과 다른 기준이 필요해 추후 별도로 지원할 예정이에요.",
      lengthResult: "unknown" as const,
      widthResult: "unknown" as const,
      fitResult: "unknown" as const,
      measurementComparison: {
        comparisons: [],
        unavailableFields: [],
        lengthResult: "unknown" as const,
        widthResult: "unknown" as const,
        fitResult: "unknown" as const,
        description: "액세서리와 가방은 의류 실측 비교에서 제외돼요.",
      },
    };
  }

  if (isShoeCategory(item)) {
    return {
      status: "신발 사이즈는 직접 확인해주세요",
      description:
        "신발은 브랜드와 모델별 착화감 차이가 커서 자동 사이즈 추천 대신 상품 사이즈표를 직접 참고하는 방식으로 유지해요.",
      lengthResult: "unknown" as const,
      widthResult: "unknown" as const,
      fitResult: "unknown" as const,
      measurementComparison: {
        comparisons: [],
        unavailableFields: [],
        lengthResult: "unknown" as const,
        widthResult: "unknown" as const,
        fitResult: "unknown" as const,
        description: "신발은 자동 핏 비교에서 제외돼요.",
      },
    };
  }

  const intendedFit = item.intendedFit || "상관없음";
  const profileSize = getProfileSize(item, profile);
  const itemSize = item.size?.trim() || "";
  const productSizeRows = getValidProductSizeRows(item.confirmedProduct?.productSizeGuide);
  const hasProductSizeGuide = productSizeRows.length > 0;
  const currentProductMeasurement = getCurrentProductMeasurement(item);
  const measurementComparison = getMeasurementComparison(item, profile);

  if (!itemSize || itemSize === "사이즈 미입력") {
    return {
      status: "비교할 상품 사이즈를 먼저 선택해주세요",
      description:
        "상품 실측표가 있어도 선택한 사이즈를 알아야 해당 사이즈 행만 정확히 비교할 수 있어요.",
      lengthResult: "unknown" as const,
      widthResult: "unknown" as const,
      fitResult: "unknown" as const,
      measurementComparison,
      blockedReason: "missing_item_size",
    };
  }

  if (currentProductMeasurement) {
    const missingProductFields = getMissingProductMeasurementFields(
      item,
      currentProductMeasurement
    );
    if (missingProductFields.length > 0) {
      return {
        status: "상품 실측이 더 필요해요",
        description: `${missingProductFields.join(", ")} 정보가 부족해 현재 사이즈의 핏을 추측하지 않았어요. 상품 실측을 직접 입력하면 비교할 수 있어요.`,
        lengthResult: "unknown" as const,
        widthResult: "unknown" as const,
        fitResult: "unknown" as const,
        measurementComparison,
        blockedReason: "missing_product_measurements",
      };
    }

    const missingProfileFields = getRequiredProfileFields(item, profile);
    if (missingProfileFields.length > 0) {
      return {
        status: "내 신체 치수가 더 필요해요",
        description: `내 프로필에 ${missingProfileFields.join(", ")} 정보를 입력하면 이 상품의 실측과 비교할 수 있어요.`,
        lengthResult: "unknown" as const,
        widthResult: "unknown" as const,
        fitResult: "unknown" as const,
        measurementComparison,
        blockedReason: "missing_profile_measurements",
      };
    }

    const profileSizeMatchesRange = isSizeWithinNumericRange(
      profileSize,
      currentProductMeasurement.numericRange
    );
    const sizeLabelDescription =
      profileSize &&
      !areSameSizeLabels(profileSize, itemSize) &&
      !profileSizeMatchesRange
        ? "표기 사이즈는 다르지만, 상품 실측 기준으로 비교했어요. "
        : "상품 실측 기준으로 비교했어요. ";

    if (measurementComparison.fitResult === "unknown") {
      return {
        status: "정확한 실측 비교가 더 필요해요",
        description: `${sizeLabelDescription}${measurementComparison.description}`,
        lengthResult: measurementComparison.lengthResult,
        widthResult: measurementComparison.widthResult,
        fitResult: measurementComparison.fitResult,
        measurementComparison,
      };
    }

    return {
      status: getFitStatus(measurementComparison.fitResult, intendedFit),
      description: `${sizeLabelDescription}${measurementComparison.description}`,
      lengthResult: measurementComparison.lengthResult,
      widthResult: measurementComparison.widthResult,
      fitResult: measurementComparison.fitResult,
      measurementComparison,
    };
  }

  if (hasProductSizeGuide) {
    return {
      status: "선택한 사이즈의 실측을 찾지 못했어요",
      description: `${itemSize}와 일치하는 상품 실측 행이 없어요. 상품 사이즈를 다시 선택하거나 실측을 직접 입력해주세요.`,
      lengthResult: "unknown" as const,
      widthResult: "unknown" as const,
      fitResult: "unknown" as const,
      measurementComparison,
      blockedReason: "unmatched_item_size",
    };
  }

  if (normalizeSize(profileSize) === "FREE" || normalizeSize(itemSize) === "FREE") {
    return {
      status: "FREE 상품은 실측 정보가 필요해요",
      description:
        "FREE는 M이나 L로 환산하지 않아요. 상품 실측과 내 신체 치수를 기준으로만 핏을 판단할 수 있어요.",
      lengthResult: "unknown" as const,
      widthResult: "unknown" as const,
      fitResult: "unknown" as const,
      measurementComparison,
      blockedReason: "missing_product_measurements",
    };
  }

  const sizeDiff = compareSize(profileSize, itemSize, item.category);

  if (!profileSize) {
    return {
      status: "정확한 실측 비교는 아직 어려워요",
      description:
        "상품 실측과 내 신체 치수가 함께 있어야 실제 핏을 비교할 수 있어요. 현재 사이즈 표기는 참고 정보로만 사용해요.",
      lengthResult: "unknown" as const,
      widthResult: "unknown" as const,
      fitResult: "unknown" as const,
      measurementComparison,
      blockedReason: "missing_profile_measurements",
    };
  }

  if (sizeDiff === null) {
    return {
      status: "정확한 실측 비교는 아직 어려워요",
      description: `프로필 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. 표기 방식이 달라 상품 실측과 내 신체 치수 없이는 정확한 비교가 어려워요.`,
      lengthResult: "unknown" as const,
      widthResult: "unknown" as const,
      fitResult: "unknown" as const,
      measurementComparison,
      blockedReason: "missing_product_measurements",
    };
  }

  const nominalComparison =
    sizeDiff < 0
      ? "표기상 프로필 사이즈보다 작아요."
      : sizeDiff > 0
        ? "표기상 프로필 사이즈보다 커요."
        : "표기상 프로필 사이즈와 같아요.";

  return {
    status: "정확한 실측 비교는 아직 어려워요",
    description: `프로필 ${item.category} 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. ${nominalComparison} 의도한 착용감은 ${intendedFit}이지만, 실제 핏은 상품 실측과 내 신체 치수를 확인해야 해요.`,
    lengthResult: "unknown" as const,
    widthResult: "unknown" as const,
    fitResult: "unknown" as const,
    measurementComparison,
    blockedReason: "missing_product_measurements",
  };
}
