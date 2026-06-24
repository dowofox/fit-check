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
  const upperSize = String(size || "").trim().toUpperCase();

  if (upperSize === "2XL") return "XXL";
  if (upperSize === "3XL") return "XXXL";

  return upperSize;
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
};

function parseMeasurement(value?: string) {
  const parsedValue = Number(String(value || "").replace(",", ".").trim());
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

function getCurrentProductMeasurement(item: ClosetItem) {
  const itemSize = normalizeSize(item.size);
  const sizes = item.confirmedProduct?.productSizeGuide?.sizes || [];

  if (!itemSize) return undefined;
  return sizes.find((measurement) => normalizeSize(measurement.size) === itemSize);
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
      fitResult: "unknown",
    },
    comparisons,
    unavailableFields,
  };
}

export function getFitSuitability(item: ClosetItem, profile?: UserProfile | null) {
  const intendedFit = item.intendedFit || "상관없음";
  const profileSize = getProfileSize(item, profile);
  const itemSize = item.size || "";
  const sizeDiff = compareSize(profileSize, itemSize, item.category);
  const measurementComparison = getMeasurementComparison(item, profile);

  if (measurementComparison.comparisons.length > 0) {
    return {
      status: "실측 비교 자료가 있어요",
      description: `현재 ${measurementComparison.comparisons.length}개 항목을 비교할 수 있어요. 아직 자동 핏 판정은 하지 않고 상품 실측과 내 신체 치수 차이만 준비해두었어요.`,
    };
  }

  if (!profileSize || !itemSize || itemSize === "사이즈 미입력") {
    return {
      status: "정확한 실측 비교는 아직 어려워요",
      description:
        "상품 실측과 내 신체 치수가 함께 있어야 실제 핏을 비교할 수 있어요. 현재 사이즈 표기는 참고 정보로만 사용해요.",
    };
  }

  if (sizeDiff === null) {
    return {
      status: "정확한 실측 비교는 아직 어려워요",
      description: `프로필 사이즈는 ${profileSize}이고 이 옷은 ${itemSize}예요. 표기 방식이 달라 상품 실측과 내 신체 치수 없이는 정확한 비교가 어려워요.`,
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
  };
}
