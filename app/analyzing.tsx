import { saveAnalysis } from "@/utils/storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function AnalyzingScreen() {
    const { imageUri } = useLocalSearchParams();
    console.log("imageUri:", imageUri);

    useEffect(() => {
        const analyzeOutfit = async () => {
            try {
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

                console.log("Base64 길이:", base64Image.length);
                const response = await fetch("http://192.168.219.104:3001/analyze", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        image: base64Image,
                    }),
                });

                const data = await response.json();

                const savedResult = {
                    id: String(Date.now()),
                    createdAt: new Date().toISOString(),
                    imageUri: imageUri as string,
                    score: data.score,
                    riskLevel: data.riskLevel,
                    summary: data.summary,
                    point: data.point,
                    problems: data.problems,
                    improvement: data.improvement,
                };

                await saveAnalysis(savedResult);

                router.replace({
                    pathname: "/result",
                    params: {
                        imageUri: imageUri as string,
                        score: data.score,

                        riskLevel: data.riskLevel,
                        style: data.style,
                        point: data.point,
                        clothingType: data.clothingType,
                        mainColor: data.mainColor,
                        matchingColors: data.matchingColors,
                        goodPoints: data.goodPoints,
                        problems: data.problems,
                        improvement: data.improvement,
                        recommendedSituations: data.recommendedSituations,
                        summary: data.summary,
                    },
                });
            } catch (error) {
                console.error(error);

                router.replace({
                    pathname: "/result",
                    params: {
                        score: "0",
                        imageUri: imageUri as string,
                        riskLevel: "분석 실패",
                        style: "분석 실패",
                        point: "-",
                        clothingType: "분석 실패",
                        mainColor: "분석 실패",
                        matchingColors: "-",
                        goodPoints: "-",
                        problems: "-",
                        improvement: "서버 연결에 실패했어요.",
                        recommendedSituations: "-",
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

            <Text style={styles.subtitle}>
                스타일과 색 조합을 분석하는 중이에요.
            </Text>
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