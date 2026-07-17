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

export async function persistLocalClosetImage(imageUri: string, itemId: string) {
  if (
    !imageUri ||
    !FileSystem.documentDirectory ||
    imageUri.startsWith(FileSystem.documentDirectory) ||
    (!imageUri.startsWith("file://") && !imageUri.startsWith("content://"))
  ) {
    return imageUri;
  }

  const targetUri = `${FileSystem.documentDirectory}closet-${itemId}.${getClosetImageExtension(imageUri)}`;
  await FileSystem.copyAsync({ from: imageUri, to: targetUri });
  return targetUri;
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
      .flatMap((item) => [item.imageUri, item.cleanImageUri])
      .map((uri) => uri?.trim())
      .filter((uri): uri is string => {
        if (!uri) return false;
        return uri.startsWith(documentDirectory) && !remainingUris.has(uri);
      })
  );

  await deleteManagedClosetImageFiles([...localUris]);
}
