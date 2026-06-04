import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      alert("카메라 권한이 필요해.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitCheck</Text>

      <Text style={styles.subtitle}>오늘 코디, 실패 확률부터 확인해요</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>
          AI가 코디를 객관적으로 분석해요
        </Text>

        <Text style={styles.heroText}>
          실패 위험, 코디 포인트, 문제점을 솔직하게 알려드립니다.
        </Text>
      </View>

      <Pressable style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>사진 선택하기</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={takePhoto}>
        <Text style={styles.secondaryButtonText}>카메라로 촬영하기</Text>
      </Pressable>

      {image ? (
        <>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>선택한 코디 사진</Text>
            <Image source={{ uri: image }} style={styles.image} />
          </View>

          <Pressable
            style={styles.analyzeButton}
            onPress={() =>
              router.push({
                pathname: "/analyzing",
                params: {
                  imageUri: image,
                },
              })
            }
          >
            <Text style={styles.buttonText}>분석하기</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>👕</Text>
          <Text style={styles.emptyTitle}>아직 분석 할 사진이 없어요</Text>
          <Text style={styles.emptyText}>
            전신이 보이는 사진을 올리면 더 정확하게 분석할 수 있어요.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingTop: 54,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#111",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginTop: 8,
    marginBottom: 22,
  },
  button: {
    width: "100%",
    backgroundColor: "#111",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  secondaryButton: {
    width: "100%",
    marginTop: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  image: {
    width: 190,
    height: 250,
    borderRadius: 20,
  },
  analyzeButton: {
    width: "100%",
    marginTop: 18,
    backgroundColor: "#111",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  emptyCard: {
    marginTop: 20,
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 34,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
  },
  previewCard: {
    marginTop: 20,
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
    marginBottom: 14,
  },
  heroCard: {
    width: "100%",
    backgroundColor: "#111",
    borderRadius: 24,
    padding: 22,
    marginTop: 18,
    marginBottom: 20,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },

  heroText: {
    color: "#d1d5db",
    fontSize: 14,
    lineHeight: 22,
  },

});