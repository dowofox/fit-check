import {
  buildNaesBackupPayload,
  getNaesBackupSummary,
  materializeNaesBackupData,
  parseNaesBackupJson,
  type NaesBackupPayload,
} from "@/utils/dataBackup";
import { deleteUnusedClosetImages } from "@/utils/closetImageFiles";
import {
  getNaesBackupDataSnapshot,
  restoreNaesBackupDataSnapshot,
} from "@/utils/storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const MAX_BACKUP_FILE_BYTES = 200 * 1024 * 1024;

function getBackupFileName(createdAt: string) {
  const date = new Date(createdAt);
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    "NAES-backup",
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}`,
  ].join("-") + ".json";
}

export async function createAndShareNaesBackup() {
  if (!FileSystem.cacheDirectory) {
    throw new Error("백업 파일을 만들 저장 공간을 찾지 못했어요.");
  }

  const snapshot = await getNaesBackupDataSnapshot();
  const payload = await buildNaesBackupPayload(snapshot, (uri) =>
    FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
  );
  const fileUri = `${FileSystem.cacheDirectory}${getBackupFileName(payload.createdAt)}`;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("이 기기에서는 백업 파일 공유를 사용할 수 없어요.");
  }

  await Sharing.shareAsync(fileUri, {
    dialogTitle: "NAES 데이터 백업",
    mimeType: "application/json",
    UTI: "public.json",
  });

  return getNaesBackupSummary(payload);
}

export async function pickNaesBackupFile(): Promise<NaesBackupPayload | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error("백업 파일이 너무 커요. 200MB 이하 파일을 선택해주세요.");
  }

  const rawValue = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return parseNaesBackupJson(rawValue);
}

export async function restoreNaesBackup(payload: NaesBackupPayload) {
  if (!FileSystem.documentDirectory) {
    throw new Error("복원한 사진을 저장할 공간을 찾지 못했어요.");
  }

  const previousSnapshot = await getNaesBackupDataSnapshot();
  const restoreDirectory = `${FileSystem.documentDirectory}naes-restored-assets/${Date.now()}/`;
  let didRestoreData = false;

  await FileSystem.makeDirectoryAsync(restoreDirectory, { intermediates: true });

  try {
    const data = await materializeNaesBackupData(payload, async (asset, index) => {
      const fileUri = `${restoreDirectory}image-${index + 1}.${asset.extension}`;
      await FileSystem.writeAsStringAsync(fileUri, asset.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return fileUri;
    });

    await restoreNaesBackupDataSnapshot(data);
    didRestoreData = true;

    try {
      await deleteUnusedClosetImages(previousSnapshot.closetItems, data.closetItems);
    } catch (cleanupError) {
      console.error("백업 복원 이전 이미지 정리 실패:", cleanupError);
    }

    return getNaesBackupSummary(payload);
  } catch (error) {
    if (!didRestoreData) {
      try {
        await FileSystem.deleteAsync(restoreDirectory, { idempotent: true });
      } catch (cleanupError) {
        console.error("실패한 백업 복원 파일 정리 실패:", cleanupError);
      }
    }
    throw error;
  }
}
