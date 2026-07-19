import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildClosetRecommendationIndex,
  CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY,
  getRecommendationRevisionKey,
  HOME_RECOMMENDATION_CACHE_STORAGE_KEY,
  incrementRecommendationRevisions,
  parseClosetRecommendationIndex,
  parseRecommendationRevisionState,
  RECOMMENDATION_REVISIONS_STORAGE_KEY,
  type ClosetRecommendationIndex,
  type RecommendationRevisionField,
  type RecommendationRevisionState,
} from "@/utils/homeRecommendationIndex";
import { endPerformanceTimer, startPerformanceTimer } from "@/utils/performance";
import {
  getOutfitFeedbackKey,
  normalizeOutfitRecommendationFeedbacks,
  type OutfitFeedbackValue,
  type OutfitRecommendationFeedback,
} from "@/utils/outfitFeedback";
import {
  getLocalDateKey,
  getOutfitWearItemKey,
  normalizeOutfitWearRecords,
  type OutfitWearRecord,
  wasOutfitWornOnDate,
} from "@/utils/outfitWear";

const STORAGE_KEY = "analysis_history";
const PROFILE_KEY = "naes_profile";
const CLOSET_KEY = "naes_closet";
const SAVED_OUTFITS_KEY = "naes_saved_outfits";
const OUTFIT_FEEDBACK_KEY = "naes_outfit_recommendation_feedback";
const OUTFIT_WEAR_RECORDS_KEY = "naes_outfit_wear_records";
const BACKUP_RESTORE_STORAGE_KEYS = [
  CLOSET_KEY,
  CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY,
  RECOMMENDATION_REVISIONS_STORAGE_KEY,
  PROFILE_KEY,
  SAVED_OUTFITS_KEY,
  OUTFIT_FEEDBACK_KEY,
  OUTFIT_WEAR_RECORDS_KEY,
  HOME_RECOMMENDATION_CACHE_STORAGE_KEY,
];
let recommendationDataMutationQueue: Promise<void> = Promise.resolve();
let analysisHistoryMutationQueue: Promise<void> = Promise.resolve();

