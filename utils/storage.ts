import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildClosetRecommendationIndex,
  CLOSET_RECOMMENDATION_INDEX_STORAGE_KEY,
  getRecommendationRevisionKey,
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
  const closetItemIds = new Set(closetItems.map((item) => item.id));
  const nextReferenceClothing: ReferenceClothing = {};

  (Object.entries(referenceClothing || {}) as [keyof ReferenceClothing, string][]).forEach(
    ([key, itemId]) => {
      if (itemId && closetItemIds.has(itemId)) {
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

export function getDisplayImageUri(item: ClosetItem) {
  return item.cleanImageUri || item.confirmedProduct?.productImageUrl || item.imageUri;
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

function parseStoredClosetItems(rawValue: string | null) {
  const parsedValue = parseStoredJson(rawValue);
  return Array.isArray(parsedValue) ? parsedValue.filter(isStoredClosetItem) : [];
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

function parseStoredUserProfile(rawValue: string | null): UserProfile | null {
  const parsedValue = parseStoredJson(rawValue);
  return isStoredRecord(parsedValue) ? (parsedValue as UserProfile) : null;
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
};

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

export async function getClosetRecommendationIndex(): Promise<ClosetRecommendationIndexLoadResult> {
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
    };
  }

  const rawCloset = await AsyncStorage.getItem(CLOSET_KEY);
  const closet = parseStoredClosetItems(rawCloset);

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

  await AsyncStorage.multiSet(entries);

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
  };
}

export async function saveAnalysis(result: any) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);

    const history = existing ? JSON.parse(existing) : [];

    history.unshift(result);
    const limitedHistory = history.slice(0, 20);

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(limitedHistory)
    );

  } catch (error) {
    console.error("저장 실패:", error);
  }
}

export async function getAnalysisHistory() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);

    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("불러오기 실패:", error);
    return [];
  }
}

export async function deleteAnalysis(id: string) {
  try {
    const history = await getAnalysisHistory();
    const filteredHistory = history.filter((item: any) => item.id !== id);

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(filteredHistory)
    );

    return filteredHistory;
  } catch (error) {
    console.error("삭제 실패:", error);
    return [];
  }
}

