import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AnalyzingScreen() {
  const { imageUri, situation } = useLocalSearchParams();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace({
        pathname: "/result",
        params: {
          imageUri: imageUri as string,
          situation: situation as string,
        },
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [imageUri, situation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#000" />

      <Text style={styles.title}>AI가 코디를 분석하고 있어요</Text>

      <Text style={styles.subtitle}>
        핏, 색 조합, 상황 적합성을 확인하는 중이에요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
});