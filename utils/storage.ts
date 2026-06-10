import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "analysis_history";
const PROFILE_KEY = "naes_profile";
const CLOSET_KEY = "naes_closet";
const SAVED_OUTFITS_KEY = "naes_saved_outfits";

export type UserProfile = {
  gender?: string;
  age?: string;
  height?: string;
  weight?: string;
  bodyType?: string;
  topSize?: string;
  bottomSize?: string;
  shoeSize?: string;
};

export type ClosetItem = {
  id: string;
  imageUri: string;
  category: string;
  subCategory?: string;
  detailCategory?: string;
  color?: string;
  style?: string;
  season?: string;
  fit?: string;
  size?: string;
  intendedFit?: string;
  description?: string;
  matchTip?: string;
  avoidTip?: string;
  createdAt: string;
};

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
    console.log("저장 실패:", error);
  }
}

export async function getAnalysisHistory() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);

    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.log("불러오기 실패:", error);
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
    console.log("삭제 실패:", error);
    return [];
  }
}

export async function saveUserProfile(profile: UserProfile) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.log("프로필 저장 실패:", error);
  }
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);

    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.log("프로필 불러오기 실패:", error);
    return null;
  }
}

export async function saveClosetItem(item: ClosetItem) {
  try {
    const existing = await AsyncStorage.getItem(CLOSET_KEY);
    const closet = existing ? JSON.parse(existing) : [];

    closet.unshift(item);

    await AsyncStorage.setItem(CLOSET_KEY, JSON.stringify(closet));

    return closet;
  } catch (error) {
    console.log("옷장 저장 실패:", error);
    return [];
  }
}

export async function getClosetItems(): Promise<ClosetItem[]> {
  try {
    const data = await AsyncStorage.getItem(CLOSET_KEY);

    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.log("옷장 불러오기 실패:", error);
    return [];
  }
}

export async function deleteClosetItem(id: string) {
  try {
    const closet = await getClosetItems();
    const filteredCloset = closet.filter((item) => item.id !== id);

    await AsyncStorage.setItem(CLOSET_KEY, JSON.stringify(filteredCloset));

    return filteredCloset;
  } catch (error) {
    console.log("옷장 삭제 실패:", error);
    return [];
  }
}

export async function updateClosetItem(id: string, updatedItem: Partial<ClosetItem>) {
  try {
    const closet = await getClosetItems();
    const updatedCloset = closet.map((item) =>
      item.id === id ? { ...item, ...updatedItem } : item
    );

    await AsyncStorage.setItem(CLOSET_KEY, JSON.stringify(updatedCloset));

    return updatedCloset;
  } catch (error) {
    console.log("옷장 수정 실패:", error);
    return [];
  }
}

export async function saveOutfit(outfit: SavedOutfit) {
  try {
    const savedOutfits = await getSavedOutfits();
    const updatedOutfits = [outfit, ...savedOutfits];

    await AsyncStorage.setItem(SAVED_OUTFITS_KEY, JSON.stringify(updatedOutfits));

    return updatedOutfits;
  } catch (error) {
    console.log("코디 저장 실패:", error);
    return [];
  }
}

export async function getSavedOutfits(): Promise<SavedOutfit[]> {
  try {
    const data = await AsyncStorage.getItem(SAVED_OUTFITS_KEY);

    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.log("저장된 코디 불러오기 실패:", error);
    return [];
  }
}

export async function deleteSavedOutfit(id: string) {
  try {
    const savedOutfits = await getSavedOutfits();
    const filteredOutfits = savedOutfits.filter((outfit) => outfit.id !== id);

    await AsyncStorage.setItem(SAVED_OUTFITS_KEY, JSON.stringify(filteredOutfits));

    return filteredOutfits;
  } catch (error) {
    console.log("저장된 코디 삭제 실패:", error);
    return [];
  }
}

export async function updateSavedOutfit(id: string, updatedOutfit: Partial<SavedOutfit>) {
  try {
    const savedOutfits = await getSavedOutfits();
    const updatedOutfits = savedOutfits.map((outfit) =>
      outfit.id === id ? { ...outfit, ...updatedOutfit } : outfit
    );

    await AsyncStorage.setItem(SAVED_OUTFITS_KEY, JSON.stringify(updatedOutfits));

    return updatedOutfits;
  } catch (error) {
    console.log("저장된 코디 수정 실패:", error);
    return [];
  }
}
