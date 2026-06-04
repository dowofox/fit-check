import { useLocalSearchParams } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ResultScreen() {
  const {
    imageUri,
    score,
    riskLevel,
    style,
    point,
    clothingType,
    mainColor,
    matchingColors,
    goodPoints,
    problems,
    improvement,
    recommendedSituations,
    summary,
  } = useLocalSearchParams();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>코디 분석 결과</Text>

      {imageUri && (
        <Image
          source={{ uri: imageUri as string }}
          style={styles.image}
        />
      )}

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>코디 점수</Text>
        <Text style={styles.scoreText}>{score ?? "-"}점</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>실패 위험</Text>
        <Text style={styles.content}>{riskLevel}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>코디 포인트</Text>
        <Text style={styles.content}>{point}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>스타일 분석</Text>
        <Text style={styles.content}>{style}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>옷 종류</Text>
        <Text style={styles.content}>{clothingType}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>주 색상</Text>
        <Text style={styles.content}>{mainColor}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>잘 어울리는 색상</Text>
        <Text style={styles.content}>{matchingColors}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>문제점</Text>
        <Text style={styles.content}>{problems}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>좋은 점</Text>
        <Text style={styles.content}>{goodPoints}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>코디 개선 팁</Text>
        <Text style={styles.content}>{improvement}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>추천 상황</Text>
        <Text style={styles.content}>{recommendedSituations}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>총평</Text>
        <Text style={styles.content}>{summary}</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f3f4f6",
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 18,
    color: "#111",
  },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
    color: "#111",
  },
  content: {
    fontSize: 15,
    color: "#444",
    lineHeight: 23,
  },
  image: {
    width: 180,
    height: 230,
    borderRadius: 20,
    marginBottom: 18,
    alignSelf: "center",
  },
  scoreCard: {
    backgroundColor: "#111",
    padding: 22,
    borderRadius: 22,
    marginBottom: 16,
    alignItems: "center",
  },
  scoreLabel: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 6,
  },
  scoreText: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "900",
  },

});