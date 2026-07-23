import AsyncStorage from "@react-native-async-storage/async-storage";

import { AnalysisImageError } from "@/utils/analysisImage";
import { requestClothesAnalysis } from "@/utils/clothesAnalysis";
import { createClosetAnalysisRefreshManager } from "@/utils/closetAnalysisRefreshManager";
import {
  getClosetItemsLoadResult,
  updateClosetItemFromLatest,
} from "@/utils/storage";

export const closetAnalysisRefreshManager =
  createClosetAnalysisRefreshManager({
    jobStorage: AsyncStorage,
    loadClosetItems: getClosetItemsLoadResult,
    updateItemFromLatest: updateClosetItemFromLatest,
    requestPhotoAnalysis: (imageUri, item, signal) =>
      requestClothesAnalysis(imageUri, item.confirmedProduct, { signal }),
    isRecoverableImageError: (error) => error instanceof AnalysisImageError,
  });
