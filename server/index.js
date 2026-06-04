require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("FitCheck AI server is running");
});

app.post("/analyze", async (req, res) => {
  try {
    const { situation } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `남성 코디를 ${situation} 상황 기준으로 분석해줘. 아직 이미지는 연결 전이라 테스트 응답만 해줘.`,
    });

    res.json({
      result: response.text,
    });
  } catch (error) {
    console.error(error);

    const { situation } = req.body;

    res.json({
        mock: true,
        clothingType: "블랙 가죽 자켓",
        mainColor: "블랙",
        recommendedColor: "화이트",
        recommendation: `${situation} 상황에서는 블랙 자켓과 화이트 계열 아이템 조합이 잘 어울립니다.`,
    });
    }
});

app.listen(PORT, () => {
  console.log(`FitCheck server running on http://localhost:${PORT}`);
});