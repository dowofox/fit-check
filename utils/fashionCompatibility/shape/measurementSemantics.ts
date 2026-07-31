import type { UserProfile } from "@/utils/storage";
import type {
  MeasurementSemantics,
  ShapeMeasurementKey,
  ShapeMeasurementSource,
  ShapeMeasurementValue,
} from "@/utils/fashionCompatibility/shape/types";

export const PRODUCT_MEASUREMENT_SEMANTICS: Readonly<
  Record<ShapeMeasurementKey, MeasurementSemantics>
> = Object.freeze({
  totalLength: "linear_length",
  shoulder: "linear_length",
  chest: "flat_width",
  sleeve: "linear_length",
  waist: "flat_width",
  hip: "flat_width",
  thigh: "flat_width",
  rise: "linear_length",
  hem: "flat_width",
  footLength: "linear_length",
});

export const USER_MEASUREMENT_SEMANTICS: Readonly<
  Partial<Record<keyof UserProfile, MeasurementSemantics>>
> = Object.freeze({
  height: "linear_length",
  shoulderWidth: "linear_length",
  chestCircumference: "circumference",
  waistCircumference: "circumference",
  hipCircumference: "circumference",
  armLength: "linear_length",
  inseam: "linear_length",
  thighCircumference: "circumference",
  preferredPantsTotalLength: "linear_length",
});

export function parsePositiveMeasurement(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function createShapeMeasurementValue(
  value: unknown,
  semantics: MeasurementSemantics,
  source: ShapeMeasurementSource,
  confidence: number,
  unit: ShapeMeasurementValue["unit"] = "cm"
): ShapeMeasurementValue | undefined {
  const parsed = parsePositiveMeasurement(value);
  if (parsed === undefined || semantics === "unknown") return undefined;
  return Object.freeze({
    value: parsed,
    unit,
    semantics,
    source,
    confidence: Math.max(0, Math.min(1, confidence)),
  });
}

export function getCompatibleMeasurementDifference(
  first: ShapeMeasurementValue | undefined,
  second: ShapeMeasurementValue | undefined
) {
  if (
    !first ||
    !second ||
    first.unit !== second.unit ||
    first.semantics === "unknown" ||
    first.semantics !== second.semantics
  ) {
    return undefined;
  }
  return first.value - second.value;
}

export function getFlatWidthCircumferenceEase(
  garment: ShapeMeasurementValue | undefined,
  body: ShapeMeasurementValue | undefined
) {
  if (
    !garment ||
    !body ||
    garment.unit !== "cm" ||
    body.unit !== "cm" ||
    garment.semantics !== "flat_width" ||
    body.semantics !== "circumference"
  ) {
    return undefined;
  }
  return garment.value * 2 - body.value;
}

export function getCompatibleRatio(
  numerator: ShapeMeasurementValue | undefined,
  denominator: ShapeMeasurementValue | undefined
) {
  if (
    !numerator ||
    !denominator ||
    numerator.unit !== "cm" ||
    denominator.unit !== "cm" ||
    numerator.semantics !== "linear_length" ||
    denominator.semantics !== "linear_length" ||
    denominator.value <= 0
  ) {
    return undefined;
  }
  return numerator.value / denominator.value;
}
