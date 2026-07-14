require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { resolveClothesSeasons } = require("./clothesSeason");
const {
  applyProductTargetTrustPolicy,
  getProductAnalysisInstruction,
  normalizeProductAnalysisContext,
} = require("./productAnalysisContext");

const app = express();
const PORT = Number(process.env.PORT) || 3001;
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

function normalizeGarmentProfile(garmentProfile) {
  if (!garmentProfile || typeof garmentProfile !== "object") return undefined;

  const normalizeEnum = (value, allowedValues) =>
    typeof value === "string" && allowedValues.includes(value) ? value : undefined;
  const normalizeTenPointScore = (value) => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue)
      ? Math.max(0, Math.min(10, Math.round(parsedValue)))
      : undefined;
  };

  const normalized = {
    silhouette: normalizeEnum(garmentProfile.silhouette, [
      "slim",
      "regular",
      "semiOversized",
      "oversized",
      "wide",
      "cropped",
      "long",
    ]),
    volume: normalizeTenPointScore(garmentProfile.volume),
    visualWeight: normalizeTenPointScore(garmentProfile.visualWeight),
    lengthBalance: normalizeEnum(garmentProfile.lengthBalance, ["short", "regular", "long"]),
    fitIntent: normalizeEnum(garmentProfile.fitIntent, [
      "trueToSize",
      "relaxed",
      "oversized",
      "structured",
    ]),
    pointLevel: normalizeTenPointScore(garmentProfile.pointLevel),
    structure: normalizeEnum(garmentProfile.structure, ["soft", "normal", "stiff"]),
    drape: normalizeEnum(garmentProfile.drape, ["low", "medium", "high"]),
  };

  return Object.values(normalized).some((value) => value !== undefined)
    ? normalized
    : undefined;
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

function extractMetaContentWithDebug(html, propertyNames) {
  const attempts = [];

  for (const propertyName of propertyNames) {
    const escapedName = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["'][^>]*>`, "i"),
    ];

    let value = "";

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        value = decodeHtmlEntities(match[1]);
        break;
      }
    }

    attempts.push({
      propertyName,
      found: Boolean(value),
      value,
    });

    if (value) {
      return {
        value,
        matchedProperty: propertyName,
        attempts,
      };
    }
  }

  return {
    value: "",
    matchedProperty: "",
    attempts,
  };
}

function resolveProductImageUrl(imageUrl, productUrl) {
  if (!imageUrl) return "";

  try {
    return new URL(imageUrl, productUrl).toString();
  } catch {
    return imageUrl;
  }
}

function extractTitle(html) {
  const metaTitle = extractMetaContent(html, ["og:title", "twitter:title"]);
  if (metaTitle) return metaTitle;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : "";
}

function getSchemaTypes(value) {
  const schemaType = value?.["@type"];
  return (Array.isArray(schemaType) ? schemaType : [schemaType])
    .filter((type) => typeof type === "string")
    .map((type) => type.toLowerCase());
}

function collectStructuredProducts(value, depth = 0, path = [], products = []) {
  if (!value || depth > 8) return products;

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStructuredProducts(entry, depth + 1, path, products));
    return products;
  }

  if (typeof value !== "object") return products;
  if (getSchemaTypes(value).includes("product")) {
    products.push({ product: value, depth, path });
    return products;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    collectStructuredProducts(nestedValue, depth + 1, [...path, key], products);
  });

  return products;
}

function normalizeComparableProductUrl(value, baseUrl) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value, baseUrl);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function scoreStructuredProductCandidate(candidate, productUrl) {
  const { product, depth, path } = candidate;
  const normalizedPath = path.join(".").toLowerCase();
  const candidateUrl = normalizeComparableProductUrl(
    typeof product.url === "string" ? product.url : product["@id"],
    productUrl
  );
  const currentUrl = normalizeComparableProductUrl(productUrl, productUrl);
  let score = 0;

  if (depth === 0) score += 100;
  if (normalizedPath.includes("@graph")) score += 60;
  if (normalizedPath.includes("mainentity")) score += 80;
  if (
    ["itemlistelement", "related", "recommend", "similar", "carousel"].some((key) =>
      normalizedPath.includes(key)
    )
  ) {
    score -= 120;
  }
  if (candidateUrl && currentUrl && candidateUrl === currentUrl) score += 140;
  if (typeof product.name === "string" && product.name.trim()) score += 20;
  if (product.image) score += 10;
  if (product.brand) score += 5;
  if (product.offers) score += 5;

  return score;
}

function getStructuredProductData(html, productUrl) {
  const jsonScripts = extractJsonDataFromScripts(html, true).filter(
    (script) => script.source === "json-script"
  );

  const candidates = jsonScripts.flatMap((script) =>
    collectStructuredProducts(script.data)
  );
  const selectedCandidate = candidates.sort(
    (first, second) =>
      scoreStructuredProductCandidate(second, productUrl) -
      scoreStructuredProductCandidate(first, productUrl)
  )[0];
  const product = selectedCandidate?.product;

  if (product) {

    const brandValue = product.brand;
    const brand =
      typeof brandValue === "string"
        ? brandValue
        : typeof brandValue?.name === "string"
          ? brandValue.name
          : "";
    const imageValue = Array.isArray(product.image) ? product.image[0] : product.image;
    const image =
      typeof imageValue === "string"
        ? imageValue
        : typeof imageValue?.url === "string"
          ? imageValue.url
          : typeof imageValue?.contentUrl === "string"
            ? imageValue.contentUrl
            : "";
    const colorValues = (Array.isArray(product.color) ? product.color : [product.color])
      .map((colorValue) =>
        typeof colorValue === "string"
          ? colorValue.trim()
          : typeof colorValue?.name === "string"
            ? colorValue.name.trim()
            : ""
      )
      .filter(Boolean);
    const uniqueColorValues = [...new Set(colorValues)];
    const color = uniqueColorValues.length === 1 ? uniqueColorValues[0] : "";
    const categoryValue = Array.isArray(product.category)
      ? product.category[0]
      : product.category;
    const category =
      typeof categoryValue === "string"
        ? categoryValue
        : typeof categoryValue?.name === "string"
          ? categoryValue.name
          : "";
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;

    return {
      name: typeof product.name === "string" ? product.name.trim() : "",
      brand: brand.trim(),
      category: category.trim(),
      color,
      image: image.trim(),
      price:
        typeof offers?.price === "string" || typeof offers?.price === "number"
          ? String(offers.price)
          : "",
    };
  }

  return undefined;
}

function hasProductPageEvidence(html, structuredProduct, isMusinsa) {
  if (isMusinsa || structuredProduct) return true;

  const ogType = extractMetaContent(html, ["og:type"]);
  if (ogType.toLowerCase().includes("product")) return true;

  return Boolean(
    extractMetaContent(html, [
      "product:name",
      "product:price:amount",
      "product:product_link",
    ])
  );
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

function cleanProductName(productName) {
  return (productName || "")
    .replace(/\s*-\s*사이즈\s*&\s*후기\s*$/i, "")
    .replace(/\s*\|\s*무신사\s*$/i, "")
    .replace(/\s*-\s*무신사\s*$/i, "")
    .replace(/\s*-\s*MUSINSA\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPrice(html) {
  const metaPrice = extractMetaContent(html, [
    "product:price:amount",
    "og:price:amount",
  ]);

  if (metaPrice) return metaPrice;

  const priceMatch = html.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/);
  return priceMatch?.[0] || "";
}

function normalizeProductSizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const normalized = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeExtractedBrand(value) {
  const brand = String(value || "").replace(/\s+/g, " ").trim();

  if (/^(?:brand|브랜드|maker|제조사)$/i.test(brand)) return "";
  return brand;
}

const FLAT_MEASUREMENT_KEYS = new Set(["chest", "waist", "hip", "thigh"]);

function normalizeProductSizeMeasurementValue(label, measurementKey, value) {
  const normalizedValue = normalizeProductSizeNumber(value);
  if (normalizedValue === undefined) return undefined;

  const normalizedLabel = String(label || "").toLowerCase().replace(/\s+/g, "");
  const isExplicitCircumference =
    FLAT_MEASUREMENT_KEYS.has(measurementKey) &&
    !normalizedLabel.includes("단면") &&
    (normalizedLabel.includes("둘레") || normalizedLabel.includes("circumference"));

  return isExplicitCircumference ? normalizedValue / 2 : normalizedValue;
}

function getProductSizeValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }

  return undefined;
}

const INVALID_SIZE_NAME_KEYWORDS = [
  "무신사",
  "단독",
  "무진장",
  "쿠폰",
  "할인",
  "적립",
  "후기",
  "배송",
  "무료",
  "이벤트",
  "랭킹",
  "브랜드",
];

