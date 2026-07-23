import BottomNav, { BOTTOM_NAV_CONTENT_PADDING } from "@/components/BottomNav";
import ClosetItemImage from "@/components/ClosetItemImage";
import { AnalysisImageError } from "@/utils/analysisImage";
import { requestClothesAnalysis } from "@/utils/clothesAnalysis";
import {
    getClosetItemAnalysisUpdateAvailability,
    prepareClosetAnalysisBatch,
} from "@/utils/closetAnalysisRefresh";
import { deleteUnusedClosetItemImages } from "@/utils/closetImageFiles";
import { getClosetItemReviewFields } from "@/utils/closetRegistration";
import {
    filterClosetItemsByQuery,
    resolveClosetDetailFilter,
    sortClosetItems,
    type ClosetSortOrder,
} from "@/utils/closetSearch";
import { endPerformanceTimer, startPerformanceTimer } from "@/utils/performance";
import {
    ClosetItem,
    deleteClosetItems,
    getClosetItemsLoadResult,
    getSavedOutfitsLoadResult,
    updateClosetItemsBatch,
} from "@/utils/storage";
import { colors } from "@/utils/theme";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REVIEW_FILTER = "확인 필요";
const ARCHIVED_FILTER = "보관 중";
const CLOSET_FILTERS = [
    "전체",
    "상의",
    "하의",
    "신발",
    "아우터",
    "액세서리",
    REVIEW_FILTER,
    ARCHIVED_FILTER,
];
const SCREEN_HORIZONTAL_PADDING = 18;
const GRID_GAP = 12;
const GRID_COLUMN_COUNT = 3;
const CLOSET_PAGE_SIZE = 30;

