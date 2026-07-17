export type ProfileMeasurementInputKey =
  | "height"
  | "shoulderWidth"
  | "chestCircumference"
  | "waistCircumference"
  | "hipCircumference"
  | "armLength"
  | "inseam"
  | "thighCircumference"
  | "preferredPantsTotalLength";

export type ProfileMeasurementInputs = Record<ProfileMeasurementInputKey, string>;

const PROFILE_MEASUREMENT_LABELS: Record<ProfileMeasurementInputKey, string> = {
  height: "키",
  shoulderWidth: "어깨 너비",
  chestCircumference: "가슴 둘레",
  waistCircumference: "허리 둘레",
  hipCircumference: "엉덩이 둘레",
  armLength: "팔 길이",
  inseam: "다리 안쪽 길이(인심)",
  thighCircumference: "허벅지 둘레",
  preferredPantsTotalLength: "평소 잘 맞는 바지 총장",
};

const PROFILE_MEASUREMENT_RANGES: Record<
  ProfileMeasurementInputKey,
  { min: number; max: number }
> = {
  height: { min: 80, max: 250 },
  shoulderWidth: { min: 20, max: 90 },
  chestCircumference: { min: 40, max: 250 },
  waistCircumference: { min: 40, max: 250 },
  hipCircumference: { min: 40, max: 250 },
  armLength: { min: 25, max: 120 },
  inseam: { min: 30, max: 140 },
  thighCircumference: { min: 20, max: 150 },
  preferredPantsTotalLength: { min: 40, max: 180 },
};

export function normalizeOptionalProfileMeasurement(
  value: string,
  key?: ProfileMeasurementInputKey
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return { value: "", isValid: true };

  const parsedValue = Number(trimmedValue.replace(",", "."));
  const range = key ? PROFILE_MEASUREMENT_RANGES[key] : undefined;
  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0 ||
    (range && (parsedValue < range.min || parsedValue > range.max))
  ) {
    return { value: trimmedValue, isValid: false };
  }

  return { value: String(parsedValue), isValid: true };
}

export function validateProfileMeasurementInputs(inputs: ProfileMeasurementInputs) {
  const values = { ...inputs };
  const invalidFields: string[] = [];

  (Object.keys(inputs) as ProfileMeasurementInputKey[]).forEach((key) => {
    const result = normalizeOptionalProfileMeasurement(inputs[key], key);
    values[key] = result.value;
    if (!result.isValid) invalidFields.push(PROFILE_MEASUREMENT_LABELS[key]);
  });

  return { values, invalidFields };
}

export function countValidProfileMeasurements(
  inputs: ProfileMeasurementInputs,
  excludedKeys: ProfileMeasurementInputKey[] = []
) {
  const excluded = new Set(excludedKeys);

  return (Object.keys(inputs) as ProfileMeasurementInputKey[]).filter((key) => {
    if (excluded.has(key)) return false;
    const result = normalizeOptionalProfileMeasurement(inputs[key], key);
    return result.isValid && Boolean(result.value);
  }).length;
}
