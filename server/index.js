require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const app = express();
const PORT = 3001;
const execFileAsync = promisify(execFile);
const MIN_REMBG_FILE_SIZE_RATIO = 0.2;
const MIN_NON_TRANSPARENT_PIXEL_RATIO = 0.03;

let sharp = null;

try {
  sharp = require("sharp");
} catch {
  console.log("[background-remove] sharp is not installed, skipping alpha pixel ratio check");
}

app.use(cors());
app.use(express.json({ limit: "25mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_CLOTHES_DETAIL_ANALYSIS = {
  brand: null,
  confirmedBrand: null,
  inferredBrand: null,
  inferredProductName: null,
  brandConfidence: 0,
  confidence: {},
  logoDetected: false,
  logoText: "",
  graphicDetected: false,
  graphicType: "판단 어려움",
  graphicSize: "판단 어려움",
  material: "판단 어려움",
  pattern: "판단 어려움",
  analysisWarnings: [],
  analysisQuality: {
    imageQuality: "good",
    needsMorePhotos: false,
    missingHints: [],
  },
};

const BRAND_OR_LOGO_TERMS = [
  "Nike",
  "나이키",
  "스우시",
  "Swoosh",
  "Adidas",
  "아디다스",
  "삼선",
  "Jordan",
  "조던",
  "Jumpman",
  "Puma",
  "푸마",
  "New Balance",
  "뉴발란스",
  "NB",
  "Converse",
  "컨버스",
  "Vans",
  "반스",
  "Reebok",
  "리복",
  "Asics",
  "아식스",
  "Fila",
  "휠라",
  "Lacoste",
  "라코스테",
  "Supreme",
  "슈프림",
  "Stussy",
  "스투시",
  "Carhartt",
  "칼하트",
  "Patagonia",
  "파타고니아",
  "The North Face",
  "노스페이스",
  "Arc'teryx",
  "Arcteryx",
  "아크테릭스",
  "Uniqlo",
  "유니클로",
  "GU",
  "Zara",
  "자라",
  "H&M",
  "무신사",
];

function normalizeScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;
  return Math.round(Math.max(0, Math.min(100, numericScore)));
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function normalizeConfidence(confidence) {
  if (!confidence || typeof confidence !== "object") return {};

  const keys = ["category", "color", "season", "style", "fit", "brand", "product"];

  return keys.reduce((result, key) => {
    if (confidence[key] !== undefined) {
      result[key] = normalizeScore(confidence[key]);
    }

    return result;
  }, {});
}

function normalizeAnalysisWarnings(warnings) {
  if (!Array.isArray(warnings)) return [];

  return warnings
    .filter((warning) => typeof warning === "string" && warning.trim().length > 0)
    .map((warning) => warning.trim())
    .slice(0, 6);
}

function normalizeAnalysisQuality(quality) {
  const allowedQualities = ["good", "dark", "blurred", "folded", "partial"];

  if (!quality || typeof quality !== "object") {
    return DEFAULT_CLOTHES_DETAIL_ANALYSIS.analysisQuality;
  }

  const imageQuality = allowedQualities.includes(quality.imageQuality)
    ? quality.imageQuality
    : "good";
  const missingHints = Array.isArray(quality.missingHints)
    ? quality.missingHints
        .filter((hint) => typeof hint === "string" && hint.trim().length > 0)
        .map((hint) => hint.trim())
        .slice(0, 5)
    : [];

  return {
    imageQuality,
    needsMorePhotos: normalizeBoolean(quality.needsMorePhotos),
    missingHints,
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generalizeBrandTerms(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  let sanitized = value;

  for (const term of BRAND_OR_LOGO_TERMS) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(term), "gi"), "로고");
  }

  return sanitized
    .replace(/로고\s*로고/g, "로고")
    .replace(/브랜드명/g, "로고")
    .replace(/상표명/g, "로고")
    .replace(/\s{2,}/g, " ")
    .trim() || fallback;
}

function normalizeProductCandidates(candidates) {
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((candidate) => ({
      brand: typeof candidate?.brand === "string" ? candidate.brand.trim() : "",
      productName: typeof candidate?.productName === "string" ? candidate.productName.trim() : "",
      reason: typeof candidate?.reason === "string" ? candidate.reason.trim() : "",
      confidence: Number(candidate?.confidence),
    }))
    .filter((candidate) => candidate.brand && candidate.productName)
    .map((candidate) => ({
      brand: candidate.brand,
      productName: candidate.productName,
      reason: candidate.reason || "디자인이 비슷한 참고 상품 후보입니다.",
      confidence: Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence))
        : undefined,
    }))
    .slice(0, 5);
}

