import BottomNav from "@/components/BottomNav";
import { getUserProfile, saveUserProfile } from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const genderOptions = ["남성", "여성"];
const bodyTypeOptions = ["마름", "보통", "근육형", "통통"];

export default function ProfileScreen() {
  const [gender, setGender] = useState("남성");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyType, setBodyType] = useState("보통");

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        const profile = await getUserProfile();

        if (profile) {
          setGender(profile.gender || "남성");
          setAge(profile.age || "");
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
      age,
      height,
      weight,
      bodyType,
    });

    Alert.alert("저장 완료", "내 프로필 정보가 저장됐어요.");
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color="#111" />
          </Pressable>

          <Text style={styles.headerTitle}>마이페이지</Text>

          <View style={styles.headerBlank} />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionEyebrow}>STYLE PROFILE</Text>
          <Text style={styles.sectionTitle}>기본 정보</Text>
          <Text style={styles.sectionDescription}>
            프로필 정보를 저장하면 이후 코디 분석에서 나이, 체형, 핏과 비율 평가에 함께 반영됩니다.
          </Text>

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
              <Text style={styles.inputLabel}>나이</Text>
              <View style={styles.textInputWrap}>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  placeholder="25"
                  keyboardType="numeric"
                  style={styles.textInput}
                />
                <Text style={styles.unitText}>세</Text>
              </View>
            </View>

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
          </View>

          <View style={styles.inputRow}>
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

            <View style={styles.inputBoxPlaceholder} />
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
            <Feather name="lock" size={16} color="#111" />
          </View>
          <Text style={styles.infoText}>
            입력한 정보는 내 기기 안에 저장됩니다. AI 분석 요청 시 개인화 기준으로 함께 사용됩니다.
          </Text>
        </View>

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>저장하기</Text>
        </Pressable>
      </ScrollView>

      <BottomNav activeTab="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f2ee",
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f2ee",
    paddingTop: 34,
    paddingHorizontal: 20,
    paddingBottom: 104,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
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
  headerTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 8,
  },
  sectionDescription: {
    color: "#6b6258",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 20,
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
  inputBoxPlaceholder: {
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
