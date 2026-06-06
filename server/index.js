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

function normalizeScore(score) {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return 0;
  }

  const clampedScore = Math.max(0, Math.min(100, numericScore));

  return Math.round(clampedScore / 5) * 5;
}

function getRiskLevel(score) {
  if (score >= 80) return "낮음";
  if (score >= 65) return "보통";
  return "높음";
}

function getProfileText(profile = {}) {
  const gender = profile.gender || "미입력";
  const age = profile.age || "미입력";
  const height = profile.height || "미입력";
  const weight = profile.weight || "미입력";
  const bodyType = profile.bodyType || "미입력";

  return `
사용자 프로필:
- 성별: ${gender}
- 나이: ${age}
- 키: ${height}${height !== "미입력" ? "cm" : ""}
- 몸무게: ${weight}${weight !== "미입력" ? "kg" : ""}
- 체형: ${bodyType}
`;
}

function normalizeAnalysisResult(result) {
  const normalizedScore = normalizeScore(result.score);

  return {
    score: normalizedScore,
    riskLevel: getRiskLevel(normalizedScore),
    fitScore: normalizeScore(result.fitScore ?? normalizedScore),
    colorScore: normalizeScore(result.colorScore ?? normalizedScore),
    balanceScore: normalizeScore(result.balanceScore ?? normalizedScore),
    bodyFitScore: normalizeScore(result.bodyFitScore ?? normalizedScore),
    itemScore: normalizeScore(result.itemScore ?? normalizedScore),
    seasonScore: normalizeScore(result.seasonScore ?? normalizedScore),
    trendScore: normalizeScore(result.trendScore ?? normalizedScore),
    finishScore: normalizeScore(result.finishScore ?? normalizedScore),
    summary: result.summary || "전체적인 코디 분석 결과입니다.",
    point: result.point || "코디의 핵심 포인트를 판단하기 어렵습니다.",
    problems: result.problems || "큰 문제는 없습니다.",
    improvement: result.improvement || "핏과 색 조합을 조금 더 정리하면 좋습니다.",
  };
}

app.get("/", (req, res) => {
  res.send("NAES AI server is running");
});