export async function saveUserProfile(profile: UserProfile) {
  try {
    const revisions = await getIncrementedRecommendationRevisions([
      "profileRevision",
    ]);

    await AsyncStorage.multiSet([
      [PROFILE_KEY, JSON.stringify(profile)],
      [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
    ]);
  } catch (error) {
    console.error("프로필 저장 실패:", error);
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const timer = startPerformanceTimer("storage.getUserProfile");

  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    const profile = parseStoredUserProfile(data);

    endPerformanceTimer(timer, {
      found: Boolean(profile),
      jsonCharacters: data?.length || 0,
    });
    return profile;
  } catch (error) {
    endPerformanceTimer(timer, { failed: true });
    console.error("프로필 불러오기 실패:", error);
    return null;
  }
}

export async function saveClosetItem(item: ClosetItem) {
  try {
    const [existing, revisions] = await Promise.all([
      AsyncStorage.getItem(CLOSET_KEY),
      getIncrementedRecommendationRevisions(["closetRevision"]),
    ]);
    const closet = parseStoredClosetItems(existing);

    closet.unshift(item);

    await AsyncStorage.multiSet(getClosetStorageEntries(closet, revisions));

    return closet;
  } catch (error) {
    console.error("옷장 저장 실패:", error);
    return [];
  }
}

export async function getClosetItems(): Promise<ClosetItem[]> {
  const timer = startPerformanceTimer("storage.getClosetItems");

  try {
    const data = await AsyncStorage.getItem(CLOSET_KEY);
    const closet = parseStoredClosetItems(data);

    endPerformanceTimer(timer, {
      itemCount: closet.length,
      jsonCharacters: data?.length || 0,
      approximateKilobytes: Number(((data?.length || 0) / 1024).toFixed(1)),
    });
    return closet;
  } catch (error) {
    endPerformanceTimer(timer, { failed: true });
    console.error("옷장 불러오기 실패:", error);
    return [];
  }
}

export async function deleteClosetItem(id: string) {
  try {
    const [closet, profile, currentRevisions] = await Promise.all([
      getClosetItems(),
      getUserProfile(),
      getRecommendationRevisionState(),
    ]);
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
    return [];
  }
}

export async function updateClosetItem(id: string, updatedItem: Partial<ClosetItem>) {
  try {
    const [closet, revisions] = await Promise.all([
      getClosetItems(),
      getIncrementedRecommendationRevisions(["closetRevision"]),
    ]);
    const updatedCloset = closet.map((item) =>
      item.id === id ? { ...item, ...updatedItem } : item
    );

    await AsyncStorage.multiSet(getClosetStorageEntries(updatedCloset, revisions));

    return updatedCloset;
  } catch (error) {
    console.error("옷장 수정 실패:", error);
    return [];
  }
}

export async function saveOutfit(outfit: SavedOutfit) {
  try {
    const savedOutfits = await getSavedOutfits();
    const updatedOutfits = [outfit, ...savedOutfits];
    const revisions = await getIncrementedRecommendationRevisions([
      "savedOutfitRevision",
    ]);
    await AsyncStorage.multiSet([
      [SAVED_OUTFITS_KEY, JSON.stringify(updatedOutfits)],
      [RECOMMENDATION_REVISIONS_STORAGE_KEY, JSON.stringify(revisions)],
    ]);

    return updatedOutfits;
  } catch (error) {
    console.error("코디 저장 실패:", error);
    return [];
  }
}

export async function getOutfitWearRecords(): Promise<OutfitWearRecord[]> {
  try {
    const data = await AsyncStorage.getItem(OUTFIT_WEAR_RECORDS_KEY);
    const parsedRecords = data ? JSON.parse(data) : [];

    return normalizeOutfitWearRecords(parsedRecords);
  } catch (error) {
    console.error("착용 기록 불러오기 실패:", error);
    return [];
  }
}

export type RecordOutfitWearResult =
  | { status: "recorded"; records: OutfitWearRecord[] }
  | { status: "already_recorded"; records: OutfitWearRecord[] }
  | { status: "missing_items"; records: OutfitWearRecord[] }
  | { status: "failed"; records: OutfitWearRecord[] };

export async function recordSavedOutfitWear(
  outfit: SavedOutfit,
  wornAt = new Date()
): Promise<RecordOutfitWearResult> {
  try {
    if (Number.isNaN(wornAt.getTime())) {
      return { status: "failed", records: [] };
    }

    const [closet, records, currentRevisions] = await Promise.all([
      getClosetItems(),
      getOutfitWearRecords(),
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
}

export type DeleteOutfitWearRecordResult =
  | { status: "deleted"; records: OutfitWearRecord[] }
  | { status: "not_found"; records: OutfitWearRecord[] }
  | { status: "failed"; records: OutfitWearRecord[] };

export async function deleteOutfitWearRecord(
  recordId: string
): Promise<DeleteOutfitWearRecordResult> {
  try {
    const [closet, records, currentRevisions] = await Promise.all([
      getClosetItems(),
      getOutfitWearRecords(),
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
}

export async function getSavedOutfits(): Promise<SavedOutfit[]> {
  const timer = startPerformanceTimer("storage.getSavedOutfits");

  try {
    const data = await AsyncStorage.getItem(SAVED_OUTFITS_KEY);
    const savedOutfits = parseStoredSavedOutfits(data);

    endPerformanceTimer(timer, {
      outfitCount: savedOutfits.length,
      jsonCharacters: data?.length || 0,
    });
    return savedOutfits;
  } catch (error) {
    endPerformanceTimer(timer, { failed: true });
    console.error("저장된 코디 불러오기 실패:", error);
    return [];
  }
}

export async function getOutfitRecommendationFeedbacks(): Promise<
  OutfitRecommendationFeedback[]
> {
  try {
    const data = await AsyncStorage.getItem(OUTFIT_FEEDBACK_KEY);
    const parsedFeedbacks = data ? JSON.parse(data) : [];

    return normalizeOutfitRecommendationFeedbacks(parsedFeedbacks);
  } catch (error) {
    console.error("코디 추천 피드백 불러오기 실패:", error);
    return [];
  }
}

export async function setOutfitRecommendationFeedback(
  itemIds: string[],
  value: OutfitFeedbackValue | null
): Promise<OutfitRecommendationFeedback[] | null> {
  try {
    const key = getOutfitFeedbackKey(itemIds);
    if (!key) return null;

    const [feedbacks, revisions] = await Promise.all([
      getOutfitRecommendationFeedbacks(),
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
}

export async function deleteSavedOutfit(id: string) {
  try {
    const [savedOutfits, revisions] = await Promise.all([
      getSavedOutfits(),
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
    return [];
  }
}

export async function updateSavedOutfit(id: string, updatedOutfit: Partial<SavedOutfit>) {
  try {
    const [savedOutfits, revisions] = await Promise.all([
      getSavedOutfits(),
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
    return [];
  }
}

export async function getNaesBackupDataSnapshot(): Promise<NaesBackupDataSnapshot> {
  const [closetItems, profile, savedOutfits, outfitFeedbacks, wearRecords] =
    await Promise.all([
      getClosetItems(),
      getUserProfile(),
      getSavedOutfits(),
      getOutfitRecommendationFeedbacks(),
      getOutfitWearRecords(),
    ]);

  return {
    closetItems,
    profile,
    savedOutfits,
    outfitFeedbacks,
    wearRecords,
  };
}

export async function restoreNaesBackupDataSnapshot(
  snapshot: NaesBackupDataSnapshot
) {
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

  await AsyncStorage.multiSet([
    ...getClosetStorageEntries(snapshot.closetItems, revisions),
    [PROFILE_KEY, JSON.stringify(snapshot.profile)],
    [SAVED_OUTFITS_KEY, JSON.stringify(snapshot.savedOutfits)],
    [OUTFIT_FEEDBACK_KEY, JSON.stringify(outfitFeedbacks)],
    [OUTFIT_WEAR_RECORDS_KEY, JSON.stringify(wearRecords)],
  ]);
}
