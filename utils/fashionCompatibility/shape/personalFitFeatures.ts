import {
  createShapeMeasurementValue,
  getCompatibleMeasurementDifference,
  getFlatWidthCircumferenceEase,
} from "@/utils/fashionCompatibility/shape/measurementSemantics";
import {
  buildGarmentShapeProfile,
  type ShapeProfileBuildContext,
} from "@/utils/fashionCompatibility/shape/shapeProfiles";
import {
  PERSONAL_FIT_FEATURE_VERSION,
  type GarmentShapeProfile,
  type PersonalFitFeatures,
  type ShapeMeasurementKey,
  type ShapeMeasurementValue,
} from "@/utils/fashionCompatibility/shape/types";
import type { ClosetItem, UserProfile } from "@/utils/storage";

type PersonalFitOptions = {
  profiles?: readonly GarmentShapeProfile[];
  referenceItems?: readonly ClosetItem[];
};

const REFERENCE_ID_BY_CATEGORY = {
  "상의": "topItemId",
  "하의": "bottomItemId",
  "아우터": "outerItemId",
  "신발": "shoesItemId",
} as const;

function getBodyMeasurement(
  value: unknown,
  semantics: "circumference" | "linear_length"
) {
  return createShapeMeasurementValue(
    value,
    semantics,
    "user_confirmed",
    0.9
  );
}

function isExplicitLongSleeve(item?: ClosetItem) {
  if (!item) return false;
  const text = [
    item.detailCategory,
    item.subCategory,
    item.confirmedProduct?.productName,
    item.inferredProductName,
    item.styleProfile?.sleeveLength,
    item.description,
  ]
    .filter(Boolean)
    .join(" ");
  const nonLong = /민소매|슬리브리스|나시|반팔|숏\s*슬리브|5부|7부|sleeveless|short[-\s]?sleeve|three[-\s]?quarter/i;
  return !nonLong.test(text) && /긴팔|롱\s*슬리브|long[-\s]?sleeve/i.test(text);
}

function addDifference(
  key: string,
  garment: ShapeMeasurementValue | undefined,
  body: ShapeMeasurementValue | undefined,
  comparable: string[],
  semanticMismatches: string[]
) {
  if (!garment || !body) return undefined;
  const difference = getCompatibleMeasurementDifference(garment, body);
  if (difference === undefined) {
    semanticMismatches.push(key);
    return undefined;
  }
  comparable.push(key);
  return difference;
}

function addEase(
  key: string,
  garment: ShapeMeasurementValue | undefined,
  body: ShapeMeasurementValue | undefined,
  comparable: string[],
  semanticMismatches: string[]
) {
  if (!garment || !body) return undefined;
  const ease = getFlatWidthCircumferenceEase(garment, body);
  if (ease === undefined) {
    semanticMismatches.push(key);
    return undefined;
  }
  comparable.push(key);
  return ease;
}

function getReferenceDifferences(
  items: readonly ClosetItem[],
  profile: UserProfile,
  referenceItems: readonly ClosetItem[] | undefined
) {
  if (!referenceItems?.length) return undefined;
  const differences: Record<string, number> = {};
  for (const item of items) {
    const referenceKey = REFERENCE_ID_BY_CATEGORY[
      item.category as keyof typeof REFERENCE_ID_BY_CATEGORY
    ];
    const referenceId = referenceKey
      ? profile.referenceClothing?.[referenceKey]
      : undefined;
    const referenceItem = referenceItems.find(
      (candidate) => candidate.id === referenceId && candidate.id !== item.id
    );
    if (!referenceItem) continue;
    const itemProfile = buildGarmentShapeProfile(item);
    const context: ShapeProfileBuildContext = {
      measurementSource: "reference_clothing",
    };
    const referenceProfile = buildGarmentShapeProfile(referenceItem, context);
    for (const key of Object.keys(itemProfile.measurements) as ShapeMeasurementKey[]) {
      const difference = getCompatibleMeasurementDifference(
        itemProfile.measurements[key],
        referenceProfile.measurements[key]
      );
      if (difference !== undefined) {
        differences[`${item.category}:${key}`] = difference;
      }
    }
  }
  return Object.keys(differences).length > 0 ? differences : undefined;
}

