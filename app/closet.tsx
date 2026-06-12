import BottomNav from "@/components/BottomNav";
import {
    ClosetItem,
    deleteClosetItem,
    getClosetItems,
} from "@/utils/storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const CLOSET_FILTERS = ["전체", "상의", "하의", "신발", "아우터", "액세서리"];

export default function ClosetScreen() {
    const { category } = useLocalSearchParams<{ category?: string }>();
    const [items, setItems] = useState<ClosetItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("전체");
    const [selectedDetailCategory, setSelectedDetailCategory] = useState("전체");
    useFocusEffect(
        useCallback(() => {
            loadCloset();

            if (typeof category === "string") {
                setSelectedCategory(category);
                setSelectedDetailCategory("전체");
            }
        }, [category])
    );
    async function loadCloset() {
        const closetItems = await getClosetItems();
        setItems(closetItems);
    }
    const categoryFilteredItems = selectedCategory === "전체"
        ? items
        : items.filter((item) => item.category === selectedCategory);
    const detailFilters = [
        "전체",
        ...Array.from(
            new Set(
                categoryFilteredItems
                    .map((item) => item.detailCategory || item.subCategory)
                    .filter((category): category is string => Boolean(category))
            )
        ),
    ];
    const filteredItems = selectedDetailCategory === "전체"
        ? categoryFilteredItems
        : categoryFilteredItems.filter(
            (item) => (item.detailCategory || item.subCategory) === selectedDetailCategory
        );

    function handleDeleteItem(id: string) {
        Alert.alert(
            "옷을 삭제할까요?",
            "삭제하면 옷장에서 바로 사라져요.",
            [
                { text: "취소", style: "cancel" },
                {
                    text: "삭제",
                    style: "destructive",
                    onPress: async () => {
                        const updatedItems = await deleteClosetItem(id);
                        setItems(updatedItems);
                    },
                },
            ]
        );
    }
    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.headerRow}>
                    <View style={styles.headerSide} />

                    <Text style={styles.headerTitle}>옷장</Text>

                    <View style={styles.headerActions}>
                        <Pressable style={styles.iconButton}>
                            <Feather name="search" size={19} color="#111" />
                        </Pressable>
                        <Pressable style={styles.iconButton} onPress={() => router.push("/add-clothes")}>
                            <Feather name="plus" size={21} color="#111" />
                        </Pressable>
                    </View>
                </View>

                {items.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <Feather name="archive" size={22} color="#8c6f47" />
                        </View>

                        <Text style={styles.emptyTitle}>
                            아직 저장된 옷이 없어요
                        </Text>

                        <Text style={styles.emptyText}>
                            상의, 하의, 신발, 아우터를 하나씩 저장하면
                            옷장 기반 코디 추천을 만들 수 있어요.
                        </Text>

                        <Pressable style={styles.primaryButton} onPress={() => router.push("/add-clothes")}>
                            <Feather name="plus" size={15} color="#fff" />
                            <Text style={styles.primaryButtonText}>
                                옷 추가하기
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {CLOSET_FILTERS.map((category) => {
                                const isActive = selectedCategory === category;

                                return (
                                    <Pressable
                                        key={category}
                                        style={[
                                            styles.filterChip,
                                            isActive && styles.filterChipActive,
                                        ]}
                                        onPress={() => {
                                            setSelectedCategory(category);
                                            setSelectedDetailCategory("전체");
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.filterText,
                                                isActive && styles.filterTextActive,
                                            ]}
                                        >
                                            {category}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        {selectedCategory !== "전체" && detailFilters.length > 1 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.detailFilterRow}
                            >
                                {detailFilters.map((category) => {
                                    const isActive = selectedDetailCategory === category;

                                    return (
                                        <Pressable
                                            key={category}
                                            style={[
                                                styles.filterChip,
                                                isActive && styles.filterChipActive,
                                            ]}
                                            onPress={() => setSelectedDetailCategory(category)}
                                        >
                                            <Text
                                                style={[
                                                    styles.filterText,
                                                    isActive && styles.filterTextActive,
                                                ]}
                                            >
                                                {category}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        )}

                        <Text style={styles.countText}>
                            {selectedCategory === "전체"
                                ? `총 ${items.length}개 보유`
                                : `${selectedCategory} ${filteredItems.length}개`}
                        </Text>

                        <View style={styles.closetGrid}>
                            {filteredItems.map((item) => (
                                <Pressable
                                    key={item.id}
                                    style={styles.closetCard}
                                    onPress={() => router.push({
                                        pathname: "/clothes-detail",
                                        params: { id: item.id },
                                    })}
                                >
                                    <Image
                                        source={{ uri: item.imageUri }}
                                        style={styles.closetImage}
                                    />
                                    <Pressable
                                        style={styles.deleteButton}
                                        onPress={() => handleDeleteItem(item.id)}
                                    >
                                        <Feather name="trash-2" size={11} color="#B45309" />
                                    </Pressable>

                                    <Text style={styles.closetCategory}>
                                        {item.detailCategory || item.subCategory || item.category}
                                    </Text>

                                    <Text style={styles.closetSubText}>
                                        {item.category}{item.color ? ` · ${item.color}` : ""}
                                    </Text>
                                </Pressable>
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
    screen: { flex: 1, backgroundColor: "#F7F2EB" },
    container: {
        flexGrow: 1,
        paddingTop: 42,
        paddingHorizontal: 18,
        paddingBottom: 78,
    },

    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 22,
    },
    headerSide: {
        width: 58,
    },
    headerTitle: {
        color: "#111",
        fontSize: 20,
        fontWeight: "700",
        textAlign: "center",
    },
    headerActions: {
        width: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 14,
    },
    iconButton: {
        width: 22,
        height: 22,
        alignItems: "center",
        justifyContent: "center",
    },

    emptyCard: {
        backgroundColor: "#fff",
        borderRadius: 24,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#f0eee9",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },

    emptyIconCircle: {
        width: 46,
        height: 46,
        borderRadius: 999,
        backgroundColor: "#f0e7dc",
        borderWidth: 1,
        borderColor: "#e6d9cb",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },

    emptyTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#111",
        marginBottom: 8,
    },

    emptyText: {
        fontSize: 14,
        color: "#6b6258",
        lineHeight: 22,
        fontWeight: "500",
        textAlign: "center",
        marginBottom: 15,
    },

    primaryButton: {
        backgroundColor: "#111",
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    primaryButtonText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "700",
    },
    filterRow: {
        gap: 9,
        paddingRight: 2,
        marginBottom: 18,
    },
    detailFilterRow: {
        gap: 6,
        paddingRight: 2,
        marginBottom: 10,
    },
    filterChip: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#eee7dd",
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 15,
    },
    filterChipActive: {
        backgroundColor: "#111",
        borderColor: "#111",
    },
    filterText: {
        color: "#111",
        fontSize: 13,
        fontWeight: "600",
    },
    filterTextActive: {
        color: "#fff",
    },
    countText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111",
        marginBottom: 14,
    },

    closetGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: 10,
        rowGap: 18,
    },

    closetCard: {
        width: "31.4%",
        backgroundColor: "transparent",
        borderRadius: 0,
        overflow: "hidden",
    },

    closetImage: {
        width: "100%",
        height: 112,
        borderRadius: 14,
        backgroundColor: "#EFE8DE",
    },

    closetCategory: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111",
        paddingTop: 8,
    },

    closetSubText: {
        fontSize: 11,
        color: "#777064",
        paddingTop: 2,
    },
    deleteButton: {
        position: "absolute",
        top: 6,
        right: 6,
        width: 20,
        height: 20,
        borderRadius: 999,
        backgroundColor: "#F8EFE5",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#F0D8C6",
    },
});