function runRecommendationDataMutation<T>(
  operation: () => Promise<T>
): Promise<T> {
  const result = recommendationDataMutationQueue.then(operation, operation);
  recommendationDataMutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function runClosetMutation<T>(operation: () => Promise<T>): Promise<T> {
  return runRecommendationDataMutation(operation);
}

function runSavedOutfitMutation<T>(operation: () => Promise<T>): Promise<T> {
  return runRecommendationDataMutation(operation);
}

function runFeedbackMutation<T>(operation: () => Promise<T>): Promise<T> {
  return runRecommendationDataMutation(operation);
}

function runAnalysisHistoryMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = analysisHistoryMutationQueue.then(operation, operation);
  analysisHistoryMutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export type { OutfitFeedbackValue, OutfitRecommendationFeedback };
export type { OutfitWearRecord };

export type ReferenceClothing = {
  topItemId?: string;
  bottomItemId?: string;
  outerItemId?: string;
  shoesItemId?: string;
};

export type UserProfile = {
  gender?: string;
  age?: string;
  height?: string;
  weight?: string;
  bodyType?: string;
  topSize?: string;
  bottomSize?: string;
  shoeSize?: string;
  shoulderWidth?: string;
  chestCircumference?: string;
  waistCircumference?: string;
  hipCircumference?: string;
  armLength?: string;
  inseam?: string;
  thighCircumference?: string;
  preferredPantsTotalLength?: number;
  referenceClothing?: ReferenceClothing;
};

export type ProductCandidate = {
  brand: string;
  productName: string;
  reason: string;
  confidence?: number;
};

export type ProductSizeMeasurement = {
  size: string;
  rawSize?: string;
  displaySize?: string;
  numericRange?: {
    min: number;
    max: number;
  };
  totalLength?: number;
  shoulder?: number;
  chest?: number;
  sleeve?: number;
  waist?: number;
  hip?: number;
  thigh?: number;
  rise?: number;
  hem?: number;
  footLength?: number;
};

export type ProductSizeGuide = {
  unit?: "cm";
  sizes: ProductSizeMeasurement[];
};

export type MaterialSection = "outer" | "lining" | "filling" | "trim";

export type MaterialComposition = {
  summary?: string;
  items?: {
    name: string;
    percentage?: number | null;
    section?: MaterialSection;
  }[];
  source?: string;
};

export type ConfirmedProduct = {
  brand: string;
  productName: string;
  productCategory?: string;
  productColor?: string;
  productUrl?: string;
  productImageUrl?: string;
  productSizeGuide?: ProductSizeGuide;
  materialComposition?: MaterialComposition;
  mallName?: string;
  price?: string;
  confirmedAt: string;
};

export type StyleProfile = {
  subCategory?: string;
  fit?: string;
  silhouette?: string;
  formality?: string;
  mood?: string[];
  usage?: string[];
  neckline?: string;
  sleeveLength?: string;
  lengthType?: string;
  mainColor?: string;
  subColors?: string[];
  matchColors?: string[];
  avoidColors?: string[];
  recommendedPairings?: string[];
  avoidPairings?: string[];
  temperatureRange?: {
    min?: number;
    max?: number;
  };
};

export type GarmentProfile = {
  // Photo-based visual estimates only. Do not treat these values as a user's actual fit.
  silhouette?: "slim" | "regular" | "semiOversized" | "oversized" | "wide" | "cropped" | "long";
  volume?: number;
  visualWeight?: number;
  lengthBalance?: "short" | "regular" | "long";
  fitIntent?: "trueToSize" | "relaxed" | "oversized" | "structured";
  pointLevel?: number;
  structure?: "soft" | "normal" | "stiff";
  drape?: "low" | "medium" | "high";
};

export type FitMeasurements = {
  shoulder?: number;
  chest?: number;
  sleeve?: number;
  waist?: number;
  hip?: number;
  thigh?: number;
  rise?: number;
  inseam?: number;
  totalLength?: number;
  footLength?: number;
};

export type FitAnalysisProfile = {
  sourceSize: string;
  userMeasurements?: FitMeasurements;
  garmentMeasurements?: FitMeasurements;
  fitResult?: "small" | "fitted" | "comfortable" | "relaxed" | "oversized" | "unknown";
};

export type AnalysisConfidence = {
  category?: number;
  color?: number;
  season?: number;
  style?: number;
  fit?: number;
  brand?: number;
  product?: number;
};

export type AnalysisQuality = {
  imageQuality?: "good" | "dark" | "blurred" | "folded" | "partial";
  needsMorePhotos?: boolean;
  missingHints?: string[];
};

export type SeasonSource = "user" | "official_product" | "rule" | "photo_ai";

export type SeasonInferenceResult = {
  seasons: string[];
  source: SeasonSource;
  needsReview: boolean;
  reasons?: string[];
};

export function pruneReferenceClothing(
  referenceClothing: ReferenceClothing | undefined,
  closetItems: ClosetItem[]
) {
  const expectedCategoryByKey: Record<keyof ReferenceClothing, string> = {
    topItemId: "상의",
    bottomItemId: "하의",
    outerItemId: "아우터",
    shoesItemId: "신발",
  };
  const closetItemsById = new Map(closetItems.map((item) => [item.id, item]));
  const nextReferenceClothing: ReferenceClothing = {};

  (Object.entries(referenceClothing || {}) as [keyof ReferenceClothing, string][]).forEach(
    ([key, itemId]) => {
      const closetItem = itemId ? closetItemsById.get(itemId) : undefined;
      if (closetItem?.category === expectedCategoryByKey[key]) {
        nextReferenceClothing[key] = itemId;
      }
    }
  );

  return nextReferenceClothing;
}

export type ProductClassificationField =
  | "category"
  | "subCategory"
  | "detailCategory"
  | "color"
  | "material"
  | "styleTags"
  | "season";

export type ClosetItem = {
  id: string;
  imageUri: string;
  cleanImageUri?: string;
  category: string;
  subCategory?: string;
  detailCategory?: string;
  color?: string;
  style?: string;
  styleTags?: string[];
  season?: string;
  seasons?: string[];
  seasonSource?: SeasonSource;
  seasonNeedsReview?: boolean;
  fit?: string;
  size?: string;
  intendedFit?: string;
  brand?: string;
  brandConfidence?: number;
  confirmedBrand?: string | null;
  inferredBrand?: string;
  inferredProductName?: string;
  logoDetected?: boolean;
  logoText?: string;
  graphicDetected?: boolean;
  graphicType?: string;
  graphicSize?: string;
  material?: string;
  pattern?: string;
  productCandidates?: ProductCandidate[];
  selectedProductCandidate?: ProductCandidate;
  confirmedProduct?: ConfirmedProduct;
  styleProfile?: StyleProfile;
  garmentProfile?: GarmentProfile;
  confidence?: AnalysisConfidence;
  analysisWarnings?: string[];
  analysisQuality?: AnalysisQuality;
  description?: string;
  matchTip?: string;
  avoidTip?: string;
  wearCount?: number;
  lastWornAt?: string;
  recommendationPreference?: "normal" | "prefer" | "less";
  isArchived?: boolean;
  userEditedClassificationFields?: ProductClassificationField[];
  createdAt: string;
};

export function isClosetItemAvailableForRecommendation(item: ClosetItem) {
  return item.isArchived !== true;
}

export function getDisplayImageUris(item: ClosetItem) {
  return Array.from(
    new Set(
      [item.cleanImageUri, item.confirmedProduct?.productImageUrl, item.imageUri]
        .map((uri) => uri?.trim())
        .filter((uri): uri is string => Boolean(uri))
    )
  );
}

export function getDisplayImageUri(item: ClosetItem) {
  return getDisplayImageUris(item)[0];
}

export type SavedOutfit = {
  id: string;
  name?: string;
  memo?: string;
  itemIds: string[];
  score: number;
  grade: string;
  reasons: string[];
  warnings: string[];
  createdAt: string;
};

export function createSavedOutfitId(
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

export type SaveOutfitResult = {
  status: "saved" | "duplicate" | "failed";
  outfits: SavedOutfit[];
};

export type NaesBackupDataSnapshot = {
  closetItems: ClosetItem[];
  profile: UserProfile | null;
  savedOutfits: SavedOutfit[];
  outfitFeedbacks: OutfitRecommendationFeedback[];
  wearRecords: OutfitWearRecord[];
};

function isStoredRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStoredJson(rawValue: string | null): unknown {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function isStoredClosetItem(value: unknown): value is ClosetItem {
  if (!isStoredRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    Boolean(value.id) &&
    typeof value.imageUri === "string" &&
    typeof value.category === "string" &&
    Boolean(value.category) &&
    typeof value.createdAt === "string" &&
    Boolean(value.createdAt)
  );
}

export type ClosetItemsLoadResult = {
  status: "loaded" | "failed";
  items: ClosetItem[];
};

function parseStoredClosetItemsLoadResult(
  rawValue: string | null
): ClosetItemsLoadResult {
  if (rawValue === null) return { status: "loaded", items: [] };

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return { status: "failed", items: [] };
    }

    return {
      status: "loaded",
      items: parsedValue.filter(isStoredClosetItem),
    };
  } catch {
    return { status: "failed", items: [] };
  }
}

function parseStoredClosetItemsForMutation(rawValue: string | null) {
  if (!rawValue) return [];

  const parsedValue = JSON.parse(rawValue) as unknown;
  if (!Array.isArray(parsedValue) || !parsedValue.every(isStoredClosetItem)) {
    throw new Error("Stored closet data is invalid");
  }

  return parsedValue;
}

async function getClosetItemsForMutation() {
  const rawCloset = await AsyncStorage.getItem(CLOSET_KEY);
  return parseStoredClosetItemsForMutation(rawCloset);
}

function isStoredSavedOutfit(value: unknown): value is SavedOutfit {
  if (!isStoredRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    Boolean(value.id) &&
    Array.isArray(value.itemIds) &&
    value.itemIds.every((itemId) => typeof itemId === "string") &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    typeof value.grade === "string" &&
    Array.isArray(value.reasons) &&
    value.reasons.every((reason) => typeof reason === "string") &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string") &&
    typeof value.createdAt === "string" &&
    Boolean(value.createdAt)
  );
}

function parseStoredSavedOutfits(rawValue: string | null) {
  const parsedValue = parseStoredJson(rawValue);
  return Array.isArray(parsedValue) ? parsedValue.filter(isStoredSavedOutfit) : [];
}

export type SavedOutfitsLoadResult = {
  status: "loaded" | "failed";
  outfits: SavedOutfit[];
};

function parseStoredSavedOutfitsLoadResult(
  rawValue: string | null
): SavedOutfitsLoadResult {
  if (rawValue === null) return { status: "loaded", outfits: [] };

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return { status: "failed", outfits: [] };
    }

    return {
      status: "loaded",
      outfits: parsedValue.filter(isStoredSavedOutfit),
    };
  } catch {
    return { status: "failed", outfits: [] };
  }
}