app.post("/analyze", async (req, res) => {
  try {
    const { image, profile } = req.body;

    if (!image) {
      return res.status(400).json({
        score: 0,
        riskLevel: "분석 실패",
        fitScore: 0,
        colorScore: 0,
        balanceScore: 0,
        bodyFitScore: 0,
        itemScore: 0,
        seasonScore: 0,
        trendScore: 0,
        finishScore: 0,
        summary: "이미지가 전달되지 않았습니다.",
        point: "-",
        problems: "-",
        improvement: "사진을 다시 선택한 뒤 분석해주세요.",
      });
    }

    const profileText = getProfileText(profile);

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
이 이미지를 보고 패션 코디를 분석해주세요.

${profileText}

분석 기준:
- 사용자의 성별, 나이, 키, 몸무게, 체형 정보가 있으면 반드시 참고해주세요.
- 특정 성별 패션으로 고정하지 말고, 프로필 정보와 실제 착장을 기준으로 판단해주세요.
- 키와 체형을 고려해 상하의 비율, 핏, 실루엣이 잘 맞는지 평가해주세요.
- 나이를 고려해 스타일이 너무 어려 보이거나 과하게 성숙해 보이지 않는지도 판단해주세요.
- 프로필 정보가 미입력인 항목은 이미지에 보이는 정보만으로 일반적인 기준에서 평가해주세요.

반드시 아래 JSON 형식만 반환해주세요.

{
  "score": 0,
  "riskLevel": "낮음 / 보통 / 높음 중 하나",
  "fitScore": 0,
  "colorScore": 0,
  "balanceScore": 0,
  "bodyFitScore": 0,
  "itemScore": 0,
  "seasonScore": 0,
  "trendScore": 0,
  "finishScore": 0,
  "summary": "전체 코디에 대한 짧고 단호한 총평",
  "point": "이 코디의 핵심 포인트",
  "problems": "가장 아쉬운 문제점. 없으면 '큰 문제는 없습니다.'",
  "improvement": "더 좋아지기 위한 구체적인 개선 팁"
}

세부 점수 기준:
- fitScore: 옷의 실제 핏, 사이즈감, 어깨선, 기장, 품, 실루엣이 자연스러운지 평가해주세요.
- colorScore: 색 조합, 톤 매칭, 명도/채도 균형, 과하거나 밋밋하지 않은지를 평가해주세요.
- balanceScore: 상하의 비율, 시선 분산, 다리 길이 보정, 전체 균형감을 평가해주세요.
- bodyFitScore: 사용자의 키, 몸무게, 체형과 착장이 잘 맞는지 평가해주세요. 프로필이 없으면 이미지 기준으로 평가해주세요.
- itemScore: 상의, 하의, 신발, 아우터, 액세서리 등 아이템끼리 조화로운지 평가해주세요.
- seasonScore: 계절감, 소재감, 두께감, 색감이 현재 외출 코디로 자연스러운지 평가해주세요.
- trendScore: 현재 감각, 스타일 완성도, 촌스럽지 않은지, 과하게 유행만 따라간 느낌은 아닌지 평가해주세요.
- finishScore: 전체 정돈감, 디테일, 구김/어수선함, 실제 외출 가능성, 완성도를 평가해주세요.

규칙:
- JSON 외의 문장은 절대 출력하지 마세요.
- 모든 답변은 반드시 자연스러운 한국어 존댓말로 작성해주세요.
- 단호하게 말하되 무례하지 않게 말해주세요.
- 억지로 칭찬하지 마세요.
- 별로인 부분은 명확하게 지적해주세요.
- score와 모든 세부 점수는 0~100점 숫자로 평가해주세요.
- score는 세부 점수의 단순 평균이 아니라 전체 코디 완성도를 종합해서 평가해주세요.
- 점수는 아래 기준표를 최우선으로 사용해주세요.
- 비슷한 수준의 코디는 매번 비슷한 점수가 나오도록 평가 기준을 보수적으로 유지해주세요.
- 애매하면 높은 점수보다 낮은 구간을 선택해주세요.
- 사진 품질, 포즈, 배경보다 실제 옷의 핏, 색 조합, 계절감, 전체 균형을 우선 평가해주세요.
- riskLevel은 반드시 "낮음", "보통", "높음" 중 하나만 사용해주세요.
- summary, point, problems, improvement는 각각 1~2문장으로 짧게 작성해주세요.
- 프로필 정보가 있는 경우 summary나 point에 개인 기준으로 평가했다는 느낌이 자연스럽게 드러나게 작성해주세요.

점수 기준표:
- 100점: 핏, 색 조합, 아이템 조화, 계절감, 개성, 완성도가 모두 완벽한 코디. 단, 정말 흠잡을 부분이 거의 없을 때만 사용
- 95점: 핏, 색 조합, 아이템 조화, 계절감이 모두 매우 좋고 바로 참고할 만한 코디
- 90점: 전체 완성도가 높고 사소한 개선점만 있는 코디
- 85점: 보기 좋고 안정적이지만 포인트나 디테일이 약간 아쉬운 코디
- 80점: 무난하게 좋고 실패 위험은 낮지만 특별함은 부족한 코디
- 75점: 전체적으로 무난하지만 핏, 색감, 아이템 중 하나가 아쉬운 코디
- 70점: 평범하고 크게 이상하진 않지만 조화가 부족한 코디
- 65점: 어색한 부분이 확실히 있고 개선이 필요한 코디
- 60점: 핏이나 색 조합 문제가 뚜렷해 실패 위험이 있는 코디
- 55점 이하: 전체적으로 어색하거나 코디 의도가 잘 보이지 않는 코디
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
    const normalized = normalizeAnalysisResult(parsed);

    return res.json(normalized);
  } catch (error) {
    console.error("OpenAI 에러:", error);

    return res.json({
      score: 0,
      riskLevel: "분석 실패",
      fitScore: 0,
      colorScore: 0,
      balanceScore: 0,
      bodyFitScore: 0,
      itemScore: 0,
      seasonScore: 0,
      trendScore: 0,
      finishScore: 0,
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
