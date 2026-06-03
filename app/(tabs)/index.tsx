import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [situation, setSituation] = useState("데이트");

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
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
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FitCheck</Text>

      <Text style={styles.subtitle}>코디 실수를 줄여주는 AI</Text>
      <View style={styles.situationContainer}>
  {["데이트", "소개팅", "학교", "카페", "출근"].map((item) => (
    <Pressable
      key={item}
      style={[
        styles.situationButton,
        situation === item && styles.selectedSituationButton,
      ]}
      onPress={() => setSituation(item)}
    >
      <Text
        style={[
          styles.situationText,
          situation === item && styles.selectedSituationText,
        ]}
      >
        {item}
      </Text>
    </Pressable>
  ))}
</View>

      <Pressable style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>사진 선택하기</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={takePhoto}>
        <Text style={styles.secondaryButtonText}>카메라로 촬영하기</Text>
      </Pressable>

      {image ? (
  <>
        <Image source={{ uri: image }} style={styles.image} />

        <Pressable
          style={styles.analyzeButton}
          onPress={() =>
            router.push({
              pathname: "/result",
              params: {
                imageUri: image,
                situation: situation,
              },
            })
          }
        >
          <Text style={styles.buttonText}>분석하기</Text>
        </Pressable>
      </>
    ) : (
      <Text style={styles.info}>아직 선택된 사진이 없습니다.</Text>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#fff",
    paddingTop: 100,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
  },
  button: {
    marginTop: 40,
    backgroundColor: "#000",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  info: {
    marginTop: 20,
    color: "#888",
  },
  image: {
    marginTop: 30,
    width: 260,
    height: 360,
    borderRadius: 16,
  },
  analyzeButton: {
    marginTop: 20,
    backgroundColor: "#111",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 12,
  },
  situationContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
  },
  situationButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectedSituationButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  situationText: {
    color: "#333",
    fontSize: 14,
  },
  selectedSituationText: {
    color: "#fff",
    fontWeight: "600",
  },
});