function isValidBaseProductSizeName(size) {
  const normalizedSize = String(size || "").trim().toUpperCase();
  if (!normalizedSize) return false;

  if (INVALID_SIZE_NAME_KEYWORDS.some((keyword) => normalizedSize.includes(keyword))) return false;

  return /^(?:XS|S|M|L|XL|XXL|XXXL|[2-5]XL|FREE|OS|\d{1,3}|2[2-9]\d|3[0-1]\d)$/.test(normalizedSize);
}

function parseProductSizeName(value) {
  const rawSize = String(value || "").trim();
  if (!rawSize) return null;
  if (INVALID_SIZE_NAME_KEYWORDS.some((keyword) => rawSize.includes(keyword))) return null;

  const normalizedRawSize = rawSize.toUpperCase();
  const compactSize = normalizedRawSize.replace(/\s+/g, "");
  const isFreeSize = ["FREE", "F", "ONESIZE", "OS"].includes(compactSize);
  const letterSize = isFreeSize
    ? "FREE"
    : normalizedRawSize.match(
        /(?:^|[\s(/])((?:[2-5]XL|XXXL|XXL|XL|XS|S|M|L|FREE|OS))(?=$|[\s()/])/,
      )?.[1];
  const numericOnlySize = /^\d{1,3}$/.test(normalizedRawSize)
    ? normalizedRawSize
    : "";
  const size = letterSize || numericOnlySize;

  if (!isValidBaseProductSizeName(size)) return null;

  const rangeMatch = normalizedRawSize.match(
    /(?:\(|\s|^)(\d{1,3})\s*[~～\-–—]\s*(\d{1,3})(?:\)|\s|$)/,
  );
  const firstRangeValue = Number(rangeMatch?.[1]);
  const secondRangeValue = Number(rangeMatch?.[2]);
  const numericRange =
    Number.isFinite(firstRangeValue) && Number.isFinite(secondRangeValue)
      ? {
          min: Math.min(firstRangeValue, secondRangeValue),
          max: Math.max(firstRangeValue, secondRangeValue),
        }
      : undefined;

  return {
    size,
    rawSize,
    displaySize: size === "FREE" ? "FREE" : rawSize,
    numericRange,
  };
}

function isValidProductSizeName(size) {
  return Boolean(parseProductSizeName(size));
}

function hasProductSizeMeasurements(sizeMeasurement) {
  return [
    sizeMeasurement.totalLength,
    sizeMeasurement.shoulder,
    sizeMeasurement.chest,
    sizeMeasurement.sleeve,
    sizeMeasurement.waist,
    sizeMeasurement.hip,
    sizeMeasurement.thigh,
    sizeMeasurement.rise,
    sizeMeasurement.hem,
    sizeMeasurement.footLength,
  ].some((value) => typeof value === "number" && Number.isFinite(value));
}

function logInvalidSizeRow(reason, row, normalizedRow) {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_SIZE_GUIDE !== "true") return;

  console.log("[extract-product] skip invalid size row", {
    reason,
    size: normalizedRow?.size,
    row,
  });
}

function normalizeProductSizeMeasurement(row) {
  if (!row || typeof row !== "object") return null;

  const rawSize = String(
    getProductSizeValue(row, [
      "size",
      "name",
      "label",
      "option",
      "optionName",
      "sizeName",
      "사이즈",
      "호칭",
      "SIZE",
    ]) || "",
  ).trim();
  const parsedSize = parseProductSizeName(rawSize);

  if (!rawSize) return null;
  if (!parsedSize) {
    logInvalidSizeRow("invalid size name", row, { size: rawSize });
    return null;
  }

  return {
    ...parsedSize,
    totalLength: getNormalizedProductSizeValue(
      row,
      ["totalLength", "length", "총장", "기장", "옷길이"],
      "totalLength",
    ),
    shoulder: getNormalizedProductSizeValue(
      row,
      ["shoulder", "어깨", "어깨너비"],
      "shoulder",
    ),
    chest: getNormalizedProductSizeValue(
      row,
      ["chest", "bust", "가슴", "가슴단면", "가슴둘레", "chestCircumference"],
      "chest",
    ),
    sleeve: getNormalizedProductSizeValue(
      row,
      ["sleeve", "arm", "소매", "소매길이"],
      "sleeve",
    ),
    waist: getNormalizedProductSizeValue(
      row,
      ["waist", "허리", "허리단면", "허리둘레", "waistCircumference"],
      "waist",
    ),
    hip: getNormalizedProductSizeValue(
      row,
      ["hip", "엉덩이", "엉덩이단면", "힙", "엉덩이둘레", "hipCircumference"],
      "hip",
    ),
    thigh: getNormalizedProductSizeValue(
      row,
      ["thigh", "허벅지", "허벅지단면", "허벅지둘레", "thighCircumference"],
      "thigh",
    ),
    rise: getNormalizedProductSizeValue(row, ["rise", "밑위", "밑위길이"], "rise"),
    hem: getNormalizedProductSizeValue(row, ["hem", "밑단", "밑단단면"], "hem"),
    footLength: getNormalizedProductSizeValue(
      row,
      ["footLength", "발길이", "발 길이"],
      "footLength",
    ),
  };
}

function normalizeNestedSizeMeasurement(row) {
  const normalized = normalizeProductSizeMeasurement(row);
  if (!normalized) return null;

  const measurement = { ...normalized };
  const nestedValues = [row.items, row.values, row.measurements, row.measurement, row.details];

  for (const nestedValue of nestedValues) {
    const entries = Array.isArray(nestedValue)
      ? nestedValue
      : nestedValue && typeof nestedValue === "object"
        ? Object.entries(nestedValue).map(([name, value]) => ({ name, value }))
        : [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;

      const label = getProductSizeValue(entry, [
        "name",
        "label",
        "key",
        "itemName",
        "measurementName",
        "title",
      ]);
      const key = getSizeMeasurementKey(String(label || ""));
      const value = normalizeProductSizeMeasurementValue(
        label,
        key,
        getProductSizeValue(entry, ["value", "measurement", "sizeValue", "val", "content"]),
      );

      if (key && key !== "size" && value !== undefined) {
        measurement[key] = value;
      }
    }
  }

  return hasProductSizeMeasurements(measurement) ? measurement : null;
}

function normalizeProductSizeGuide(productSizeGuide) {
  if (!productSizeGuide || typeof productSizeGuide !== "object") return undefined;

  const collectionKeys = [
    "sizes",
    "size",
    "goodsSize",
    "goodsSizes",
    "measurements",
    "options",
    "table",
    "rows",
    "sizeInfo",
    "sizeInfos",
  ];
  const collections = [
    ...(Array.isArray(productSizeGuide) ? [productSizeGuide] : []),
    ...collectionKeys
      .map((key) => productSizeGuide[key])
      .filter((value) => Array.isArray(value)),
  ];

  for (const rawSizes of collections) {
    const sizes = rawSizes
      .filter((row) => !isEventBannerObject(row))
      .map((row) => normalizeNestedSizeMeasurement(row))
      .filter(Boolean);

    if (sizes.length > 0) {
      return {
        unit: "cm",
        sizes,
      };
    }
  }

  return undefined;
}

const SIZE_CANDIDATE_KEYWORDS = [
  "size",
  "measure",
  "measurement",
  "goods",
  "option",
  "product",
  "detail",
  "goodsNo",
  "productNo",
];

const EXCLUDED_SIZE_PATH_KEYWORDS = [
  "badge",
  "event",
  "campaign",
  "banner",
  "benefit",
  "promotion",
  "review",
  "logistics",
];

function isMusinsaProductUrl(productUrl) {
  try {
    return new URL(productUrl).hostname.includes("musinsa.com");
  } catch {
    return false;
  }
}

function extractMusinsaProductId(productUrl) {
  try {
    const parsedUrl = new URL(productUrl);
    const productPathMatch = parsedUrl.pathname.match(
      /\/(?:products|app\/goods|goods)\/(\d+)/,
    );
    if (productPathMatch?.[1]) return productPathMatch[1];

    const goodsNo = parsedUrl.searchParams.get("goodsNo") || parsedUrl.searchParams.get("productNo");
    return goodsNo || "";
  } catch {
    return "";
  }
}

function hasSizeCandidateKeyword(value) {
  const normalized = String(value || "").toLowerCase();
  return SIZE_CANDIDATE_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isExcludedSizePathKey(key) {
  const normalizedKey = String(key || "").toLowerCase();
  return EXCLUDED_SIZE_PATH_KEYWORDS.some((keyword) => normalizedKey.includes(keyword));
}

function getJsonSample(value) {
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 500 ? `${serialized.slice(0, 500)}...` : serialized;
  } catch {
    return String(value).slice(0, 500);
  }
}

function isEventBannerObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return (
    Object.prototype.hasOwnProperty.call(value, "eventBannerId") ||
    Object.prototype.hasOwnProperty.call(value, "bannerTitle") ||
    Object.prototype.hasOwnProperty.call(value, "landingUrl") ||
    Object.prototype.hasOwnProperty.call(value, "exposeContents")
  );
}

function collectSizeCandidateEntries(value, path = "", depth = 0, entries = []) {
  if (!value || depth > 8 || entries.length >= 20) return entries;

  if (Array.isArray(value)) {
    value.slice(0, 30).forEach((item, index) => {
      collectSizeCandidateEntries(item, `${path}[${index}]`, depth + 1, entries);
    });
    return entries;
  }

  if (typeof value !== "object") return entries;
  if (isEventBannerObject(value)) return entries;

  for (const [key, child] of Object.entries(value)) {
    if (isExcludedSizePathKey(key)) continue;

    const childPath = path ? `${path}.${key}` : key;

    if (hasSizeCandidateKeyword(key)) {
      entries.push({
        key: childPath,
        sample: getJsonSample(child),
      });
    }

    if (child && typeof child === "object") {
      collectSizeCandidateEntries(child, childPath, depth + 1, entries);
    }

    if (entries.length >= 20) break;
  }

  return entries;
}

function findSizeGuideInJson(value, depth = 0) {
  if (!value || depth > 6) return undefined;
  if (isEventBannerObject(value)) return undefined;

  const directNormalized = normalizeProductSizeGuide(value);
  if (directNormalized) return directNormalized;

  const normalized = normalizeProductSizeGuide(value.productSizeGuide || value.sizeGuide || value.sizeTable);
  if (normalized) return normalized;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSizeGuideInJson(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (isExcludedSizePathKey(key)) continue;
      if (!child || typeof child !== "object") continue;
      const found = findSizeGuideInJson(child, depth + 1);
      if (found) return found;
    }
  }

  return undefined;
}

