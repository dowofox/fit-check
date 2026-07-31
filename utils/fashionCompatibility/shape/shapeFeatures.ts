import { buildGarmentShapeProfile } from "@/utils/fashionCompatibility/shape/shapeProfiles";
import {
  SHAPE_FEATURE_VERSION,
  type GarmentShapeProfile,
  type OutfitShapeFeatures,
  type ShapeMeasurementKey,
} from "@/utils/fashionCompatibility/shape/types";
import type { ClosetItem } from "@/utils/storage";

const EXPECTED_MEASUREMENTS: Readonly<Record<string, ShapeMeasurementKey[]>> = {
  "상의": ["totalLength", "shoulder", "chest", "sleeve"],
  "아우터": ["totalLength", "shoulder", "chest", "sleeve"],
  "하의": ["totalLength", "waist", "hip", "thigh", "rise", "hem"],
  "신발": ["footLength"],
};

function average(values: Array<number | undefined>) {
  const available = values.filter((value): value is number => value !== undefined);
  return available.length > 0
    ? available.reduce((sum, value) => sum + value, 0) / available.length
    : undefined;
}

function getLengthRelation(
  top: GarmentShapeProfile | undefined,
  bottom: GarmentShapeProfile | undefined
): OutfitShapeFeatures["topBottomLengthRelation"] {
  if (!top || !bottom) return "unknown";
  if (top.lengthClass === "short" && bottom.lengthClass === "long") {
    return "short-top-long-bottom";
  }
  if (top.lengthClass === "long" && bottom.lengthClass === "long") {
    return "long-top-long-bottom";
  }
  if (
    top.lengthClass !== "unknown" &&
    top.lengthClass === bottom.lengthClass
  ) {
    return "similar-length";
  }
  return "unknown";
}

function getMeasurementCoverage(profiles: readonly GarmentShapeProfile[]) {
  let available = 0;
  let expected = 0;
  for (const profile of profiles) {
    const keys = EXPECTED_MEASUREMENTS[profile.category] || [];
    expected += keys.length;
    available += keys.filter((key) => profile.measurements[key]).length;
  }
  return expected > 0 ? available / expected : 0;
}

export function buildOutfitShapeFeatures(
  items: readonly ClosetItem[],
  preparedProfiles?: readonly GarmentShapeProfile[]
): OutfitShapeFeatures {
  const profiles = preparedProfiles || items.map((item) => buildGarmentShapeProfile(item));
  const top = profiles.find((profile) => profile.category === "상의");
  const bottom = profiles.find((profile) => profile.category === "하의");
  const outers = profiles.filter((profile) => profile.category === "아우터");
  const shoes = profiles.filter((profile) => profile.category === "신발");
  const topBottomVolumeDifference =
    top?.volume !== undefined && bottom?.volume !== undefined
      ? top.volume - bottom.volume
      : undefined;
  const upperVisualWeight = average([
    top?.visualWeight,
    ...outers.map((profile) => profile.visualWeight),
  ]);
  const lowerVisualWeight = average([
    bottom?.visualWeight,
    ...shoes.map((profile) => profile.visualWeight),
  ]);
  const visualWeightDifference =
    upperVisualWeight !== undefined && lowerVisualWeight !== undefined
      ? upperVisualWeight - lowerVisualWeight
      : undefined;
  const visualWeightCenter =
    visualWeightDifference === undefined
      ? "unknown"
      : visualWeightDifference > 1
        ? "upper"
        : visualWeightDifference < -1
          ? "lower"
          : "balanced";
  const structureDifference =
    top?.structure !== undefined && bottom?.structure !== undefined
      ? Math.abs(top.structure - bottom.structure)
      : undefined;
  const drapeDifference =
    top?.drape !== undefined && bottom?.drape !== undefined
      ? Math.abs(top.drape - bottom.drape)
      : undefined;
  const outerWeight = average(outers.map((profile) => profile.visualWeight));
  const baseWeight = average([top?.visualWeight, bottom?.visualWeight]);
  const outerDominance =
    outerWeight !== undefined && baseWeight !== undefined
      ? outerWeight - baseWeight
      : undefined;
  const topBottomLengthRelation = getLengthRelation(top, bottom);
  const observedRelations: OutfitShapeFeatures["observedRelations"] = [];

  if (topBottomVolumeDifference !== undefined) {
    if (Math.abs(topBottomVolumeDifference) <= 2) {
      observedRelations.push("low-volume-difference");
    } else if (Math.abs(topBottomVolumeDifference) >= 5) {
      observedRelations.push("high-volume-difference");
    }
  }
  if (topBottomLengthRelation === "short-top-long-bottom") {
    observedRelations.push("short-top-long-bottom");
  }
  if (topBottomLengthRelation === "long-top-long-bottom") {
    observedRelations.push("long-top-long-bottom");
  }
  if ((top?.structure ?? 0) >= 7 && (bottom?.structure ?? 0) >= 7) {
    observedRelations.push("high-structure-pair");
  }
  if ((structureDifference ?? 0) >= 4) observedRelations.push("mixed-structure");
  if ((drapeDifference ?? 0) >= 4) observedRelations.push("mixed-drape");
  if (visualWeightCenter === "upper") observedRelations.push("upper-heavy");
  if (visualWeightCenter === "lower") observedRelations.push("lower-heavy");
  if ((outerDominance ?? 0) >= 2) observedRelations.push("outer-dominant");

  const warnings = new Set<string>();
  if (!top || !bottom) warnings.add("core-shape-profile-unavailable");
  if (profiles.some((profile) => profile.usedFallback)) {
    warnings.add("shape-profile-fallback-used");
  }
  const availableMeasurementRatio = getMeasurementCoverage(profiles);
  if (availableMeasurementRatio < 0.5) warnings.add("low-measurement-coverage");

  return Object.freeze({
    version: SHAPE_FEATURE_VERSION,
    itemCount: items.length,
    layerCount: Number(Boolean(top)) + outers.length,
    topBottomVolumeDifference,
    topBottomLengthRelation,
    upperVisualWeight,
    lowerVisualWeight,
    visualWeightDifference,
    visualWeightCenter,
    structureDifference,
    drapeDifference,
    outerDominance,
    layeringDepth: Number(Boolean(top)) + outers.length,
    availableMeasurementRatio,
    profileConfidence: average(profiles.map((profile) => profile.confidence)) ?? 0,
    usedFallback: profiles.some((profile) => profile.usedFallback),
    observedRelations: Object.freeze(observedRelations) as OutfitShapeFeatures["observedRelations"],
    warnings: Object.freeze([...warnings]) as string[],
  });
}
