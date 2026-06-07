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

function normalizeComment(comment, fallback) {
  if (typeof comment === "string" && comment.trim().length > 0) {
    return comment.trim();
  }

  return fallback;
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
    fitComment: normalizeComment(result.fitComment, "핏과 실루엣을 기준으로 평가했습니다."),
    colorComment: normalizeComment(result.colorComment, "색 조합과 톤 매칭을 기준으로 평가했습니다."),
    balanceComment: normalizeComment(result.balanceComment, "상하의 비율과 전체 균형을 기준으로 평가했습니다."),
    bodyFitComment: normalizeComment(result.bodyFitComment, "체형과 착장의 조화를 기준으로 평가했습니다."),
    itemComment: normalizeComment(result.itemComment, "아이템 간 조화를 기준으로 평가했습니다."),
    seasonComment: normalizeComment(result.seasonComment, "계절감과 소재감을 기준으로 평가했습니다."),
    trendComment: normalizeComment(result.trendComment, "현재 스타일 감각을 기준으로 평가했습니다."),
    finishComment: normalizeComment(result.finishComment, "전체 완성도와 정돈감을 기준으로 평가했습니다."),
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
        fitComment: "이미지가 없어 핏을 분석하지 못했습니다.",
        colorComment: "이미지가 없어 색 조합을 분석하지 못했습니다.",
        balanceComment: "이미지가 없어 비율을 분석하지 못했습니다.",
        bodyFitComment: "이미지가 없어 체형 적합도를 분석하지 못했습니다.",
        itemComment: "이미지가 없어 아이템 조화를 분석하지 못했습니다.",
        seasonComment: "이미지가 없어 계절감을 분석하지 못했습니다.",
        trendComment: "이미지가 없어 트렌드를 분석하지 못했습니다.",
        finishComment: "이미지가 없어 완성도를 분석하지 못했습니다.",
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
  "fitComment": "핏에 대한 한 줄 평가",
  "colorComment": "색조합에 대한 한 줄 평가",
  "balanceComment": "비율에 대한 한 줄 평가",
  "bodyFitComment": "체형적합에 대한 한 줄 평가",
  "itemComment": "아이템조화에 대한 한 줄 평가",
  "seasonComment": "계절감에 대한 한 줄 평가",
  "trendComment": "트렌드에 대한 한 줄 평가",
  "finishComment": "완성도에 대한 한 줄 평가",
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

코멘트 작성 규칙:
- 각 세부 코멘트는 1문장으로 작성해주세요.
- 코멘트는 점수 이유가 바로 이해되게 구체적으로 작성해주세요.
- 막연한 칭찬보다 실제 보이는 핏, 색, 비율, 아이템 문제를 말해주세요.
- 프로필 정보가 있으면 bodyFitComment에 개인 체형 기준 평가를 반영해주세요.

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
- 점수는 70~90점에 몰리지 않게 넓게 사용해주세요.
- 일반적인 평범한 코디는 65~80점 사이를 중심으로 평가해주세요.
- 확실히 별로인 코디는 40~60점대를 적극적으로 사용해주세요.
- 90점 이상은 정말 잘 입은 코디에만 드물게 사용해주세요.
- 50점대는 실패가 아니라 개선이 많이 필요한 코디로 자연스럽게 사용할 수 있습니다.
- 0~20점은 이미지가 부정확하거나 옷을 거의 판단할 수 없을 때만 사용해주세요.

점수 기준표:
- 100점: 거의 완벽한 코디. 핏, 색 조합, 비율, 아이템 조화, 계절감, 디테일이 모두 뛰어나고 흠잡을 부분이 거의 없을 때만 사용
- 95점: 매우 완성도 높은 코디. 대부분의 요소가 뛰어나고 바로 참고할 만한 수준
- 90점: 확실히 잘 입은 코디. 사소한 개선점만 있음
- 85점: 보기 좋고 안정적인 코디. 다만 포인트나 디테일이 조금 아쉬움
- 80점: 무난하게 좋은 코디. 실패 위험은 낮지만 특별함은 부족함
- 75점: 평범하게 괜찮은 코디. 한두 가지 요소가 아쉬움
- 70점: 크게 이상하진 않지만 조화, 핏, 비율 중 아쉬움이 분명함
- 65점: 어색한 부분이 확실히 보이고 개선이 필요한 코디
- 60점: 핏, 색 조합, 비율, 아이템 중 여러 문제가 보여 실패 위험이 있음
- 55점: 전체적으로 어색하고 외출 코디로는 아쉬움이 큰 상태
- 50점: 코디 의도가 약하고 핏/색/비율 문제가 뚜렷함
- 40점: 실패에 가까운 코디. 여러 요소가 서로 맞지 않음
- 30점: 매우 어색한 코디. 옷 조합이 거의 맞지 않거나 스타일 의도가 보이지 않음
- 20점 이하: 의상 식별이 어렵거나 코디 평가가 거의 불가능한 수준일 때만 사용
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
      fitComment: "분석에 실패해 핏 평가를 불러오지 못했습니다.",
      colorComment: "분석에 실패해 색조합 평가를 불러오지 못했습니다.",
      balanceComment: "분석에 실패해 비율 평가를 불러오지 못했습니다.",
      bodyFitComment: "분석에 실패해 체형 적합 평가를 불러오지 못했습니다.",
      itemComment: "분석에 실패해 아이템 조화 평가를 불러오지 못했습니다.",
      seasonComment: "분석에 실패해 계절감 평가를 불러오지 못했습니다.",
      trendComment: "분석에 실패해 트렌드 평가를 불러오지 못했습니다.",
      finishComment: "분석에 실패해 완성도 평가를 불러오지 못했습니다.",
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
