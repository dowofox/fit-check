import { useLocalSearchParams } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";

export default function ResultScreen() {
  const { imageUri, situation } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>분석 결과</Text>
      <Text style={styles.situation}>상황: {situation}</Text>
      {imageUri && (
        <Image
            source={{ uri: imageUri as string }}
            style={styles.image}
        />
    )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>실패 위험</Text>
        <Text style={styles.content}>낮음</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>좋은 점</Text>
        <Text style={styles.content}>- 색 조합이 무난해요.</Text>
        <Text style={styles.content}>- 과한 느낌이 적어요.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>주의할 점</Text>
        <Text style={styles.content}>- 신발과 바지 조화는 나중에 더 확인해볼게요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 30,
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
    width: 220,
    height: 300,
    borderRadius: 16,
    marginBottom: 20,
    alignSelf: "center",
  },
  situation: {
  fontSize: 16,
  color: "#666",
  marginBottom: 20,
  },
});