export function buildPersonalFitFeatures(
  items: readonly ClosetItem[],
  profile: UserProfile | null | undefined,
  options: PersonalFitOptions = {}
): PersonalFitFeatures {
  const profiles =
    options.profiles ||
    items.map((item) =>
      buildGarmentShapeProfile(item, { userHeightCm: profile?.height })
    );
  const topItem = items.find((item) => item.category === "상의");
  const upperItem = topItem || items.find((item) => item.category === "아우터");
  const upperProfile = upperItem
    ? profiles.find((candidate) => candidate.itemId === upperItem.id)
    : undefined;
  const bottomProfile = profiles.find((candidate) => candidate.category === "하의");
  const comparableMeasurements: string[] = [];
  const semanticMismatches: string[] = [];
  const unavailableReasons: string[] = [];

  if (!profile) {
    unavailableReasons.push("user-profile-unavailable");
  }
  const chestEaseCm = addEase(
    "chest",
    upperProfile?.measurements.chest,
    getBodyMeasurement(profile?.chestCircumference, "circumference"),
    comparableMeasurements,
    semanticMismatches
  );
  const waistEaseCm = addEase(
    "waist",
    bottomProfile?.measurements.waist,
    getBodyMeasurement(profile?.waistCircumference, "circumference"),
    comparableMeasurements,
    semanticMismatches
  );
  const hipEaseCm = addEase(
    "hip",
    bottomProfile?.measurements.hip,
    getBodyMeasurement(profile?.hipCircumference, "circumference"),
    comparableMeasurements,
    semanticMismatches
  );
  const shoulderDifferenceCm = addDifference(
    "shoulder",
    upperProfile?.measurements.shoulder,
    getBodyMeasurement(profile?.shoulderWidth, "linear_length"),
    comparableMeasurements,
    semanticMismatches
  );
  const sleeveDifferenceCm = isExplicitLongSleeve(upperItem)
    ? addDifference(
        "sleeve",
        upperProfile?.measurements.sleeve,
        getBodyMeasurement(profile?.armLength, "linear_length"),
        comparableMeasurements,
        semanticMismatches
      )
    : undefined;
  const totalLengthDifferenceCm = addDifference(
    "totalLength",
    bottomProfile?.measurements.totalLength,
    getBodyMeasurement(profile?.preferredPantsTotalLength, "linear_length"),
    comparableMeasurements,
    semanticMismatches
  );
  if (profile?.inseam && bottomProfile) {
    unavailableReasons.push("garment-inseam-unavailable");
  }
  if (items.some((item) => item.category === "아우터") && topItem) {
    unavailableReasons.push("outer-layer-ease-not-aggregated");
  }
  if (comparableMeasurements.length === 0) {
    unavailableReasons.push("no-compatible-personal-measurements");
  }
  const referenceClothingDifferences = profile
    ? getReferenceDifferences(items, profile, options.referenceItems)
    : undefined;
  const directCount = comparableMeasurements.length;
  const referenceCount = Object.keys(referenceClothingDifferences || {}).length;
  const confidence = Math.min(1, (directCount + referenceCount * 0.75) / 6);

  return Object.freeze({
    version: PERSONAL_FIT_FEATURE_VERSION,
    comparableMeasurements: Object.freeze(comparableMeasurements) as string[],
    chestEaseCm,
    waistEaseCm,
    hipEaseCm,
    shoulderDifferenceCm,
    sleeveDifferenceCm,
    inseamDifferenceCm: undefined,
    totalLengthDifferenceCm,
    referenceClothingDifferences: referenceClothingDifferences
      ? Object.freeze(referenceClothingDifferences)
      : undefined,
    confidence,
    usedFallback:
      profiles.some((candidate) => candidate.usedFallback) || directCount === 0,
    unavailableReasons: Object.freeze(unavailableReasons) as string[],
    semanticMismatches: Object.freeze(semanticMismatches) as string[],
  });
}