function parseStoredSavedOutfitsForMutation(rawValue: string | null) {
  if (!rawValue) return [];

  const parsedValue = JSON.parse(rawValue) as unknown;
  if (!Array.isArray(parsedValue) || !parsedValue.every(isStoredSavedOutfit)) {
    throw new Error("Stored saved outfit data is invalid");
  }

  return parsedValue;
}

function parseStoredFeedbacksForMutation(rawValue: string | null) {
  if (!rawValue) return [];

  const parsedValue = JSON.parse(rawValue) as unknown;
  if (
    !Array.isArray(parsedValue) ||
    !parsedValue.every((candidate) => {
      if (!isStoredRecord(candidate)) return false;

      return (
        Array.isArray(candidate.itemIds) &&
        candidate.itemIds.every((itemId) => typeof itemId === "string") &&
        Boolean(getOutfitFeedbackKey(candidate.itemIds as string[])) &&
        (candidate.value === "like" || candidate.value === "less") &&
        typeof candidate.updatedAt === "string" &&
        Boolean(candidate.updatedAt)
      );
    })
  ) {
    throw new Error("Stored outfit feedback data is invalid");
  }

  return normalizeOutfitRecommendationFeedbacks(parsedValue);
}

async function getFeedbacksForMutation() {
  const rawFeedbacks = await AsyncStorage.getItem(OUTFIT_FEEDBACK_KEY);
  return parseStoredFeedbacksForMutation(rawFeedbacks);
}

function parseStoredWearRecordsForMutation(rawValue: string | null) {
  if (!rawValue) return [];

  const parsedValue = JSON.parse(rawValue) as unknown;
  if (
    !Array.isArray(parsedValue) ||
    !parsedValue.every((candidate) => {
      if (!isStoredRecord(candidate)) return false;

      return (
        typeof candidate.id === "string" &&
        Boolean(candidate.id) &&
        Array.isArray(candidate.itemIds) &&
        candidate.itemIds.every((itemId) => typeof itemId === "string") &&
        Boolean(getOutfitWearItemKey(candidate.itemIds as string[])) &&
        typeof candidate.wornAt === "string" &&
        Boolean(candidate.wornAt) &&
        typeof candidate.dateKey === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(candidate.dateKey) &&
        (candidate.savedOutfitId === undefined ||
          typeof candidate.savedOutfitId === "string")
      );
    })
  ) {
    throw new Error("Stored outfit wear data is invalid");
  }

  return normalizeOutfitWearRecords(parsedValue);
}

async function getWearRecordsForMutation() {
  const rawRecords = await AsyncStorage.getItem(OUTFIT_WEAR_RECORDS_KEY);
  return parseStoredWearRecordsForMutation(rawRecords);
}

async function getSavedOutfitsForMutation() {
  const rawSavedOutfits = await AsyncStorage.getItem(SAVED_OUTFITS_KEY);
  return parseStoredSavedOutfitsForMutation(rawSavedOutfits);
}

export type UserProfileLoadResult = {
  status: "loaded" | "failed";
  profile: UserProfile | null;
};

