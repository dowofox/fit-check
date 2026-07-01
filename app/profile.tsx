import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import { normalizeSize } from "@/utils/sizeMatch";
import {
  ClosetItem,
  getClosetItems,
  getUserProfile,
  ReferenceClothing,
  saveUserProfile,
} from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const genderOptions = ["남성", "여성"];
const bodyTypeOptions = ["마름", "보통", "근육형", "통통"];
const referenceClothingSlots: {
  key: keyof ReferenceClothing;
  label: string;
}[] = [
  { key: "topItemId", label: "상의" },
  { key: "bottomItemId", label: "하의" },
  { key: "outerItemId", label: "아우터" },
  { key: "shoesItemId", label: "신발" },
];

function getClosetItemName(item?: ClosetItem) {
  return item?.detailCategory || item?.subCategory || item?.category || "";
}

function MeasurementInput({
  label,
  value,
  onChangeText,
  placeholder,
  description,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  description?: string;
}) {
  return (
    <View style={styles.inputBox}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.textInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType="decimal-pad"
          style={styles.textInput}
        />
        <Text style={styles.unitText}>cm</Text>
      </View>
      {description ? (
        <Text style={styles.measurementInputDescription}>{description}</Text>
      ) : null}
    </View>
  );
}

function parseOptionalMeasurement(value: string) {
  const parsedValue = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

export default function ProfileScreen() {
  const [gender, setGender] = useState("남성");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyType, setBodyType] = useState("보통");
  const [topSize, setTopSize] = useState("");
  const [bottomSize, setBottomSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [shoulderWidth, setShoulderWidth] = useState("");
  const [chestCircumference, setChestCircumference] = useState("");
  const [waistCircumference, setWaistCircumference] = useState("");
  const [hipCircumference, setHipCircumference] = useState("");
  const [armLength, setArmLength] = useState("");
  const [inseam, setInseam] = useState("");
  const [thighCircumference, setThighCircumference] = useState("");
  const [preferredPantsTotalLength, setPreferredPantsTotalLength] = useState("");
  const [referenceClothing, setReferenceClothing] = useState<ReferenceClothing>({});
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const hasStyleSizes = Boolean(topSize || bottomSize || shoeSize);
  const measurementCount = [
    shoulderWidth,
    chestCircumference,
    waistCircumference,
    hipCircumference,
    armLength,
    inseam,
    thighCircumference,
    preferredPantsTotalLength,
  ].filter(Boolean).length;

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        const [profile, savedClosetItems] = await Promise.all([
          getUserProfile(),
          getClosetItems(),
        ]);

        setClosetItems(savedClosetItems);

        if (profile) {
          setGender(profile.gender || "남성");
          setAge(profile.age || "");
          setHeight(profile.height || "");
          setWeight(profile.weight || "");
          setBodyType(profile.bodyType || "보통");
          setTopSize(normalizeSize(profile.topSize));
          setBottomSize(normalizeSize(profile.bottomSize));
          setShoeSize(normalizeSize(profile.shoeSize));
          setShoulderWidth(profile.shoulderWidth || "");
          setChestCircumference(profile.chestCircumference || "");
          setWaistCircumference(profile.waistCircumference || "");
          setHipCircumference(profile.hipCircumference || "");
          setArmLength(profile.armLength || "");
          setInseam(profile.inseam || "");
          setThighCircumference(profile.thighCircumference || "");
          setPreferredPantsTotalLength(
            profile.preferredPantsTotalLength !== undefined
              ? String(profile.preferredPantsTotalLength)
              : ""
          );
          setReferenceClothing(profile.referenceClothing || {});
        } else {
          setReferenceClothing({});
        }
      };

      loadProfile();
    }, [])
  );

  const handleSave = async () => {
    const normalizedTopSize = normalizeSize(topSize);
    const normalizedBottomSize = normalizeSize(bottomSize);
    const normalizedShoeSize = normalizeSize(shoeSize);
    const normalizedPreferredPantsTotalLength = parseOptionalMeasurement(
      preferredPantsTotalLength
    );

    await saveUserProfile({
      gender,
      age,
      height,
      weight,
      bodyType,
      topSize: normalizedTopSize,
      bottomSize: normalizedBottomSize,
      shoeSize: normalizedShoeSize,
      shoulderWidth,
      chestCircumference,
      waistCircumference,
      hipCircumference,
      armLength,
      inseam,
      thighCircumference,
      preferredPantsTotalLength: normalizedPreferredPantsTotalLength,
      referenceClothing,
    });

    setTopSize(normalizedTopSize);
    setBottomSize(normalizedBottomSize);
    setShoeSize(normalizedShoeSize);
    setPreferredPantsTotalLength(
      normalizedPreferredPantsTotalLength !== undefined
        ? String(normalizedPreferredPantsTotalLength)
        : ""
    );

    Alert.alert("저장 완료", "내 프로필 정보가 저장됐어요.");
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={18} color="#111" />
          </Pressable>

          <Text style={styles.headerTitle}>마이페이지</Text>

          <View style={styles.headerBlank} />
        </View>

        <View style={styles.styleSummaryCard}>
          <View>
            <Text style={styles.summaryEyebrow}>MY STYLE STANDARD</Text>
            <Text style={styles.summaryTitle}>내 스타일 기준</Text>
            <Text style={styles.summaryText}>
              {hasStyleSizes
                ? `상의 ${topSize || "-"} · 하의 ${bottomSize || "-"} · 신발 ${shoeSize || "-"}`
                : "프로필을 채우면 추천 정확도가 올라가요"}
            </Text>
          </View>

          <View style={styles.summaryIconCircle}>
            <Feather name="target" size={14} color="#111" />
          </View>
        </View>

        <View style={styles.referenceClothingCard}>
          <View style={styles.referenceClothingHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>REFERENCE CLOTHING</Text>
              <Text style={styles.sectionTitle}>내 기준 옷</Text>
              <Text style={styles.referenceClothingDescription}>
                옷 상세 화면에서 가장 잘 맞는 옷을 기준으로 설정할 수 있어요.
              </Text>
            </View>
            <View style={styles.summaryIconCircle}>
              <Feather name="bookmark" size={14} color="#111" />
            </View>
          </View>

          <View style={styles.referenceClothingList}>
            {referenceClothingSlots.map((slot) => {
              const itemId = referenceClothing[slot.key];
              const referenceItem = closetItems.find((item) => item.id === itemId);
              const itemName = getClosetItemName(referenceItem);

              return (
                <View key={slot.key} style={styles.referenceClothingRow}>
                  <Text style={styles.referenceClothingLabel}>{slot.label}</Text>
                  <View style={styles.referenceClothingValueWrap}>
                    <Text style={styles.referenceClothingValue} numberOfLines={1}>
                      {itemName || (itemId ? "옷을 찾을 수 없어요" : "설정 전")}
                    </Text>
                    {referenceItem?.color ? (
                      <Text style={styles.referenceClothingMeta}>{referenceItem.color}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
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

          <Text style={styles.sizeSectionTitle}>기본 사이즈</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>상의 사이즈</Text>
              <View style={styles.textInputWrap}>
                <TextInput
                  value={topSize}
                  onChangeText={setTopSize}
                  placeholder="L"
                  autoCapitalize="characters"
                  style={styles.textInput}
                />
                <Pressable
                  style={[
                    styles.freeSizeButton,
                    topSize === "FREE" && styles.freeSizeButtonActive,
                  ]}
                  onPress={() => setTopSize((current) => (current === "FREE" ? "" : "FREE"))}
                >
                  <Text
                    style={[
                      styles.freeSizeButtonText,
                      topSize === "FREE" && styles.freeSizeButtonTextActive,
                    ]}
                  >
                    FREE
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>하의 사이즈</Text>
              <View style={styles.textInputWrap}>
                <TextInput
                  value={bottomSize}
                  onChangeText={setBottomSize}
                  placeholder="32"
                  keyboardType="numeric"
                  style={styles.textInput}
                />
                <Pressable
                  style={[
                    styles.freeSizeButton,
                    bottomSize === "FREE" && styles.freeSizeButtonActive,
                  ]}
                  onPress={() => setBottomSize((current) => (current === "FREE" ? "" : "FREE"))}
                >
                  <Text
                    style={[
                      styles.freeSizeButtonText,
                      bottomSize === "FREE" && styles.freeSizeButtonTextActive,
                    ]}
                  >
                    FREE
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.inputRowLast}>
            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>신발 사이즈</Text>
              <View style={styles.textInputWrap}>
                <TextInput
                  value={shoeSize}
                  onChangeText={setShoeSize}
                  placeholder="270"
                  keyboardType="numeric"
                  style={styles.textInput}
                />
                {shoeSize !== "FREE" ? <Text style={styles.unitText}>mm</Text> : null}
                <Pressable
                  style={[
                    styles.freeSizeButton,
                    shoeSize === "FREE" && styles.freeSizeButtonActive,
                  ]}
                  onPress={() => setShoeSize((current) => (current === "FREE" ? "" : "FREE"))}
                >
                  <Text
                    style={[
                      styles.freeSizeButtonText,
                      shoeSize === "FREE" && styles.freeSizeButtonTextActive,
                    ]}
                  >
                    FREE
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.inputBoxPlaceholder} />
          </View>

          <Text style={styles.sizeSectionTitle}>상세 신체 치수</Text>
          <Text style={styles.measurementDescription}>
            선택 입력 항목이에요. 상품 실측과 비교할 때만 사용하며 단위는 cm예요.
          </Text>

          <View style={styles.inputRow}>
            <MeasurementInput
              label="어깨 너비"
              value={shoulderWidth}
              onChangeText={setShoulderWidth}
              placeholder="45"
            />
            <MeasurementInput
              label="가슴 둘레"
              value={chestCircumference}
              onChangeText={setChestCircumference}
              placeholder="100"
            />
          </View>

          <View style={styles.inputRow}>
            <MeasurementInput
              label="허리 둘레"
              value={waistCircumference}
              onChangeText={setWaistCircumference}
              placeholder="82"
            />
            <MeasurementInput
              label="엉덩이 둘레"
              value={hipCircumference}
              onChangeText={setHipCircumference}
              placeholder="96"
            />
          </View>

          <View style={styles.inputRow}>
            <MeasurementInput
              label="팔 길이"
              value={armLength}
              onChangeText={setArmLength}
              placeholder="61"
            />
            <MeasurementInput
              label="다리 안쪽 길이(인심)"
              value={inseam}
              onChangeText={setInseam}
              placeholder="76"
              description="가랑이 안쪽부터 발목까지의 길이입니다."
            />
          </View>

          <View style={styles.inputRowLast}>
            <MeasurementInput
              label="허벅지 둘레"
              value={thighCircumference}
              onChangeText={setThighCircumference}
              placeholder="56"
            />
            <MeasurementInput
              label="평소 잘 맞는 바지 총장(cm)"
              value={preferredPantsTotalLength}
              onChangeText={setPreferredPantsTotalLength}
              placeholder="104"
              description="평소 가장 잘 맞는 바지의 총장을 입력해주세요."
            />
          </View>

          {measurementCount > 0 ? (
            <Text style={styles.measurementCountText}>
              상세 치수 {measurementCount}개가 저장 대상에 포함돼요.
            </Text>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <Feather name="lock" size={14} color="#111" />
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
    backgroundColor: "#F7F2EB",
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#F7F2EB",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#eee7dd",
  },
  headerBlank: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 10,
  },
  styleSummaryCard: {
    backgroundColor: "#F4EEE7",
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8DED2",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryEyebrow: {
    color: "#8C6F47",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 3,
  },
  summaryTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  summaryText: {
    color: "#777064",
    fontSize: 12,
    fontWeight: "500",
  },
  measurementInputDescription: {
    color: "#777064",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "500",
    marginTop: 5,
  },
  referenceClothingCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8DED2",
    marginBottom: 10,
  },
  referenceClothingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  referenceClothingDescription: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  referenceClothingList: {
    borderTopWidth: 1,
    borderTopColor: "#EFE8DE",
  },
  referenceClothingRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EFE8DE",
  },
  referenceClothingLabel: {
    color: "#777064",
    fontSize: 12,
    fontWeight: "600",
  },
  referenceClothingValueWrap: {
    flex: 1,
    alignItems: "flex-end",
  },
  referenceClothingValue: {
    maxWidth: "100%",
    color: "#111",
    fontSize: 13,
    fontWeight: "700",
  },
  referenceClothingMeta: {
    color: "#8C6F47",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  summaryIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8DED2",
  },
  sectionEyebrow: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 5,
  },
  sectionDescription: {
    color: "#6b6258",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    marginBottom: 12,
  },
  inputLabel: {
    color: "#5d554d",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5,
  },
  optionRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 11,
  },
  optionButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: "700",
  },
  activeOptionText: {
    color: "#fff",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 11,
  },
  inputRowLast: {
    flexDirection: "row",
    gap: 8,
  },
  inputBox: {
    flex: 1,
  },
  inputBoxPlaceholder: {
    flex: 1,
  },
  textInputWrap: {
    height: 42,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee7dd",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    color: "#111",
    fontSize: 15,
    fontWeight: "600",
  },
  unitText: {
    color: "#8c8175",
    fontSize: 13,
    fontWeight: "600",
  },
  freeSizeButton: {
    backgroundColor: "#f4eee7",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginLeft: 5,
  },
  freeSizeButtonActive: {
    backgroundColor: "#111",
  },
  freeSizeButtonText: {
    color: "#8c6f47",
    fontSize: 10,
    fontWeight: "800",
  },
  freeSizeButtonTextActive: {
    color: "#fff",
  },
  bodyTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  bodyTypeButton: {
    width: "48.4%",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 8,
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
    fontSize: 13,
    fontWeight: "700",
  },
  activeBodyTypeText: {
    color: "#fff",
  },
  sizeSectionTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 8,
  },
  measurementDescription: {
    color: "#777064",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    marginTop: -2,
    marginBottom: 10,
  },
  measurementCountText: {
    color: "#8C6F47",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 9,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "#f0eee9",
    marginBottom: 10,
  },
  infoIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    color: "#5d554d",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: "#111",
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
