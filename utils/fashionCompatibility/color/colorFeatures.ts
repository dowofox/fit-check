import {
  deltaE2000,
  hueAngleDifference,
} from "@/utils/fashionCompatibility/color/colorMath";
import { buildGarmentColorProfile } from "@/utils/fashionCompatibility/color/colorProfiles";
import {
  COLOR_FEATURE_VERSION,
  type GarmentColorProfile,
  type GarmentColorSwatch,
  type OutfitColorFeatures,
} from "@/utils/fashionCompatibility/color/types";
import type { ClosetItem } from "@/utils/storage";

const ACHROMATIC_CHROMA_LIMIT = 8;
const ACCENT_CHROMA_LIMIT = 45;

type ProfiledItem = {
  id: string;
  profile: GarmentColorProfile;
  dominant?: GarmentColorSwatch;
};

function getDominantSwatch(profile: GarmentColorProfile) {
  return (
    profile.swatches.find((swatch) => swatch.id === profile.dominantSwatchId) ||
    profile.swatches[0]
  );
}

function getRange(values: readonly number[]) {
  return values.length > 0 ? Math.max(...values) - Math.min(...values) : undefined;
}

function average(values: readonly number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
}

function countDistinctDominantColors(items: readonly ProfiledItem[]) {
  const representatives: GarmentColorSwatch[] = [];
  for (const item of items) {
    const swatch = item.dominant;
    if (!swatch?.lab) continue;
    const lab = swatch.lab;
    const alreadyRepresented = representatives.some(
      (representative) =>
        representative.lab && deltaE2000(representative.lab, lab) <= 3
    );
    if (!alreadyRepresented) representatives.push(swatch);
  }
  return representatives.length;
}

export function buildOutfitColorFeatures(
  items: readonly ClosetItem[]
): OutfitColorFeatures {
  const profiledItems: ProfiledItem[] = items.map((item) => {
    const profile = buildGarmentColorProfile(item);
    return { id: item.id, profile, dominant: getDominantSwatch(profile) };
  });
  const swatches = profiledItems.flatMap((item) => item.profile.swatches);
  const lightnessValues = swatches
    .map((swatch) => swatch.lab?.l)
    .filter((value): value is number => value !== undefined);
  const chromaValues = swatches
    .map((swatch) => swatch.lch?.c)
    .filter((value): value is number => value !== undefined);
  const pairwiseDeltaE00: OutfitColorFeatures["pairwiseDeltaE00"] = [];
  let hasSimilarHue = false;
  let hasOpposingHue = false;

  for (let firstIndex = 0; firstIndex < profiledItems.length; firstIndex += 1) {
    const first = profiledItems[firstIndex];
    if (!first.dominant?.lab || !first.dominant.lch) continue;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < profiledItems.length;
      secondIndex += 1
    ) {
      const second = profiledItems[secondIndex];
      if (!second.dominant?.lab || !second.dominant.lch) continue;
      const hueDifference = hueAngleDifference(
        first.dominant.lch.h,
        second.dominant.lch.h
      );
      pairwiseDeltaE00.push({
        itemIdA: first.id,
        itemIdB: second.id,
        deltaE00: deltaE2000(first.dominant.lab, second.dominant.lab),
        lightnessDifference: Math.abs(first.dominant.lab.l - second.dominant.lab.l),
        chromaDifference: Math.abs(first.dominant.lch.c - second.dominant.lch.c),
        hueDifference,
      });
      const bothChromatic =
        first.dominant.lch.c >= ACHROMATIC_CHROMA_LIMIT &&
        second.dominant.lch.c >= ACHROMATIC_CHROMA_LIMIT;
      if (bothChromatic && hueDifference !== undefined) {
        if (hueDifference <= 30) hasSimilarHue = true;
        if (hueDifference >= 150) hasOpposingHue = true;
      }
    }
  }

  const deltaValues = pairwiseDeltaE00.map((pair) => pair.deltaE00);
  const weightedSwatches = profiledItems.flatMap((item) =>
    item.profile.swatches.map((swatch) => ({
      swatch,
      weight: swatch.proportion / Math.max(1, profiledItems.length),
    }))
  );
  const achromaticRatio = weightedSwatches.reduce(
    (sum, entry) =>
      sum +
      ((entry.swatch.lch?.c ?? 0) < ACHROMATIC_CHROMA_LIMIT ? entry.weight : 0),
    0
  );
  const warmRatio = weightedSwatches.reduce((sum, entry) => {
    const { h, c } = entry.swatch.lch || { h: undefined, c: 0 };
    return sum +
      (c >= ACHROMATIC_CHROMA_LIMIT && h !== undefined && (h < 90 || h >= 330)
        ? entry.weight
        : 0);
  }, 0);
  const coolRatio = weightedSwatches.reduce((sum, entry) => {
    const { h, c } = entry.swatch.lch || { h: undefined, c: 0 };
    return sum +
      (c >= ACHROMATIC_CHROMA_LIMIT && h !== undefined && h >= 90 && h < 330
        ? entry.weight
        : 0);
  }, 0);
  const possibleRelations: OutfitColorFeatures["possibleRelations"] = [];
  if (achromaticRatio >= 0.8) possibleRelations.push("achromatic");
  if (deltaValues.length > 0 && Math.max(...deltaValues) <= 12) {
    possibleRelations.push("low-contrast");
  }
  if (pairwiseDeltaE00.some((pair) => pair.lightnessDifference >= 45)) {
    possibleRelations.push("high-lightness-contrast");
  }
  if (hasSimilarHue) possibleRelations.push("similar-hue");
  if (hasOpposingHue) possibleRelations.push("opposing-hue");
  if (warmRatio > 0 && coolRatio > 0) possibleRelations.push("mixed-temperature");

  const warnings = new Set<string>();
  if (profiledItems.some((item) => item.profile.usedFallback)) {
    warnings.add("named-color-fallback");
  }
  if (
    profiledItems.some(
      (item) => (item.profile.diagnostics?.unresolvedLabels?.length ?? 0) > 0
    )
  ) {
    warnings.add("unresolved-color-label");
  }
  if (
    profiledItems.some((item) => item.profile.diagnostics?.assumedEqualProportions)
  ) {
    warnings.add("equal-proportion-assumption");
  }
  const confidence =
    average(profiledItems.map((item) => item.profile.confidence)) ?? 0;
  if (confidence < 0.5) warnings.add("low-color-confidence");

  return {
    version: COLOR_FEATURE_VERSION,
    itemCount: items.length,
    swatchCount: swatches.length,
    averageLightness: average(lightnessValues),
    lightnessRange: getRange(lightnessValues),
    averageChroma: average(chromaValues),
    chromaRange: getRange(chromaValues),
    pairwiseDeltaE00,
    minDeltaE00: deltaValues.length > 0 ? Math.min(...deltaValues) : undefined,
    maxDeltaE00: deltaValues.length > 0 ? Math.max(...deltaValues) : undefined,
    meanDeltaE00: average(deltaValues),
    dominantColorCount: countDistinctDominantColors(profiledItems),
    accentCandidateCount: profiledItems.filter(
      (item) => (item.dominant?.lch?.c ?? 0) >= ACCENT_CHROMA_LIMIT
    ).length,
    achromaticRatio,
    warmRatio,
    coolRatio,
    possibleRelations,
    confidence,
    usedFallback: profiledItems.some((item) => item.profile.usedFallback),
    warnings: [...warnings],
  };
}
