import {
  doesProductSizeRowMatch,
  getValidProductSizeRows,
} from "@/utils/productSizeMeasurements";
import {
  PRODUCT_MEASUREMENT_SEMANTICS,
  createShapeMeasurementValue,
  getCompatibleRatio,
  parsePositiveMeasurement,
} from "@/utils/fashionCompatibility/shape/measurementSemantics";
import {
  SHAPE_PROFILE_VERSION,
  type GarmentShapeProfile,
  type ShapeLengthClass,
  type ShapeMeasurementKey,
  type ShapeMeasurementSource,
  type ShapeMeasurements,
  type ShapeProfileSource,
  type ShapeSilhouetteClass,
} from "@/utils/fashionCompatibility/shape/types";
import type { ClosetItem, ProductSizeMeasurement } from "@/utils/storage";

const MEASUREMENT_KEYS = Object.keys(
  PRODUCT_MEASUREMENT_SEMANTICS
) as ShapeMeasurementKey[];

export type ShapeProfileBuildContext = {
  userHeightCm?: string | number;
  measurementSource?: Extract<
    ShapeMeasurementSource,
    "official_product" | "user_confirmed" | "reference_clothing"
  >;
  confirmedFitLabel?: string;
};

const SILHOUETTE_ALIASES: Array<{
  value: ShapeSilhouetteClass;
  patterns: RegExp[];
}> = [
  { value: "cropped", patterns: [/크롭|cropped?/i] },
  { value: "semi_oversized", patterns: [/세미\s*오버|semi[-\s]?oversized/i] },
  { value: "oversized", patterns: [/오버\s*핏|오버사이즈|oversized?/i] },
  { value: "wide", patterns: [/와이드|루즈|배기|wide|baggy|loose/i] },
  { value: "slim", patterns: [/슬림|스키니|타이트|slim|skinny|fitted/i] },
  { value: "long", patterns: [/롱\s*기장|롱핏|long/i] },
  { value: "regular", patterns: [/레귤러|정핏|regular|true[-\s]?to[-\s]?size/i] },
];

const LENGTH_ALIASES: Array<{ value: ShapeLengthClass; patterns: RegExp[] }> = [
  { value: "short", patterns: [/크롭|짧은\s*기장|숏|cropped?|short/i] },
  { value: "long", patterns: [/롱\s*기장|맥시|long|full[-\s]?length/i] },
  { value: "regular", patterns: [/레귤러|기본\s*기장|regular/i] },
];

function clampScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10
    ? value
    : undefined;
}

function mapOrdinal(value: string | undefined, values: Record<string, number>) {
  return value ? values[value] : undefined;
}

function normalizeSilhouette(value: unknown): ShapeSilhouetteClass {
  const text = String(value || "").trim();
  if (!text) return "unknown";
  return (
    SILHOUETTE_ALIASES.find((entry) =>
      entry.patterns.some((pattern) => pattern.test(text))
    )?.value || "unknown"
  );
}

function normalizeLength(value: unknown): ShapeLengthClass {
  const text = String(value || "").trim();
  if (!text) return "unknown";
  return (
    LENGTH_ALIASES.find((entry) =>
      entry.patterns.some((pattern) => pattern.test(text))
    )?.value || "unknown"
  );
}

function getTextInput(item: ClosetItem) {
  return [
    item.category,
    item.subCategory,
    item.detailCategory,
    item.fit,
    item.description,
    item.confirmedProduct?.productName,
    item.inferredProductName,
  ]
    .filter(Boolean)
    .join(" ");
}

export function getSelectedProductMeasurement(
  item: ClosetItem
): ProductSizeMeasurement | undefined {
  if (!item.size?.trim()) return undefined;
  return getValidProductSizeRows(
    item.confirmedProduct?.productSizeGuide
  ).find((row) => doesProductSizeRowMatch(row, item.size));
}

function getMeasurements(
  item: ClosetItem,
  row: ProductSizeMeasurement | undefined,
  context: ShapeProfileBuildContext,
  ambiguousMeasurementSemantics: string[]
) {
  const measurements: ShapeMeasurements = {};
  if (!row) return measurements;
  if (item.confirmedProduct?.productSizeGuide?.unit !== "cm") {
    ambiguousMeasurementSemantics.push("product-size-guide-unit-unknown");
    return measurements;
  }
  const source = context.measurementSource || "official_product";
  const confidence = source === "official_product" ? 0.85 : 0.9;
  for (const key of MEASUREMENT_KEYS) {
    const value = createShapeMeasurementValue(
      row[key],
      PRODUCT_MEASUREMENT_SEMANTICS[key],
      source,
      confidence
    );
    if (value) measurements[key] = value;
  }
  if (measurements.rise) {
    ambiguousMeasurementSemantics.push("rise-subtype-unspecified");
  }
  return measurements;
}

function getSource(
  measurements: ShapeMeasurements,
  context: ShapeProfileBuildContext,
  item: ClosetItem,
  styleSilhouette: ShapeSilhouetteClass,
  textSilhouette: ShapeSilhouetteClass
): ShapeProfileSource {
  if (Object.keys(measurements).length > 0) {
    return context.measurementSource === "reference_clothing"
      ? "reference_clothing"
      : "official_measurement";
  }
  if (context.confirmedFitLabel?.trim()) return "user_confirmed_label";
  if (item.garmentProfile) return "image_impression";
  if (styleSilhouette !== "unknown" || item.styleProfile?.lengthType) {
    return "style_profile";
  }
  return textSilhouette !== "unknown" ? "text_inference" : "unknown";
}

