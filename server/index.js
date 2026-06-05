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
  res.send("NAES AI server is running");
});

app.post("/analyze", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        score: 0,
        riskLevel: "분석 실패",
        summary: "이미지가 전달되지 않았습니다.",
        point: "-",
        problems: "-",
        improvement: "사진을 다시 선택한 뒤 분석해주세요.",
      });
    }

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
이 이미지를 보고 남성 패션 코디를 분석해주세요.

반드시 아래 JSON 형식만 반환해주세요.

{
  "score": 0,
  "riskLevel": "낮음 / 보통 / 높음 중 하나",
  "summary": "전체 코디에 대한 짧고 단호한 총평",
  "point": "이 코디의 핵심 포인트",
  "problems": "가장 아쉬운 문제점. 없으면 '큰 문제는 없습니다.'",
  "improvement": "더 좋아지기 위한 구체적인 개선 팁"
}

규칙:
- JSON 외의 문장은 절대 출력하지 마세요.
- 모든 답변은 반드시 자연스러운 한국어 존댓말로 작성해주세요.
- 단호하게 말하되 무례하지 않게 말해주세요.
- 억지로 칭찬하지 마세요.
- 별로인 부분은 명확하게 지적해주세요.
- score는 0~100점 숫자로 평가해주세요.
- 무난하면 70점대, 좋으면 80점대, 매우 좋으면 90점대, 실패 위험이 있으면 60점 이하로 주세요.
- riskLevel은 반드시 "낮음", "보통", "높음" 중 하나만 사용해주세요.
- summary, point, problems, improvement는 각각 1~2문장으로 짧게 작성해주세요.
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

    const text = completion.choices[0].message.content;

    const parsed = JSON.parse(text);

    return res.json(parsed);
  } catch (error) {
    console.error("OpenAI 에러:", error);

    return res.json({
      score: 0,
      riskLevel: "분석 실패",
      summary: "분석에 실패했어요.",
      point: "-",
      problems: "-",
      improvement: "OpenAI 분석 실패",
    });
  }
});

app.listen(PORT, () => {
  console.log(`NAES server running on http://localhost:${PORT}`);
});