type AnalysisRefreshProgress = {
    current: number;
    total: number;
    updated: number;
    unchanged: number;
    failed: number;
};

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
    const { width: screenWidth } = useWindowDimensions();
    const safeAreaInsets = useSafeAreaInsets();
    const [items, setItems] = useState<ClosetItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("전체");
    const [selectedDetailCategory, setSelectedDetailCategory] = useState("전체");
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState<ClosetSortOrder>("newest");
    const [hasLoadError, setHasLoadError] = useState(false);
    const [visibleWindow, setVisibleWindow] = useState({
        key: "",
        count: CLOSET_PAGE_SIZE,
    });
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
        () => new Set()
    );
    const [isDeletingSelected, setIsDeletingSelected] = useState(false);
    const [isRefreshingAnalysis, setIsRefreshingAnalysis] = useState(false);
    const [analysisRefreshProgress, setAnalysisRefreshProgress] =
        useState<AnalysisRefreshProgress | null>(null);
    const [failedAnalysisItemIds, setFailedAnalysisItemIds] = useState<string[]>([]);

    const closetLoadRequestRef = useRef(0);
    const analysisBatchRequestRef = useRef(0);

    useFocusEffect(
        useCallback(() => {
            void loadCloset();

            if (typeof category === "string") {
                setSelectedCategory(category);
                setSelectedDetailCategory("전체");
            }

            return () => {
                closetLoadRequestRef.current += 1;
                analysisBatchRequestRef.current += 1;
            };
        }, [category])
    );

    async function loadCloset() {
        const requestId = closetLoadRequestRef.current + 1;
        closetLoadRequestRef.current = requestId;
        const timer = startPerformanceTimer("screen.closet.load");
        const result = await getClosetItemsLoadResult();

        if (requestId !== closetLoadRequestRef.current) {
            endPerformanceTimer(timer, {
                itemCount: result.items.length,
                status: result.status,
                stale: true,
            });
            return;
        }

        if (result.status === "loaded") {
            setItems(result.items);
            setHasLoadError(false);
        } else {
            setHasLoadError(true);
        }

        endPerformanceTimer(timer, {
            itemCount: result.items.length,
            status: result.status,
        });
    }

    const categoryItems = useMemo(
        () => selectedCategory === "전체"
            ? items
            : selectedCategory === REVIEW_FILTER
                ? items.filter((item) => getClosetItemReviewFields(item).length > 0)
                : selectedCategory === ARCHIVED_FILTER
                    ? items.filter((item) => item.isArchived === true)
                    : items.filter((item) => item.category === selectedCategory),
        [items, selectedCategory]
    );
    const detailFilters = useMemo(
        () => [
            "전체",
            ...Array.from(new Set(
                categoryItems
                    .map((item) => item.detailCategory || item.subCategory)
                    .filter((detail): detail is string => Boolean(detail?.trim()))
            )),
        ],
        [categoryItems]
    );
    const activeDetailCategory = resolveClosetDetailFilter(
        selectedDetailCategory,
        detailFilters
    );
    useEffect(() => {
        if (selectedDetailCategory !== activeDetailCategory) {
            setSelectedDetailCategory(activeDetailCategory);
        }
    }, [activeDetailCategory, selectedDetailCategory]);
    const detailFilteredItems = useMemo(
        () => activeDetailCategory === "전체"
            ? categoryItems
            : categoryItems.filter(
                (item) => (item.detailCategory || item.subCategory) === activeDetailCategory
            ),
        [activeDetailCategory, categoryItems]
    );
    const filteredItems = useMemo(
        () => filterClosetItemsByQuery(detailFilteredItems, searchQuery),
        [detailFilteredItems, searchQuery]
    );
    const displayedItems = useMemo(
        () => sortClosetItems(filteredItems, sortOrder),
        [filteredItems, sortOrder]
    );
    const visibleWindowKey = [
        selectedCategory,
        activeDetailCategory,
        searchQuery.trim(),
        sortOrder,
    ].join("\u0000");
    const visibleItemCount = visibleWindow.key === visibleWindowKey
        ? visibleWindow.count
        : CLOSET_PAGE_SIZE;
    const visibleItems = useMemo(
        () => displayedItems.slice(0, visibleItemCount),
        [displayedItems, visibleItemCount]
    );
    const remainingItemCount = displayedItems.length - visibleItems.length;
    const hasSearchQuery = searchQuery.trim().length > 0;
    const closetCardWidth = Math.max(
        0,
        Math.floor(
            (screenWidth -
                SCREEN_HORIZONTAL_PADDING * 2 -
                GRID_GAP * (GRID_COLUMN_COUNT - 1)) /
            GRID_COLUMN_COUNT
        )
    );
    const analysisRefreshSummary = useMemo(() => {
        const states = items.map((item) => ({
            item,
            availability: getClosetItemAnalysisUpdateAvailability(item),
        }));
        const updateCandidates = states.filter(
            ({ availability }) =>
                availability.status === "photo_and_classification" ||
                availability.status === "classification_only"
        );

        return {
            updateCandidates,
            availableCount: updateCandidates.length,
            currentCount: states.filter(
                ({ availability }) => availability.status === "current"
            ).length,
            classificationOnlyCount: states.filter(
                ({ availability }) => availability.status === "classification_only"
            ).length,
            unavailableCount: states.filter(
                ({ availability }) => availability.status === "unavailable"
            ).length,
            photoCount: states.filter(
                ({ availability }) => availability.canRefreshPhoto
            ).length,
        };
    }, [items]);

    function enterSelectionMode(id: string) {
        setIsSelectionMode(true);
        setSelectedItemIds(new Set([id]));
    }

    function exitSelectionMode() {
        if (isDeletingSelected) return;

        setIsSelectionMode(false);
        setSelectedItemIds(new Set());
    }

    function toggleSelectedItem(id: string) {
        setSelectedItemIds((currentIds) => {
            const nextIds = new Set(currentIds);

            if (nextIds.has(id)) {
                nextIds.delete(id);
            } else {
                nextIds.add(id);
            }

            return nextIds;
        });
    }

    useEffect(() => {
        if (isSelectionMode && selectedItemIds.size === 0) {
            setIsSelectionMode(false);
        }
    }, [isSelectionMode, selectedItemIds]);

    async function handleDeleteSelectedItems() {
        if (selectedItemIds.size === 0 || isDeletingSelected) return;

        const selectedIds = Array.from(selectedItemIds);
        const selectedIdSet = new Set(selectedIds);
        const selectedItems = items.filter((item) => selectedIdSet.has(item.id));
        const savedOutfitsResult = await getSavedOutfitsLoadResult();

        if (savedOutfitsResult.status === "failed") {
            Alert.alert(
                "삭제 정보를 확인하지 못했어요",
                "저장한 코디에 포함된 옷인지 확인한 뒤 삭제할 수 있어요. 잠시 후 다시 시도해주세요."
            );
            return;
        }

        const affectedSavedOutfitCount = savedOutfitsResult.outfits.filter(
            (outfit) => outfit.itemIds.some((itemId) => selectedIdSet.has(itemId))
        ).length;

        const description =
            affectedSavedOutfitCount > 0
                ? `선택한 옷 중 일부가 저장한 코디 ${affectedSavedOutfitCount}개에 포함되어 있어요. 삭제 후 해당 코디에는 찾을 수 없는 옷으로 표시돼요.`
                : "선택한 옷을 옷장에서 삭제해요.";

        Alert.alert(
            `${selectedIds.length}개의 옷을 삭제할까요?`,
            description,
            [
                {
                    text: "취소",
                    style: "cancel",
                },
                {
                    text: "삭제",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeletingSelected(true);
                        closetLoadRequestRef.current += 1;

                        const updatedItems = await deleteClosetItems(selectedIds);

                        if (!updatedItems) {
                            setIsDeletingSelected(false);
                            Alert.alert(
                                "삭제 실패",
                                "선택한 옷을 삭제하지 못했어요. 다시 시도해주세요."
                            );
                            return;
                        }

                        setItems(updatedItems);
                        setSelectedItemIds(new Set());
                        setIsSelectionMode(false);
                        setIsDeletingSelected(false);

                        for (const deletedItem of selectedItems) {
                            try {
                                await deleteUnusedClosetItemImages(
                                    deletedItem,
                                    updatedItems
                                );
                            } catch (error) {
                                console.error("옷 이미지 파일 정리 실패:", error);
                            }
                        }
                    },
                },
            ]
        );
    }

    async function runClosetAnalysisRefresh(targetItemIds?: string[]) {
        if (isRefreshingAnalysis) return;

        const requestedIds = targetItemIds ? new Set(targetItemIds) : null;
        const targets = analysisRefreshSummary.updateCandidates
            .filter(({ item }) => !requestedIds || requestedIds.has(item.id))
            .map(({ item }) => item);

        if (targets.length === 0) {
            Alert.alert("업데이트할 옷이 없어요", "현재 업데이트 가능한 옷은 모두 최신 상태예요.");
            return;
        }

        const requestId = analysisBatchRequestRef.current + 1;
        analysisBatchRequestRef.current = requestId;

        setIsRefreshingAnalysis(true);
        setFailedAnalysisItemIds([]);
        setAnalysisRefreshProgress({
            current: 0,
            total: targets.length,
            updated: 0,
            unchanged: 0,
            failed: 0,
        });

        try {
            const batchResult = await prepareClosetAnalysisBatch(targets, {
                requestPhotoAnalysis: (imageUri, currentItem) =>
                    requestClothesAnalysis(imageUri, currentItem.confirmedProduct),
                shouldFallbackToLocal: (error) => error instanceof AnalysisImageError,
                isCancelled: () => requestId !== analysisBatchRequestRef.current,
                onProgress: setAnalysisRefreshProgress,
                onItemPrepared: (currentItem, result) => {
                    if (!__DEV__) return;
                    console.info("[closet-analysis-refresh]", {
                        itemId: currentItem.id,
                        previousClassificationVersion:
                            currentItem.classificationVersion || 0,
                        nextClassificationVersion:
                            result.item.classificationVersion || 0,
                        previousPhotoAnalysisVersion:
                            currentItem.photoAnalysisVersion || 0,
                        nextPhotoAnalysisVersion:
                            result.item.photoAnalysisVersion || 0,
                        changedFields: result.diffs.map((diff) => diff.field),
                        skippedUserEditedFields: result.skippedUserEditedFields,
                        source: result.changes.photoAnalysisVersion
                            ? "photo_and_classification"
                            : "classification",
                    });
                },
                onItemError: (currentItem, error) =>
                    console.error("옷장 개별 분석 최신화 실패:", {
                        itemId: currentItem.id,
                        error,
                    }),
            });
            if (batchResult.cancelled || requestId !== analysisBatchRequestRef.current) return;
            const updatedItems =
                batchResult.updates.length > 0
                    ? await updateClosetItemsBatch(batchResult.updates)
                    : items;

            if (requestId !== analysisBatchRequestRef.current) return;
            if (!updatedItems) {
                setFailedAnalysisItemIds(targets.map((item) => item.id));
                Alert.alert(
                    "업데이트 저장 실패",
                    "분석 결과를 저장하지 못해 기존 옷장 정보를 그대로 유지했어요."
                );
                return;
            }

            setItems(updatedItems);
            setFailedAnalysisItemIds(batchResult.failedItemIds);
            setAnalysisRefreshProgress({
                current: targets.length,
                total: targets.length,
                updated: batchResult.updated,
                unchanged: batchResult.unchanged,
                failed: batchResult.failedItemIds.length,
            });
            Alert.alert(
                "옷장 분석 최신화 완료",
                `완료 ${batchResult.updated} · 변경 없음 ${batchResult.unchanged} · 실패 ${batchResult.failedItemIds.length}`
            );
        } finally {
            if (requestId === analysisBatchRequestRef.current) {
                setIsRefreshingAnalysis(false);
            }
        }
    }

    function handleClosetAnalysisRefresh(targetItemIds?: string[]) {
        if (isRefreshingAnalysis) return;

        const requestedIds = targetItemIds ? new Set(targetItemIds) : null;
        const targets = analysisRefreshSummary.updateCandidates.filter(
            ({ item }) => !requestedIds || requestedIds.has(item.id)
        );
        if (targets.length === 0) {
            Alert.alert("업데이트할 옷이 없어요", "현재 업데이트 가능한 옷은 모두 최신 상태예요.");
            return;
        }

        const photoCount = targets.filter(
            ({ availability }) => availability.canRefreshPhoto
        ).length;
        const message =
            photoCount > 0
                ? `${targets.length}개 중 ${photoCount}개의 원본 사진을 분석 서버에 순서대로 다시 보냅니다. 직접 수정한 정보와 기존 사진은 유지돼요.`
                : `${targets.length}개의 확정 상품 정보와 최신 분류 기준을 다시 적용합니다. 사진은 전송하지 않아요.`;

        Alert.alert("옷장 분석 최신화", message, [
            { text: "취소", style: "cancel" },
            {
                text: "시작",
                onPress: () => void runClosetAnalysisRefresh(targetItemIds),
            },
        ]);
    }


    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.headerRow}>
                    {isSelectionMode ? (
                        <>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="선택 취소"
                                style={styles.selectionHeaderSide}
                                disabled={isDeletingSelected}
                                onPress={exitSelectionMode}
                            >
                                <Feather name="x" size={22} color={colors.text} />
                            </Pressable>

                            <Text style={styles.headerTitle}>
                                {selectedItemIds.size}개 선택
                            </Text>

                            <View style={styles.selectionHeaderSide} />
                        </>
                    ) : (
                        <>
                            <View style={styles.headerSide} />

                            <Text style={styles.headerTitle}>옷장</Text>

                            <View style={styles.headerActions}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={isSearchVisible ? "옷장 검색 닫기" : "옷장 검색"}
                                    style={styles.iconButton}
                                    onPress={() => {
                                        setIsSearchVisible((visible) => {
                                            if (visible) setSearchQuery("");
                                            return !visible;
                                        });
                                    }}
                                >
                                    <Feather
                                        name={isSearchVisible ? "x" : "search"}
                                        size={22}
                                        color={colors.text}
                                    />
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="옷 추가"
                                    style={styles.iconButton}
                                    onPress={() => router.push("/add-clothes")}
                                >
                                    <Feather name="plus" size={24} color={colors.text} />
                                </Pressable>
                            </View>
                        </>
                    )}
                </View>

                {!isSelectionMode && isSearchVisible && items.length > 0 ? (
                    <View style={styles.searchBox}>
                        <Feather name="search" size={17} color={colors.subText} />
                        <TextInput
                            autoFocus
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="종류, 상품명, 브랜드, 색상 검색"
                            placeholderTextColor={colors.subText}
                            returnKeyType="search"
                            style={styles.searchInput}
                        />
                        {hasSearchQuery ? (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="검색어 지우기"
                                hitSlop={8}
                                onPress={() => setSearchQuery("")}
                            >
                                <Feather name="x-circle" size={17} color={colors.subText} />
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}

                {hasLoadError ? (
                    <View style={styles.loadErrorCard}>
                        <Feather name="alert-circle" size={20} color={colors.warning} />
                        <View style={styles.reviewCompleteTextBox}>
                            <Text style={styles.reviewCompleteTitle}>옷장을 불러오지 못했어요</Text>
                            <Text style={styles.reviewCompleteText}>
                                저장된 옷은 그대로 있어요. 잠시 후 다시 시도해주세요.
                            </Text>
                        </View>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="옷장 다시 불러오기"
                            style={styles.loadErrorAction}
                            onPress={loadCloset}
                        >
                            <Text style={styles.loadErrorActionText}>다시 시도</Text>
                        </Pressable>
                    </View>
                ) : null}

                {items.length === 0 && hasLoadError ? null : items.length === 0 ? (
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
                        <View style={styles.analysisRefreshCard}>
                            <View style={styles.analysisRefreshHeader}>
                                <View style={styles.analysisRefreshIcon}>
                                    <Feather name="refresh-cw" size={16} color={colors.point} />
                                </View>
                                <View style={styles.analysisRefreshTextWrap}>
                                    <Text style={styles.analysisRefreshTitle}>옷장 분석 최신화</Text>
                                    <Text style={styles.analysisRefreshDescription}>
                                        업데이트 가능 {analysisRefreshSummary.availableCount} · 최신{" "}
                                        {analysisRefreshSummary.currentCount} · 분류만 가능{" "}
                                        {analysisRefreshSummary.classificationOnlyCount} · 자동 분석 불가{" "}
                                        {analysisRefreshSummary.unavailableCount}
                                    </Text>
                                </View>
                            </View>
                            {analysisRefreshProgress ? (
                                <Text style={styles.analysisRefreshProgressText}>
                                    {isRefreshingAnalysis
                                        ? `${analysisRefreshProgress.current}/${analysisRefreshProgress.total} 분석 중`
                                        : `완료 ${analysisRefreshProgress.updated} · 변경 없음 ${analysisRefreshProgress.unchanged} · 실패 ${analysisRefreshProgress.failed}`}
                                </Text>
                            ) : null}
                            <View style={styles.analysisRefreshActions}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="옷장 분석 최신화"
                                    disabled={
                                        isRefreshingAnalysis ||
                                        analysisRefreshSummary.availableCount === 0
                                    }
                                    style={[
                                        styles.analysisRefreshButton,
                                        (isRefreshingAnalysis ||
                                            analysisRefreshSummary.availableCount === 0) &&
                                            styles.analysisRefreshButtonDisabled,
                                    ]}
                                    onPress={() => handleClosetAnalysisRefresh()}
                                >
                                    <Text style={styles.analysisRefreshButtonText}>
                                        {isRefreshingAnalysis
                                            ? "분석 중"
                                            : analysisRefreshSummary.availableCount > 0
                                                ? `${analysisRefreshSummary.availableCount}개 최신화`
                                                : "모두 최신 상태"}
                                    </Text>
                                </Pressable>
                                {failedAnalysisItemIds.length > 0 && !isRefreshingAnalysis ? (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`실패한 옷 ${failedAnalysisItemIds.length}개 다시 시도`}
                                        style={styles.analysisRefreshRetryButton}
                                        onPress={() =>
                                            handleClosetAnalysisRefresh(failedAnalysisItemIds)
                                        }
                                    >
                                        <Text style={styles.analysisRefreshRetryText}>
                                            실패 {failedAnalysisItemIds.length}개 재시도
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>

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
                            selectedCategory !== ARCHIVED_FILTER &&
                            detailFilters.length > 1 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.detailFilterRow}
                            >
                                {detailFilters.map((filter) => {
                                    const isActive = activeDetailCategory === filter;

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

                        <View style={styles.listHeaderRow}>
                            <Text style={styles.countText}>
                                {hasSearchQuery
                                    ? `검색 결과 ${filteredItems.length}개`
                                    : selectedCategory === "전체"
                                        ? `전체 ${items.length}개`
                                        : selectedCategory === REVIEW_FILTER
                                            ? `${REVIEW_FILTER} ${filteredItems.length}개`
                                            : selectedCategory === ARCHIVED_FILTER
                                                ? `${ARCHIVED_FILTER} ${filteredItems.length}개`
                                                : activeDetailCategory === "전체"
                                                    ? `${selectedCategory} ${filteredItems.length}개`
                                                    : `${activeDetailCategory} ${filteredItems.length}개`}
                            </Text>
                            <View style={styles.sortControl}>
                                {(["newest", "oldest"] as const).map((order) => {
                                    const isActive = sortOrder === order;

                                    return (
                                        <Pressable
                                            key={order}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: isActive }}
                                            style={[
                                                styles.sortOption,
                                                isActive && styles.sortOptionActive,
                                            ]}
                                            onPress={() => setSortOrder(order)}
                                        >
                                            <Text
                                                style={[
                                                    styles.sortOptionText,
                                                    isActive && styles.sortOptionTextActive,
                                                ]}
                                            >
                                                {order === "newest" ? "최신순" : "오래된순"}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        {hasSearchQuery && filteredItems.length === 0 ? (
                            <View style={styles.reviewCompleteCard}>
                                <Feather name="search" size={20} color={colors.point} />
                                <View style={styles.reviewCompleteTextBox}>
                                    <Text style={styles.reviewCompleteTitle}>검색 결과가 없어요</Text>
                                    <Text style={styles.reviewCompleteText}>
                                        다른 종류, 상품명, 브랜드나 색상으로 검색해보세요.
                                    </Text>
                                </View>
                            </View>
                        ) : selectedCategory === REVIEW_FILTER && filteredItems.length === 0 ? (
                            <View style={styles.reviewCompleteCard}>
                                <Feather name="check-circle" size={20} color={colors.point} />
                                <View style={styles.reviewCompleteTextBox}>
                                    <Text style={styles.reviewCompleteTitle}>확인할 옷이 없어요</Text>
                                    <Text style={styles.reviewCompleteText}>
                                        종류, 색상, 계절 정보가 모두 추천에 사용할 수 있는 상태예요.
                                    </Text>
                                </View>
                            </View>
                        ) : selectedCategory === ARCHIVED_FILTER && filteredItems.length === 0 ? (
                            <View style={styles.reviewCompleteCard}>
                                <Feather name="archive" size={20} color={colors.point} />
                                <View style={styles.reviewCompleteTextBox}>
                                    <Text style={styles.reviewCompleteTitle}>보관 중인 옷이 없어요</Text>
                                    <Text style={styles.reviewCompleteText}>
                                        상세 화면에서 잠시 쉬고 싶은 옷을 추천 대상에서 제외할 수 있어요.
                                    </Text>
                                </View>
                            </View>
                        ) : filteredItems.length === 0 ? (
                            <View style={styles.reviewCompleteCard}>
                                <Feather name="archive" size={20} color={colors.point} />
                                <View style={styles.reviewCompleteTextBox}>
                                    <Text style={styles.reviewCompleteTitle}>
                                        {activeDetailCategory === "전체"
                                            ? `${selectedCategory}에 저장된 옷이 없어요`
                                            : `${activeDetailCategory}에 저장된 옷이 없어요`}
                                    </Text>
                                    <Text style={styles.reviewCompleteText}>
                                        다른 분류를 선택하거나 새 옷을 추가해보세요.
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <>
                                <View style={styles.closetGrid}>
                                    {visibleItems.map((item) => {
                                        const reviewLabel = getRecommendationInfoReviewLabel(item);

                                        return (
                                            <Pressable
                                                key={item.id}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: selectedItemIds.has(item.id) }}
                                                style={[
                                                    styles.closetCard,
                                                    { width: closetCardWidth },
                                                    selectedItemIds.has(item.id) && styles.closetCardSelected,
                                                ]}
                                                onPress={() => {
                                                    if (isSelectionMode) {
                                                        toggleSelectedItem(item.id);
                                                        return;
                                                    }

                                                    router.push({
                                                        pathname: "/clothes-detail",
                                                        params: { id: item.id },
                                                    });
                                                }}
                                                onLongPress={() => {
                                                    if (isSelectionMode) {
                                                        toggleSelectedItem(item.id);
                                                        return;
                                                    }

                                                    enterSelectionMode(item.id);
                                                }}
                                            >
                                                <View style={styles.imageBox}>
                                                    {isSelectionMode ? (
                                                        <View
                                                            style={[
                                                                styles.selectionCheck,
                                                                selectedItemIds.has(item.id) &&
                                                                    styles.selectionCheckSelected,
                                                            ]}
                                                        >
                                                            {selectedItemIds.has(item.id) ? (
                                                                <Feather name="check" size={14} color={colors.card} />
                                                            ) : null}
                                                        </View>
                                                    ) : null}
                                                    <ClosetItemImage
                                                        item={item}
                                                        style={[
                                                            styles.closetImage,
                                                            item.isArchived && styles.closetImageArchived,
                                                        ]}
                                                        contentFit="contain"
                                                    />
                                                    {item.isArchived ? (
                                                        <View style={styles.archivedBadge}>
                                                            <Feather name="archive" size={10} color={colors.point} />
                                                            <Text style={styles.archivedBadgeText}>보관 중</Text>
                                                        </View>
                                                    ) : null}
                                                    {!isSelectionMode && reviewLabel ? (
                                                        <Pressable
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`${reviewLabel} 정보 수정`}
                                                            style={styles.infoReviewBadge}
                                                            onPress={(event) => {
                                                                event.stopPropagation();

                                                                if (isSelectionMode) {
                                                                    toggleSelectedItem(item.id);
                                                                    return;
                                                                }

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
                                {remainingItemCount > 0 ? (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`옷장 아이템 ${Math.min(
                                            CLOSET_PAGE_SIZE,
                                            remainingItemCount
                                        )}개 더 보기`}
                                        style={styles.loadMoreButton}
                                        onPress={() =>
                                            setVisibleWindow({
                                                key: visibleWindowKey,
                                                count: visibleItemCount + CLOSET_PAGE_SIZE,
                                            })
                                        }
                                    >
                                        <Text style={styles.loadMoreButtonText}>
                                            더 보기 · {remainingItemCount}개 남음
                                        </Text>
                                        <Feather name="chevron-down" size={15} color={colors.point} />
                                    </Pressable>
                                ) : null}
                            </>
                        )}
                    </View>
                )}
            </ScrollView>

            {isSelectionMode ? (
                <View
                    style={[
                        styles.selectionActionBar,
                        { paddingBottom: Math.max(safeAreaInsets.bottom, 16) },
                    ]}
                >
                    <View style={styles.selectionActionTextBox}>
                        <Text style={styles.selectionActionCount}>
                            {selectedItemIds.size}개 선택됨
                        </Text>
                        <Text style={styles.selectionActionHint}>
                            삭제할 옷을 더 선택할 수 있어요
                        </Text>
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`선택한 옷 ${selectedItemIds.size}개 삭제`}
                        disabled={selectedItemIds.size === 0 || isDeletingSelected}
                        style={[
                            styles.selectionDeleteButton,
                            (selectedItemIds.size === 0 || isDeletingSelected) &&
                                styles.selectionDeleteButtonDisabled,
                        ]}
                        onPress={handleDeleteSelectedItems}
                    >
                        <Feather name="trash-2" size={17} color={colors.card} />
                        <Text style={styles.selectionDeleteButtonText}>
                            {isDeletingSelected ? "삭제 중" : "삭제"}
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <BottomNav activeTab="closet" />
            )}
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
    selectionHeaderSide: {
        width: 64,
        minHeight: 32,
        alignItems: "flex-start",
        justifyContent: "center",
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
    searchBox: {
        minHeight: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingHorizontal: 13,
        marginTop: -10,
        marginBottom: 18,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 10,
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
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
    analysisRefreshCard: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 18,
        padding: 14,
        marginBottom: 16,
        gap: 10,
    },
    analysisRefreshHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 9,
    },
    analysisRefreshIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.softCard,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    analysisRefreshTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    analysisRefreshTitle: {
        color: colors.text,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "800",
    },
    analysisRefreshDescription: {
        color: colors.subText,
        fontSize: 10,
        lineHeight: 16,
        fontWeight: "600",
        marginTop: 2,
    },
    analysisRefreshProgressText: {
        color: colors.point,
        fontSize: 11,
        lineHeight: 16,
        fontWeight: "700",
    },
    analysisRefreshActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    analysisRefreshButton: {
        minHeight: 38,
        borderRadius: 13,
        backgroundColor: colors.text,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 13,
        flex: 1,
        minWidth: 0,
    },
    analysisRefreshButtonDisabled: {
        opacity: 0.45,
    },
    analysisRefreshButtonText: {
        color: colors.card,
        fontSize: 11,
        lineHeight: 16,
        fontWeight: "800",
        textAlign: "center",
    },
    analysisRefreshRetryButton: {
        minHeight: 38,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.softCard,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
        flexShrink: 0,
    },
    analysisRefreshRetryText: {
        color: colors.point,
        fontSize: 10,
        lineHeight: 15,
        fontWeight: "800",
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
    },
    listHeaderRow: {
        minHeight: 32,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
    },
    sortControl: {
        flexDirection: "row",
        borderRadius: 10,
        backgroundColor: colors.softCard,
        padding: 3,
        flexShrink: 0,
    },
    sortOption: {
        minHeight: 26,
        justifyContent: "center",
        borderRadius: 8,
        paddingHorizontal: 8,
    },
    sortOptionActive: {
        backgroundColor: colors.card,
    },
    sortOptionText: {
        color: colors.subText,
        fontSize: 10,
        fontWeight: "700",
    },
    sortOptionTextActive: {
        color: colors.point,
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
    loadErrorCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    loadErrorAction: {
        minHeight: 30,
        justifyContent: "center",
        borderRadius: 10,
        paddingHorizontal: 10,
        backgroundColor: colors.softCard,
        flexShrink: 0,
    },
    loadErrorActionText: {
        color: colors.point,
        fontSize: 11,
        fontWeight: "700",
    },
    closetGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: GRID_GAP,
        rowGap: 18,
    },
    loadMoreButton: {
        minHeight: 44,
        marginTop: 18,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.softCard,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    loadMoreButtonText: {
        color: colors.point,
        fontSize: 12,
        fontWeight: "700",
    },
    closetCard: {
        minWidth: 0,
    },
    closetCardSelected: {
        opacity: 0.82,
    },
    selectionCheck: {
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 5,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.card,
        backgroundColor: "rgba(0, 0, 0, 0.28)",
        alignItems: "center",
        justifyContent: "center",
    },
    selectionCheckSelected: {
        backgroundColor: colors.point,
        borderColor: colors.point,
    },
    imageBox: {
        width: "100%",
        aspectRatio: 1,
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
    closetImageArchived: {
        opacity: 0.58,
    },
    archivedBadge: {
        position: "absolute",
        right: 7,
        bottom: 7,
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
    archivedBadgeText: {
        color: colors.point,
        fontSize: 9,
        lineHeight: 12,
        fontWeight: "800",
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
    selectionActionBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: 82,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.card,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
    },
    selectionActionTextBox: {
        flex: 1,
        minWidth: 0,
    },
    selectionActionCount: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "800",
    },
    selectionActionHint: {
        color: colors.subText,
        fontSize: 11,
        fontWeight: "600",
        marginTop: 3,
    },
    selectionDeleteButton: {
        minHeight: 42,
        paddingHorizontal: 17,
        borderRadius: 14,
        backgroundColor: "#C94A4A",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        flexShrink: 0,
    },
    selectionDeleteButtonDisabled: {
        opacity: 0.45,
    },
    selectionDeleteButtonText: {
        color: colors.card,
        fontSize: 13,
        fontWeight: "800",
    },
});
