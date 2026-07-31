import { labToLch, srgbToLabD65 } from "@/utils/fashionCompatibility/color/colorMath";
import {
  getNamedColorRecord,
  normalizeColorAlias,
} from "@/utils/fashionCompatibility/color/namedColorCatalog";
import {
  COLOR_PROFILE_VERSION,
  type ColorProfileSource,
  type GarmentColorProfile,
  type GarmentColorSwatch,
  type NamedColorRecord,
} from "@/utils/fashionCompatibility/color/types";
import type { ClosetItem } from "@/utils/storage";

const ACHROMATIC_CHROMA_LIMIT = 8;
const MAX_PROFILE_SWATCHES = 5;

type ColorInput = string | readonly string[] | undefined;
export type ColorProfileBuildOptions = { proportions?: readonly number[] };

function hasColorInput(input: ColorInput) {
  return Array.isArray(input)
    ? input.some((value) => typeof value === "string" && value.trim())
    : typeof input === "string" && Boolean(input.trim());
}

function splitColorLabels(input: ColorInput) {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return values
    .flatMap((value) => value.split(/[,/+&·]|\s+(?:및|and)\s+/i))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getHexColorRecord(label: string): NamedColorRecord | undefined {
  const match = label.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return undefined;
  const digits =
    match[1].length === 3
      ? [...match[1]].map((value) => value + value).join("")
      : match[1];
  return {
    canonicalName: `#${digits.toUpperCase()}`,
    aliases: [label],
    representativeSrgb: {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
    },
    confidence: 0.9,
    notes: ["명시적인 sRGB hex 색상 코드입니다."],
  };
}

function getColorInput(item: ClosetItem): {
  input: ColorInput;
  source: ColorProfileSource;
} {
  const itemColor = item.color as unknown as ColorInput;
  if (
    item.userEditedClassificationFields?.includes("color") &&
    hasColorInput(itemColor)
  ) {
    return { input: itemColor, source: "user_confirmed" };
  }
  if (item.confirmedProduct?.productColor?.trim()) {
    return {
      input: item.confirmedProduct.productColor,
      source: "official_product",
    };
  }
  if (hasColorInput(itemColor)) {
    const analyzedByAi =
      item.confidence?.color !== undefined ||
      item.photoAnalysisVersion !== undefined ||
      item.lastAnalyzedAt !== undefined;
    return {
      input: itemColor,
      source: analyzedByAi ? "ai_color_name" : "legacy_color_name",
    };
  }
  const profileColors = [
    item.styleProfile?.mainColor,
    ...(item.styleProfile?.subColors || []),
  ].filter((value): value is string => Boolean(value?.trim()));
  return {
    input: profileColors,
    source: profileColors.length > 0 ? "ai_color_name" : "unknown",
  };
}

export function normalizeColorProportions(
  proportions: readonly number[] | undefined,
  swatchCount: number
) {
  if (swatchCount <= 0) return { values: [] as number[], usedFallback: false };
  const valid =
    proportions?.length === swatchCount &&
    proportions.every((value) => Number.isFinite(value) && value >= 0);
  const total = valid
    ? proportions.reduce((sum, value) => sum + value, 0)
    : 0;
  if (!valid || total <= 0) {
    return {
      values: Array.from({ length: swatchCount }, () => 1 / swatchCount),
      usedFallback: true,
    };
  }
  return {
    values: proportions.map((value) => value / total),
    usedFallback: false,
  };
}

function getTemperature(swatches: readonly GarmentColorSwatch[]) {
  const chromatic = swatches.filter(
    (swatch) => (swatch.lch?.c ?? 0) >= ACHROMATIC_CHROMA_LIMIT
  );
  if (swatches.length === 0) return "unknown" as const;
  if (chromatic.length === 0) return "neutral" as const;
  let warm = false;
  let cool = false;
  for (const swatch of chromatic) {
    const hue = swatch.lch?.h;
    if (hue === undefined) continue;
    if (hue < 90 || hue >= 330) warm = true;
    else cool = true;
  }
  if (warm && cool) return "mixed" as const;
  return warm ? ("warm" as const) : ("cool" as const);
}

function getPaletteType(swatches: readonly GarmentColorSwatch[]) {
  if (swatches.length === 0) return "unknown" as const;
  if (swatches.every((swatch) => (swatch.lch?.c ?? 0) < ACHROMATIC_CHROMA_LIMIT)) {
    return "achromatic" as const;
  }
  const hues = swatches
    .map((swatch) => swatch.lch?.h)
    .filter((hue): hue is number => hue !== undefined);
  if (hues.length > 1) {
    const sorted = [...hues].sort((a, b) => a - b);
    const gaps = sorted.map((hue, index) => {
      const next = sorted[(index + 1) % sorted.length];
      return index === sorted.length - 1 ? next + 360 - hue : next - hue;
    });
    const circularRange = 360 - Math.max(...gaps);
    if (circularRange <= 20) return "monochrome" as const;
  }
  return swatches.length <= 2 ? ("limited" as const) : ("multicolor" as const);
}

function freezeProfile(profile: GarmentColorProfile) {
  Object.freeze(profile.swatches);
  if (profile.diagnostics?.unresolvedLabels) {
    Object.freeze(profile.diagnostics.unresolvedLabels);
  }
  if (profile.diagnostics) Object.freeze(profile.diagnostics);
  return Object.freeze(profile);
}

export function buildGarmentColorProfile(
  item: ClosetItem,
  options: ColorProfileBuildOptions = {}
): GarmentColorProfile {
  const { input, source } = getColorInput(item);
  const labels = splitColorLabels(input);
  const unresolvedLabels: string[] = [];
  const seen = new Set<string>();
  const resolved: Array<{
    label: string;
    record: NamedColorRecord;
    usedFallback: boolean;
  }> = [];

  for (const label of labels) {
    const namedRecord = getNamedColorRecord(label);
    const record = namedRecord || getHexColorRecord(label);
    if (!record) {
      const normalized = normalizeColorAlias(label);
      if (!unresolvedLabels.some((value) => normalizeColorAlias(value) === normalized)) {
        unresolvedLabels.push(label);
      }
      continue;
    }
    if (seen.has(record.canonicalName)) continue;
    seen.add(record.canonicalName);
    resolved.push({ label, record, usedFallback: Boolean(namedRecord) });
    if (resolved.length === MAX_PROFILE_SWATCHES) break;
  }

  const normalizedProportions = normalizeColorProportions(
    options.proportions,
    resolved.length
  );
  const swatches = resolved.map(({ label, record }, index): GarmentColorSwatch => {
    const lab = srgbToLabD65(record.representativeSrgb);
    return Object.freeze({
      id: `${normalizeColorAlias(record.canonicalName)}-${index + 1}`,
      canonicalName: record.canonicalName,
      srgb: record.representativeSrgb,
      lab: Object.freeze(lab),
      lch: Object.freeze(labToLch(lab)),
      proportion: normalizedProportions.values[index],
      confidence: record.confidence,
      source,
      originalLabel: label,
    });
  });
  const totalConfidence = swatches.reduce(
    (sum, swatch) => sum + swatch.confidence * swatch.proportion,
    0
  );
  const averageLightness = swatches.reduce(
    (sum, swatch) => sum + (swatch.lab?.l ?? 0) * swatch.proportion,
    0
  );
  const averageChroma = swatches.reduce(
    (sum, swatch) => sum + (swatch.lch?.c ?? 0) * swatch.proportion,
    0
  );

  return freezeProfile({
    version: COLOR_PROFILE_VERSION,
    swatches,
    dominantSwatchId: swatches.reduce<GarmentColorSwatch | undefined>(
      (dominant, swatch) =>
        !dominant || swatch.proportion > dominant.proportion ? swatch : dominant,
      undefined
    )?.id,
    averageLightness: swatches.length > 0 ? averageLightness : undefined,
    averageChroma: swatches.length > 0 ? averageChroma : undefined,
    colorTemperature: getTemperature(swatches),
    paletteType: getPaletteType(swatches),
    source,
    confidence: totalConfidence,
    usedFallback: resolved.some((entry) => entry.usedFallback),
    diagnostics: {
      unresolvedLabels: unresolvedLabels.length > 0 ? unresolvedLabels : undefined,
      assumedEqualProportions:
        swatches.length > 0 ? normalizedProportions.usedFallback : undefined,
      imagePaletteUnavailable: true,
    },
  });
}
