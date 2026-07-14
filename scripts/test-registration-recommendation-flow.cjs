const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const Module = require("node:module");
const path = require("node:path");
const { spawn } = require("node:child_process");
const ts = require("typescript");

const fixturePort = 3922;
const apiPort = 3921;
const projectRoot = path.resolve(__dirname, "..");
const storageMemory = new Map();

global.__DEV__ = false;

const asyncStorage = {
  async getItem(key) {
    return storageMemory.has(key) ? storageMemory.get(key) : null;
  },
  async setItem(key, value) {
    storageMemory.set(key, value);
  },
  async multiSet(entries) {
    entries.forEach(([key, value]) => storageMemory.set(key, value));
  },
};

const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

Module._load = function loadWithMocks(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return { __esModule: true, default: asyncStorage };
  }

  return originalLoad.call(this, request, parent, isMain);
};

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;

  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(result.outputText, filename);
};

const {
  getClosetItems,
  saveClosetItem,
  updateClosetItem,
} = require("../utils/storage.ts");
const {
  applyProductAnalysisTarget,
  getProductAnalysisTarget,
  inferProductAttributesFromConfirmedProduct,
} = require("../utils/productClassification.ts");
const {
  getOutfitRecommendationResult,
} = require("../utils/outfitRecommend.ts");
const {
  applyProductTargetTrustPolicy,
  normalizeProductAnalysisContext,
} = require("../server/productAnalysisContext.js");
const {
  getClosetItemReviewFields,
  normalizeClosetRegistrationBasics,
} = require("../utils/closetRegistration.ts");
const { normalizeProductColor } = require("../utils/color.ts");
const {
  toRecommendationInputItem,
  toRecommendationInputItems,
} = require("../utils/recommendationInput.ts");

const createdAt = "2026-07-01T00:00:00.000Z";

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function waitForApi() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${apiPort}/`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error("통합 테스트용 상품 추출 서버가 시작되지 않았습니다.");
}

function createClosetItem(id, category, overrides = {}) {
  const defaultsByCategory = {
    상의: {
      subCategory: "셔츠",
      detailCategory: "린넨 셔츠",
      color: "화이트",
      material: "린넨",
    },
    하의: {
      subCategory: "팬츠",
      detailCategory: "스트레이트 데님 팬츠",
      color: "데님",
      material: "데님",
    },
    신발: {
      subCategory: "스니커즈",
      detailCategory: "화이트 스니커즈",
      color: "화이트",
      material: "가죽",
    },
  };

  return {
    id,
    imageUri: `file:///${id}.png`,
    category,
    style: "캐주얼",
    styleTags: ["캐주얼", "데일리"],
    seasons: ["여름"],
    season: "여름",
    fit: "레귤러",
    size: "M",
    pattern: "무지",
    graphicDetected: false,
    graphicSize: "없음",
    garmentProfile: {
      silhouette: "regular",
      volume: 4,
      visualWeight: 3,
      lengthBalance: "regular",
      fitIntent: "trueToSize",
      pointLevel: 2,
      structure: "normal",
      drape: "medium",
    },
    createdAt,
    ...defaultsByCategory[category],
    ...overrides,
  };
}

