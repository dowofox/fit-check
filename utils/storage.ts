import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveAnalysis(result: any) {
  try {
    const existing = await AsyncStorage.getItem("analysis_history");

    const history = existing ? JSON.parse(existing) : [];

    history.unshift(result);
    const limitedHistory = history.slice(0, 20);

    await AsyncStorage.setItem(
      "analysis_history",
      JSON.stringify(limitedHistory)
    );

  } catch (error) {
    console.log("저장 실패:", error);
  }
}

export async function getAnalysisHistory() {
  try {
    const data = await AsyncStorage.getItem("analysis_history");

    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.log("불러오기 실패:", error);
    return [];
  }
}