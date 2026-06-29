import {
  ClosetItem,
  FitAnalysisProfile,
  FitMeasurements,
  ProductSizeMeasurement,
  UserProfile,
} from "@/utils/storage";

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

function normalizeSize(size?: string) {
  const upperSize = String(size || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/X-LARGE/g, "XL")
    .replace(/LARGE/g, "L")
    .replace(/MEDIUM/g, "M")
    .replace(/SMALL/g, "S");

  if (upperSize === "2XL") return "XXL";
  if (upperSize === "3XL") return "XXXL";

  return upperSize;
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

type WidthAnalysis = {
  result: WidthResult;
  description: string;
  shoulderDescription?: string;
  chestDescription?: string;
};

function parseMeasurement(value?: string) {
  const parsedValue = Number(String(value || "").replace(",", ".").trim());
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

function getCurrentProductMeasurement(item: ClosetItem) {
  const itemSizeAliases = getSizeAliases(item.size);
  const sizes = item.confirmedProduct?.productSizeGuide?.sizes || [];

  if (itemSizeAliases.length === 0) return undefined;
  return sizes.find((measurement) =>
    getSizeAliases(measurement.size).some((alias) => itemSizeAliases.includes(alias))
  );
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

function getIntendedLengthOffset(intendedFit?: string) {
  if (intendedFit === "오버핏") return 3;
  if (intendedFit === "여유 있게") return 1.5;
  return 0;
}

function getBottomLengthAnalysis(
  item: ClosetItem,
  garmentMeasurement: ProductSizeMeasurement,
  profile?: UserProfile | null
): { result: LengthResult; description: string } {
  if (!isBottomCategory(item) || typeof garmentMeasurement.totalLength !== "number") {
    return { result: "unknown", description: "" };
  }

  const userInseam = parseMeasurement(profile?.inseam);
  const userHeight = parseMeasurement(profile?.height);
  const intendedOffset = getIntendedLengthOffset(item.intendedFit);
  let difference: number | undefined;
  let comparisonBasis = "";

  if (userInseam !== undefined && typeof garmentMeasurement.rise === "number") {
    const estimatedGarmentInseam = garmentMeasurement.totalLength - garmentMeasurement.rise;
    difference = estimatedGarmentInseam - userInseam - intendedOffset;
    comparisonBasis = "내 인심";
  } else if (userHeight !== undefined) {
    const estimatedRegularLength = userHeight * 0.59;
    difference = garmentMeasurement.totalLength - estimatedRegularLength - intendedOffset;
    comparisonBasis = "내 키";
  }

  if (difference === undefined) {
    return {
      result: "unknown",
      description: "총장은 확인됐지만 키 또는 인심 정보가 없어 길이감을 정확히 비교하기 어려워요.",
    };
  }

  const roundedDifference = Math.abs(Number(difference.toFixed(1)));

  if (difference < -4) {
    return {
      result: "short",
      description: `총장이 ${comparisonBasis} 기준보다 약 ${roundedDifference}cm 짧아 발목이 드러나는 짧은 길이감일 수 있어요.`,
    };
  }

  if (difference <= 3) {
    return {
      result: "regular",
      description: `총장이 ${comparisonBasis} 기준과 비슷해 자연스럽게 떨어지는 기본 길이감이에요.`,
    };
  }

  if (difference <= 7) {
    return {
      result: "long",
      description: `총장이 ${comparisonBasis} 대비 약 ${roundedDifference}cm 길어 발등에 살짝 쌓이는 길이감이에요.`,
    };
  }

  return {
    result: "tooLong",
    description: `총장이 ${comparisonBasis} 대비 약 ${roundedDifference}cm 길어 밑단이 많이 쌓이거나 수선이 필요할 수 있어요.`,
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
  if (!isUpperCategory(item)) return "";

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
  profile?: UserProfile | null
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

  COMPARISON_FIELDS.forEach(({ key, productKey, label }) => {
    const userValue = comparableUserMeasurements[key];
    const garmentValue = garmentMeasurement[productKey];

    if (typeof userValue === "number" && typeof garmentValue === "number") {
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
    ? getBottomLengthAnalysis(item, garmentMeasurement, profile)
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

export function getFitSuitability(item: ClosetItem, profile?: UserProfile | null) {
  const intendedFit = item.intendedFit || "상관없음";
  const profileSize = getProfileSize(item, profile);
  const itemSize = item.size?.trim() || "";
  const productSizeRows = item.confirmedProduct?.productSizeGuide?.sizes || [];
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
    };
  }

  if (currentProductMeasurement) {
    const sizeLabelDescription =
      profileSize && !areSameSizeLabels(profileSize, itemSize)
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
  };
}
