import type {
  ClosetItem,
  NaesBackupDataSnapshot,
  OutfitRecommendationFeedback,
  OutfitWearRecord,
  SavedOutfit,
  UserProfile,
} from "@/utils/storage";

export const NAES_BACKUP_SCHEMA = "naes-data-backup";
export const NAES_BACKUP_VERSION = 1;
export const NAES_BACKUP_ASSET_PREFIX = "naes-backup-asset://";

export type NaesBackupImageAsset = {
  id: string;
  extension: string;
  base64: string;
};

export type NaesBackupPayload = {
  schema: typeof NAES_BACKUP_SCHEMA;
  version: typeof NAES_BACKUP_VERSION;
  createdAt: string;
  data: NaesBackupDataSnapshot;
  images: NaesBackupImageAsset[];
};

export type NaesBackupSummary = {
  closetItemCount: number;
  savedOutfitCount: number;
  feedbackCount: number;
  wearRecordCount: number;
  imageCount: number;
  hasProfile: boolean;
};

type ReadImageBase64 = (uri: string) => Promise<string>;
type WriteImageAsset = (
  asset: NaesBackupImageAsset,
  index: number
) => Promise<string>;
type ClosetImageField = "imageUri" | "cleanImageUri" | "productImageUrl";

const CLOSET_IMAGE_FIELDS: ClosetImageField[] = [
  "imageUri",
  "cleanImageUri",
  "productImageUrl",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function hasUniqueIds(values: { id: string }[]) {
  return new Set(values.map((value) => value.id)).size === values.length;
}

function isValidClosetItem(value: unknown): value is ClosetItem {
  if (!isRecord(value)) return false;

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

function isValidSavedOutfit(value: unknown): value is SavedOutfit {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    Boolean(value.id) &&
    isStringArray(value.itemIds) &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    typeof value.grade === "string" &&
    isStringArray(value.reasons) &&
    isStringArray(value.warnings) &&
    typeof value.createdAt === "string" &&
    Boolean(value.createdAt)
  );
}

function isValidFeedback(value: unknown): value is OutfitRecommendationFeedback {
  if (!isRecord(value)) return false;

  return (
    isStringArray(value.itemIds) &&
    value.itemIds.length > 0 &&
    (value.value === "like" || value.value === "less") &&
    typeof value.updatedAt === "string" &&
    Boolean(value.updatedAt)
  );
}

function isValidWearRecord(value: unknown): value is OutfitWearRecord {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    Boolean(value.id) &&
    isStringArray(value.itemIds) &&
    value.itemIds.length > 0 &&
    typeof value.wornAt === "string" &&
    Boolean(value.wornAt) &&
    typeof value.dateKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)
  );
}

function isValidProfile(value: unknown): value is UserProfile | null {
  return value === null || isRecord(value);
}

function isValidImageAsset(value: unknown): value is NaesBackupImageAsset {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    /^image-\d+$/.test(value.id) &&
    typeof value.extension === "string" &&
    /^[a-z0-9]{2,5}$/.test(value.extension) &&
    typeof value.base64 === "string" &&
    value.base64.length > 0 &&
    value.base64.length % 4 === 0 &&
    /^[a-z0-9+/]+={0,2}$/i.test(value.base64)
  );
}

function cloneSnapshot(snapshot: NaesBackupDataSnapshot): NaesBackupDataSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as NaesBackupDataSnapshot;
}

function getAssetIdFromUri(uri: string) {
  return uri.startsWith(NAES_BACKUP_ASSET_PREFIX)
    ? uri.slice(NAES_BACKUP_ASSET_PREFIX.length)
    : undefined;
}

function isPortableImageUri(uri: string) {
  return /^(https?:|data:)/i.test(uri);
}

function getClosetImageUri(item: ClosetItem, field: ClosetImageField) {
  return field === "productImageUrl"
    ? item.confirmedProduct?.productImageUrl
    : item[field];
}

function setClosetImageUri(
  item: ClosetItem,
  field: ClosetImageField,
  uri: string
) {
  if (field === "productImageUrl") {
    if (item.confirmedProduct) {
      item.confirmedProduct.productImageUrl = uri;
    }
    return;
  }

  item[field] = uri;
}

