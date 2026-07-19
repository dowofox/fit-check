import type { ClosetItem, ProductClassificationField } from "@/utils/storage";

const SEASONS = ["봄", "여름", "가을", "겨울", "사계절"];
const UNCERTAIN_VALUE_PATTERN = /확인\s*필요|판단\s*어려움|분석\s*전|미분석/;

export type RegistrationReviewField = "category" | "color" | "season";
export type RegistrationValidationResult = {
  valid: boolean;
  missingFields: RegistrationReviewField[];
  invalidFields: RegistrationReviewField[];
};

const REGISTRATION_FIELD_ORDER: RegistrationReviewField[] = [
  "category",
  "color",
  "season",
];
const REVIEW_FIELD_LABELS: Record<RegistrationReviewField, string> = {
  category: "종류",
  color: "색상",
  season: "계절",
};

type ClosetRegistrationBasicsInput = {
  category?: string;
  color?: string;
  seasons?: string | string[];
};

export function isUsableClothesAnalysisResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const analysis = value as Record<string, unknown>;
  const category = typeof analysis.category === "string"
    ? analysis.category.trim()
    : "";
  const color = typeof analysis.color === "string"
    ? analysis.color.trim()
    : "";

  return Boolean(category && category !== "분석 실패" && color);
}

export function validateClosetRegistration({
  category,
  color,
  seasons,
}: ClosetRegistrationBasicsInput): RegistrationValidationResult {
  const trimmedCategory = category?.trim() || "";
  const trimmedColor = color?.trim() || "";
  const rawSeasons = Array.isArray(seasons) ? seasons.join(", ") : seasons || "";
  const normalizedSeasons = normalizeClosetSeasons(seasons);
  const missingFields: RegistrationReviewField[] = [];
  const invalidFields: RegistrationReviewField[] = [];

  if (!trimmedCategory) {
    missingFields.push("category");
  } else if (
    trimmedCategory === "기타" ||
    UNCERTAIN_VALUE_PATTERN.test(trimmedCategory)
  ) {
    invalidFields.push("category");
  }

  if (!trimmedColor) {
    missingFields.push("color");
  } else if (UNCERTAIN_VALUE_PATTERN.test(trimmedColor)) {
    invalidFields.push("color");
  }

  if (!rawSeasons.trim()) {
    missingFields.push("season");
  } else if (
    UNCERTAIN_VALUE_PATTERN.test(rawSeasons) ||
    normalizedSeasons.length === 0
  ) {
    invalidFields.push("season");
  }

  return {
    valid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields,
  };
}

export function createClosetItemId(
  timestamp = Date.now(),
  randomValue = Math.random()
) {
  const normalizedTimestamp = Number.isFinite(timestamp)
    ? Math.max(0, Math.trunc(timestamp))
    : Date.now();
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.9999999999999999)
    : Math.random();
  const entropy = Math.floor(normalizedRandom * Number.MAX_SAFE_INTEGER)
    .toString(36)
    .padStart(11, "0");

  return `${normalizedTimestamp}-${entropy}`;
}

export function getUniqueRegistrationImageUris(
  imageUris: string[],
  maxCount = 10
) {
  const normalizedLimit = Math.max(0, Math.trunc(maxCount));
  if (normalizedLimit === 0) return [];

  const uniqueUris: string[] = [];
  const seenUris = new Set<string>();

  for (const imageUri of imageUris) {
    const normalizedUri = imageUri.trim();
    if (!normalizedUri || seenUris.has(normalizedUri)) continue;

    seenUris.add(normalizedUri);
    uniqueUris.push(normalizedUri);
    if (uniqueUris.length >= normalizedLimit) break;
  }

  return uniqueUris;
}

export function normalizeClosetSeasons(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const matchedSeasons = SEASONS.filter((season) =>
    values.some((currentValue) => currentValue.includes(season))
  );

  if (matchedSeasons.length > 1 && matchedSeasons.includes("사계절")) {
    return matchedSeasons.filter((season) => season !== "사계절");
  }

  return matchedSeasons;
}

export function normalizeClosetRegistrationBasics({
  category,
  color,
  seasons,
}: ClosetRegistrationBasicsInput) {
  const trimmedCategory = category?.trim() || "";
  const trimmedColor = color?.trim() || "";
  const normalizedSeasons = normalizeClosetSeasons(seasons);
  const validation = validateClosetRegistration({ category, color, seasons });
  const reviewFields = REGISTRATION_FIELD_ORDER.filter(
    (field) =>
      validation.missingFields.includes(field) ||
      validation.invalidFields.includes(field)
  );

  return {
    category: trimmedCategory || "기타",
    color: trimmedColor || "색상 확인 필요",
    seasons: normalizedSeasons,
    reviewFields,
  };
}

export function wasClosetItemSaved(items: ClosetItem[], itemId: string) {
  return items.some((item) => item.id === itemId);
}

export function getRegistrationReviewLabels(fields: RegistrationReviewField[]) {
  return fields.map((field) => REVIEW_FIELD_LABELS[field]);
}

export function getRegistrationValidationMessage(
  result: RegistrationValidationResult
) {
  const messages: string[] = [];

  if (result.missingFields.length > 0) {
    messages.push(
      `${getRegistrationReviewLabels(result.missingFields).join(", ")} 정보를 입력해주세요.`
    );
  }

  if (result.invalidFields.length > 0) {
    messages.push(
      `${getRegistrationReviewLabels(result.invalidFields).join(", ")} 정보를 확인해주세요.`
    );
  }

  return messages.join("\n");
}

export function getProductRegistrationReviewFields({
  category,
  color,
  seasons,
  seasonNeedsReview = false,
}: ClosetRegistrationBasicsInput & {
  seasonNeedsReview?: boolean;
  missingOfficialFields?: string[];
  editedFields?: ProductClassificationField[];
}) {
  const reviewFields = normalizeClosetRegistrationBasics({
    category,
    color,
    seasons,
  }).reviewFields;
  if (seasonNeedsReview && !reviewFields.includes("season")) {
    reviewFields.push("season");
  }

  return reviewFields;
}

export function getClosetItemReviewFields(
  item: Pick<ClosetItem, "category" | "color" | "season" | "seasons" | "seasonNeedsReview">
) {
  const reviewFields = normalizeClosetRegistrationBasics({
    category: item.category,
    color: item.color,
    seasons: item.seasons?.length ? item.seasons : item.season,
  }).reviewFields;

  if (item.seasonNeedsReview && !reviewFields.includes("season")) {
    reviewFields.push("season");
  }

  return reviewFields;
}
