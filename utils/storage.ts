import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "analysis_history";
const PROFILE_KEY = "naes_profile";

export type UserProfile = {
  gender?: string;
  age?: string;
  height?: string;
  weight?: string;
  bodyType?: string;
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