function stripHtml(value = "") {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

const MATERIAL_DEFINITIONS = [
  { name: "폴리우레탄", aliases: ["폴리우레탄", "스판덱스", "스판", "span", "polyurethane", "elastane"] },
  { name: "폴리에스터", aliases: ["폴리에스터", "폴리에스테르", "polyester", "poly"] },
  { name: "레이온", aliases: ["레이온", "rayon", "viscose"] },
  { name: "나일론", aliases: ["나일론", "nylon"] },
  { name: "아크릴", aliases: ["아크릴", "acrylic"] },
  { name: "린넨", aliases: ["린넨", "linen", "마"] },
  { name: "면", aliases: ["코튼", "cotton", "면"] },
  { name: "울", aliases: ["wool", "울", "모"] },
  { name: "가죽", aliases: ["천연가죽", "합성가죽", "leather", "가죽"] },
  { name: "데님", aliases: ["데님", "denim"] },
  { name: "플리스", aliases: ["플리스", "후리스", "fleece"] },
  { name: "캐시미어", aliases: ["캐시미어", "cashmere"] },
  { name: "실크", aliases: ["실크", "silk"] },
];
const MATERIAL_CONTEXT_KEYWORDS = [
  "goodsMaterial",
  "material",
  "materials",
  "composition",
  "compositions",
  "fabric",
  "fabrics",
  "textile",
  "textiles",
  "fiber",
  "fibers",
  "goodsContents",
  "소재",
  "혼용률",
  "혼방률",
  "제품소재",
  "상품정보고시",
  "품질표시",
  "겉감",
  "안감",
  "충전재",
];

function isMaterialExtractionDebugEnabled() {
  return process.env.DEBUG_MATERIAL_EXTRACTION === "true";
}

function logMaterialExtraction(stage, details) {
  if (!isMaterialExtractionDebugEnabled()) return;
  console.log(`[extract-product] material ${stage}`, details);
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMaterialName(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (!normalizedValue) return "";

  const definition = MATERIAL_DEFINITIONS.find(({ aliases }) =>
    aliases.some((alias) => normalizedValue.includes(alias.toLowerCase())),
  );

  return definition?.name || "";
}

function normalizeMaterialPercentage(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsedValue = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 100
    ? parsedValue
    : null;
}

function getMaterialPercentageTotal(items) {
  return items.reduce(
    (total, item) => (
      typeof item.percentage === "number" ? total + item.percentage : total
    ),
    0,
  );
}

function findHundredPercentMaterialSubset(items) {
  const percentageItems = items.filter((item) => typeof item.percentage === "number");
  if (percentageItems.length > 12) return null;

  const maxMask = 1 << percentageItems.length;

  for (let mask = 1; mask < maxMask; mask += 1) {
    const subset = percentageItems.filter((_, index) => mask & (1 << index));
    const total = getMaterialPercentageTotal(subset);

    if (total >= 99.5 && total <= 100.5) return subset;
  }

  return null;
}

function sanitizeMaterialCompositionItems(items) {
  const percentageItems = items.filter((item) => typeof item.percentage === "number");
  const total = getMaterialPercentageTotal(items);

  if (percentageItems.length <= 1 || total <= 100.5) return items;

  const hundredPercentSubset = findHundredPercentMaterialSubset(items);
  if (hundredPercentSubset) return hundredPercentSubset;

  logMaterialExtraction("invalid-percentage-total", {
    total,
    items,
  });

  return items.map((item) => ({
    ...item,
    percentage: null,
  }));
}

function buildMaterialComposition(items, source) {
  const uniqueItems = [];

  for (const item of items) {
    const name = normalizeMaterialName(item?.name);
    if (!name) continue;

    const percentage = normalizeMaterialPercentage(item?.percentage);
    const existingItem = uniqueItems.find((candidate) => candidate.name === name);

    if (existingItem) {
      if (existingItem.percentage == null && percentage != null) {
        existingItem.percentage = percentage;
      }
      continue;
    }

    uniqueItems.push({ name, percentage });
  }

  if (uniqueItems.length === 0) return undefined;
  const sanitizedItems = sanitizeMaterialCompositionItems(uniqueItems);

  return {
    summary: sanitizedItems
      .map((item) =>
        item.percentage == null ? item.name : `${item.name} ${item.percentage}%`,
      )
      .join(", "),
    items: sanitizedItems,
    source,
  };
}

function parseMaterialCompositionText(
  value,
  source,
  contextLabel = "",
  options = {},
) {
  const text = stripHtml(`${contextLabel} ${String(value || "")}`);
  if (!text) return undefined;

  const hasMaterialContext = MATERIAL_CONTEXT_KEYWORDS.some((keyword) =>
    text.toLowerCase().includes(keyword.toLowerCase()),
  );
  const aliases = MATERIAL_DEFINITIONS.flatMap(({ aliases }) => aliases)
    .sort((first, second) => second.length - first.length)
    .map(escapeRegularExpression)
    .join("|");
  const percentagePattern = new RegExp(
    `(?:^|[\\s,/:()])(${aliases})\\s*[:：]?\\s*(\\d{1,3}(?:\\.\\d+)?)\\s*%`,
    "gi",
  );
  const reversePercentagePattern = new RegExp(
    `(?:^|[\\s,/:()])(\\d{1,3}(?:\\.\\d+)?)\\s*%\\s*(${aliases})(?=$|[\\s,/:()])`,
    "gi",
  );
  const percentageItems = [
    ...[...text.matchAll(percentagePattern)].map((match) => ({
      name: match[1],
      percentage: match[2],
    })),
    ...[...text.matchAll(reversePercentagePattern)].map((match) => ({
      name: match[2],
      percentage: match[1],
    })),
  ];

  if (percentageItems.length > 0) {
    return buildMaterialComposition(percentageItems, source);
  }

  const hasStrongMaterialContext =
    Boolean(contextLabel) &&
    isMaterialCandidateKey(contextLabel) &&
    !String(contextLabel).toLowerCase().includes("goodscontents");

  if (options.requirePercentage || !hasMaterialContext || !hasStrongMaterialContext) {
    return undefined;
  }

  const nameItems = MATERIAL_DEFINITIONS.filter(({ aliases: definitionAliases }) =>
    definitionAliases.some((alias) => {
      const normalizedAlias = alias.toLowerCase();
      if (normalizedAlias.length > 1) {
        return text.toLowerCase().includes(normalizedAlias);
      }

      return new RegExp(
        `(?:^|[\\s,/:()])${escapeRegularExpression(normalizedAlias)}(?:$|[\\s,/:()])`,
        "i",
      ).test(text);
    }),
  ).map(({ name }) => ({ name, percentage: null }));

  return buildMaterialComposition(nameItems, source);
}

function normalizeMaterialCompositionValue(value, source, contextLabel = "") {
  if (typeof value === "string" || typeof value === "number") {
    return parseMaterialCompositionText(value, source, contextLabel);
  }

  if (Array.isArray(value)) {
    const structuredItems = value.map((item) => ({
      name:
        item && typeof item === "object"
          ? getProductSizeValue(item, [
              "name",
              "material",
              "materialName",
              "fabric",
              "fiber",
              "label",
              "title",
              "type",
            ])
          : item,
      percentage:
        item && typeof item === "object"
          ? getProductSizeValue(item, [
              "percentage",
              "ratio",
              "rate",
              "contentRate",
              "percent",
              "value",
            ])
          : null,
    }));
    const structuredComposition = buildMaterialComposition(structuredItems, source);

    return (
      structuredComposition ||
      parseMaterialCompositionText(JSON.stringify(value), source, contextLabel)
    );
  }

  if (!value || typeof value !== "object") return undefined;

  if (Array.isArray(value.items)) {
    const itemComposition = normalizeMaterialCompositionValue(value.items, source, contextLabel);
    if (itemComposition) return itemComposition;
  }

  const keyedMaterialItems = Object.entries(value)
    .map(([key, child]) => ({
      name: key,
      percentage:
        typeof child === "string" || typeof child === "number" ? child : null,
    }))
    .filter((item) => normalizeMaterialName(item.name));
  const keyedComposition = buildMaterialComposition(keyedMaterialItems, source);
  if (keyedComposition) return keyedComposition;

  const scalarText = Object.entries(value)
    .filter(([, child]) => ["string", "number"].includes(typeof child))
    .map(([key, child]) => `${key}: ${child}`)
    .join(", ");

  return parseMaterialCompositionText(scalarText, source, contextLabel);
}

function isMaterialCandidateKey(key) {
  const normalizedKey = String(key || "").toLowerCase();
  return MATERIAL_CONTEXT_KEYWORDS.some((keyword) =>
    normalizedKey.includes(keyword.toLowerCase()),
  );
}

function findMaterialCompositionInJson(
  value,
  source,
  depth = 0,
  path = "$",
  debugSource = "json",
) {
  if (!value || depth > 9) return undefined;

  if (Array.isArray(value)) {
    for (const [index, child] of value.slice(0, 100).entries()) {
      const found = findMaterialCompositionInJson(
        child,
        source,
        depth + 1,
        `${path}[${index}]`,
        debugSource,
      );
      if (found) return found;
    }
    return undefined;
  }

  if (typeof value !== "object" || isEventBannerObject(value)) return undefined;

  const entryLabel = getProductSizeValue(value, ["name", "label", "title", "key"]);
  if (isMaterialCandidateKey(entryLabel)) {
    const entryValue = getProductSizeValue(value, [
      "value",
      "content",
      "description",
      "text",
      "items",
    ]);
    const normalizedEntry = normalizeMaterialCompositionValue(
      entryValue,
      source,
      String(entryLabel),
    );
    if (normalizedEntry) {
      logMaterialExtraction("candidate", {
        path,
        source: debugSource,
        summary: normalizedEntry.summary,
      });
      return normalizedEntry;
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (!isMaterialCandidateKey(key)) continue;

    const normalized = normalizeMaterialCompositionValue(child, source, key);
    if (normalized) {
      logMaterialExtraction("candidate", {
        path: `${path}.${key}`,
        source: debugSource,
        summary: normalized.summary,
      });
      return normalized;
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (isExcludedSizePathKey(key) || !child || typeof child !== "object") continue;

    const found = findMaterialCompositionInJson(
      child,
      source,
      depth + 1,
      `${path}.${key}`,
      debugSource,
    );
    if (found) return found;
  }

  return undefined;
}

function extractMaterialCompositionFromProductInfo(html) {
  const rowPatterns = [
    /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,
    /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
    /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi,
  ];

  for (const pattern of rowPatterns) {
    for (const match of html.matchAll(pattern)) {
      const rowText = stripHtml(match.slice(1).filter(Boolean).join(" "));
      const normalizedRowText = rowText.toLowerCase();
      if (
        !MATERIAL_CONTEXT_KEYWORDS.some((keyword) =>
          normalizedRowText.includes(keyword.toLowerCase()),
        )
      ) {
        continue;
      }

      const composition = parseMaterialCompositionText(
        rowText,
        "official",
        "상품정보고시 소재",
      );
      if (composition) {
        logMaterialExtraction("candidate", {
          path: "html.product-info",
          source: "product-info",
          summary: composition.summary,
        });
        return composition;
      }
    }
  }

  return undefined;
}

function getNormalizedProductSizeValue(row, keys, measurementKey) {
  for (const key of keys) {
    if (row[key] === undefined || row[key] === null || row[key] === "") continue;
    return normalizeProductSizeMeasurementValue(key, measurementKey, row[key]);
  }

  return undefined;
}

function extractMaterialCompositionFromVisibleText(html) {
  const visibleText = stripHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " "),
  );
  const materialLabelPattern =
    /(?:제품\s*)?소재|혼용률|혼방률|겉감|안감|충전재|fabric|composition|textile/gi;

  for (const match of visibleText.matchAll(materialLabelPattern)) {
    const start = Math.max(0, (match.index || 0) - 40);
    const snippet = visibleText.slice(start, start + 420);
    const composition = parseMaterialCompositionText(
      snippet,
      "official",
      "상품 상세 소재",
    );
    if (composition) {
      logMaterialExtraction("candidate", {
        path: "html.visible-text",
        source: "html-text",
        summary: composition.summary,
      });
      return composition;
    }
  }

  return undefined;
}

function extractProductMaterialComposition(html) {
  const parsedScripts = extractJsonDataFromScripts(html, true);

  for (const parsedScript of parsedScripts) {
    const found = findMaterialCompositionInJson(
      parsedScript.data,
      "official",
      0,
      `script[${parsedScript.index}]`,
      parsedScript.source,
    );
    if (found) return found;
  }

  const productInfoComposition = extractMaterialCompositionFromProductInfo(html);
  if (productInfoComposition) return productInfoComposition;

  const visibleTextComposition = extractMaterialCompositionFromVisibleText(html);
  if (visibleTextComposition) return visibleTextComposition;

  const metaDescription = extractMetaContent(html, [
    "description",
    "og:description",
    "twitter:description",
  ]);
  const metaComposition = parseMaterialCompositionText(
    metaDescription,
    "official",
    "meta description 소재",
    { requirePercentage: true },
  );
  if (metaComposition) {
    logMaterialExtraction("candidate", {
      path: "meta.description",
      source: "meta",
      summary: metaComposition.summary,
    });
  }

  return metaComposition;
}

async function fetchMusinsaMaterialComposition(productId, productUrl) {
  if (!productId) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(
      `https://goods-detail.musinsa.com/api2/goods/${productId}/essential`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
          Referer: productUrl,
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) return undefined;

    const responseJson = await response.json();
    const essentials = Array.isArray(responseJson?.data?.essentials)
      ? responseJson.data.essentials
      : [];
    const materialEssential = essentials.find((essential) =>
      isMaterialCandidateKey(essential?.name),
    );
    const materialComposition = materialEssential
      ? normalizeMaterialCompositionValue(
          materialEssential.value,
          "official",
          materialEssential.name,
        )
      : findMaterialCompositionInJson(
          responseJson,
          "official",
          0,
          "$.musinsa-essential",
          "musinsa-essential-api",
        );

    if (materialComposition) {
      if (materialEssential) {
        logMaterialExtraction("candidate", {
          path: `$.data.essentials.${materialEssential.name}`,
          source: "musinsa-essential-api",
          summary: materialComposition.summary,
        });
      }
      logMaterialExtraction("result", {
        source: "musinsa-essential-api",
        productId,
        summary: materialComposition.summary,
      });
    }

    return materialComposition;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function getTableCells(rowHtml) {
  return [...rowHtml.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
}

function getSizeMeasurementKey(label) {
  const normalized = label.toLowerCase().replace(/\s+/g, "");

  if (normalized.includes("사이즈") || normalized === "size") return "size";
  if (normalized.includes("총장") || normalized.includes("기장") || normalized.includes("length")) return "totalLength";
  if (normalized.includes("어깨") || normalized.includes("shoulder")) return "shoulder";
  if (normalized.includes("가슴") || normalized.includes("chest") || normalized.includes("bust")) return "chest";
  if (normalized.includes("소매") || normalized.includes("sleeve")) return "sleeve";
  if (normalized.includes("허리") || normalized.includes("waist")) return "waist";
  if (normalized.includes("엉덩이") || normalized.includes("힙") || normalized.includes("hip")) return "hip";
  if (normalized.includes("허벅지") || normalized.includes("thigh")) return "thigh";
  if (normalized.includes("밑위") || normalized.includes("rise")) return "rise";
  if (normalized.includes("밑단") || normalized.includes("hem")) return "hem";
  if (normalized.includes("발길이") || normalized.includes("footlength")) return "footLength";

  return "";
}

function extractProductSizeGuideFromTables(html) {
  const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

  for (const tableMatch of tableMatches) {
    const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const rows = rowMatches.map((match) => getTableCells(match[1])).filter((cells) => cells.length >= 2);

    if (rows.length < 2) continue;

    const headerIndex = rows.findIndex((cells) => {
      const mappedKeys = cells.map((cell) => getSizeMeasurementKey(cell)).filter(Boolean);
      return mappedKeys.includes("size") && mappedKeys.some((key) => key !== "size");
    });

    if (headerIndex < 0) continue;

    const headerLabels = rows[headerIndex];
    const headers = headerLabels.map((cell) => getSizeMeasurementKey(cell));
    const sizeRows = rows
      .slice(headerIndex + 1)
      .map((cells) => {
        const row = {};

        cells.forEach((cell, index) => {
          const key = headers[index];
          if (!key) return;

          row[key] = key === "size"
            ? cell
            : normalizeProductSizeMeasurementValue(headerLabels[index], key, cell);
        });

        return normalizeProductSizeMeasurement(row);
      })
      .filter(Boolean);

    if (sizeRows.length > 0) {
      return {
        unit: "cm",
        sizes: sizeRows,
      };
    }
  }

  return undefined;
}

function parseJsonScriptContent(content) {
  const trimmedContent = decodeHtmlEntities(content || "").trim();
  if (!trimmedContent) return null;

  try {
    return JSON.parse(trimmedContent);
  } catch {
    return null;
  }
}

function extractJsonDataFromScripts(html, includeAllJson = false) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const parsedScripts = [];

  for (const [index, match] of scripts.entries()) {
    const attrs = match[1] || "";
    const body = match[2] || "";
    const isNextData = /\bid=["']__NEXT_DATA__["']/i.test(attrs);
    const isJsonScript = /\btype=["']application\/(?:ld\+)?json["']/i.test(attrs);

    if (!includeAllJson && !isNextData && !isJsonScript && !hasSizeCandidateKeyword(body)) continue;

    const parsed = parseJsonScriptContent(body);
    if (parsed) {
      parsedScripts.push({
        index,
        source: isNextData ? "__NEXT_DATA__" : isJsonScript ? "json-script" : "inline-json",
        data: parsed,
      });
    }
  }

  return parsedScripts;
}

const GOODS_CONTENTS_KEYWORDS = [
  "사이즈",
  "총장",
  "어깨",
  "가슴",
  "소매",
  "허리",
  "엉덩이",
  "허벅지",
  "밑위",
  "밑단",
  "cm",
  "실측",
];

const SIZE_GUIDE_IMAGE_KEYWORDS = [
  "size",
  "measure",
  "measurement",
  "dimension",
  "spec",
  "guide",
  "사이즈",
  "실측",
  "치수",
];

const MUSINSA_DIRECT_SIZE_PATHS = [
  "goodsContents",
  "goodsSize",
  "size",
  "sizeInfo",
  "sizeInfos",
  "sizeGuide",
  "measurement",
  "measurements",
  "option",
  "options",
  "goodsOption",
  "goodsOptions",
];

function getMusinsaMetaData(parsedScripts) {
  const nextData = parsedScripts.find((script) => script.source === "__NEXT_DATA__")?.data;
  return nextData?.props?.pageProps?.meta?.data;
}

function serializeDebugPreview(value, maxLength = 1000) {
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value || "").slice(0, maxLength);
  }
}

function hasMeasurementKeywords(value) {
  const serializedValue = serializeDebugPreview(value, Number.MAX_SAFE_INTEGER).toLowerCase();
  return GOODS_CONTENTS_KEYWORDS.some((keyword) => serializedValue.includes(keyword.toLowerCase()));
}

function collectMeasurementValueEntries(
  value,
  path = "",
  depth = 0,
  entries = [],
  parent = undefined,
) {
  if (value == null || depth > 12 || entries.length >= 40) return entries;
  if (isEventBannerObject(value)) return entries;

  if (typeof value === "string" || typeof value === "number") {
    const text = String(value);
    const matchedKeywords = GOODS_CONTENTS_KEYWORDS.filter((keyword) =>
      text.toLowerCase().includes(keyword.toLowerCase()),
    );

    if (matchedKeywords.length > 0) {
      entries.push({
        path: path || "(root)",
        matchedKeywords,
        sample: stripHtml(text).slice(0, 700),
        parent,
      });
    }
    return entries;
  }

  if (Array.isArray(value)) {
    value.slice(0, 200).forEach((item, index) => {
      collectMeasurementValueEntries(item, `${path}[${index}]`, depth + 1, entries, value);
    });
    return entries;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (isExcludedSizePathKey(key)) continue;
      const childPath = path ? `${path}.${key}` : key;
      collectMeasurementValueEntries(child, childPath, depth + 1, entries, value);
      if (entries.length >= 40) break;
    }
  }

  return entries;
}

function findSizeGuideFromMeasurementEntries(entries) {
  for (const entry of entries) {
    if (!entry.parent || typeof entry.parent !== "object") continue;

    const found = findSizeGuideInJson(entry.parent);
    if (found) {
      return {
        productSizeGuide: found,
        source: `value-path:${entry.path}`,
      };
    }
  }

  return undefined;
}

function logMusinsaDirectSizePaths(data) {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_SIZE_GUIDE !== "true") return;

  const goodsContents = data?.goodsContents;
  console.log("[extract-product] goodsContents debug", {
    type: typeof goodsContents,
    isArray: Array.isArray(goodsContents),
    preview: serializeDebugPreview(goodsContents),
  });

  for (const path of MUSINSA_DIRECT_SIZE_PATHS) {
    const value = data?.[path];
    console.log("[extract-product] size path debug", {
      path,
      type: typeof value,
      isArray: Array.isArray(value),
      length: Array.isArray(value) || typeof value === "string" ? value.length : undefined,
      hasMeasurementKeywords: hasMeasurementKeywords(value),
      preview: serializeDebugPreview(value),
    });
  }
}

function findMusinsaDirectSizeGuide(data) {
  for (const path of MUSINSA_DIRECT_SIZE_PATHS) {
    if (isExcludedSizePathKey(path)) continue;

    const value = data?.[path];
    if (value == null || !hasMeasurementKeywords(value)) continue;

    const jsonSizeGuide = findSizeGuideInJson(value);
    if (jsonSizeGuide) return { productSizeGuide: jsonSizeGuide, source: `__NEXT_DATA__.${path}` };

    if (typeof value === "string") {
      const tableSizeGuide = extractProductSizeGuideFromTables(value);
      if (tableSizeGuide) {
        return { productSizeGuide: tableSizeGuide, source: `__NEXT_DATA__.${path}` };
      }
    }
  }

  return undefined;
}

function getKeywordContext(value, keywords, contextLength = 1000) {
  let serializedValue = "";

  try {
    serializedValue = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    serializedValue = String(value || "");
  }

  const text = stripHtml(serializedValue);
  const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));

  if (matchedKeywords.length === 0) return null;

  const keywordIndex = Math.min(...matchedKeywords.map((keyword) => text.indexOf(keyword)));
  const start = Math.max(0, keywordIndex - Math.floor(contextLength / 2));
  return {
    matchedKeywords,
    context: text.slice(start, start + contextLength),
  };
}