const fixtureServer = http.createServer((request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html><head>
    <meta property="og:site_name" content="NAES SHOP">
    <meta property="og:image" content="/images/linen-shirt.jpg">
    <script type="application/ld+json">{
      "@context":"https://schema.org",
      "@type":"Product",
      "name":"린넨 데일리 셔츠",
      "brand":{"@type":"Brand","name":"NAES"},
      "category":"Apparel > Shirts",
      "color":"아이보리",
      "image":"/images/linen-shirt.jpg",
      "offers":{"@type":"Offer","price":"59000"}
    }</script>
  </head><body><dl><dt>소재</dt><dd>린넨 55%, 면 45%</dd></dl></body></html>`);
});

async function main() {
  const emptyRegistration = normalizeClosetRegistrationBasics({});
  assert.equal(emptyRegistration.category, "기타");
  assert.equal(emptyRegistration.color, "색상 확인 필요");
  assert.deepEqual(emptyRegistration.seasons, []);
  assert.deepEqual(emptyRegistration.reviewFields, ["category", "color", "season"]);

  const validRegistration = normalizeClosetRegistrationBasics({
    category: "상의",
    color: "아이보리",
    seasons: ["봄", "가을"],
  });
  assert.deepEqual(validRegistration.reviewFields, []);
  assert.equal(normalizeProductColor("BLACK"), "블랙");
  assert.equal(normalizeProductColor("OFF WHITE"), "아이보리");
  assert.equal(normalizeProductColor("GREYISH BLUE"), "블루");
  assert.equal(normalizeProductColor("STONE WASH"), "STONE WASH");

  const conflictedSeasonReviewFields = getClosetItemReviewFields({
    category: "아우터",
    color: "블랙",
    seasons: ["겨울"],
    seasonNeedsReview: true,
  });
  assert.deepEqual(conflictedSeasonReviewFields, ["season"]);

  const confirmedSeasonReviewFields = getClosetItemReviewFields({
    category: "아우터",
    color: "블랙",
    seasons: ["겨울"],
    seasonNeedsReview: false,
  });
  assert.deepEqual(confirmedSeasonReviewFields, []);

  const legacyRecommendationItem = toRecommendationInputItem({
    id: "legacy-empty",
    imageUri: "",
    category: "",
    color: "판단 어려움",
    season: "",
    style: "스타일 미분석",
    pattern: "판단 어려움",
    createdAt,
  });
  assert.equal(legacyRecommendationItem.category, "기타");
  assert.equal(legacyRecommendationItem.color, undefined);
  assert.deepEqual(legacyRecommendationItem.seasons, []);
  assert.equal(legacyRecommendationItem.seasonNeedsReview, true);
  assert.deepEqual(legacyRecommendationItem.styleTags, ["데일리"]);
  assert.equal(legacyRecommendationItem.pattern, undefined);

  await listen(fixtureServer, fixturePort);
  const apiProcess = spawn(process.execPath, ["server/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(apiPort),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || "test-key",
      ENABLE_PRODUCT_SIZE_GUIDE: "false",
      DEBUG_SIZE_GUIDE: "false",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let serverError = "";
  apiProcess.stderr.on("data", (chunk) => {
    serverError += chunk.toString();
  });

  try {
    await waitForApi();
    const productUrl = `http://127.0.0.1:${fixturePort}/product`;
    const response = await fetch(`http://127.0.0.1:${apiPort}/extract-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: productUrl }),
    });
    const product = await response.json();

    assert.equal(response.status, 200);
    assert.equal(product.productName, "린넨 데일리 셔츠");
    assert.equal(product.brand, "NAES");
    assert.equal(product.productCategory, "Apparel > Shirts");
    assert.equal(product.productColor, "아이보리");
    assert.equal(product.materialComposition.summary, "린넨 55%, 면 45%");

    const categoryFallbackTarget = getProductAnalysisTarget({
      productName: "TWO TUCK WIDE",
      productCategory: "Pants",
    });
    assert.equal(categoryFallbackTarget.category, "하의");
    assert.equal(categoryFallbackTarget.subCategory, "팬츠");
    assert.equal(
      getProductAnalysisTarget({
        productName: "LOOK 2026",
        productCategory: "Apparel > Shirts",
      }).category,
      "상의"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "ITEM 123",
        productCategory: "Outerwear",
      }).category,
      "아우터"
    );

    const officialColorTarget = getProductAnalysisTarget({
      productName: product.productName,
      productColor: "OFF WHITE",
    });
    assert.equal(officialColorTarget.color, "아이보리");
    assert.equal(
      applyProductAnalysisTarget({ color: "블랙" }, officialColorTarget).color,
      "아이보리"
    );

    const pantsTarget = getProductAnalysisTarget({
      productName: "TWO TUCK WIDE PANTS",
      brand: "NAES",
    });
    assert.equal(pantsTarget.category, "하의");
    assert.equal(pantsTarget.subCategory, "팬츠");
    assert.equal(pantsTarget.detailCategory, "팬츠");
    assert.deepEqual(
      applyProductAnalysisTarget(
        {
          category: "아우터",
          subCategory: "자켓",
          detailCategory: "테일러드 재킷",
          color: "블랙",
          styleTags: ["포멀"],
        },
        pantsTarget
      ),
      {
        category: "하의",
        subCategory: "팬츠",
        detailCategory: "팬츠",
        color: "블랙",
        styleTags: ["포멀"],
      }
    );

    const genericProductTargets = [
      ["RELAXED DAILY SHIRT", "상의", "셔츠"],
      ["OVERSIZED DAILY JACKET", "아우터", "자켓"],
      ["PLEATED MIDI SKIRT", "하의", "스커트"],
      ["DAILY WALKING SHOES", "신발", "신발"],
      ["CITY DAILY BAG", "액세서리", "가방"],
      ["SUMMER SUN HAT", "액세서리", "모자"],
      ["SILVER ACCESSORY", "액세서리", "액세서리"],
    ];

    genericProductTargets.forEach(([productName, category, subCategory]) => {
      const target = getProductAnalysisTarget({ productName });
      assert.equal(target.category, category, productName);
      assert.equal(target.subCategory, subCategory, productName);
      assert.equal(
        applyProductAnalysisTarget(
          {
            category: category === "아우터" ? "상의" : "아우터",
            subCategory: "사진 속 다른 옷",
            detailCategory: "사진 속 다른 옷",
          },
          target
        ).category,
        category,
        `${productName} target anchor`
      );
    });

    const specificRuleTarget = getProductAnalysisTarget({
      productName: "LIGHTWEIGHT RUNNING SHOES",
    });
    assert.equal(specificRuleTarget.category, "신발");
    assert.equal(specificRuleTarget.detailCategory, "러닝화");
    assert.equal(
      getProductAnalysisTarget({ productName: "WHATEVER DAILY ITEM" }).category,
      undefined
    );

    const normalizedPantsContext = normalizeProductAnalysisContext({
      productName: "TWO TUCK WIDE PANTS",
      category: "하의",
      subCategory: "팬츠",
      detailCategory: "팬츠",
      color: "네이비",
    });
    const mismatchedPhotoAnalysis = applyProductTargetTrustPolicy(
      normalizedPantsContext,
      {
        category: "아우터",
        subCategory: "자켓",
        detailCategory: "테일러드 재킷",
        color: "블랙",
        seasons: ["겨울"],
        fit: "오버핏",
        graphicDetected: true,
        analysisQuality: { imageQuality: "good", missingHints: [] },
      }
    );
    assert.equal(mismatchedPhotoAnalysis.targetMismatch, true);
    assert.equal(mismatchedPhotoAnalysis.analysis.category, "하의");
    assert.equal(mismatchedPhotoAnalysis.analysis.color, "네이비");
    assert.deepEqual(mismatchedPhotoAnalysis.analysis.seasons, []);
    assert.equal(mismatchedPhotoAnalysis.analysis.fit, "핏 분석 전");
    assert.equal(mismatchedPhotoAnalysis.analysis.graphicDetected, false);
    assert.match(
      mismatchedPhotoAnalysis.analysis.analysisWarnings[0],
      /주상품을 명확히 구분하지 못해/
    );
    assert.equal(mismatchedPhotoAnalysis.analysis.analysisQuality.needsMorePhotos, true);
    assert.ok(
      mismatchedPhotoAnalysis.analysis.analysisQuality.missingHints.includes(
        "주상품 단독 사진"
      )
    );

    const matchingPhotoAnalysis = {
      category: "하의",
      color: "네이비",
      seasons: ["봄", "가을"],
      fit: "와이드",
    };
    const trustedPhotoAnalysis = applyProductTargetTrustPolicy(
      normalizedPantsContext,
      matchingPhotoAnalysis
    );
    assert.equal(trustedPhotoAnalysis.targetMismatch, false);
    assert.equal(trustedPhotoAnalysis.analysis, matchingPhotoAnalysis);

    const confirmedProduct = {
      brand: product.brand,
      productName: product.productName,
      productCategory: product.productCategory,
      productColor: product.productColor,
      productUrl: product.productUrl,
      productImageUrl: product.productImageUrl,
      materialComposition: product.materialComposition,
      confirmedAt: createdAt,
    };
    const classification = inferProductAttributesFromConfirmedProduct({
      productName: confirmedProduct.productName,
      productCategory: confirmedProduct.productCategory,
      brand: confirmedProduct.brand,
      materialComposition: confirmedProduct.materialComposition,
    });
    const linkedTop = createClosetItem("top-linked", classification.category || "상의", {
      subCategory: classification.subCategory || "셔츠",
      detailCategory: classification.detailCategory || "린넨 셔츠",
      material: classification.material || confirmedProduct.materialComposition.summary,
      styleTags: classification.styleTags || ["캐주얼", "데일리"],
      imageUri: confirmedProduct.productImageUrl,
      confirmedProduct,
      confirmedBrand: confirmedProduct.brand,
      brand: confirmedProduct.brand,
      brandConfidence: 100,
    });

    await saveClosetItem(linkedTop);
    await saveClosetItem(createClosetItem("bottom-denim", "하의"));
    await saveClosetItem(createClosetItem("shoes-white", "신발"));
    const seasonEditedTop = createClosetItem("top-season-edit", linkedTop.category, {
      subCategory: linkedTop.subCategory,
      detailCategory: linkedTop.detailCategory,
      color: linkedTop.color,
      material: linkedTop.material,
      seasons: ["겨울"],
      season: "겨울",
      seasonSource: "rule",
      seasonNeedsReview: false,
    });
    await saveClosetItem(seasonEditedTop);

    const savedCloset = await getClosetItems();
    const savedTop = savedCloset.find((item) => item.id === linkedTop.id);
    assert.equal(savedTop.confirmedProduct.productName, "린넨 데일리 셔츠");
    assert.equal(savedTop.confirmedProduct.productCategory, "Apparel > Shirts");
    assert.equal(savedTop.confirmedProduct.productColor, "아이보리");
    assert.equal(savedTop.detailCategory, "린넨 셔츠");
    const beforeSeasonCorrection = getOutfitRecommendationResult(
      toRecommendationInputItems(savedCloset),
      null,
      linkedTop.seasons[0]
    );
    assert.equal(
      beforeSeasonCorrection.recommendations.some((recommendation) =>
        recommendation.items.some((item) => item.id === seasonEditedTop.id)
      ),
      false
    );

    await updateClosetItem(linkedTop.id, {
      color: "아이보리",
      detailCategory: "린넨 오픈카라 셔츠",
      userEditedClassificationFields: ["detailCategory"],
    });
    await updateClosetItem(seasonEditedTop.id, {
      seasons: linkedTop.seasons,
      season: linkedTop.season,
      seasonSource: "user",
      seasonNeedsReview: false,
      userEditedClassificationFields: ["season"],
    });

    const updatedCloset = await getClosetItems();
    const updatedTop = updatedCloset.find((item) => item.id === linkedTop.id);
    assert.equal(updatedTop.color, "아이보리");
    assert.equal(updatedTop.detailCategory, "린넨 오픈카라 셔츠");
    assert.equal(updatedTop.confirmedProduct.productName, "린넨 데일리 셔츠");
    const updatedSeasonTop = updatedCloset.find((item) => item.id === seasonEditedTop.id);
    assert.deepEqual(updatedSeasonTop.seasons, linkedTop.seasons);
    assert.equal(updatedSeasonTop.seasonSource, "user");
    assert.equal(updatedSeasonTop.seasonNeedsReview, false);

    const recommendationItems = toRecommendationInputItems(updatedCloset);
    const recommendationResult = getOutfitRecommendationResult(recommendationItems, null, "여름");
    assert.ok(recommendationResult.recommendations.length > 0);
    assert.ok(
      recommendationResult.recommendations.some((recommendation) =>
        recommendation.items.some((item) => item.id === linkedTop.id)
      )
    );
    assert.ok(
      recommendationResult.recommendations.some((recommendation) =>
        recommendation.items.some((item) => item.id === seasonEditedTop.id)
      )
    );

    const imageLessItem = createClosetItem("manual-no-photo", "액세서리", {
      imageUri: "",
      subCategory: "모자",
      detailCategory: "볼캡",
      color: "블랙",
    });
    await saveClosetItem(imageLessItem);
    await updateClosetItem(imageLessItem.id, { imageUri: "file:///manual-photo.jpg" });
    const closetWithUpdatedImage = await getClosetItems();
    assert.equal(
      closetWithUpdatedImage.find((closetItem) => closetItem.id === imageLessItem.id)?.imageUri,
      "file:///manual-photo.jpg"
    );

    console.log("등록부터 추천까지 핵심 흐름 통합 테스트 통과");
  } finally {
    apiProcess.kill();
    await close(fixtureServer);
  }

  if (serverError) process.stderr.write(serverError);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await close(fixtureServer);
  } catch {}
  process.exitCode = 1;
});
