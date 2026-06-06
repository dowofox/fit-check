import { getUserProfile, saveUserProfile } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const genderOptions = ["남성", "여성"];
const bodyTypeOptions = ["마름", "보통", "근육형", "통통"];

export default function ProfileScreen() {
  const [gender, setGender] = useState("남성");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyType, setBodyType] = useState("보통");

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        const profile = await getUserProfile();

        if (profile) {
          setGender(profile.gender || "남성");
          setHeight(profile.height || "");
          setWeight(profile.weight || "");
          setBodyType(profile.bodyType || "보통");
        }
      };

      loadProfile();
    }, [])
  );

  const handleSave = async () => {
    await saveUserProfile({
      gender,
      height,
      weight,
      bodyType,
    });

    Alert.alert("저장 완료", "내 체형 정보가 저장됐어요.");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color="#111" />
        </Pressable>

        <View>
          <Text style={styles.headerEyebrow}>MY STYLE PROFILE</Text>
          <Text style={styles.headerTitle}>마이페이지</Text>
        </View>

        <View style={styles.headerBlank} />
      </View>

      <View style={styles.heroCard}>
        <View>
          <Text style={styles.heroBadge}>NAES PROFILE</Text>
          <Text style={styles.heroTitle}>내 체형 정보를{`\n`}저장해보세요</Text>
          <Text style={styles.heroText}>
            저장된 정보는 코디 분석 시 핏과 비율 평가에 함께 반영됩니다.
          </Text>
        </View>

        <View style={styles.heroObject}>
          <Text style={styles.heroObjectLogo}>N</Text>
          <Text style={styles.heroObjectSub}>BODY</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>기본 정보</Text>

        <Text style={styles.inputLabel}>성별</Text>
        <View style={styles.optionRow}>
          {genderOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.optionButton, gender === option && styles.activeOptionButton]}
              onPress={() => setGender(option)}
            >
              <Text style={[styles.optionText, gender === option && styles.activeOptionText]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>키</Text>
            <View style={styles.textInputWrap}>
              <TextInput
                value={height}
                onChangeText={setHeight}
                placeholder="175"
                keyboardType="numeric"
                style={styles.textInput}
              />
              <Text style={styles.unitText}>cm</Text>
            </View>
          </View>

          <View style={styles.inputBox}>
            <Text style={styles.inputLabel}>몸무게</Text>
            <View style={styles.textInputWrap}>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="68"
                keyboardType="numeric"
                style={styles.textInput}
              />
              <Text style={styles.unitText}>kg</Text>
            </View>
          </View>
        </View>

        <Text style={styles.inputLabel}>체형</Text>
        <View style={styles.bodyTypeGrid}>
          {bodyTypeOptions.map((option) => (
            <Pressable
              key={option}
              style={[styles.bodyTypeButton, bodyType === option && styles.activeBodyTypeButton]}
              onPress={() => setBodyType(option)}
            >
              <Text style={[styles.bodyTypeText, bodyType === option && styles.activeBodyTypeText]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIconCircle}>
          <Feather name="info" size={17} color="#111" />
        </View>
        <Text style={styles.infoText}>
          체형 정보는 앱 안에 저장되며, 이후 코디 분석에서 핏과 비율을 더 개인화해서 평가하는 데 사용됩니다.
        </Text>
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>프로필 저장하기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f2ee",
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#eee7dd",
  },
  headerBlank: {
    width: 40,
    height: 40,
  },
  headerEyebrow: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textAlign: "center",
  },
  headerTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },
  heroCard: {
    backgroundColor: "#111",
    borderRadius: 30,
    padding: 22,
    minHeight: 178,
    marginBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  heroBadge: {
    color: "#caa46a",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 29,
    fontWeight: "900",
    lineHeight: 38,
    letterSpacing: -1,
  },
  heroText: {
    color: "#d8d2ca",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 12,
    width: "68%",
  },
  heroObject: {
    position: "absolute",
    right: 24,
    top: 48,
    width: 86,
    height: 108,
    borderTopLeftRadius: 44,
    borderTopRightRadius: 44,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1.3,
    borderColor: "#caa46a",
    alignItems: "center",
    justifyContent: "center",
  },
  heroObjectLogo: {
    color: "#caa46a",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
  },
  heroObjectSub: {
    color: "#caa46a",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  formCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 18,
  },
  inputLabel: {
    color: "#5d554d",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 9,
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  optionButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee7dd",
  },
  activeOptionButton: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  optionText: {
    color: "#6b6258",
    fontSize: 14,
    fontWeight: "900",
  },
  activeOptionText: {
    color: "#fff",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  inputBox: {
    flex: 1,
  },
  textInputWrap: {
    height: 56,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    color: "#111",
    fontSize: 20,
    fontWeight: "900",
  },
  unitText: {
    color: "#8c8175",
    fontSize: 13,
    fontWeight: "900",
  },
  bodyTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  bodyTypeButton: {
    width: "47.8%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee7dd",
  },
  activeBodyTypeButton: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  bodyTypeText: {
    color: "#6b6258",
    fontSize: 14,
    fontWeight: "900",
  },
  activeBodyTypeText: {
    color: "#fff",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 16,
  },
  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    color: "#5d554d",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 21,
  },
  saveButton: {
    backgroundColor: "#111",
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
});
