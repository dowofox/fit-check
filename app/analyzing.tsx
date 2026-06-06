import { getUserProfile, saveAnalysis } from "@/utils/storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const ANALYZE_URL = "http://192.168.219.104:3001/analyze";

export default function AnalyzingScreen() {
    const { imageUri } = useLocalSearchParams();

    useEffect(() => {
        const analyzeOutfit = async () => {
            try {
                const profile = await getUserProfile();
                const imageResponse = await fetch(imageUri as string);
                const imageBlob = await imageResponse.blob();

                const base64Image = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onloadend = () => {
                        const result = reader.result as string;
                        const base64 = result.split(",")[1];
                        resolve(base64);
                    };

                    reader.onerror = reject;
                    reader.readAsDataURL(imageBlob);
                });

                const response = await fetch(ANALYZE_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        image: base64Image,
                        profile,
                    }),
                });

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
                    trendScore: data.trendScore,
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
                        trendScore: "0",
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
            <Text style={styles.subtitle}>핏, 색 조합, 비율, 트렌드까지 함께 분석하는 중이에요.</Text>
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