function collectDetailImageUrls(value, productUrl, urls = new Set(), depth = 0) {
  if (value == null || depth > 10 || urls.size >= 10) return urls;

  if (typeof value === "string") {
    const urlMatches = value.matchAll(
      /(?:https?:)?\/\/[^"'<>\\s]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'<>\\s]*)?|\/[^"'<>\\s]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'<>\\s]*)?/gi,
    );

    for (const match of urlMatches) {
      const absoluteUrl = resolveProductImageUrl(match[0], productUrl);
      if (absoluteUrl) urls.add(absoluteUrl);
      if (urls.size >= 10) break;
    }

    return urls;
  }

  if (Array.isArray(value)) {
    value.slice(0, 100).forEach((item) => collectDetailImageUrls(item, productUrl, urls, depth + 1));
    return urls;
  }

  if (typeof value === "object") {
    if (isEventBannerObject(value)) return urls;

    Object.values(value).forEach((child) =>
      collectDetailImageUrls(child, productUrl, urls, depth + 1),
    );
  }

  return urls;
}

function collectSizeGuideImageCandidates(html, productUrl) {
  const candidates = new Set();
  const imageTagMatches = html.matchAll(/<img\b[^>]*>/gi);

  for (const match of imageTagMatches) {
    const imageTag = match[0];
    const sourceMatch = imageTag.match(/\b(?:src|data-src|data-original)=["']([^"']+)["']/i);
    const imageUrl = sourceMatch?.[1];
    if (!imageUrl) continue;

    const contextStart = Math.max(0, (match.index || 0) - 350);
    const contextEnd = Math.min(html.length, (match.index || 0) + imageTag.length + 350);
    const context = decodeHtmlEntities(html.slice(contextStart, contextEnd));
    const absoluteUrl = resolveProductImageUrl(imageUrl, productUrl);
    const searchableValue = `${absoluteUrl} ${imageTag} ${context}`.toLowerCase();

    if (
      SIZE_GUIDE_IMAGE_KEYWORDS.some((keyword) =>
        searchableValue.includes(keyword.toLowerCase()),
      )
    ) {
      candidates.add(absoluteUrl);
    }

    if (candidates.size >= 10) break;
  }

  return [...candidates];
}

