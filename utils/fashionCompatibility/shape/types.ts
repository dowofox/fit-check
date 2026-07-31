export const SHAPE_PROFILE_VERSION = "shape-profile-v1" as const;
export const SHAPE_FEATURE_VERSION = "shape-features-v1" as const;
export const PERSONAL_FIT_FEATURE_VERSION = "personal-fit-features-v1" as const;

export type MeasurementSemantics =
  | "flat_width"
  | "circumference"
  | "linear_length"
  | "ratio"
  | "categorical_estimate"
  | "unknown";

export type ShapeMeasurementSource =
  | "official_product"
  | "user_confirmed"
  | "reference_clothing"
  | "image_analysis"
  | "text_inference";

export type ShapeMeasurementValue = {
  value: number;
  unit: "cm" | "ratio" | "score";
  semantics: MeasurementSemantics;
  source: ShapeMeasurementSource;
  confidence: number;
};

export type ShapeMeasurementKey =
  | "totalLength"
  | "shoulder"
  | "chest"
  | "sleeve"
  | "waist"
  | "hip"
  | "thigh"
  | "rise"
  | "hem"
  | "footLength";

export type ShapeMeasurements = Partial<
  Record<ShapeMeasurementKey, ShapeMeasurementValue>
>;

export type ShapeProfileSource =
  | "official_measurement"
  | "user_confirmed_label"
  | "reference_clothing"
  | "image_impression"
  | "style_profile"
  | "text_inference"
  | "unknown";

export type ShapeSilhouetteClass =
  | "slim"
  | "regular"
  | "semi_oversized"
  | "oversized"
  | "wide"
  | "cropped"
  | "long"
  | "unknown";

export type ShapeLengthClass = "short" | "regular" | "long" | "unknown";

export type GarmentShapeProfile = {
  version: typeof SHAPE_PROFILE_VERSION;
  itemId: string;
  category: string;
  silhouetteClass: ShapeSilhouetteClass;
  lengthClass: ShapeLengthClass;
  volume?: number;
  visualWeight?: number;
  structure?: number;
  drape?: number;
  stiffness?: number;
  pointLevel?: number;
  measurements: ShapeMeasurements;
  derived: {
    lengthToHeightRatio?: number;
    widthToLengthRatio?: number;
    shoulderToLengthRatio?: number;
    hemToThighRatio?: number;
    riseToLengthRatio?: number;
  };
  source: ShapeProfileSource;
  confidence: number;
  usedFallback: boolean;
  diagnostics: {
    unavailableFields: string[];
    ambiguousMeasurementSemantics: string[];
    conflictingSources: string[];
  };
};

export type OutfitShapeFeatures = {
  version: typeof SHAPE_FEATURE_VERSION;
  itemCount: number;
  layerCount: number;
  topBottomVolumeDifference?: number;
  topBottomLengthRelation?:
    | "short-top-long-bottom"
    | "long-top-long-bottom"
    | "similar-length"
    | "unknown";
  upperVisualWeight?: number;
  lowerVisualWeight?: number;
  visualWeightDifference?: number;
  visualWeightCenter?: "upper" | "balanced" | "lower" | "unknown";
  structureDifference?: number;
  drapeDifference?: number;
  outerDominance?: number;
  layeringDepth?: number;
  availableMeasurementRatio: number;
  profileConfidence: number;
  usedFallback: boolean;
  observedRelations: Array<
    | "low-volume-difference"
    | "high-volume-difference"
    | "short-top-long-bottom"
    | "long-top-long-bottom"
    | "high-structure-pair"
    | "mixed-structure"
    | "mixed-drape"
    | "upper-heavy"
    | "lower-heavy"
    | "outer-dominant"
  >;
  warnings: string[];
};

export type PersonalFitFeatures = {
  version: typeof PERSONAL_FIT_FEATURE_VERSION;
  comparableMeasurements: string[];
  chestEaseCm?: number;
  waistEaseCm?: number;
  hipEaseCm?: number;
  shoulderDifferenceCm?: number;
  sleeveDifferenceCm?: number;
  inseamDifferenceCm?: number;
  totalLengthDifferenceCm?: number;
  referenceClothingDifferences?: Record<string, number>;
  confidence: number;
  usedFallback: boolean;
  unavailableReasons: string[];
  semanticMismatches: string[];
};

export type LegacyShapeResult = {
  silhouetteScore: number;
  wearFitScore: number;
  pointBalanceScore: number;
  appliedRuleIds: string[];
};

export type ShapeShadowComparison = {
  mode: "legacy-only" | "shadow";
  legacy: LegacyShapeResult;
  professional?: {
    score?: number;
    confidence: number;
    shapeProfileVersion: typeof SHAPE_PROFILE_VERSION;
    shapeFeatureVersion: typeof SHAPE_FEATURE_VERSION;
    outfitFeatures: OutfitShapeFeatures;
    personalFitFeatures?: PersonalFitFeatures;
  };
  scoreDifference?: number;
  disagreementReasons: string[];
};