function normalizeConfirmedBrand(brand, confidence, logoDetected, evidenceText) {
  if (typeof brand !== "string") return null;

  const trimmedBrand = brand.trim();
  if (!trimmedBrand || trimmedBrand === "판단 어려움") return null;

  const normalizedConfidence = normalizeScore(confidence);
  const hasEvidence = typeof evidenceText === "string" && evidenceText.trim().length > 0;
  if (!logoDetected || normalizedConfidence < 80 || !hasEvidence) return null;

  return trimmedBrand;
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

function normalizeStringArray(value, maxLength = 6) {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => generalizeBrandTerms(item.trim()))
    .filter(Boolean)
    .slice(0, maxLength);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStyleProfile(styleProfile) {
  if (!styleProfile || typeof styleProfile !== "object") return undefined;

  const temperatureRange =
    styleProfile.temperatureRange && typeof styleProfile.temperatureRange === "object"
      ? {
          min: Number.isFinite(Number(styleProfile.temperatureRange.min))
            ? Number(styleProfile.temperatureRange.min)
            : undefined,
          max: Number.isFinite(Number(styleProfile.temperatureRange.max))
            ? Number(styleProfile.temperatureRange.max)
            : undefined,
        }
      : undefined;
  const normalizedTemperatureRange =
    temperatureRange && (temperatureRange.min !== undefined || temperatureRange.max !== undefined)
      ? temperatureRange
      : undefined;

  const normalized = {
    subCategory: generalizeBrandTerms(styleProfile.subCategory),
    fit: generalizeBrandTerms(styleProfile.fit),
    silhouette: generalizeBrandTerms(styleProfile.silhouette),
    formality: generalizeBrandTerms(styleProfile.formality),
    mood: normalizeStringArray(styleProfile.mood),
    usage: normalizeStringArray(styleProfile.usage),
    neckline: generalizeBrandTerms(styleProfile.neckline),
    sleeveLength: generalizeBrandTerms(styleProfile.sleeveLength),
    lengthType: generalizeBrandTerms(styleProfile.lengthType),
    mainColor: generalizeBrandTerms(styleProfile.mainColor),
    subColors: normalizeStringArray(styleProfile.subColors),
    matchColors: normalizeStringArray(styleProfile.matchColors),
    avoidColors: normalizeStringArray(styleProfile.avoidColors),
    recommendedPairings: normalizeStringArray(styleProfile.recommendedPairings),
    avoidPairings: normalizeStringArray(styleProfile.avoidPairings),
    temperatureRange: normalizedTemperatureRange,
  };

  const hasValue = Object.values(normalized).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  );

  return hasValue ? normalized : undefined;
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

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html, propertyNames) {
  for (const propertyName of propertyNames) {
    const escapedName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["'][^>]*>`, "i"),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtmlEntities(match[1]);
    }
  }

  return "";
}

function extractTitle(html) {
  const metaTitle = extractMetaContent(html, ["og:title", "twitter:title"]);
  if (metaTitle) return metaTitle;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : "";
}

function inferMallName(productUrl, html) {
  const siteName = extractMetaContent(html, ["og:site_name", "twitter:site"]);
  if (siteName) return siteName;

  try {
    const hostname = new URL(productUrl).hostname.replace(/^www\./, "");
    if (hostname.includes("musinsa")) return "무신사";
    if (hostname.includes("naver")) return "네이버쇼핑";
    return hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function cleanProductTitle(title, mallName) {
  let cleanedTitle = title || "";
  const separators = [" | ", " - ", " :: ", " : "];

  for (const separator of separators) {
    if (cleanedTitle.includes(separator)) {
      const parts = cleanedTitle
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean);
      cleanedTitle = parts.find((part) => !mallName || !part.includes(mallName)) || parts[0] || cleanedTitle;
      break;
    }
  }

  return cleanedTitle.trim();
}

function extractPrice(html) {
  const metaPrice = extractMetaContent(html, [
    "product:price:amount",
    "og:price:amount",
    "twitter:data1",
  ]);

  if (metaPrice) return metaPrice;

  const priceMatch = html.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
  return priceMatch?.[0] || "";
}

function getRembgCommand(inputPath, outputPath) {
  const rembgCommand = process.env.REMBG_COMMAND;
  const rembgModel = process.env.REMBG_MODEL || "u2net";
  const rembgArgs = ["i", "-m", rembgModel, inputPath, outputPath];

  if (rembgCommand) {
    return {
      command: rembgCommand,
      args: rembgArgs,
      model: rembgModel,
    };
  }

  return {
    command: process.env.REMBG_PYTHON || "python",
    args: ["-m", "rembg", ...rembgArgs],
    model: rembgModel,
  };
}

async function removeTempDirectory(tempDirectory) {
  try {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  } catch (error) {
    console.error("[background-remove] temp cleanup error", error);
  }
}

async function getNonTransparentPixelRatio(imageBuffer) {
  if (!sharp) return null;

  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const totalPixels = info.width * info.height;

  if (totalPixels === 0) return 0;

  let nonTransparentPixels = 0;

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 0) nonTransparentPixels += 1;
  }

  return nonTransparentPixels / totalPixels;
}