function getMusinsaSizeApiUrls(productId) {
  if (!productId) return [];

  return [
    `https://goods-detail.musinsa.com/api2/goods/${productId}/actual-size`,
    `https://goods-detail.musinsa.com/api2/goods/${productId}/size`,
    `https://goods-detail.musinsa.com/api2/goods/${productId}/measurement`,
    `https://goods-detail.musinsa.com/api2/goods/${productId}/option`,
    `https://goods-detail.musinsa.com/api2/goods/${productId}/options`,
    `https://goods-detail.musinsa.com/api2/goods/${productId}`,
    `https://www.musinsa.com/api/goods/v1/goods/${productId}`,
  ];
}

function normalizeMusinsaActualSizeGuide(responseJson) {
  return findSizeGuideInJson(responseJson);
}

async function inspectMusinsaSizeSources({ html, productUrl, productId }) {
  if (!productId) {
    return {
      productSizeGuide: undefined,
      url: "",
      sizeGuideStatus: "productId_not_found",
      sizeGuideImageCandidates: [],
    };
  }

  const isDebugEnabled =
    process.env.NODE_ENV !== "production" && process.env.DEBUG_SIZE_GUIDE === "true";
  const parsedScripts = extractJsonDataFromScripts(html, true);
  const data = getMusinsaMetaData(parsedScripts);
  const goodsContents = data?.goodsContents;
  const goodsContentsContext = getKeywordContext(goodsContents, GOODS_CONTENTS_KEYWORDS, 1000);
  const detailImageUrls = [...collectDetailImageUrls(goodsContents, productUrl)];
  const sizeGuideImageCandidates = [
    ...new Set([
      ...collectSizeGuideImageCandidates(html, productUrl),
      ...collectSizeGuideImageCandidates(
        typeof goodsContents === "string"
          ? goodsContents.replace(/\\"/g, '"').replace(/\\\//g, "/")
          : "",
        productUrl,
      ),
      ...detailImageUrls.filter((imageUrl) =>
        SIZE_GUIDE_IMAGE_KEYWORDS.some((keyword) =>
          imageUrl.toLowerCase().includes(keyword.toLowerCase()),
        ),
      ),
    ]),
  ].slice(0, 10);
  const measurementValueEntries = parsedScripts.flatMap((parsedScript) =>
    collectMeasurementValueEntries(
      parsedScript.data,
      parsedScript.source,
    ),
  );
  const mappedValueSizeGuide = findSizeGuideFromMeasurementEntries(measurementValueEntries);

  if (isDebugEnabled) {
    console.log("[extract-product] musinsa goodsContents", {
      found: goodsContents != null,
      type: typeof goodsContents,
      matchedKeywords: goodsContentsContext?.matchedKeywords || [],
      context: goodsContentsContext?.context || "none",
    });
    console.log("[extract-product] musinsa detail image urls", detailImageUrls);
    console.log(
      "[extract-product] measurement value paths",
      measurementValueEntries.slice(0, 40).map((entry) => ({
        path: entry.path,
        matchedKeywords: entry.matchedKeywords,
        sample: entry.sample,
      })),
    );
    console.log("[extract-product] size guide image candidates", sizeGuideImageCandidates);
  }

  if (mappedValueSizeGuide?.productSizeGuide) {
    return {
      ...mappedValueSizeGuide,
      sizeGuideStatus: "text data found",
      sizeGuideImageCandidates,
    };
  }

  const apiResults = [];

  for (const apiUrl of getMusinsaSizeApiUrls(productId)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
          Referer: productUrl,
        },
        signal: controller.signal,
      });
      const responseText = await response.text();
      let responseJson;

      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = undefined;
      }

      const productSizeGuide = responseJson
        ? normalizeMusinsaActualSizeGuide(responseJson)
        : undefined;
      const errorMessage =
        responseJson?.error?.message ||
        responseJson?.message ||
        responseJson?.meta?.message ||
        response.statusText ||
        "";
      const dataSample = responseJson
        ? getJsonSample(responseJson?.error?.data || responseJson?.data || responseJson)
        : responseText.slice(0, 500);
      const apiResult = {
        url: apiUrl,
        ok: response.ok,
        status: response.status,
        errorMessage,
        productSizeGuide,
      };
      apiResults.push(apiResult);

      if (isDebugEnabled) {
        console.log("[extract-product] musinsa size api", {
          url: apiUrl,
          status: response.status,
          ok: response.ok,
          errorMessage,
          dataSample,
          jsonKeys:
            responseJson && typeof responseJson === "object" && !Array.isArray(responseJson)
              ? Object.keys(responseJson).slice(0, 20)
              : [],
        });
      }

      if (productSizeGuide) break;
    } catch (error) {
      const apiResult = {
        url: apiUrl,
        ok: false,
        status: error?.name === "AbortError" ? "timeout" : "request-failed",
        errorMessage: error?.message || String(error),
        productSizeGuide: undefined,
      };
      apiResults.push(apiResult);

      if (isDebugEnabled) {
        console.log("[extract-product] musinsa size api", apiResult);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  const apiResult = apiResults.find((result) => result.productSizeGuide);
  if (apiResult) {
    return {
      ...apiResult,
      sizeGuideStatus: "api data found",
      sizeGuideImageCandidates,
    };
  }

  return {
    productSizeGuide: undefined,
    url: "",
    sizeGuideStatus: sizeGuideImageCandidates.length > 0
      ? "image_only"
      : apiResults.some((result) => result.ok)
        ? "no_text_size_guide"
        : "api_failed",
    sizeGuideImageCandidates,
  };
}

function extractProductSizeGuide(html, productUrl = "") {
  const isMusinsa = isMusinsaProductUrl(productUrl);
  const productId = isMusinsa ? extractMusinsaProductId(productUrl) : "";
  const parsedScripts = extractJsonDataFromScripts(html);
  const sizeCandidateEntries = [];

  if (isMusinsa) {
    if (!productId) {
      return {
        productSizeGuide: undefined,
        source: "",
        productId: "",
        sizeGuideStatus: "productId_not_found",
      };
    }

    const data = getMusinsaMetaData(parsedScripts);
    logMusinsaDirectSizePaths(data);

    const directSizeGuide = findMusinsaDirectSizeGuide(data);
    if (directSizeGuide) {
      return {
        ...directSizeGuide,
        productId,
        sizeGuideStatus: "text data found",
      };
    }

    const tableSizeGuide = extractProductSizeGuideFromTables(html);
    return {
      productSizeGuide: tableSizeGuide,
      source: tableSizeGuide ? "table" : "",
      productId,
      sizeGuideStatus: tableSizeGuide ? "text data found" : "no_text_size_guide",
    };
  }

  for (const parsedScript of parsedScripts) {
    collectSizeCandidateEntries(parsedScript.data, parsedScript.source, 0, sizeCandidateEntries);
    const found = findSizeGuideInJson(parsedScript.data);
    if (found) {
      return {
        productSizeGuide: found,
        source: parsedScript.source,
        productId,
        sizeGuideStatus: "text data found",
      };
    }
  }

  const jsonScriptMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const match of jsonScriptMatches) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1]));
      collectSizeCandidateEntries(parsed, "json-ld", 0, sizeCandidateEntries);
      const found = findSizeGuideInJson(parsed);
      if (found) {
        return {
          productSizeGuide: found,
          source: "json",
          productId,
          sizeGuideStatus: "text data found",
        };
      }
    } catch {
      // Ignore malformed structured data. Product extraction should still succeed.
    }
  }

  const tableSizeGuide = extractProductSizeGuideFromTables(html);

  return {
    productSizeGuide: tableSizeGuide,
    source: tableSizeGuide ? "table" : "",
    productId,
    sizeGuideStatus: tableSizeGuide ? "text data found" : "manual_required",
  };
}

