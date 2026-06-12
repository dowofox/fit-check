require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { toFile } = require("openai");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;
  return Math.round(Math.max(0, Math.min(100, numericScore)));
}

function getRiskLevel(score) {
  if (score >= 80) return "낮음";
  if (score >= 65) return "보통";
  return "높음";
}

function normalizeComment(comment, fallback) {
  if (typeof comment === "string" && comment.trim().length > 0) return comment.trim();
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

  if (typeof seasonValue !== "string" || seasonValue.trim().length === 0) return ["사계절"];

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

function getImageFileInfo(imageMimeType) {
  const safeMimeType = typeof imageMimeType === "string" ? imageMimeType.toLowerCase() : "";

  if (safeMimeType.includes("png")) {
    return { fileName: "clothes.png", mimeType: "image/png" };
  }

  if (safeMimeType.includes("webp")) {
    return { fileName: "clothes.webp", mimeType: "image/webp" };
  }

  return { fileName: "clothes.jpg", mimeType: "image/jpeg" };
}

function getImageEditErrorLog(error) {
  return {
    status: error?.status,
    code: error?.code,
    type: error?.type,
    message: error?.message,
    response: error?.response?.data,
  };
}

async function getImageResultBase64(imageResult) {
  if (imageResult?.b64_json) {
    return imageResult.b64_json;
  }

  if (imageResult?.url) {
    const imageResponse = await fetch(imageResult.url);

    if (!imageResponse.ok) {
      throw new Error(`Failed to download edited image: ${imageResponse.status}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  }

  return null;
}

async function removeClothesBackground(imageBase64, imageMimeType) {
  try {
    const fileInfo = getImageFileInfo(imageMimeType);
    const imageBuffer = Buffer.from(imageBase64, "base64");

    console.log("[background-remove] start", {
      mimeType: fileInfo.mimeType,
      base64Length: imageBase64?.length || 0,
      byteLength: imageBuffer.length,
    });

    const imageFile = await toFile(imageBuffer, fileInfo.fileName, { type: fileInfo.mimeType });

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt:
        "Remove the background from the clothing product photo. Keep only the single clothing item. Preserve the original color, shape, fabric texture, wrinkles, and edges. Return a clean product cutout with transparent background. Do not add a person, mannequin, hanger, text, logo, extra objects, or new background.",
      size: "1024x1024",
      background: "transparent",
      output_format: "png",
      quality: "low",
    });

    const imageResult = result.data?.[0];
    const cleanImageBase64 = await getImageResultBase64(imageResult);
    console.log("[background-remove] result", {
      hasBase64: Boolean(cleanImageBase64),
      base64Length: cleanImageBase64?.length || 0,
      resultKeys: imageResult ? Object.keys(imageResult) : [],
    });
    console.log("배경제거 결과:", cleanImageBase64 ? "성공" : "결과 없음");

    return cleanImageBase64;
  } catch (error) {
    console.error("[background-remove] error", getImageEditErrorLog(error));
    console.error("배경제거 에러:", error?.response?.data || error);
    return null;
  }
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

규칙:
- JSON 외의 문장은 절대 출력하지 마세요.
- 모든 답변은 반드시 자연스러운 한국어 존댓말로 작성해주세요.
- 사진 품질, 포즈, 배경보다 실제 옷의 핏, 색 조합, 계절감, 전체 균형을 우선 평가해주세요.
- 일반적인 평범한 코디는 65~80점 사이를 중심으로 평가해주세요.
- 확실히 별로인 코디는 40~60점대를 적극적으로 사용해주세요.
- 90점 이상은 정말 잘 입은 코디에만 드물게 사용해주세요.
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
      trendComment: "분석에 실패해 트렌드를 평가를 불러오지 못했습니다.",
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
    const { image, imageMimeType } = req.body;

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
        cleanImageBase64: null,
      });
    }

    const requestImageMimeType = getImageFileInfo(imageMimeType).mimeType;

    console.log("[analyze-clothes] request", {
      imageMimeType: requestImageMimeType,
      imageLength: image?.length || 0,
    });

    const [completion, cleanImageBase64] = await Promise.all([
      openai.chat.completions.create({
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
- 색상은 가장 많이 보이는 대표 색상으로 말해주세요.
- styleTags는 ["미니멀", "캐주얼", "스트릿", "댄디", "포멀", "스포티", "아메카지", "고프코어", "빈티지", "러블리", "페미닌", "모던", "클래식", "데일리", "편안함", "깔끔함", "꾸안꾸"] 중 최대 3개를 배열로 작성하세요.
- seasons는 반드시 ["봄", "여름", "가을", "겨울", "사계절"] 중 필요한 값을 담은 배열로 작성하세요.
- 사진 품질이 낮아도 최대한 보이는 정보 기준으로 판단해주세요.
- 모든 답변은 자연스러운 한국어로 작성해주세요.
`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${requestImageMimeType};base64,${image}`,
                },
              },
            ],
          },
        ],
      }),
      removeClothesBackground(image, requestImageMimeType),
    ]);

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
      cleanImageBase64,
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
      cleanImageBase64: null,
    });
  }
});

app.listen(PORT, () => {
  console.log(`NAES server running on http://localhost:${PORT}`);
});