function parseStoredUserProfileLoadResult(
  rawValue: string | null
): UserProfileLoadResult {
  if (rawValue === null) return { status: "loaded", profile: null };

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    return isStoredRecord(parsedValue)
      ? { status: "loaded", profile: parsedValue as UserProfile }
      : { status: "failed", profile: null };
  } catch {
    return { status: "failed", profile: null };
  }
}

export type ClosetRecommendationIndexLoadResult = {
  index: ClosetRecommendationIndex;
  revisions: RecommendationRevisionState;
  source:
    | "cache"
    | "rebuilt_missing"
    | "rebuilt_invalid"
    | "rebuilt_version_mismatch"
    | "rebuilt_stale"
    | "rebuilt_revision_missing"
    | "rebuilt_revision_invalid";
  serializedCharacters: number;
  closetSerializedCharacters: number;
  fullClosetParsed: boolean;
  persisted: boolean;
};

let closetRecommendationIndexLoadRequest:
  | Promise<ClosetRecommendationIndexLoadResult>
  | null = null;

async function readRecommendationRevisionState() {
  const rawValue = await AsyncStorage.getItem(RECOMMENDATION_REVISIONS_STORAGE_KEY);
  return parseRecommendationRevisionState(rawValue);
}

export async function getRecommendationRevisionState() {
  return (await readRecommendationRevisionState()).state;
}

export { getRecommendationRevisionKey };

async function getIncrementedRecommendationRevisions(
  fields: RecommendationRevisionField[]
) {
  const { state } = await readRecommendationRevisionState();
  return incrementRecommendationRevisions(state, fields);
}

function getClosetStorageEntries(
  closet: ClosetItem[],
  revisions: RecommendationRevisionState
): [string, string][] {
  const recommendationIndex = buildClosetRecommendationIndex(
    closet,
    revisions.closetRevision
  );

  return [
    [CLOSET_KEY, JSON.stringify(closet)],
    [CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY, JSON.stringify(recommendationIndex)],
    [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
  ];
}

async function loadClosetRecommendationIndex(): Promise<ClosetRecommendationIndexLoadResult> {
  const [rawIndex, rawRevisions] = await Promise.all([
    AsyncStorage.getItem(CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY),
    AsyncStorage.getItem(RECOMMENDATION_REVISIONS_STORAGE_KEY),
  ]);
  const revisionResult = parseRecommendationRevisionState(rawRevisions);
  const parsedIndex = parseClosetRecommendationIndex(
    rawIndex,
    revisionResult.state.closetRevision
  );

  if (revisionResult.status === "valid" && parsedIndex.index) {
    return {
      index: parsedIndex.index,
      revisions: revisionResult.state,
      source: "cache",
      serializedCharacters: rawIndex?.length || 0,
      closetSerializedCharacters: 0,
      fullClosetParsed: false,
      persisted: true,
    };
  }

  const rawCloset = await AsyncStorage.getItem(CLOSET_KEY);
  const closetLoad = parseStoredClosetItemsLoadResult(rawCloset);

  if (closetLoad.status === "failed") {
    throw new Error("Stored closet data could not be loaded");
  }

  const closet = closetLoad.items;

  const rebuiltIndex = buildClosetRecommendationIndex(
    closet,
    revisionResult.state.closetRevision
  );
  const serializedIndex = JSON.stringify(rebuiltIndex);
  const entries: [string, string][] = [
    [CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY, serializedIndex],
  ];

  if (revisionResult.status !== "valid") {
    entries.push([
      RECOMMENDATION_REVISIONS_STORAGE_KEY,
      JSON.stringify(revisionResult.state),
    ]);
  }

  let persisted = true;

  try {
    await AsyncStorage.multiSet(entries);
  } catch (error) {
    persisted = false;
    console.error("Failed to persist rebuilt recommendation index", error);
  }

  const source =
    revisionResult.status === "missing"
      ? "rebuilt_revision_missing"
      : revisionResult.status === "invalid"
        ? "rebuilt_revision_invalid"
        : (`rebuilt_${parsedIndex.status}` as ClosetRecommendationIndexLoadResult["source"]);

  return {
    index: rebuiltIndex,
    revisions: revisionResult.state,
    source,
    serializedCharacters: serializedIndex.length,
    closetSerializedCharacters: rawCloset?.length || 0,
    fullClosetParsed: true,
    persisted,
  };
}

export function getClosetRecommendationIndex(): Promise<ClosetRecommendationIndexLoadResult> {
  if (closetRecommendationIndexLoadRequest) {
    return closetRecommendationIndexLoadRequest;
  }

  const request = loadClosetRecommendationIndex().finally(() => {
    if (closetRecommendationIndexLoadRequest === request) {
      closetRecommendationIndexLoadRequest = null;
    }
  });

  closetRecommendationIndexLoadRequest = request;
  return request;
}

function parseAnalysisHistoryForMutation(value: string | null): any[] {
  if (!value) return [];

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Stored analysis history is not an array");
  }

  return parsed;
}

export function saveAnalysis(result: any): Promise<boolean> {
  return runAnalysisHistoryMutation(async () => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const history = parseAnalysisHistoryForMutation(existing);
      const limitedHistory = [result, ...history].slice(0, 20);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));
      return true;
    } catch (error) {
      console.error("저장 실패:", error);
      return false;
    }
  });
}

export type AnalysisHistoryLoadResult = {
  status: "loaded" | "failed";
  history: any[];
};

export async function getAnalysisHistoryLoadResult(): Promise<AnalysisHistoryLoadResult> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);

    return {
      status: "loaded",
      history: parseAnalysisHistoryForMutation(data),
    };
  } catch (error) {
    console.error("불러오기 실패:", error);
    return { status: "failed", history: [] };
  }
}

