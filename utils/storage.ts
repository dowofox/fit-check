import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "analysis_history";

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
