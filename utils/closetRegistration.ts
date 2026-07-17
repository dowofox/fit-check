import type { ClosetItem, ProductClassificationField } from "@/utils/storage";

const SEASONS = ["봄", "여름", "가을", "겨울", "사계절"];
const UNCERTAIN_VALUE_PATTERN = /확인\s*필요|판단\s*어려움|분석\s*전|미분석/;

export type RegistrationReviewField = "category" | "color" | "season";
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
  const rawSeasons = Array.isArray(seasons) ? seasons.join(", ") : seasons || "";
  const reviewFields: RegistrationReviewField[] = [];

  if (
    !trimmedCategory ||
    trimmedCategory === "기타" ||
    UNCERTAIN_VALUE_PATTERN.test(trimmedCategory)
  ) {
    reviewFields.push("category");
  }

  if (!trimmedColor || UNCERTAIN_VALUE_PATTERN.test(trimmedColor)) {
    reviewFields.push("color");
  }

  if (!rawSeasons.trim() || UNCERTAIN_VALUE_PATTERN.test(rawSeasons)) {
    reviewFields.push("season");
  }

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

export function getProductRegistrationReviewFields({
  category,
  color,
  seasons,
  seasonNeedsReview = false,
  missingOfficialFields = [],
  editedFields = [],
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
  const missingFields = new Set(missingOfficialFields);
  const userEditedFields = new Set(editedFields);

  const officialChecks: [RegistrationReviewField, string][] = [
    ["category", "productCategory"],
    ["color", "productColor"],
  ];
  officialChecks.forEach(([field, missingField]) => {
    if (
      missingFields.has(missingField) &&
      !userEditedFields.has(field) &&
      !reviewFields.includes(field)
    ) {
      reviewFields.push(field);
    }
  });

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
