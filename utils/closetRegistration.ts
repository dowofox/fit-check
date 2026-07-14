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

export function getRegistrationReviewLabels(fields: RegistrationReviewField[]) {
  return fields.map((field) => REVIEW_FIELD_LABELS[field]);
}
