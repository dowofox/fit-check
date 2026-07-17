import type { ClosetItem } from "@/utils/storage";
import * as FileSystem from "expo-file-system/legacy";

function getClosetImageExtension(uri: string) {
  const cleanUri = uri.split(/[?#]/, 1)[0];
  const extension = cleanUri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();

  return extension && ["jpg", "jpeg", "png", "webp", "heic"].includes(extension)
    ? extension
    : "jpg";
}

function getStoredItemImageUris(item: ClosetItem) {
  return [item.imageUri, item.cleanImageUri, item.confirmedProduct?.productImageUrl]
    .map((uri) => uri?.trim())
    .filter((uri): uri is string => Boolean(uri));
}

export async function persistClosetImage(imageUri: string, itemId: string) {
  if (
    !imageUri ||
    !FileSystem.documentDirectory ||
    imageUri.startsWith(FileSystem.documentDirectory)
  ) {
    return imageUri;
  }

  const targetUri = `${FileSystem.documentDirectory}closet-${itemId}.${getClosetImageExtension(imageUri)}`;
  if (imageUri.startsWith("file://") || imageUri.startsWith("content://")) {
    await FileSystem.copyAsync({ from: imageUri, to: targetUri });
    return targetUri;
  }

  if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
    try {
      const result = await FileSystem.downloadAsync(imageUri, targetUri);
      if (result.status >= 200 && result.status < 300) return result.uri;

      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    } catch (error) {
      console.error("상품 이미지 로컬 캐시 실패:", error);
      await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => {});
    }
  }

  return imageUri;
}

export async function deleteManagedClosetImageFiles(imageUris: (string | undefined)[]) {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) return;

  const localUris = new Set(
    imageUris
      .map((uri) => uri?.trim())
      .filter((uri): uri is string => Boolean(uri?.startsWith(documentDirectory)))
  );

  await Promise.all(
    [...localUris].map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }))
  );
}

export async function deleteUnusedClosetItemImages(
  deletedItem: ClosetItem,
  remainingItems: ClosetItem[]
) {
  return deleteUnusedClosetImages([deletedItem], remainingItems);
}

export async function deleteUnusedClosetImages(
  previousItems: ClosetItem[],
  remainingItems: ClosetItem[]
) {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) return;

  const remainingUris = new Set(remainingItems.flatMap(getStoredItemImageUris));
  const localUris = new Set(
    previousItems
      .flatMap(getStoredItemImageUris)
      .filter(
        (uri) => uri.startsWith(documentDirectory) && !remainingUris.has(uri)
      )
  );

  await deleteManagedClosetImageFiles([...localUris]);
}