function freezeProfile(profile: GarmentShapeProfile) {
  Object.freeze(profile.measurements);
  Object.freeze(profile.derived);
  Object.freeze(profile.diagnostics.unavailableFields);
  Object.freeze(profile.diagnostics.ambiguousMeasurementSemantics);
  Object.freeze(profile.diagnostics.conflictingSources);
  Object.freeze(profile.diagnostics);
  return Object.freeze(profile);
}

export function buildGarmentShapeProfile(
  item: ClosetItem,
  context: ShapeProfileBuildContext = {}
): GarmentShapeProfile {
  const ambiguousMeasurementSemantics: string[] = [];
  const selectedMeasurement = getSelectedProductMeasurement(item);
  const measurements = getMeasurements(
    item,
    selectedMeasurement,
    context,
    ambiguousMeasurementSemantics
  );
  const userSilhouette = normalizeSilhouette(context.confirmedFitLabel);
  const imageSilhouette = normalizeSilhouette(item.garmentProfile?.silhouette);
  const styleSilhouette = normalizeSilhouette(
    item.styleProfile?.silhouette || item.styleProfile?.fit
  );
  const textInput = getTextInput(item);
  const textSilhouette = normalizeSilhouette(textInput);
  const silhouetteClass =
    userSilhouette !== "unknown"
      ? userSilhouette
      : imageSilhouette !== "unknown"
        ? imageSilhouette
        : styleSilhouette !== "unknown"
          ? styleSilhouette
          : textSilhouette;
  const imageLength = normalizeLength(
    item.garmentProfile?.lengthBalance || item.garmentProfile?.silhouette
  );
  const styleLength = normalizeLength(item.styleProfile?.lengthType);
  const textLength = normalizeLength(textInput);
  const lengthClass =
    imageLength !== "unknown"
      ? imageLength
      : styleLength !== "unknown"
        ? styleLength
        : textLength;
  const source = getSource(
    measurements,
    context,
    item,
    styleSilhouette,
    textSilhouette
  );
  const sourceReliability: Record<ShapeProfileSource, number> = {
    official_measurement: 0.85,
    user_confirmed_label: 0.9,
    reference_clothing: 0.9,
    image_impression: 0.55,
    style_profile: 0.4,
    text_inference: 0.25,
    unknown: 0,
  };
  const structure = mapOrdinal(item.garmentProfile?.structure, {
    soft: 2,
    normal: 5,
    stiff: 8,
  });
  const drape = mapOrdinal(item.garmentProfile?.drape, {
    low: 2,
    medium: 5,
    high: 8,
  });
  const volume = clampScore(item.garmentProfile?.volume);
  const visualWeight = clampScore(item.garmentProfile?.visualWeight);
  const pointLevel = clampScore(item.garmentProfile?.pointLevel);
  const height = createShapeMeasurementValue(
    context.userHeightCm,
    "linear_length",
    "user_confirmed",
    0.9
  );
  const derived = {
    lengthToHeightRatio: getCompatibleRatio(measurements.totalLength, height),
    widthToLengthRatio:
      measurements.chest?.semantics === "flat_width" && measurements.totalLength
        ? measurements.chest.value / measurements.totalLength.value
        : measurements.waist?.semantics === "flat_width" && measurements.totalLength
          ? measurements.waist.value / measurements.totalLength.value
          : undefined,
    shoulderToLengthRatio:
      measurements.shoulder && measurements.totalLength
        ? measurements.shoulder.value / measurements.totalLength.value
        : undefined,
    hemToThighRatio:
      measurements.hem?.semantics === "flat_width" &&
      measurements.thigh?.semantics === "flat_width"
        ? measurements.hem.value / measurements.thigh.value
        : undefined,
    riseToLengthRatio:
      measurements.rise && measurements.totalLength
        ? measurements.rise.value / measurements.totalLength.value
        : undefined,
  };
  const visualValues = [
    silhouetteClass !== "unknown" ? 1 : 0,
    lengthClass !== "unknown" ? 1 : 0,
    volume !== undefined ? 1 : 0,
    visualWeight !== undefined ? 1 : 0,
    structure !== undefined || drape !== undefined ? 1 : 0,
  ];
  const completeness =
    (Object.keys(measurements).length / MEASUREMENT_KEYS.length +
      visualValues.reduce((sum, value) => sum + value, 0) / visualValues.length) /
    2;
  const sourceSilhouettes = [
    userSilhouette,
    imageSilhouette,
    styleSilhouette,
    textSilhouette,
  ].filter((value) => value !== "unknown");
  const conflictingSources =
    new Set(sourceSilhouettes).size > 1 ? ["silhouette-source-conflict"] : [];
  const unavailableFields = [
    ...MEASUREMENT_KEYS.filter((key) => !measurements[key]).map(
      (key) => `measurement:${key}`
    ),
    ...(silhouetteClass === "unknown" ? ["silhouetteClass"] : []),
    ...(lengthClass === "unknown" ? ["lengthClass"] : []),
    ...(volume === undefined ? ["volume"] : []),
    ...(visualWeight === undefined ? ["visualWeight"] : []),
  ];
  if (selectedMeasurement && Object.keys(measurements).length === 0) {
    unavailableFields.push("selected-size-measurements");
  } else if (!selectedMeasurement) {
    unavailableFields.push(
      item.size?.trim() ? "matching-selected-size-row" : "selected-size"
    );
  }

  return freezeProfile({
    version: SHAPE_PROFILE_VERSION,
    itemId: item.id,
    category: item.category,
    silhouetteClass,
    lengthClass,
    volume,
    visualWeight,
    structure,
    drape,
    pointLevel,
    measurements,
    derived,
    source,
    confidence: sourceReliability[source] * (0.5 + completeness * 0.5),
    usedFallback: source === "text_inference" || source === "unknown",
    diagnostics: {
      unavailableFields,
      ambiguousMeasurementSemantics,
      conflictingSources,
    },
  });
}