export async function getAnalysisHistory() {
  return (await getAnalysisHistoryLoadResult()).history;
}

export function deleteAnalysis(id: string): Promise<any[] | null> {
  return runAnalysisHistoryMutation(async () => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      const history = parseAnalysisHistoryForMutation(existing);
      const filteredHistory = history.filter((item: any) => item.id !== id);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredHistory));
      return filteredHistory;
    } catch (error) {
      console.error("삭제 실패:", error);
      return null;
    }
  });
}

export function saveUserProfile(profile: UserProfile): Promise<boolean> {
  return runRecommendationDataMutation(async () => {
    try {
      const revisions = await getIncrementedRecommendationRevisions([
        "profileRevision",
      ]);

      await AsyncStorage.multiSet([
        [PROFILE_KEY, JSON.stringify(profile)],
        [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
      ]);
      return true;
    } catch (error) {
      console.error("프로필 저장 실패:", error);
      return false;
    }
  });
}

export function updateUserProfile(
  updater: (currentProfile: UserProfile | null) => UserProfile
): Promise<UserProfile | null> {
  return runRecommendationDataMutation(async () => {
    try {
      const profileLoad = await getUserProfileLoadResult();
      if (profileLoad.status === "failed") {
        throw new Error("Stored profile data could not be loaded");
      }

      const updatedProfile = updater(profileLoad.profile);
      const revisions = await getIncrementedRecommendationRevisions([
        "profileRevision",
      ]);

      await AsyncStorage.multiSet([
        [PROFILE_KEY, JSON.stringify(updatedProfile)],
        [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
      ]);
      return updatedProfile;
    } catch (error) {
      console.error("프로필 수정 실패:", error);
      return null;
    }
  });
}

export async function getUserProfileLoadResult(): Promise<UserProfileLoadResult> {
  const timer = startPerformanceTimer("storage.getUserProfile");

  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    const result = parseStoredUserProfileLoadResult(data);

    endPerformanceTimer(timer, {
      found: Boolean(result.profile),
      status: result.status,
      jsonCharacters: data?.length || 0,
    });
    return result;
  } catch (error) {
    endPerformanceTimer(timer, { failed: true });
    console.error("프로필 불러오기 실패:", error);
    return { status: "failed", profile: null };
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  return (await getUserProfileLoadResult()).profile;
}

export function saveClosetItem(item: ClosetItem) {
  return runClosetMutation(async () => {
    try {
    const [existing, revisions] = await Promise.all([
      AsyncStorage.getItem(CLOSET_KEY),
      getIncrementedRecommendationRevisions(["closetRevision"]),
    ]);
    const closet = parseStoredClosetItemsForMutation(existing);

    if (closet.some((closetItem) => closetItem.id === item.id)) {
      return closet;
    }

    closet.unshift(item);

    await AsyncStorage.multiSet(getClosetStorageEntries(closet, revisions));

    return closet;
    } catch (error) {
      console.error("옷장 저장 실패:", error);
      return [];
    }
  });
}

export async function getClosetItemsLoadResult(): Promise<ClosetItemsLoadResult> {
  const timer = startPerformanceTimer("storage.getClosetItems");

  try {
    const data = await AsyncStorage.getItem(CLOSET_KEY);
    const result = parseStoredClosetItemsLoadResult(data);

    endPerformanceTimer(timer, {
      itemCount: result.items.length,
      status: result.status,
      jsonCharacters: data?.length || 0,
      approximateKilobytes: Number(((data?.length || 0) / 1024).toFixed(1)),
    });
    return result;
  } catch (error) {
    endPerformanceTimer(timer, { failed: true });
    console.error("옷장 불러오기 실패:", error);
    return { status: "failed", items: [] };
  }
}

export async function getClosetItems(): Promise<ClosetItem[]> {
  return (await getClosetItemsLoadResult()).items;
}

export function deleteClosetItem(id: string): Promise<ClosetItem[] | null> {
  return runClosetMutation(async () => {
    try {
    const [closet, profileLoad, currentRevisions] = await Promise.all([
      getClosetItemsForMutation(),
      getUserProfileLoadResult(),
      getRecommendationRevisionState(),
    ]);

    if (profileLoad.status === "failed") {
      throw new Error("Stored profile data could not be loaded");
    }

    const profile = profileLoad.profile;
    const filteredCloset = closet.filter((item) => item.id !== id);
    const nextReferenceClothing = pruneReferenceClothing(
      profile?.referenceClothing,
      filteredCloset
    );
    const revisions = incrementRecommendationRevisions(
      currentRevisions,
      profile ? ["closetRevision", "profileRevision"] : ["closetRevision"]
    );
    const entries = getClosetStorageEntries(filteredCloset, revisions);

    if (profile) {
      entries.push([
        PROFILE_KEY,
        JSON.stringify({ ...profile, referenceClothing: nextReferenceClothing }),
      ]);
    }

    await AsyncStorage.multiSet(entries);

    return filteredCloset;
    } catch (error) {
      console.error("옷장 삭제 실패:", error);
      return null;
    }
  });
}

export function updateClosetItem(id: string, updatedItem: Partial<ClosetItem>) {
  return runClosetMutation(async () => {
    try {
    const shouldValidateReferences = updatedItem.category !== undefined;
    const [closet, currentRevisions] = await Promise.all([
      getClosetItemsForMutation(),
      getRecommendationRevisionState(),
    ]);
    const profileLoad = shouldValidateReferences
      ? await getUserProfileLoadResult()
      : { status: "loaded" as const, profile: null };

    if (profileLoad.status === "failed") {
      throw new Error("Stored profile data could not be loaded");
    }

    const updatedCloset = closet.map((item) =>
      item.id === id ? { ...item, ...updatedItem } : item
    );
    const profile = profileLoad.profile;
    const nextReferenceClothing = profile
      ? pruneReferenceClothing(profile.referenceClothing, updatedCloset)
      : undefined;
    const didReferencesChange = Boolean(
      profile &&
        JSON.stringify(profile.referenceClothing || {}) !==
          JSON.stringify(nextReferenceClothing || {})
    );
    const revisions = incrementRecommendationRevisions(
      currentRevisions,
      didReferencesChange
        ? ["closetRevision", "profileRevision"]
        : ["closetRevision"]
    );
    const entries = getClosetStorageEntries(updatedCloset, revisions);

    if (profile && didReferencesChange) {
      entries.push([
        PROFILE_KEY,
        JSON.stringify({ ...profile, referenceClothing: nextReferenceClothing }),
      ]);
    }

    await AsyncStorage.multiSet(entries);

    return updatedCloset;
    } catch (error) {
      console.error("옷장 수정 실패:", error);
      return [];
    }
  });
}

export function saveOutfit(outfit: SavedOutfit): Promise<SaveOutfitResult> {
  return runSavedOutfitMutation(async () => {
    try {
      const savedOutfits = await getSavedOutfitsForMutation();
      const itemKey = [...outfit.itemIds].sort().join("|");
      const isDuplicate = savedOutfits.some(
        (savedOutfit) => [...savedOutfit.itemIds].sort().join("|") === itemKey
      );

      if (isDuplicate) {
        return { status: "duplicate", outfits: savedOutfits };
      }

      const updatedOutfits = [outfit, ...savedOutfits];
      const revisions = await getIncrementedRecommendationRevisions([
        "savedOutfitRevision",
      ]);
      await AsyncStorage.multiSet([
        [SAVED_OUTFITS_KEY, JSON.stringify(updatedOutfits)],
        [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
      ]);

      return { status: "saved", outfits: updatedOutfits };
    } catch (error) {
      console.error("코디 저장 실패:", error);
      return { status: "failed", outfits: [] };
    }
  });
}

export type OutfitWearRecordsLoadResult = {
  status: "loaded" | "failed";
  records: OutfitWearRecord[];
};

export async function getOutfitWearRecordsLoadResult(): Promise<
  OutfitWearRecordsLoadResult
> {
  try {
    const data = await AsyncStorage.getItem(OUTFIT_WEAR_RECORDS_KEY);
    return {
      status: "loaded",
      records: parseStoredWearRecordsForMutation(data),
    };
  } catch (error) {
    console.error("착용 기록 불러오기 실패:", error);
    return { status: "failed", records: [] };
  }
}

export async function getOutfitWearRecords(): Promise<OutfitWearRecord[]> {
  return (await getOutfitWearRecordsLoadResult()).records;
}

export type RecordOutfitWearResult =
  | { status: "recorded"; records: OutfitWearRecord[] }
  | { status: "already_recorded"; records: OutfitWearRecord[] }
  | { status: "missing_items"; records: OutfitWearRecord[] }
  | { status: "failed"; records: OutfitWearRecord[] };

export function recordSavedOutfitWear(
  outfit: SavedOutfit,
  wornAt = new Date()
): Promise<RecordOutfitWearResult> {
  return runClosetMutation(async () => {
    try {
    if (Number.isNaN(wornAt.getTime())) {
      return { status: "failed", records: [] };
    }

    const [closet, records, currentRevisions] = await Promise.all([
      getClosetItemsForMutation(),
      getWearRecordsForMutation(),
      getRecommendationRevisionState(),
    ]);
    const itemKey = getOutfitWearItemKey(outfit.itemIds);
    const closetItemIds = new Set(closet.map((item) => item.id));
    const hasMissingItems =
      !itemKey || itemKey.split("|").some((itemId) => !closetItemIds.has(itemId));

    if (hasMissingItems) {
      return { status: "missing_items", records };
    }

    const dateKey = getLocalDateKey(wornAt);
    if (wasOutfitWornOnDate(records, outfit.itemIds, dateKey)) {
      return { status: "already_recorded", records };
    }

    const wornAtIso = wornAt.toISOString();
    const wornItemIds = new Set(itemKey.split("|"));
    const updatedCloset = closet.map((item) =>
      wornItemIds.has(item.id)
        ? {
            ...item,
            wearCount: (item.wearCount || 0) + 1,
            lastWornAt: wornAtIso,
          }
        : item
    );
    const updatedRecords = [
      {
        id: `${wornAt.getTime()}-${outfit.id}`,
        savedOutfitId: outfit.id,
        itemIds: itemKey.split("|"),
        wornAt: wornAtIso,
        dateKey,
      },
      ...records,
    ];
    const revisions = incrementRecommendationRevisions(currentRevisions, [
      "closetRevision",
    ]);

    await AsyncStorage.multiSet([
      [OUTFIT_WEAR_RECORDS_KEY, JSON.stringify(updatedRecords)],
      ...getClosetStorageEntries(updatedCloset, revisions),
    ]);

    return { status: "recorded", records: updatedRecords };
    } catch (error) {
      console.error("착용 기록 저장 실패:", error);
      return { status: "failed", records: [] };
    }
  });
}

export type DeleteOutfitWearRecordResult =
  | { status: "deleted"; records: OutfitWearRecord[] }
  | { status: "not_found"; records: OutfitWearRecord[] }
  | { status: "failed"; records: OutfitWearRecord[] };

export function deleteOutfitWearRecord(
  recordId: string
): Promise<DeleteOutfitWearRecordResult> {
  return runClosetMutation(async () => {
    try {
    const [closet, records, currentRevisions] = await Promise.all([
      getClosetItemsForMutation(),
      getWearRecordsForMutation(),
      getRecommendationRevisionState(),
    ]);
    const targetRecord = records.find((record) => record.id === recordId);

    if (!targetRecord) {
      return { status: "not_found", records };
    }

    const updatedRecords = records.filter((record) => record.id !== recordId);
    const targetItemIds = new Set(targetRecord.itemIds);
    const updatedCloset = closet.map((item) => {
      if (!targetItemIds.has(item.id)) return item;

      const remainingLastWornAt = updatedRecords
        .filter((record) => record.itemIds.includes(item.id))
        .map((record) => record.wornAt)
        .sort((first, second) => second.localeCompare(first))[0];
      const shouldRecalculateLastWornAt = item.lastWornAt === targetRecord.wornAt;

      return {
        ...item,
        wearCount: Math.max(0, (item.wearCount || 0) - 1),
        lastWornAt: shouldRecalculateLastWornAt
          ? remainingLastWornAt
          : item.lastWornAt,
      };
    });
    const revisions = incrementRecommendationRevisions(currentRevisions, [
      "closetRevision",
    ]);

    await AsyncStorage.multiSet([
      [OUTFIT_WEAR_RECORDS_KEY, JSON.stringify(updatedRecords)],
      ...getClosetStorageEntries(updatedCloset, revisions),
    ]);

    return { status: "deleted", records: updatedRecords };
    } catch (error) {
      console.error("착용 기록 삭제 실패:", error);
      return { status: "failed", records: [] };
    }
  });
}

export async function getSavedOutfitsLoadResult(): Promise<SavedOutfitsLoadResult> {
  const timer = startPerformanceTimer("storage.getSavedOutfits");

  try {
    const data = await AsyncStorage.getItem(SAVED_OUTFITS_KEY);
    const result = parseStoredSavedOutfitsLoadResult(data);

    endPerformanceTimer(timer, {
      outfitCount: result.outfits.length,
      status: result.status,
      jsonCharacters: data?.length || 0,
    });
    return result;
  } catch (error) {
    endPerformanceTimer(timer, { failed: true });
    console.error("저장된 코디 불러오기 실패:", error);
    return { status: "failed", outfits: [] };
  }
}

export async function getSavedOutfits(): Promise<SavedOutfit[]> {
  return (await getSavedOutfitsLoadResult()).outfits;
}

export type OutfitRecommendationFeedbacksLoadResult = {
  status: "loaded" | "failed";
  feedbacks: OutfitRecommendationFeedback[];
};

function parseStoredOutfitRecommendationFeedbacksLoadResult(
  rawValue: string | null
): OutfitRecommendationFeedbacksLoadResult {
  if (rawValue === null) return { status: "loaded", feedbacks: [] };

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsedValue)) {
      return { status: "failed", feedbacks: [] };
    }

    return {
      status: "loaded",
      feedbacks: normalizeOutfitRecommendationFeedbacks(parsedValue),
    };
  } catch {
    return { status: "failed", feedbacks: [] };
  }
}

