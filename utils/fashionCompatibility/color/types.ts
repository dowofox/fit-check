export const COLOR_PROFILE_VERSION = "color-profile-v1" as const;
export const COLOR_FEATURE_VERSION = "color-features-v1" as const;

export type ColorProfileSource =
  | "user_confirmed"
  | "official_product"
  | "image_palette"
  | "ai_color_name"
  | "legacy_color_name"
  | "unknown";

export type SrgbColor = { r: number; g: number; b: number };
export type XyzColor = { x: number; y: number; z: number };
export type LabColor = { l: number; a: number; b: number };
export type LchColor = { l: number; c: number; h?: number };

export type GarmentColorSwatch = {
  id: string;
  canonicalName?: string;
  srgb?: SrgbColor;
  lab?: LabColor;
  lch?: LchColor;
  proportion: number;
  confidence: number;
  source: ColorProfileSource;
  originalLabel?: string;
};

export type GarmentColorProfile = {
  version: typeof COLOR_PROFILE_VERSION;
  swatches: GarmentColorSwatch[];
  dominantSwatchId?: string;
  averageLightness?: number;
  averageChroma?: number;
  colorTemperature: "warm" | "cool" | "neutral" | "mixed" | "unknown";
  paletteType:
    | "monochrome"
    | "achromatic"
    | "limited"
    | "multicolor"
    | "unknown";
  patternComplexity?: number;
  source: ColorProfileSource;
  confidence: number;
  usedFallback: boolean;
  diagnostics?: {
    unresolvedLabels?: string[];
    assumedEqualProportions?: boolean;
    imagePaletteUnavailable?: boolean;
  };
};

export type NamedColorRecord = {
  canonicalName: string;
  aliases: string[];
  representativeSrgb: SrgbColor;
  confidence: number;
  notes: string[];
};

export type OutfitColorFeatures = {
  version: typeof COLOR_FEATURE_VERSION;
  itemCount: number;
  swatchCount: number;
  averageLightness?: number;
  lightnessRange?: number;
  averageChroma?: number;
  chromaRange?: number;
  pairwiseDeltaE00: Array<{
    itemIdA: string;
    itemIdB: string;
    deltaE00: number;
    lightnessDifference: number;
    chromaDifference: number;
    hueDifference?: number;
  }>;
  minDeltaE00?: number;
  maxDeltaE00?: number;
  meanDeltaE00?: number;
  dominantColorCount: number;
  accentCandidateCount: number;
  achromaticRatio: number;
  warmRatio: number;
  coolRatio: number;
  possibleRelations: Array<
    | "achromatic"
    | "low-contrast"
    | "high-lightness-contrast"
    | "similar-hue"
    | "opposing-hue"
    | "mixed-temperature"
  >;
  confidence: number;
  usedFallback: boolean;
  warnings: string[];
};

export type LegacyColorResult = {
  score: number;
  maxScore: number;
  appliedRuleIds: string[];
};

export type ColorShadowComparison = {
  mode: "legacy-only" | "shadow";
  legacy: LegacyColorResult;
  professional?: {
    score?: number;
    confidence: number;
    featureVersion: typeof COLOR_FEATURE_VERSION;
    profileVersion: typeof COLOR_PROFILE_VERSION;
    features: OutfitColorFeatures;
  };
  scoreDifference?: number;
  disagreementReasons: string[];
};
