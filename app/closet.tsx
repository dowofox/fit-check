import BottomNav from "@/components/BottomNav";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import {
    ClosetItem,
    deleteClosetItem,
    getClosetItems,
} from "@/utils/storage";
import { useEffect, useState } from "react";

export default function ClosetScreen() {
    const [items, setItems] = useState<ClosetItem[]>([]);
    useEffect(() => {
        loadCloset();
    }, []);

    async function loadCloset() {
        const closetItems = await getClosetItems();
        setItems(closetItems);
    }
    async function handleDeleteItem(id: string) {
        const updatedItems = await deleteClosetItem(id);
        setItems(updatedItems);
    }
    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.headerEyebrow}>MY CLOSET</Text>
                        <Text style={styles.headerTitle}>내 옷장</Text>
                    </View>

                    <Pressable style={styles.addButton} onPress={() => router.push("/add-clothes")}>
                        <Feather name="plus" size={20} color="#111" />
                    </Pressable>
                </View>

                {items.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <Feather name="archive" size={26} color="#8c6f47" />
                        </View>

                        <Text style={styles.emptyTitle}>
                            아직 저장된 옷이 없어요
                        </Text>

                        <Text style={styles.emptyText}>
                            상의, 하의, 신발, 아우터를 하나씩 저장하면
                            옷장 기반 코디 추천을 만들 수 있어요.
                        </Text>

                        <Pressable style={styles.primaryButton} onPress={() => router.push("/add-clothes")}>
                            <Feather name="plus" size={18} color="#fff" />
                            <Text style={styles.primaryButtonText}>
                                옷 추가하기
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <View>
                        <Text style={styles.countText}>
                            총 {items.length}개 보유
                        </Text>

                        <View style={styles.closetGrid}>
                            {items.map((item) => (
                                <View
                                    key={item.id}
                                    style={styles.closetCard}
                                >
                                    <Image
                                        source={{ uri: item.imageUri }}
                                        style={styles.closetImage}
                                    />
                                    <Pressable
                                        style={styles.deleteButton}
                                        onPress={() => handleDeleteItem(item.id)}
                                    >
                                        <Feather name="trash-2" size={15} color="#991b1b" />
                                    </Pressable>

                                    <Text style={styles.closetCategory}>
                                        {item.category}
                                    </Text>

                                    <Text style={styles.closetSubText}>
                                        {item.color}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
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
    countText: {
        fontSize: 18,
        fontWeight: "900",
        color: "#111",
        marginBottom: 14,
    },

    closetGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },

    closetCard: {
        width: "47%",
        backgroundColor: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#f0eee9",
    },

    closetImage: {
        width: "100%",
        height: 180,
        backgroundColor: "#ddd",
    },

    closetCategory: {
        fontSize: 15,
        fontWeight: "900",
        color: "#111",
        paddingHorizontal: 12,
        paddingTop: 10,
    },

    closetSubText: {
        fontSize: 13,
        color: "#777",
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    deleteButton: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 30,
        height: 30,
        borderRadius: 999,
        backgroundColor: "#fee2e2",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#fecaca",
    },
});