export async function getOutfitRecommendationFeedbacksLoadResult(): Promise<
  OutfitRecommendationFeedbacksLoadResult
> {
  try {
    const data = await AsyncStorage.getItem(OUTFIT_FEEDBACK_KEY);
    return parseStoredOutfitRecommendationFeedbacksLoadResult(data);
  } catch (error) {
    console.error("코디 추천 피드백 불러오기 실패:", error);
    return { status: "failed", feedbacks: [] };
  }
}

export async function getOutfitRecommendationFeedbacks(): Promise<
  OutfitRecommendationFeedback[]
> {
  return (await getOutfitRecommendationFeedbacksLoadResult()).feedbacks;
}

export async function setOutfitRecommendationFeedback(
  itemIds: string[],
  value: OutfitFeedbackValue | null
): Promise<OutfitRecommendationFeedback[] | null> {
  return runFeedbackMutation(async () => {
    try {
      const key = getOutfitFeedbackKey(itemIds);
      if (!key) return null;

      const [feedbacks, revisions] = await Promise.all([
        getFeedbacksForMutation(),
        getIncrementedRecommendationRevisions(["feedbackRevision"]),
      ]);
      const remainingFeedbacks = feedbacks.filter(
        (feedback) => getOutfitFeedbackKey(feedback.itemIds) !== key
      );
      const updatedFeedbacks = value
        ? [
            {
              itemIds: key.split("|"),
              value,
              updatedAt: new Date().toISOString(),
            },
            ...remainingFeedbacks,
          ]
        : remainingFeedbacks;

      await AsyncStorage.multiSet([
        [OUTFIT_FEEDBACK_KEY, JSON.stringify(updatedFeedbacks)],
        [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
      ]);

      return updatedFeedbacks;
    } catch (error) {
      console.error("코디 추천 피드백 저장 실패:", error);
      return null;
    }
  });
}

export async function deleteSavedOutfit(id: string): Promise<SavedOutfit[] | null> {
  return runSavedOutfitMutation(async () => {
    try {
      const [savedOutfits, revisions] = await Promise.all([
        getSavedOutfitsForMutation(),
        getIncrementedRecommendationRevisions(["savedOutfitRevision"]),
      ]);
      const filteredOutfits = savedOutfits.filter((outfit) => outfit.id !== id);

      await AsyncStorage.multiSet([
        [SAVED_OUTFITS_KEY, JSON.stringify(filteredOutfits)],
        [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
      ]);

      return filteredOutfits;
    } catch (error) {
      console.error("저장된 코디 삭제 실패:", error);
      return null;
    }
  });
}

export async function updateSavedOutfit(
  id: string,
  updatedOutfit: Partial<SavedOutfit>
): Promise<SavedOutfit[] | null> {
  return runSavedOutfitMutation(async () => {
    try {
      const [savedOutfits, revisions] = await Promise.all([
        getSavedOutfitsForMutation(),
        getIncrementedRecommendationRevisions(["savedOutfitRevision"]),
      ]);
      const updatedOutfits = savedOutfits.map((outfit) =>
        outfit.id === id ? { ...outfit, ...updatedOutfit } : outfit
      );

      await AsyncStorage.multiSet([
        [SAVED_OUTFITS_KEY, JSON.stringify(updatedOutfits)],
        [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
      ]);

      return updatedOutfits;
    } catch (error) {
      console.error("저장된 코디 수정 실패:", error);
      return null;
    }
  });
}

export function getNaesBackupDataSnapshot(): Promise<NaesBackupDataSnapshot> {
  return runRecommendationDataMutation(async () => {
    const entries = await AsyncStorage.multiGet([
      CLOSET_KEY,
      PROFILE_KEY,
      SAVED_OUTFITS_KEY,
      OUTFIT_FEEDBACK_KEY,
      OUTFIT_WEAR_RECORDS_KEY,
    ]);
    const valuesByKey = new Map(entries);
    const rawProfile = valuesByKey.get(PROFILE_KEY);
    const parsedProfile = rawProfile ? (JSON.parse(rawProfile) as unknown) : null;

    if (parsedProfile !== null && !isStoredRecord(parsedProfile)) {
      throw new Error(`백업 원본 데이터 형식이 올바르지 않아요: ${PROFILE_KEY}`);
    }

    const closetItems = parseStoredClosetItemsForMutation(
      valuesByKey.get(CLOSET_KEY) || null
    );
    const savedOutfits = parseStoredSavedOutfitsForMutation(
      valuesByKey.get(SAVED_OUTFITS_KEY) || null
    );
    const outfitFeedbacks = parseStoredFeedbacksForMutation(
      valuesByKey.get(OUTFIT_FEEDBACK_KEY) || null
    );
    const wearRecords = parseStoredWearRecordsForMutation(
      valuesByKey.get(OUTFIT_WEAR_RECORDS_KEY) || null
    );

    return {
      closetItems,
      profile: parsedProfile as UserProfile | null,
      savedOutfits,
      outfitFeedbacks,
      wearRecords,
    };
  });
}

export function restoreNaesBackupDataSnapshot(
  snapshot: NaesBackupDataSnapshot
): Promise<void> {
  return runRecommendationDataMutation(async () => {
    const previousEntries = await AsyncStorage.multiGet(
      BACKUP_RESTORE_STORAGE_KEYS
    );
    const currentRevisions = await getRecommendationRevisionState();
    const revisions = incrementRecommendationRevisions(currentRevisions, [
      "closetRevision",
      "profileRevision",
      "savedOutfitRevision",
      "feedbackRevision",
    ]);
    const outfitFeedbacks = normalizeOutfitRecommendationFeedbacks(
      snapshot.outfitFeedbacks
    );
    const wearRecords = normalizeOutfitWearRecords(snapshot.wearRecords);
    const restoredProfile = snapshot.profile?.referenceClothing
      ? {
          ...snapshot.profile,
          referenceClothing: pruneReferenceClothing(
            snapshot.profile.referenceClothing,
            snapshot.closetItems
          ),
        }
      : snapshot.profile;

    try {
      await AsyncStorage.multiSet([
        ...getClosetStorageEntries(snapshot.closetItems, revisions),
        [PROFILE_KEY, JSON.stringify(restoredProfile)],
        [SAVED_OUTFITS_KEY, JSON.stringify(snapshot.savedOutfits)],
        [OUTFIT_FEEDBACK_KEY, JSON.stringify(outfitFeedbacks)],
        [OUTFIT_WEAR_RECORDS_KEY, JSON.stringify(wearRecords)],
        [HOME_RECOMMENDATION_CACHE_STORAGE_KEY, ""],
      ]);
    } catch (error) {
      try {
        const entriesToRestore = previousEntries.filter(
          (entry): entry is [string, string] => entry[1] !== null
        );
        const keysToRemove = previousEntries
          .filter(([, value]) => value === null)
          .map(([key]) => key);

        if (entriesToRestore.length > 0) {
          await AsyncStorage.multiSet(entriesToRestore);
        }
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
      } catch (rollbackError) {
        console.error("백업 복원 롤백 실패:", rollbackError);
        throw new Error(
          "백업 복원에 실패했고 기존 데이터를 자동으로 되돌리지 못했어요.",
          { cause: rollbackError }
        );
      }

      throw error;
    }
  });
}
