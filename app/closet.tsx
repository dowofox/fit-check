import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import ClosetItemImage from "@/components/ClosetItemImage";
import { getClosetItemReviewFields } from "@/utils/closetRegistration";
import { endPerformanceTimer, startPerformanceTimer } from "@/utils/performance";
import { getSavedOutfitUsageCount } from "@/utils/savedOutfitIntegrity";
import {
    ClosetItem,
    deleteClosetItem,
    getClosetItems,
    getSavedOutfits,
} from "@/utils/storage";
import { colors } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const REVIEW_FILTER = "확인 필요";
const CLOSET_FILTERS = ["전체", "상의", "하의", "신발", "아우터", "액세서리", REVIEW_FILTER];
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

function getRecommendationInfoReviewLabel(item: ClosetItem) {
    const reviewFields = getClosetItemReviewFields(item);

    if (reviewFields.length === 1 && reviewFields[0] === "season") return "계절 확인";
    return reviewFields.length > 0 ? "정보 확인" : "";
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
        const timer = startPerformanceTimer("screen.closet.load");
        const closetItems = await getClosetItems();
        setItems(closetItems);
        endPerformanceTimer(timer, { itemCount: closetItems.length });
    }

    const categoryItems = selectedCategory === "전체"
        ? items
        : selectedCategory === REVIEW_FILTER
            ? items.filter((item) => getClosetItemReviewFields(item).length > 0)
            : items.filter((item) => item.category === selectedCategory);
    const detailFilters = [
        "전체",
        ...Array.from(new Set(
            categoryItems
                .map((item) => item.detailCategory || item.subCategory)
                .filter((detail): detail is string => Boolean(detail?.trim()))
        )),
    ];
    const filteredItems = selectedDetailCategory === "전체"
        ? categoryItems
        : categoryItems.filter(
            (item) => (item.detailCategory || item.subCategory) === selectedDetailCategory
        );

    async function handleDeleteItem(id: string) {
        const savedOutfits = await getSavedOutfits();
        const savedOutfitUsageCount = getSavedOutfitUsageCount(savedOutfits, id);
        const description = savedOutfitUsageCount > 0
            ? `저장한 코디 ${savedOutfitUsageCount}개에 포함된 옷이에요. 삭제 후 해당 코디에는 찾을 수 없는 옷으로 표시돼요.`
            : "삭제하면 옷장에서 바로 사라져요.";

        Alert.alert(
            "옷을 삭제할까요?",
            description,
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
                                        onPress={() => {
                                            setSelectedCategory(filter);
                                            setSelectedDetailCategory("전체");
                                        }}
                                    >
                                        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                                            {filter}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        {selectedCategory !== "전체" &&
                        selectedCategory !== REVIEW_FILTER &&
                        detailFilters.length > 1 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.detailFilterRow}
                            >
                                {detailFilters.map((filter) => {
                                    const isActive = selectedDetailCategory === filter;

                                    return (
                                        <Pressable
                                            key={filter}
                                            style={[
                                                styles.detailFilterChip,
                                                isActive && styles.detailFilterChipActive,
                                            ]}
                                            onPress={() => setSelectedDetailCategory(filter)}
                                        >
                                            <Text
                                                style={[
                                                    styles.detailFilterText,
                                                    isActive && styles.detailFilterTextActive,
                                                ]}
                                            >
                                                {filter}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        ) : null}

                        <Text style={styles.countText}>
                            {selectedCategory === "전체"
                                ? `전체 ${items.length}개`
                                : selectedCategory === REVIEW_FILTER
                                    ? `${REVIEW_FILTER} ${filteredItems.length}개`
                                : selectedDetailCategory === "전체"
                                    ? `${selectedCategory} ${filteredItems.length}개`
                                    : `${selectedDetailCategory} ${filteredItems.length}개`}
                        </Text>

                        {selectedCategory === REVIEW_FILTER && filteredItems.length === 0 ? (
                            <View style={styles.reviewCompleteCard}>
                                <Feather name="check-circle" size={20} color={colors.point} />
                                <View style={styles.reviewCompleteTextBox}>
                                    <Text style={styles.reviewCompleteTitle}>확인할 옷이 없어요</Text>
                                    <Text style={styles.reviewCompleteText}>
                                        종류, 색상, 계절 정보가 모두 추천에 사용할 수 있는 상태예요.
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.closetGrid}>
                                {filteredItems.map((item) => {
                                    const reviewLabel = getRecommendationInfoReviewLabel(item);

                                    return (
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
                                                <ClosetItemImage
                                                    item={item}
                                                    style={styles.closetImage}
                                                    contentFit="contain"
                                                />
                                                {reviewLabel ? (
                                                    <Pressable
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`${reviewLabel} 정보 수정`}
                                                        style={styles.infoReviewBadge}
                                                        onPress={(event) => {
                                                            event.stopPropagation();
                                                            router.push({
                                                                pathname: "/clothes-detail",
                                                                params: {
                                                                    id: item.id,
                                                                    openEdit:
                                                                        reviewLabel === "계절 확인"
                                                                            ? "season"
                                                                            : "1",
                                                                },
                                                            });
                                                        }}
                                                    >
                                                        <Feather name="alert-circle" size={11} color={colors.warning} />
                                                        <Text style={styles.infoReviewBadgeText}>{reviewLabel}</Text>
                                                    </Pressable>
                                                ) : null}
                                            </View>

                                            <Text style={styles.closetCategory} numberOfLines={1}>
                                                {getItemTitle(item)}
                                            </Text>

                                            <Text style={styles.closetSubText} numberOfLines={1}>
                                                {formatDate(item.createdAt)}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
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
        paddingBottom: BOTTOM_NAV_CONTENT_PADDING,
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
    detailFilterRow: {
        gap: 8,
        paddingRight: 18,
        marginTop: -8,
        marginBottom: 16,
    },
    detailFilterChip: {
        backgroundColor: colors.softCard,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 13,
    },
    detailFilterChipActive: {
        backgroundColor: colors.point,
        borderColor: colors.point,
    },
    detailFilterText: {
        color: colors.subText,
        fontSize: 12,
        fontWeight: "700",
    },
    detailFilterTextActive: {
        color: colors.card,
    },
    countText: {
        fontSize: 18,
        fontWeight: "800",
        color: colors.text,
        marginBottom: 14,
    },
    reviewCompleteCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    reviewCompleteTextBox: {
        flex: 1,
        minWidth: 0,
    },
    reviewCompleteTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "800",
    },
    reviewCompleteText: {
        color: colors.subText,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: "600",
        marginTop: 3,
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
    },
    infoReviewBadge: {
        position: "absolute",
        top: 7,
        left: 7,
        minHeight: 24,
        borderRadius: 999,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 7,
    },
    infoReviewBadgeText: {
        color: colors.warning,
        fontSize: 9,
        lineHeight: 12,
        fontWeight: "800",
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
