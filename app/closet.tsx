import BottomNav from "@/components/BottomNav";
import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function ClosetScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerEyebrow}>MY CLOSET</Text>
            <Text style={styles.headerTitle}>내 옷장</Text>
          </View>

          <Pressable style={styles.addButton}>
            <Feather name="plus" size={20} color="#111" />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroBadge}>WARDROBE AI</Text>
            <Text style={styles.heroTitle}>가지고 있는 옷을{"\n"}기록해보세요</Text>
            <Text style={styles.heroText}>
              옷을 저장하면 나중에 AI가 어울리는 조합과 부족한 아이템을 추천해줄 수 있어요.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Feather name="shopping-bag" size={34} color="#caa46a" />
          </View>
        </View>

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Feather name="archive" size={26} color="#8c6f47" />
          </View>

          <Text style={styles.emptyTitle}>아직 저장된 옷이 없어요</Text>
          <Text style={styles.emptyText}>
            상의, 하의, 신발, 아우터를 하나씩 저장하면 옷장 기반 코디 추천을 만들 수 있어요.
          </Text>

          <Pressable style={styles.primaryButton}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>옷 추가하기</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav activeTab="closet" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f2ee" },
  container: {
    flexGrow: 1,
    paddingTop: 34,
    paddingHorizontal: 20,
    paddingBottom: 104,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerEyebrow: {
    color: "#9b7a4b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 3,
  },

  headerTitle: {
    color: "#111",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  addButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee7dd",
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    backgroundColor: "#111",
    borderRadius: 28,
    padding: 24,
    minHeight: 210,
    marginBottom: 18,
    position: "relative",
    overflow: "hidden",
  },

  heroBadge: {
    color: "#caa46a",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 12,
    letterSpacing: 1.5,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 31,
    fontWeight: "900",
    lineHeight: 40,
    letterSpacing: -1.1,
  },

  heroText: {
    marginTop: 16,
    color: "#d8d2ca",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    width: "74%",
  },

  heroIcon: {
    position: "absolute",
    right: 26,
    top: 58,
    width: 86,
    height: 106,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1.4,
    borderColor: "#caa46a",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCard: {
    backgroundColor: "#faf8f5",
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0eee9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 16,
    elevation: 2,
  },

  emptyIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: "#f0e7dc",
    borderWidth: 1,
    borderColor: "#e6d9cb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 14,
    color: "#6b6258",
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },

  primaryButton: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
});