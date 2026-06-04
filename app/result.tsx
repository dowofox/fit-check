import { useLocalSearchParams } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ResultScreen() {
  const { imageUri, situation } = useLocalSearchParams();

  return (
  <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>코디 분석 결과</Text>

      <Text style={styles.situation}>
        📍 {situation}
      </Text>
      {imageUri && (
        <Image
            source={{ uri: imageUri as string }}
            style={styles.image}
        />
    )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>옷 종류</Text>
        <Text style={styles.content}>블랙 가죽 자켓</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>주 색상</Text>
        <Text style={styles.content}>블랙</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>추천 색상</Text>
        <Text style={styles.content}>화이트</Text>
        <Text style={styles.content}>그레이</Text>
        <Text style={styles.content}>데님 블루</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>추천 코디</Text>
        <Text style={styles.content}>• 흰색 무지 티셔츠</Text>
        <Text style={styles.content}>• 검정 슬랙스</Text>
        <Text style={styles.content}>• 연청 와이드 데님</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>추천 상황</Text>
        <Text style={styles.content}>• 데이트</Text>
        <Text style={styles.content}>• 카페</Text>
        <Text style={styles.content}>• 저녁 약속</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#f5f5f5",
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  content: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  image: {
    width: 160,
    height: 210,
    borderRadius: 14,
    marginBottom: 18,
    alignSelf: "center",
  },
  situation: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
});