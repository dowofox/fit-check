import BottomNav from "@/components/BottomNav";
import {
    ClosetItem,
    deleteClosetItem,
    getClosetItems,
} from "@/utils/storage";
import { colors } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    Dimensions,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const CLOSET_FILTERS = ["전체", "상의", "하의", "신발", "아우터", "액세서리"];
const SCREEN_HORIZONTAL_PADDING = 18;
const GRID_GAP = 12;
const GRID_COLUMN_COUNT = 3;
const CLOSET_CARD_WIDTH = Math.floor(
    (Dimensions.get("window").width - SCREEN_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMN_COUNT - 1))
    / GRID_COLUMN_COUNT
);

function getItemTitle(item: ClosetItem) {
    return item.detailCategory || item.subCategory || item.category || "아이템";
}

function formatDate(value?: string) {
    if (!value) return "날짜 없음";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "날짜 없음";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}.${month}.${day}`;
}

export default function ClosetScreen() {
    const { category } = useLocalSearchParams<{ category?: string }>();
    const [items, setItems] = useState<ClosetItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("전체");

    useFocusEffect(
        useCallback(() => {
            loadCloset();

            if (typeof category === "string") {
                setSelectedCategory(category);
            }
        }, [category])
    );

    async function loadCloset() {
        const closetItems = await getClosetItems();
        setItems(closetItems);
    }

    const filteredItems = selectedCategory === "전체"
        ? items
        : items.filter((item) => item.category === selectedCategory);

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
                            <Feather name="search" size={22} color={colors.text} />
                        </Pressable>
                        <Pressable style={styles.iconButton} onPress={() => router.push("/add-clothes")}>
                            <Feather name="plus" size={24} color={colors.text} />
                        </Pressable>
                    </View>
                </View>

                {items.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <View style={styles.emptyIconCircle}>
                            <Feather name="archive" size={22} color={colors.point} />
                        </View>

                        <Text style={styles.emptyTitle}>아직 저장된 옷이 없어요</Text>

                        <Text style={styles.emptyText}>
                            상의, 하의, 신발, 아우터를 하나씩 저장하면
                            옷장 기반 코디 추천을 만들 수 있어요.
                        </Text>

                        <Pressable style={styles.primaryButton} onPress={() => router.push("/add-clothes")}>
                            <Feather name="plus" size={15} color={colors.card} />
                            <Text style={styles.primaryButtonText}>옷 추가하기</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {CLOSET_FILTERS.map((filter) => {
                                const isActive = selectedCategory === filter;

                                return (
                                    <Pressable
                                        key={filter}
                                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                                        onPress={() => setSelectedCategory(filter)}
                                    >
                                        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                                            {filter}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        <Text style={styles.countText}>
                            {selectedCategory === "전체"
                                ? `전체 ${items.length}개`
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
                                    onLongPress={() => handleDeleteItem(item.id)}
                                >
                                    <View style={styles.imageBox}>
                                        <Image
                                            source={{ uri: item.imageUri }}
                                            style={styles.closetImage}
                                        />
                                    </View>

                                    <Text style={styles.closetCategory} numberOfLines={1}>
                                        {getItemTitle(item)}
                                    </Text>

                                    <Text style={styles.closetSubText} numberOfLines={1}>
                                        {formatDate(item.createdAt)}
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
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flexGrow: 1,
        paddingTop: 42,
        paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
        paddingBottom: 132,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    headerSide: {
        width: 64,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: "800",
        textAlign: "center",
    },
    headerActions: {
        width: 64,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 18,
    },
    iconButton: {
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
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
        backgroundColor: colors.softCard,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: colors.subText,
        lineHeight: 22,
        fontWeight: "500",
        textAlign: "center",
        marginBottom: 15,
    },
    primaryButton: {
        backgroundColor: colors.text,
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    primaryButtonText: {
        color: colors.card,
        fontSize: 12,
        fontWeight: "700",
    },
    filterRow: {
        gap: 10,
        paddingRight: 18,
        marginBottom: 18,
    },
    filterChip: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingVertical: 9,
        paddingHorizontal: 18,
    },
    filterChipActive: {
        backgroundColor: colors.text,
        borderColor: colors.text,
    },
    filterText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "700",
    },
    filterTextActive: {
        color: colors.card,
    },
    countText: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.text,
        marginBottom: 14,
    },
    closetGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: GRID_GAP,
        rowGap: 18,
    },
    closetCard: {
        width: CLOSET_CARD_WIDTH,
    },
    imageBox: {
        width: "100%",
        height: CLOSET_CARD_WIDTH,
        borderRadius: 12,
        backgroundColor: colors.softCard,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
    },
    closetImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    closetCategory: {
        fontSize: 12,
        fontWeight: "800",
        color: colors.text,
        paddingTop: 8,
    },
    closetSubText: {
        fontSize: 10,
        color: colors.subText,
        fontWeight: "500",
        paddingTop: 3,
    },
});
