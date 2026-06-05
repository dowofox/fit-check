require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
    res.send("FitCheck AI server is running");
});

app.post("/analyze", async (req, res) => {
    try {
        console.log("분석 요청 받음");

        const { image } = req.body;

        console.log("OpenAI 요청 시작");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `
이 이미지를 보고 남성 패션 코디를 분석해줘.

반드시 JSON만 반환해.

{
  "score": "0부터 100 사이의 숫자",
  "riskLevel": "낮음 / 보통 / 높음 중 하나",
  "style": "스타일 분석",
  "point": "이 코디의 핵심 포인트",
  "clothingType": "옷 종류",
  "mainColor": "주 색상",
  "matchingColors": "잘 어울리는 색상",
  "goodPoints": "이 코디의 장점",
  "problems": "문제점. 없으면 '큰 문제 없음'",
  "improvement": "개선하면 좋은 점",
  "recommendedSituations": "어울리는 상황",
  "summary": "단호한 총평"
}

규칙:
- style은 캐주얼, 미니멀, 스트릿, 댄디, 아메카지, 시티보이 등 실제 패션 스타일로 분석
- matchingColors는 실제로 코디했을 때 잘 어울리는 색상 추천
- goodPoints는 잘 입은 부분 설명
- improvement는 개선하면 더 좋아질 점 설명
- recommendedSituations는 어울리는 장소와 상황 추천
- JSON 외의 문장은 절대 출력하지 마
- 억지로 칭찬하지 마
- 별로인 부분은 단호하게 지적해
- 실패 위험이 높으면 높다고 말해
- point는 이 코디에서 가장 눈에 띄는 포인트를 설명
- score는 전체 코디 완성도를 0~100점으로 평가해
- 무난하면 70점대, 좋으면 80점대, 매우 좋으면 90점대, 실패 위험이 있으면 60점 이하로 줘
- 모든 답변은 반드시 자연스러운 한국어 존댓말로 작성해
- 반말, 명령조, 과한 비난 표현은 쓰지 마
- 단호하게 말하되 무례하지 않게 말해
`,
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${image}`,
                            },
                        },
                    ],
                },
            ],
        });

        console.log("OpenAI 응답 받음");

        const text = completion.choices[0].message.content;

        console.log("응답 내용:", text);

        try {
            const cleanedText = text
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            const parsed = JSON.parse(cleanedText);

            return res.json(parsed);

        } catch (e) {
            console.log("JSON 파싱 실패:", text);

            return res.json({
                style: "파싱 실패",
                clothingType: "파싱 실패",
                mainColor: "-",
                matchingColors: "-",
                goodPoints: "-",
                improvement: text,
                recommendedSituations: "-",
            });
        }

    } catch (error) {
        console.error("OpenAI 에러:", error);

        res.json({
            riskLevel: "분석 실패",
            style: "AI 분석 실패",
            point: "-",
            clothingType: "AI 분석 실패",
            mainColor: "AI 분석 실패",
            matchingColors: "-",
            goodPoints: "-",
            problems: "-",
            improvement: "OpenAI 분석 실패",
            recommendedSituations: "-",
            summary: "분석에 실패했어요.",
        });
    }
});

app.listen(PORT, () => {
    console.log(`FitCheck server running on http://localhost:${PORT}`);
});