async function removeClothesBackground(imageBase64, imageMimeType) {
  let tempDirectory;

  try {
    const fileInfo = getImageFileInfo(imageMimeType);
    const imageBuffer = Buffer.from(imageBase64, "base64");
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "naes-rembg-"));
    const inputPath = path.join(tempDirectory, fileInfo.fileName);
    const outputPath = path.join(tempDirectory, "clean-clothes.png");
    const rembg = getRembgCommand(inputPath, outputPath);

    console.log("[background-remove] start", {
      provider: "rembg",
      command: rembg.command,
      model: rembg.model,
      mimeType: fileInfo.mimeType,
      base64Length: imageBase64?.length || 0,
      byteLength: imageBuffer.length,
    });

    await fs.writeFile(inputPath, imageBuffer);
    await execFileAsync(rembg.command, rembg.args, {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
    });

    const resultBuffer = await fs.readFile(outputPath);

    const fileSizeRatio = resultBuffer.length / imageBuffer.length;

    if (fileSizeRatio < MIN_REMBG_FILE_SIZE_RATIO) {
      console.error("[background-remove] failed: file too small", {
        reason: "file too small",
        originalByteLength: imageBuffer.length,
        byteLength: resultBuffer.length,
        fileSizeRatio,
        minFileSizeRatio: MIN_REMBG_FILE_SIZE_RATIO,
      });
      return null;
    }

    const nonTransparentPixelRatio = await getNonTransparentPixelRatio(resultBuffer);

    if (
      nonTransparentPixelRatio !== null &&
      nonTransparentPixelRatio < MIN_NON_TRANSPARENT_PIXEL_RATIO
    ) {
      console.error("[background-remove] failed: transparent pixel ratio too low", {
        reason: "transparent pixel ratio too low",
        nonTransparentPixelRatio,
        minNonTransparentPixelRatio: MIN_NON_TRANSPARENT_PIXEL_RATIO,
      });
      return null;
    }

    const cleanImageBase64 = resultBuffer.toString("base64");
    console.log("[background-remove] result", {
      hasBase64: Boolean(cleanImageBase64),
      base64Length: cleanImageBase64?.length || 0,
      byteLength: resultBuffer.length,
      fileSizeRatio,
      nonTransparentPixelRatio,
    });
    console.log("배경제거 결과:", cleanImageBase64 ? "성공" : "결과 없음");

    return cleanImageBase64;
  } catch (error) {
    console.error("[background-remove] error", {
      message: error?.message,
      stderr: error?.stderr,
      stack: error?.stack,
    });
    console.error("배경제거 에러:", error?.response?.data || error);
    return null;
  } finally {
    if (tempDirectory) {
      await removeTempDirectory(tempDirectory);
    }
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

app.post("/extract-product", async (req, res) => {
  try {
    const { url } = req.body;
    const productUrl = typeof url === "string" ? url.trim() : "";

    if (!productUrl) {
      return res.status(400).json({ error: "product url is required" });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(productUrl);
    } catch {
      return res.status(400).json({ error: "invalid product url" });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "unsupported product url protocol" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return res.status(502).json({ error: `failed to fetch product page: ${response.status}` });
      }

      const html = await response.text();
      const mallName = inferMallName(parsedUrl.toString(), html);
      const title = cleanProductTitle(extractTitle(html), mallName);
      const brand = extractMetaContent(html, [
        "product:brand",
        "og:brand",
        "twitter:label1",
        "brand",
      ]);
      const productName = extractMetaContent(html, [
        "product:name",
        "og:description",
      ]);
      const price = extractPrice(html);
      const imageUrl = extractMetaContent(html, ["og:image", "twitter:image"]);

      const extractedBrand = brand || mallName || "";
      const extractedProductName = title || productName || "";

      if (!extractedBrand || !extractedProductName) {
        return res.status(422).json({ error: "product information not found" });
      }

      return res.json({
        brand: extractedBrand,
        productName: extractedProductName,
        productUrl: parsedUrl.toString(),
        mallName,
        price,
        imageUrl,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("[extract-product] error:", error);
    return res.status(500).json({ error: "extract product failed" });
  }
});

app.post("/analyze-clothes", async (req, res) => {
  try {
    const { image, imageMimeType, applyBackgroundRemoval } = req.body;

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
        productCandidates: [],
        styleProfile: null,
        ...DEFAULT_CLOTHES_DETAIL_ANALYSIS,
      });
    }

    const requestImageMimeType = getImageFileInfo(imageMimeType).mimeType;

    console.log("[analyze-clothes] request", {
      imageMimeType: requestImageMimeType,
      imageLength: image?.length || 0,
    });

    const shouldRemoveBackground =
      applyBackgroundRemoval === true || process.env.ENABLE_BACKGROUND_REMOVAL === "true";

    console.log("[analyze-clothes] background removal", {
      enabled: shouldRemoveBackground,
      source: applyBackgroundRemoval === true ? "request" : "env",
    });

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
  "brand": null,
  "confirmedBrand": null,
  "inferredBrand": null,
  "inferredProductName": null,
  "brandConfidence": 0,
  "confidence": {
    "category": 80,
    "color": 80,
    "season": 80,
    "style": 80,
    "fit": 80,
    "brand": 0,
    "product": 0
  },
  "logoDetected": false,
  "logoText": "브랜드명이나 상표명이 아닌 일반 레터링/그래픽 설명. 없으면 빈 문자열",
  "graphicDetected": false,
  "graphicType": "무지 / 로고 / 전면 프린팅 / 백프린팅 / 패턴 / 그래픽 / 자수 / 판단 어려움 중 하나",
  "graphicSize": "없음 / 작음 / 중간 / 큼 / 판단 어려움 중 하나",
  "material": "면 / 데님 / 니트 / 나일론 / 가죽 / 스웨이드 / 폴리 / 린넨 / 판단 어려움 중 하나",
  "pattern": "무지 / 스트라이프 / 체크 / 카모 / 플라워 / 그래픽 / 로고패턴 / 판단 어려움 중 하나",
  "productCandidates": [
    {
      "brand": "브랜드명",
      "productName": "상품명",
      "reason": "로고/색상/디자인이 유사함",
      "confidence": 0.72
    }
  ],
  "styleProfile": {
    "subCategory": "기본 옷 종류",
    "fit": "정핏 / 여유핏 / 오버핏 / 슬림핏 등",
    "silhouette": "슬림 / 레귤러 / 루즈 / 와이드 / 구조적 등",
    "formality": "캐주얼 / 스마트캐주얼 / 포멀 / 스포츠 등",
    "mood": ["데일리", "미니멀"],
    "usage": ["일상", "데이트", "출근", "운동", "여행"],
    "neckline": "라운드넥 / 브이넥 / 카라 / 후드 / 판단 어려움",
    "sleeveLength": "민소매 / 반팔 / 긴팔 / 판단 어려움",
    "lengthType": "크롭 / 기본 / 롱 / 판단 어려움",
    "mainColor": "대표 색상",
    "subColors": ["보조 색상"],
    "matchColors": ["잘 어울리는 색"],
    "avoidColors": ["피하면 좋은 색"],
    "recommendedPairings": ["와이드 데님팬츠", "아이보리 스니커즈"],
    "avoidPairings": ["너무 포멀한 슬랙스"],
    "temperatureRange": { "min": 10, "max": 24 }
  },
  "description": "옷의 특징을 한 문장으로 설명",
  "matchTip": "이 옷과 잘 어울리는 조합 추천",
  "avoidTip": "피하면 좋은 조합",
  "analysisWarnings": ["분석이 애매한 항목이 있으면 작성"],
  "analysisQuality": {
    "imageQuality": "good / dark / blurred / folded / partial 중 하나",
    "needsMorePhotos": false,
    "missingHints": ["라벨", "뒷면", "전체 실루엣"]
  }
}

규칙:
- JSON 외의 문장은 절대 출력하지 마세요.
- 실제 사진에 보이는 옷만 기준으로 판단해주세요.
- 색상은 가장 많이 보이는 대표 색상으로 말해주세요.
- styleTags는 ["미니멀", "캐주얼", "스트릿", "댄디", "포멀", "스포티", "아메카지", "고프코어", "빈티지", "러블리", "페미닌", "모던", "클래식", "데일리", "편안함", "깔끔함", "꾸안꾸"] 중 최대 3개를 배열로 작성하세요.
- seasons는 반드시 ["봄", "여름", "가을", "겨울", "사계절"] 중 필요한 값을 담은 배열로 작성하세요.
- 브랜드는 목택, 라벨, 전면 프린트, 로고 주변 텍스트처럼 브랜드명이 사진에서 명확하게 읽히는 경우에만 brand와 confirmedBrand에 같은 브랜드명을 작성하세요.
- 예를 들어 목택이나 전면 프린트에 "MAISON MINED"가 선명하게 보이면 brand와 confirmedBrand는 "MAISON MINED"로 작성하세요.
- 로고나 텍스트가 흐리거나 일부만 보이거나 상징만 애매하게 보이면 brand와 confirmedBrand는 null로 작성하세요.
- 추측으로 브랜드를 단정하지 마세요. 애매한 경우에는 productCandidates에 후보로만 제안하세요.
- brandConfidence는 확정 브랜드가 있을 때만 80~100으로 작성하고, 확정할 수 없으면 0으로 작성하세요.
- confirmedBrand는 확정 브랜드가 있을 때만 문자열, 아니면 null로 작성하세요.
- 브랜드 텍스트가 명확하게 읽히는 경우 logoDetected는 true로 작성하세요.
- logoText에도 브랜드명, 로고명, 상표명을 쓰지 말고 "레터링", "로고 프린팅", "그래픽"처럼 일반화해서 작성하세요.
- description, detailCategory, styleTags, matchTip, avoidTip에도 브랜드명, 로고명, 상표명을 절대 넣지 마세요.
- "Nike 로고 티셔츠", "스우시 로고 티셔츠"처럼 특정 브랜드나 로고명을 포함한 표현은 금지입니다.
- "로고 프린팅 반팔 티셔츠", "레터링 티셔츠", "그래픽 티셔츠"처럼 일반 표현만 허용됩니다.
- 로고, 프린팅, 패턴은 코디 추천 품질에 중요하므로 보이는 범위 안에서 최대한 구체적으로 분석하세요.
- 전면 프린팅인지 백프린팅인지 사진만으로 불확실하면 graphicType은 "판단 어려움"으로 작성하세요.
- graphicType은 "무지", "로고", "전면 프린팅", "백프린팅", "패턴", "그래픽", "자수", "판단 어려움" 중 하나로 작성하세요.
- graphicSize는 "없음", "작음", "중간", "큼", "판단 어려움" 중 하나로 작성하세요.
- material은 "면", "데님", "니트", "나일론", "가죽", "스웨이드", "폴리", "린넨", "판단 어려움" 중 하나로 작성하세요.
- pattern은 "무지", "스트라이프", "체크", "카모", "플라워", "그래픽", "로고패턴", "판단 어려움" 중 하나로 작성하세요.
- productCandidates는 실제 구매 링크가 아니라 사용자가 참고할 비슷한 상품 예시 후보입니다.
- confirmedBrand가 있으면 같은 브랜드 안에서 비슷한 상품 후보를 1~5개 제안하세요.
- confirmedBrand가 없으면 비슷해 보이는 상품 후보를 0~5개 제안하세요.
- brand가 확정된 경우 productCandidates의 candidate.brand는 confirmedBrand와 같게 작성할 수 있습니다.
- productName은 실제 상품명이 확실하지 않으면 정확한 상품명처럼 단정하지 말고 "화이트 그래픽 반팔 티셔츠", "레터링 오버핏 반팔 티셔츠" 같은 일반적인 참고명으로 작성하세요.
- reason에는 로고, 색상, 그래픽 배치, 실루엣, 소재 등 왜 비슷한지 구체적으로 작성하세요.
- productCandidates가 불확실하면 빈 배열 []을 반환할 수 있습니다.
- productCandidates의 confidence는 0~1 사이 숫자로 작성하세요.
- productCandidates는 자동 저장 브랜드가 아니며 사용자가 직접 선택할 참고 후보입니다.
- 예: confirmedBrand가 "MAISON MINED"이고 흰색 그래픽 티셔츠라면 candidate.brand는 "MAISON MINED", productName은 "화이트 그래픽 반팔 티셔츠", reason은 "전면 레터링과 그래픽 배치가 유사한 참고 상품입니다.", confidence는 0.72처럼 작성하세요.
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
      });

    const cleanImageBase64 = shouldRemoveBackground
      ? await removeClothesBackground(image, requestImageMimeType)
      : null;

    const text = completion.choices[0].message.content;
    const parsed = JSON.parse(text);
    const seasons = normalizeClothesSeasons(parsed.seasons || parsed.season);
    const styleTags = normalizeStyleTags(parsed.styleTags, parsed.style);
    const productCandidates = normalizeProductCandidates(parsed.productCandidates);
    const styleProfile = normalizeStyleProfile(parsed.styleProfile);
    const logoDetected = normalizeBoolean(parsed.logoDetected);
    const brandConfidence = normalizeScore(parsed.brandConfidence);
    const confidence = normalizeConfidence(parsed.confidence);
    const analysisWarnings = normalizeAnalysisWarnings(parsed.analysisWarnings);
    const analysisQuality = normalizeAnalysisQuality(parsed.analysisQuality);
    const confirmedBrand = normalizeConfirmedBrand(
      parsed.confirmedBrand || parsed.brand,
      brandConfidence,
      logoDetected,
      parsed.logoText || parsed.confirmedBrand || parsed.brand
    );
    const inferredBrandSource = parsed.inferredBrand || parsed.brand || parsed.confirmedBrand;
    const inferredBrand =
      inferredBrandSource && inferredBrandSource !== confirmedBrand && inferredBrandSource !== "판단 어려움"
        ? inferredBrandSource
        : null;
    const inferredProductName =
      parsed.inferredProductName && parsed.inferredProductName !== "판단 어려움"
        ? parsed.inferredProductName
        : null;
    const sanitizedSubCategory = generalizeBrandTerms(parsed.subCategory, "분석 전");
    const sanitizedDetailCategory = generalizeBrandTerms(
      parsed.detailCategory || parsed.subCategory,
      "상세 분류 전"
    );
    const sanitizedDescription = generalizeBrandTerms(
      parsed.description,
      "옷 특징을 분석하지 못했습니다."
    );
    const sanitizedMatchTip = generalizeBrandTerms(
      parsed.matchTip,
      "어울리는 조합을 분석하지 못했습니다."
    );
    const sanitizedAvoidTip = generalizeBrandTerms(
      parsed.avoidTip,
      "피해야 할 조합을 분석하지 못했습니다."
    );
    const sanitizedLogoText = generalizeBrandTerms(
      parsed.logoText,
      DEFAULT_CLOTHES_DETAIL_ANALYSIS.logoText
    );

    return res.json({
      category: parsed.category || "기타",
      subCategory: sanitizedSubCategory,
      detailCategory: sanitizedDetailCategory,
      color: parsed.color || "색상 분석 전",
      style: styleTags[0] || parsed.style || "스타일 분석 전",
      styleTags,
      season: seasons.join(", "),
      seasons,
      fit: parsed.fit || "핏 분석 전",
      brand: confirmedBrand,
      confirmedBrand,
      inferredBrand,
      inferredProductName,
      brandConfidence: confirmedBrand ? brandConfidence : 0,
      confidence,
      logoDetected,
      logoText: sanitizedLogoText,
      graphicDetected: normalizeBoolean(parsed.graphicDetected),
      graphicType: parsed.graphicType || DEFAULT_CLOTHES_DETAIL_ANALYSIS.graphicType,
      graphicSize: parsed.graphicSize || DEFAULT_CLOTHES_DETAIL_ANALYSIS.graphicSize,
      material: parsed.material || DEFAULT_CLOTHES_DETAIL_ANALYSIS.material,
      pattern: parsed.pattern || DEFAULT_CLOTHES_DETAIL_ANALYSIS.pattern,
      description: sanitizedDescription,
      matchTip: sanitizedMatchTip,
      avoidTip: sanitizedAvoidTip,
      productCandidates,
      styleProfile,
      analysisWarnings,
      analysisQuality,
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
      productCandidates: [],
      styleProfile: null,
      ...DEFAULT_CLOTHES_DETAIL_ANALYSIS,
    });
  }
});

app.listen(PORT, () => {
  console.log(`NAES server running on http://localhost:${PORT}`);
});