function getImageExtension(uri: string, field: ClosetImageField) {
  const pathname = uri.split(/[?#]/)[0];
  const extension = pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();

  if (extension && ["jpg", "jpeg", "png", "webp", "heic"].includes(extension)) {
    return extension;
  }

  return field === "cleanImageUri" ? "png" : "jpg";
}

function assertSnapshot(snapshot: unknown): asserts snapshot is NaesBackupDataSnapshot {
  if (!isRecord(snapshot)) {
    throw new Error("백업 데이터 구조를 확인할 수 없어요.");
  }

  if (!Array.isArray(snapshot.closetItems) || !snapshot.closetItems.every(isValidClosetItem)) {
    throw new Error("옷장 데이터 형식이 올바르지 않아요.");
  }

  if (!hasUniqueIds(snapshot.closetItems)) {
    throw new Error("중복된 옷 정보가 포함된 백업 파일이에요.");
  }

  if (!isValidProfile(snapshot.profile)) {
    throw new Error("프로필 데이터 형식이 올바르지 않아요.");
  }

  if (!Array.isArray(snapshot.savedOutfits) || !snapshot.savedOutfits.every(isValidSavedOutfit)) {
    throw new Error("저장 코디 데이터 형식이 올바르지 않아요.");
  }

  if (!hasUniqueIds(snapshot.savedOutfits)) {
    throw new Error("중복된 저장 코디가 포함된 백업 파일이에요.");
  }

  if (
    !Array.isArray(snapshot.outfitFeedbacks) ||
    !snapshot.outfitFeedbacks.every(isValidFeedback)
  ) {
    throw new Error("추천 피드백 데이터 형식이 올바르지 않아요.");
  }

  if (!Array.isArray(snapshot.wearRecords) || !snapshot.wearRecords.every(isValidWearRecord)) {
    throw new Error("착용 기록 데이터 형식이 올바르지 않아요.");
  }
}

function assertAssetReferences(payload: NaesBackupPayload) {
  const assetIds = new Set(payload.images.map((image) => image.id));
  const referencedAssetIds = new Set<string>();

  payload.data.closetItems.forEach((item) => {
    CLOSET_IMAGE_FIELDS.forEach((field) => {
      const uri = getClosetImageUri(item, field);
      if (!uri) return;

      const assetId = getAssetIdFromUri(uri);
      if (!assetId) {
        if (!isPortableImageUri(uri)) {
          throw new Error("백업에 포함되지 않은 로컬 이미지 경로가 있어요.");
        }
        return;
      }

      if (!assetIds.has(assetId)) {
        throw new Error("백업에 필요한 옷 이미지가 누락되어 있어요.");
      }
      referencedAssetIds.add(assetId);
    });
  });

  if (referencedAssetIds.size !== assetIds.size) {
    throw new Error("사용되지 않는 이미지가 포함된 백업 파일이에요.");
  }
}

export async function buildNaesBackupPayload(
  snapshot: NaesBackupDataSnapshot,
  readImageBase64: ReadImageBase64,
  createdAt = new Date().toISOString()
): Promise<NaesBackupPayload> {
  assertSnapshot(snapshot);

  const data = cloneSnapshot(snapshot);
  const images: NaesBackupImageAsset[] = [];
  const assetIdByUri = new Map<string, string>();

  for (const item of data.closetItems) {
    for (const field of CLOSET_IMAGE_FIELDS) {
      const uri = getClosetImageUri(item, field);
      if (!uri || isPortableImageUri(uri)) continue;

      let assetId = assetIdByUri.get(uri);
      if (!assetId) {
        assetId = `image-${images.length + 1}`;

        try {
          const base64 = await readImageBase64(uri);
          if (!base64) throw new Error("empty image");

          images.push({
            id: assetId,
            extension: getImageExtension(uri, field),
            base64,
          });
          assetIdByUri.set(uri, assetId);
        } catch (error) {
          const itemName = item.detailCategory || item.subCategory || item.category;
          throw new Error(`${itemName} 이미지를 백업하지 못했어요. 다시 시도해주세요.`, {
            cause: error,
          });
        }
      }

      setClosetImageUri(item, field, `${NAES_BACKUP_ASSET_PREFIX}${assetId}`);
    }
  }

  return {
    schema: NAES_BACKUP_SCHEMA,
    version: NAES_BACKUP_VERSION,
    createdAt,
    data,
    images,
  };
}

export function parseNaesBackupJson(rawValue: string): NaesBackupPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("NAES 백업 파일이 아니거나 파일이 손상되었어요.");
  }

  if (!isRecord(parsed) || parsed.schema !== NAES_BACKUP_SCHEMA) {
    throw new Error("NAES 백업 파일 형식이 아니에요.");
  }

  if (parsed.version !== NAES_BACKUP_VERSION) {
    throw new Error("현재 앱에서 지원하지 않는 백업 버전이에요.");
  }

  if (typeof parsed.createdAt !== "string" || !parsed.createdAt) {
    throw new Error("백업 생성 시간을 확인할 수 없어요.");
  }

  assertSnapshot(parsed.data);

  if (!Array.isArray(parsed.images) || !parsed.images.every(isValidImageAsset)) {
    throw new Error("백업 이미지 형식이 올바르지 않아요.");
  }

  const payload = parsed as NaesBackupPayload;
  const imageIds = payload.images.map((image) => image.id);
  if (new Set(imageIds).size !== imageIds.length) {
    throw new Error("중복된 이미지가 포함된 백업 파일이에요.");
  }

  assertAssetReferences(payload);
  return payload;
}

export async function materializeNaesBackupData(
  payload: NaesBackupPayload,
  writeImageAsset: WriteImageAsset
): Promise<NaesBackupDataSnapshot> {
  const parsedPayload = parseNaesBackupJson(JSON.stringify(payload));
  const restoredUriByAssetId = new Map<string, string>();

  for (let index = 0; index < parsedPayload.images.length; index += 1) {
    const asset = parsedPayload.images[index];
    const uri = await writeImageAsset(asset, index);
    if (!uri) throw new Error("복원한 이미지 경로를 만들지 못했어요.");
    restoredUriByAssetId.set(asset.id, uri);
  }

  const data = cloneSnapshot(parsedPayload.data);
  data.closetItems.forEach((item) => {
    CLOSET_IMAGE_FIELDS.forEach((field) => {
      const uri = getClosetImageUri(item, field);
      if (!uri) return;

      const assetId = getAssetIdFromUri(uri);
      if (!assetId) return;

      const restoredUri = restoredUriByAssetId.get(assetId);
      if (!restoredUri) throw new Error("복원한 옷 이미지를 연결하지 못했어요.");
      setClosetImageUri(item, field, restoredUri);
    });
  });

  return data;
}

export function getNaesBackupSummary(payload: NaesBackupPayload): NaesBackupSummary {
  return {
    closetItemCount: payload.data.closetItems.length,
    savedOutfitCount: payload.data.savedOutfits.length,
    feedbackCount: payload.data.outfitFeedbacks.length,
    wearRecordCount: payload.data.wearRecords.length,
    imageCount: payload.images.length,
    hasProfile: Boolean(payload.data.profile),
  };
}
