import {
  API_ENDPOINTS,
  API_TIMEOUTS,
  fetchApiWithTimeout,
} from "@/utils/api";
import { encodeAnalysisImageUri } from "@/utils/analysisImage";
import { getUserProfile, saveAnalysis } from "@/utils/storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AnalyzingScreen() {
    const { imageUri } = useLocalSearchParams();

    useEffect(() => {
        const analyzeOutfit = async () => {
            try {
                const profile = await getUserProfile();
                const encodedImage = await encodeAnalysisImageUri(imageUri as string);

                const response = await fetchApiWithTimeout(API_ENDPOINTS.analyze, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        image: encodedImage.base64,
                        profile,
                    }),
                }, API_TIMEOUTS.analyze);

                const data = await response.json();

                const savedResult = {
                    id: String(Date.now()),
                    createdAt: new Date().toISOString(),
                    imageUri: imageUri as string,
                    score: data.score,
                    riskLevel: data.riskLevel,
                    fitScore: data.fitScore,
                    colorScore: data.colorScore,
                    balanceScore: data.balanceScore,
                    bodyFitScore: data.bodyFitScore,
                    itemScore: data.itemScore,
                    seasonScore: data.seasonScore,
                    trendScore: data.trendScore,
                    finishScore: data.finishScore,
                    fitComment: data.fitComment,
                    colorComment: data.colorComment,
                    balanceComment: data.balanceComment,
                    bodyFitComment: data.bodyFitComment,
                    itemComment: data.itemComment,
                    seasonComment: data.seasonComment,
                    trendComment: data.trendComment,
                    finishComment: data.finishComment,
                    summary: data.summary,
                    point: data.point,
                    problems: data.problems,
                    improvement: data.improvement,
                };

                await saveAnalysis(savedResult);

                router.replace({
                    pathname: "/result",
                    params: savedResult,
                });
            } catch (error) {
                console.error(error);

                router.replace({
                    pathname: "/result",
                    params: {
                        score: "0",
                        imageUri: imageUri as string,
                        riskLevel: "분석 실패",
                        fitScore: "0",
                        colorScore: "0",
                        balanceScore: "0",
                        bodyFitScore: "0",
                        itemScore: "0",
                        seasonScore: "0",
                        trendScore: "0",
                        finishScore: "0",
                        fitComment: "서버 연결에 실패해 핏 평가를 불러오지 못했어요.",
                        colorComment: "서버 연결에 실패해 색조합 평가를 불러오지 못했어요.",
                        balanceComment: "서버 연결에 실패해 비율 평가를 불러오지 못했어요.",
                        bodyFitComment: "서버 연결에 실패해 체형 적합 평가를 불러오지 못했어요.",
                        itemComment: "서버 연결에 실패해 아이템 조화 평가를 불러오지 못했어요.",
                        seasonComment: "서버 연결에 실패해 계절감 평가를 불러오지 못했어요.",
                        trendComment: "서버 연결에 실패해 트렌드 평가를 불러오지 못했어요.",
                        finishComment: "서버 연결에 실패해 완성도 평가를 불러오지 못했어요.",
                        point: "-",
                        problems: "-",
                        improvement: "서버 연결에 실패했어요.",
                        summary: "분석에 실패했어요.",
                    },
                });
            }
        };

        analyzeOutfit();
    }, [imageUri]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.title}>AI가 코디를 분석하고 있어요</Text>
            <Text style={styles.subtitle}>핏, 색 조합, 비율, 체형 적합도까지 자세히 분석하는 중이에요.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    title: {
        marginTop: 24,
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
    },
    subtitle: {
        marginTop: 12,
        fontSize: 15,
        color: "#666",
        textAlign: "center",
        lineHeight: 22,
    },
});