function logProductSizeGuideExtraction(productSizeGuideResult) {
  if (process.env.NODE_ENV === "production") return;

  const productSizeGuide = productSizeGuideResult?.productSizeGuide;
  const isDebugEnabled = process.env.DEBUG_SIZE_GUIDE === "true";
  const sizeGuideSummary = {
    found: Boolean(productSizeGuide),
    source: productSizeGuideResult?.source || "none",
    status: productSizeGuideResult?.sizeGuideStatus || "not found",
    sizesLength: productSizeGuide?.sizes?.length || 0,
    sizes: productSizeGuide?.sizes?.map((sizeInfo) => sizeInfo.size) || [],
  };

  if (!productSizeGuide) {
    if (isDebugEnabled) {
      console.log("[extract-product] productSizeGuide", sizeGuideSummary);
    }
    return;
  }

  console.log("[extract-product] productSizeGuide", sizeGuideSummary);

  if (isDebugEnabled) {
    console.log("[extract-product] productSizeGuide detail", JSON.stringify(productSizeGuide, null, 2));
  }
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

function sendProductExtractionError(res, status, code, message) {
  return res.status(status).json({ error: code, message });
}

app.post("/extract-product", async (req, res) => {
  try {
    const { url } = req.body;
    const productUrl = typeof url === "string" ? url.trim() : "";

    if (!productUrl) {
      return sendProductExtractionError(
        res,
        400,
        "product_url_required",
        "상품 링크가 필요합니다."
      );
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(productUrl);
    } catch {
      return sendProductExtractionError(
        res,
        400,
        "invalid_product_url",
        "올바른 상품 링크가 아닙니다."
      );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return sendProductExtractionError(
        res,
        400,
        "unsupported_product_url_protocol",
        "HTTP 또는 HTTPS 상품 링크만 지원합니다."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(parsedUrl.toString(), {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return sendProductExtractionError(
          res,
          502,
          "product_page_unreachable",
          `상품 페이지를 불러오지 못했습니다. (${response.status})`
        );
      }

      const finalProductUrl = (() => {
        try {
          const resolvedUrl = new URL(response.url || parsedUrl.toString());
          return ["http:", "https:"].includes(resolvedUrl.protocol)
            ? resolvedUrl.toString()
            : parsedUrl.toString();
        } catch {
          return parsedUrl.toString();
        }
      })();
      const html = await response.text();
      const isMusinsa = isMusinsaProductUrl(finalProductUrl);
      const productId = isMusinsa ? extractMusinsaProductId(finalProductUrl) : "";
      const structuredProduct = getStructuredProductData(html, finalProductUrl);

      if (!hasProductPageEvidence(html, structuredProduct, Boolean(isMusinsa && productId))) {
        return sendProductExtractionError(
          res,
          422,
          "unsupported_product_page",
          "상품 정보가 확인되는 쇼핑 페이지 링크만 자동 등록할 수 있습니다."
        );
      }

      if (process.env.NODE_ENV !== "production" && process.env.DEBUG_SIZE_GUIDE === "true") {
        console.log("[extract-product] resolved product url", {
          finalUrl: finalProductUrl,
          isMusinsa,
          productId,
        });
      }

      const mallName = inferMallName(finalProductUrl, html);
      const title = cleanProductTitle(extractTitle(html), mallName);
      const brand =
        normalizeExtractedBrand(structuredProduct?.brand) ||
        normalizeExtractedBrand(
          extractMetaContent(html, ["product:brand", "og:brand", "brand"])
        );
      const productName = extractMetaContent(html, [
        "product:name",
        "og:description",
      ]);
      const productColor =
        structuredProduct?.color ||
        extractMetaContent(html, ["product:color", "og:color", "color"]) ||
        "";
      const productCategory =
        structuredProduct?.category ||
        extractMetaContent(html, ["product:category", "category"]) ||
        "";
      const price = structuredProduct?.price || extractPrice(html) || "";
      const productImageMeta = extractMetaContentWithDebug(html, [
        "og:image",
        "twitter:image",
        "image",
        "og:image:secure_url",
      ]);
      const structuredProductImageUrl = resolveProductImageUrl(
        structuredProduct?.image || "",
        finalProductUrl
      );
      const metadataProductImageUrl = resolveProductImageUrl(
        productImageMeta.value || "",
        finalProductUrl
      );
      const productImageUrl = structuredProductImageUrl || metadataProductImageUrl;
      let materialComposition =
        isMusinsa && productId
          ? await fetchMusinsaMaterialComposition(productId, finalProductUrl)
          : undefined;
      if (!materialComposition) {
        materialComposition = extractProductMaterialComposition(html);
      }
      if (materialComposition) {
        materialComposition = {
          ...materialComposition,
          source: "official",
        };
        logMaterialExtraction("result", {
          source: materialComposition.source,
          summary: materialComposition.summary,
        });
      }
      // Product size extraction is on by default. Set the flag to "false" only
      // when a local or test environment intentionally needs to skip remote lookup.
      const isProductSizeGuideEnabled = process.env.ENABLE_PRODUCT_SIZE_GUIDE !== "false";
      const isProductSizeGuideDebugEnabled = process.env.DEBUG_SIZE_GUIDE === "true";
      let productSizeGuideResult = {
        productSizeGuide: undefined,
        source: "disabled",
        productId: "",
        sizeGuideStatus: "disabled",
        sizeGuideImageCandidates: [],
      };

      if (isProductSizeGuideEnabled || isProductSizeGuideDebugEnabled) {
        productSizeGuideResult = extractProductSizeGuide(html, finalProductUrl);

        if (!productSizeGuideResult.productSizeGuide && productSizeGuideResult.productId) {
          const apiSizeGuideResult = await inspectMusinsaSizeSources({
            html,
            productUrl: finalProductUrl,
            productId: productSizeGuideResult.productId,
          });

          if (apiSizeGuideResult) {
            productSizeGuideResult = {
              ...productSizeGuideResult,
              productSizeGuide:
                apiSizeGuideResult.productSizeGuide ||
                productSizeGuideResult.productSizeGuide,
              source: apiSizeGuideResult.productSizeGuide
                ? apiSizeGuideResult.source || `api:${apiSizeGuideResult.url}`
                : productSizeGuideResult.source,
              sizeGuideStatus:
                apiSizeGuideResult.sizeGuideStatus ||
                productSizeGuideResult.sizeGuideStatus,
              sizeGuideImageCandidates:
                apiSizeGuideResult.sizeGuideImageCandidates || [],
            };
          }
        }
      }

      const productSizeGuide = isProductSizeGuideEnabled
        ? productSizeGuideResult.productSizeGuide
        : undefined;
      logProductSizeGuideExtraction(productSizeGuideResult);

      const extractedBrand = brand;
      const rawProductName = structuredProduct?.name || title || productName || "";
      const extractedProductName = cleanProductName(rawProductName);

      if (!extractedProductName) {
        return sendProductExtractionError(
          res,
          422,
          "product_information_not_found",
          "이 상품 페이지에서 등록에 필요한 정보를 찾지 못했습니다."
        );
      }

      if (process.env.NODE_ENV !== "production" && rawProductName !== extractedProductName) {
        console.log("[extract-product] product name cleaned", {
          rawProductName,
          cleanedProductName: extractedProductName,
        });
      }

      const missingFields = [
        !extractedBrand ? "brand" : "",
        !productImageUrl ? "productImageUrl" : "",
        !materialComposition ? "materialComposition" : "",
      ].filter(Boolean);
      const extractionStatus = !productImageUrl
        ? "missing_image"
        : missingFields.length > 0
          ? "partial"
          : "complete";
      const extractedProduct = {
        brand: extractedBrand,
        productName: extractedProductName,
        productCategory,
        productColor,
        productUrl: finalProductUrl,
        productImageUrl,
        productSizeGuide,
        materialComposition,
        sizeGuideStatus: productSizeGuideResult.sizeGuideStatus,
        extractionStatus,
        extractionSource: isMusinsa ? "musinsa" : "structured_metadata",
        missingFields,
        ...(isProductSizeGuideDebugEnabled
          ? { sizeGuideImageCandidates: productSizeGuideResult.sizeGuideImageCandidates || [] }
          : {}),
        mallName,
        price,
      };

      return res.json(extractedProduct);
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("[extract-product] error:", error);
    if (error?.name === "AbortError") {
      return sendProductExtractionError(
        res,
        504,
        "product_page_timeout",
        "상품 페이지 응답 시간이 너무 길어 중단했습니다."
      );
    }

    if (error instanceof TypeError) {
      return sendProductExtractionError(
        res,
        502,
        "product_page_unreachable",
        "상품 페이지에 연결하지 못했습니다."
      );
    }

    return sendProductExtractionError(
      res,
      500,
      "product_extraction_failed",
      "상품 정보를 처리하지 못했습니다."
    );
  }
});

app.post("/analyze-clothes", async (req, res) => {
  try {
    const { image, imageMimeType, applyBackgroundRemoval, productContext } = req.body;
    const normalizedProductContext = normalizeProductAnalysisContext(productContext);

    if (!image) {
      return res.status(400).json({
        category: "분석 실패",
        subCategory: "이미지 없음",
        detailCategory: "이미지 없음",
        color: "분석 불가",
        style: "분석 불가",
        styleTags: ["데일리"],
        season: "",
        seasons: [],
        seasonSource: "photo_ai",
        seasonNeedsReview: true,
        fit: "분석 불가",
        description: "이미지가 없어 옷을 분석하지 못했습니다.",
        matchTip: "사진을 다시 선택해주세요.",
        avoidTip: "분석할 이미지가 필요합니다.",
        cleanImageBase64: null,
        productCandidates: [],
        styleProfile: null,
        garmentProfile: null,
        ...DEFAULT_CLOTHES_DETAIL_ANALYSIS,
      });
    }

    const requestImageMimeType = getImageFileInfo(imageMimeType).mimeType;

    console.log("[analyze-clothes] request", {
      imageMimeType: requestImageMimeType,
      imageLength: image?.length || 0,
      targetCategory: normalizedProductContext?.category || null,
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
${getProductAnalysisInstruction(normalizedProductContext)}

분석 대상 옷 하나를 옷장에 저장할 정보로 만들어주세요.

반드시 아래 JSON 형식만 반환해주세요.

{
  "category": "상의 / 하의 / 신발 / 아우터 / 액세서리 / 기타 중 하나",
  "subCategory": "티셔츠, 셔츠, 후드티, 데님팬츠, 슬랙스, 스니커즈 등 기본 종류",
  "detailCategory": "반팔 티셔츠, 긴팔 티셔츠, 오버핏 후드티, 와이드 데님팬츠 등 더 구체적인 종류",
  "color": "대표 색상",
  "style": "캐주얼 / 미니멀 / 스트릿 / 포멀 / 스포티 / 빈티지 / 기타 중 하나",
  "styleTags": ["캐주얼", "편안함", "데일리"],
  "seasons": ["봄", "가을"],
  "seasonEvidence": {
    "sleeveLength": "민소매 / 반팔 / 중간 소매 / 긴팔 / 해당 없음 / 판단 어려움 중 하나",
    "thickness": "얇음 / 보통 / 두꺼움 / 판단 어려움 중 하나",
    "insulation": "낮음 / 보통 / 높음 / 판단 어려움 중 하나",
    "breathability": "낮음 / 보통 / 높음 / 판단 어려움 중 하나",
    "layeringRole": "단독 / 이너 / 가벼운 겉옷 / 방한 겉옷 / 해당 없음 / 판단 어려움 중 하나",
    "evidence": ["계절 판단에 사용한 사진 속 단서"]
  },
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
  "garmentProfile": {
    "silhouette": "slim / regular / semiOversized / oversized / wide / cropped / long 중 하나",
    "volume": 0,
    "visualWeight": 0,
    "lengthBalance": "short / regular / long 중 하나",
    "fitIntent": "trueToSize / relaxed / oversized / structured 중 하나",
    "pointLevel": 0,
    "structure": "soft / normal / stiff 중 하나",
    "drape": "low / medium / high 중 하나"
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
- seasons는 ["봄", "여름", "가을", "겨울", "사계절"] 중 근거가 있는 값만 담으세요. 판단 근거가 부족하면 빈 배열 []을 반환하세요.
- 계절은 색상이나 스타일 분위기로 추측하지 말고 의류 종류, 소매 길이, 원단 두께, 보온성, 통기성, 레이어링 역할을 먼저 판단한 뒤 결정하세요.
- seasonEvidence를 먼저 작성한 다음 그 근거와 일치하는 seasons를 선택하세요.
- "사계절"은 기본값이 아닙니다. 사진만으로 사계절 착용을 확정하기 어렵다면 "사계절" 대신 빈 배열 []을 반환하세요.
- "사계절"을 다른 계절과 함께 넣지 마세요. 특정 계절을 선택했다면 "사계절"은 제외하세요.
- 반팔·민소매·린넨·쇼츠·샌들은 여름 중심, 패딩·다운·무스탕은 겨울, 가디건·바람막이·맨투맨은 봄/가을 중심으로 판단하세요.
- 반팔 니트는 일반 니트와 구분해 봄/여름 중심으로 판단하고, 얇은 니트와 두꺼운 울 니트를 같은 계절로 처리하지 마세요.
- 사진만으로 두께나 소재를 확인하기 어렵다면 seasonEvidence에 "판단 어려움"을 쓰고, 근거 없이 겨울 또는 여름 한 계절로 단정하지 마세요.
- garmentProfile은 사진에서 보이는 의류의 실루엣, 부피감, 소재 인상을 추정하는 필드입니다.
- 모델 착용 사진일 수 있으므로 garmentProfile을 사용자에게 실제로 맞는 핏이나 체형 적합도로 판단하지 마세요.
- garmentProfile은 코디의 시각적 균형을 돕는 보조 정보이며 실제 핏은 상품 실측과 사용자 신체 치수로 별도 판단합니다.
- silhouette은 몸에 붙는 정도, 품, 기장과 전체 외곽선을 함께 보고 가장 가까운 값을 선택하세요.
- volume은 옷이 몸 주변에 만드는 부피감을 0~10으로 평가하세요. 0은 매우 슬림, 10은 매우 풍성한 볼륨입니다.
- visualWeight는 두께, 색의 무게, 소재 밀도와 면적을 고려한 시각적 무게감을 0~10으로 평가하세요.
- lengthBalance는 같은 카테고리의 일반적인 옷과 비교한 상대 기장입니다.
- fitIntent는 정사이즈 착용, 여유로운 착용, 의도된 오버핏, 각 잡힌 구조적 착용 중 가장 가까운 값을 선택하세요.
- pointLevel은 그래픽, 패턴, 강한 색, 독특한 구조 등 코디에서 시선을 끄는 강도를 0~10으로 평가하세요.
- structure는 소재와 봉제 형태가 부드러운지, 보통인지, 단단하게 각이 잡히는지 평가하세요.
- drape는 원단이 아래로 자연스럽게 흐르는 정도를 low / medium / high로 평가하세요.
- 사진만으로 판단하기 어려운 수치는 과장하지 말고 중간값에 가깝게 보수적으로 작성하세요.
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
    const rawParsed = JSON.parse(text);
    const { analysis: parsed } = applyProductTargetTrustPolicy(
      normalizedProductContext,
      rawParsed
    );
    const seasonResolution = resolveClothesSeasons(parsed);
    const seasons = seasonResolution.seasons;
    const styleTags = normalizeStyleTags(
      [
        ...(normalizedProductContext?.styleTags || []),
        ...(Array.isArray(parsed.styleTags) ? parsed.styleTags : []),
      ],
      parsed.style
    );
    const productCandidates = normalizeProductCandidates(parsed.productCandidates);
    const styleProfile = normalizeStyleProfile(parsed.styleProfile);
    const garmentProfile = normalizeGarmentProfile(parsed.garmentProfile);
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
    const sanitizedSubCategory = generalizeBrandTerms(
      normalizedProductContext?.subCategory || parsed.subCategory,
      "분석 전"
    );
    const sanitizedDetailCategory = generalizeBrandTerms(
      normalizedProductContext?.detailCategory || parsed.detailCategory || parsed.subCategory,
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
      category: normalizedProductContext?.category || parsed.category || "기타",
      subCategory: sanitizedSubCategory,
      detailCategory: sanitizedDetailCategory,
      color: normalizedProductContext?.color || parsed.color || "색상 분석 전",
      style: styleTags[0] || parsed.style || "스타일 분석 전",
      styleTags,
      season: seasons.join(", "),
      seasons,
      seasonSource: seasonResolution.source,
      seasonNeedsReview: seasonResolution.needsReview,
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
      material:
        normalizedProductContext?.material ||
        parsed.material ||
        DEFAULT_CLOTHES_DETAIL_ANALYSIS.material,
      pattern: parsed.pattern || DEFAULT_CLOTHES_DETAIL_ANALYSIS.pattern,
      description: sanitizedDescription,
      matchTip: sanitizedMatchTip,
      avoidTip: sanitizedAvoidTip,
      productCandidates,
      styleProfile,
      garmentProfile,
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
      season: "",
      seasons: [],
      seasonSource: "photo_ai",
      seasonNeedsReview: true,
      fit: "분석 실패",
      description: "옷 분석에 실패했습니다.",
      matchTip: "다시 시도해주세요.",
      avoidTip: "분석 실패",
      cleanImageBase64: null,
      productCandidates: [],
      styleProfile: null,
      garmentProfile: null,
      ...DEFAULT_CLOTHES_DETAIL_ANALYSIS,
    });
  }
});

app.listen(PORT, () => {
  console.log(`NAES server running on http://localhost:${PORT}`);
});
