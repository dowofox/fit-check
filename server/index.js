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

  return Math.round(clampedScore);
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

function normalizeClothesSeasons(seasonValue) {
  const allowedSeasons = ["봄", "여름", "가을", "겨울", "사계절"];

  if (Array.isArray(seasonValue)) {
    const matchedSeasons = allowedSeasons.filter((option) =>
      seasonValue.some((season) => typeof season === "string" && season.includes(option))
    );

    return matchedSeasons.length > 0 ? matchedSeasons : ["사계절"];
  }

  if (typeof seasonValue !== "string" || seasonValue.trim().length === 0) {
    return ["사계절"];
  }

  const matchedSeasons = allowedSeasons.filter((option) => seasonValue.includes(option));

  return matchedSeasons.length > 0 ? matchedSeasons : ["사계절"];
}

function normalizeStyleTags(styleTags, style) {
  const allowedStyleTags = [
    "미니멀",
    "캐주얼",
    "스트릿",
    "댄디",
    "포멀",
    "스포티",
    "아메카지",
    "고프코어",
    "빈티지",
    "러블리",
    "페미닌",
    "모던",
    "클래식",
    "데일리",
    "편안함",
    "깔끔함",
    "꾸안꾸",
  ];

  const sourceTags = Array.isArray(styleTags) ? styleTags : [style].filter(Boolean);
  const matchedTags = allowedStyleTags.filter((tag) =>
    sourceTags.some((sourceTag) => typeof sourceTag === "string" && sourceTag.includes(tag))
  );

  return (matchedTags.length > 0 ? matchedTags : ["데일리"]).slice(0, 3);
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
- seasonScore: 실제 날씨를 모르는 상태이므로 특정 날짜의 날씨가 아니라, 사진 속 옷의 소재감, 두께감, 노출 정도, 색감이 봄/여름/가을/겨울 중 어느 계절 코디로 자연스러운지 평가해주세요. 계절이 애매하면 소재와 두께 기준으로 판단해주세요.
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
- 점수는 반드시 5점 단위로 끊지 말고, 1점 단위로 세밀하게 평가해주세요.
- 예를 들어 70, 75, 80처럼 딱 떨어지는 점수만 반복하지 말고 67, 73, 78, 82, 86처럼 실제 차이를 반영해주세요.

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

app.post("/analyze-clothes", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        category: "분석 실패",
        subCategory: "이미지 없음",
        detailCategory: "이미지 없음",
        color: "분석 불가",
        style: "분석 불가",
        styleTags: ["데일리"],
        season: "사계절",
        seasons: ["사계절"],
        fit: "분석 불가",
        description: "이미지가 없어 옷을 분석하지 못했습니다.",
        matchTip: "사진을 다시 선택해주세요.",
        avoidTip: "분석할 이미지가 필요합니다.",
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
이 이미지는 전신 코디가 아니라 단일 옷 사진입니다.
사진 속 옷 하나를 분석해서 옷장에 저장할 정보를 만들어주세요.

반드시 아래 JSON 형식만 반환해주세요.

{
  "category": "상의 / 하의 / 신발 / 아우터 / 액세서리 / 기타 중 하나",
  "subCategory": "티셔츠, 셔츠, 후드티, 데님팬츠, 슬랙스, 스니커즈 등 기본 종류",
  "detailCategory": "반팔 티셔츠, 긴팔 티셔츠, 오버핏 후드티, 와이드 데님팬츠 등 더 구체적인 종류",
  "color": "대표 색상",
  "style": "캐주얼 / 미니멀 / 스트릿 / 포멀 / 스포티 / 빈티지 / 기타 중 하나",
  "styleTags": ["캐주얼", "편안함", "데일리"],
  "seasons": ["봄", "가을"],
  "fit": "슬림핏 / 레귤러핏 / 오버핏 / 와이드핏 / 판단 어려움 중 하나",
  "description": "옷의 특징을 한 문장으로 설명",
  "matchTip": "이 옷과 잘 어울리는 조합 추천",
  "avoidTip": "피하면 좋은 조합"
}

규칙:
- JSON 외의 문장은 절대 출력하지 마세요.
- 실제 사진에 보이는 옷만 기준으로 판단해주세요.
- 브랜드명은 확실히 보이지 않으면 추정하지 마세요.
- 색상은 가장 많이 보이는 대표 색상으로 말해주세요.
- styleTags는 ["미니멀", "캐주얼", "스트릿", "댄디", "포멀", "스포티", "아메카지", "고프코어", "빈티지", "러블리", "페미닌", "모던", "클래식", "데일리", "편안함", "깔끔함", "꾸안꾸"] 중 최대 3개를 배열로 작성하세요.
- 후드티, 맨투맨, 조거팬츠는 ["캐주얼", "편안함", "데일리"]처럼 판단하세요.
- 셔츠, 슬랙스, 블레이저는 ["미니멀", "댄디", "깔끔함"]처럼 판단하세요.
- 와이드팬츠, 그래픽 티, 오버핏은 ["스트릿", "캐주얼"]처럼 판단하세요.
- 트레이닝, 조거, 러닝화는 ["스포티", "편안함"]처럼 판단하세요.
- 코트, 니트, 가디건은 ["클래식", "미니멀", "깔끔함"]처럼 판단하세요.
- 워크자켓, 카고팬츠는 ["아메카지", "고프코어"]처럼 판단하세요.
- 기본 티셔츠, 청바지, 운동화는 ["데일리", "캐주얼"]처럼 판단하세요.
- seasons는 반드시 ["봄", "여름", "가을", "겨울", "사계절"] 중 필요한 값을 담은 배열로 작성하세요.
- 반팔, 민소매, 린넨, 얇은 셔츠처럼 얇고 통기성이 좋아 보이는 옷은 ["여름"]으로 판단하세요.
- 니트, 패딩, 코트, 두꺼운 후드, 울, 플리스, 부츠는 ["겨울"]로 판단하세요.
- 셔츠, 맨투맨, 가디건, 자켓처럼 간절기에 자연스러운 옷은 ["봄", "가을"]로 판단하세요.
- 청바지, 운동화, 기본 티셔츠처럼 계절 제한이 약한 아이템은 ["사계절"]로 판단하세요.
- 사진 품질이 낮아도 최대한 보이는 정보 기준으로 판단해주세요.
- 모든 답변은 자연스러운 한국어로 작성해주세요.
`
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
    const seasons = normalizeClothesSeasons(parsed.seasons || parsed.season);
    const styleTags = normalizeStyleTags(parsed.styleTags, parsed.style);

    return res.json({
      category: parsed.category || "기타",
      subCategory: parsed.subCategory || "분석 전",
      detailCategory: parsed.detailCategory || parsed.subCategory || "상세 분류 전",
      color: parsed.color || "색상 분석 전",
      style: styleTags[0] || parsed.style || "스타일 분석 전",
      styleTags,
      season: seasons.join(", "),
      seasons,
      fit: parsed.fit || "핏 분석 전",
      description: parsed.description || "옷 특징을 분석하지 못했습니다.",
      matchTip: parsed.matchTip || "어울리는 조합을 분석하지 못했습니다.",
      avoidTip: parsed.avoidTip || "피해야 할 조합을 분석하지 못했습니다.",
    });
  } catch (error) {
    console.error("옷 분석 에러:", error);

    return res.json({
      category: "분석 실패",
      subCategory: "분석 실패",
      detailCategory: "분석 실패",
      color: "분석 실패",
      style: "분석 실패",
      styleTags: ["데일리"],
      season: "사계절",
      seasons: ["사계절"],
      fit: "분석 실패",
      description: "옷 분석에 실패했습니다.",
      matchTip: "다시 시도해주세요.",
      avoidTip: "분석 실패",
    });
  }
});

app.listen(PORT, () => {
  console.log(`NAES server running on http://localhost:${PORT}`);
});
