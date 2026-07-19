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
  getRecommendationMaterialText,
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
  createClosetItemId,
  getClosetItemReviewFields,
  getProductRegistrationReviewFields,
  getRegistrationValidationMessage,
  normalizeClosetRegistrationBasics,
  validateClosetRegistration,
  wasClosetItemSaved,
} = require("../utils/closetRegistration.ts");
const { normalizeProductColor } = require("../utils/color.ts");
const {
  getProductExtractionSummary,
} = require("../utils/productExtractionSummary.ts");
const {
  getPrimaryMaterialText,
  getSignificantMaterialText,
  parseMaterialSummaryItems,
} = require("../utils/materialComposition.ts");
const {
  toRecommendationInputItem,
  toRecommendationInputItems,
} = require("../utils/recommendationInput.ts");
const { getRecommendedShoppingItems } = require("../utils/shoppingRecommend.ts");

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
  const firstGeneratedItemId = createClosetItemId(1_720_000_000_000, 0.1);
  const secondGeneratedItemId = createClosetItemId(1_720_000_000_000, 0.2);
  assert.match(firstGeneratedItemId, /^1720000000000-[a-z0-9]{11}$/);
  assert.notEqual(firstGeneratedItemId, secondGeneratedItemId);

  const savedItem = createClosetItem("saved-item", "상의");
  assert.equal(wasClosetItemSaved([savedItem], savedItem.id), true);
  assert.equal(wasClosetItemSaved([], savedItem.id), false);
  assert.equal(wasClosetItemSaved([savedItem], "missing-item"), false);

  const completeExtractionSummary = getProductExtractionSummary({
    productName: "린넨 데일리 셔츠",
    productImageUrl: "https://example.com/shirt.jpg",
    materialComposition: { summary: "린넨 55%, 면 45%" },
    productSizeGuide: { sizes: [{ size: "M" }] },
  });
  assert.equal(completeExtractionSummary.isComplete, true);
  assert.ok(completeExtractionSummary.items.every((item) => item.available));

  const partialExtractionSummary = getProductExtractionSummary({
    productName: "데일리 티셔츠",
    productImageUrl: "https://example.com/tshirt.jpg",
  });
  assert.equal(partialExtractionSummary.isComplete, false);
  assert.deepEqual(
    partialExtractionSummary.items
      .filter((item) => !item.available)
      .map((item) => item.key),
    ["material", "sizeGuide"]
  );
  assert.match(partialExtractionSummary.message, /저장 후 상세 화면/);

  const missingImageExtractionSummary = getProductExtractionSummary({
    productName: "대표 이미지 없는 셔츠",
  });
  assert.match(missingImageExtractionSummary.message, /옷 사진을 추가/);

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

  const validRegistrationResult = validateClosetRegistration({
    category: "  상의  ",
    color: "  아이보리 ",
    seasons: ["봄", "가을"],
  });
  assert.deepEqual(validRegistrationResult, {
    valid: true,
    missingFields: [],
    invalidFields: [],
  });

  const missingRegistrationResult = validateClosetRegistration({
    category: "",
    color: " ",
    seasons: [],
  });
  assert.deepEqual(missingRegistrationResult, {
    valid: false,
    missingFields: ["category", "color", "season"],
    invalidFields: [],
  });
  assert.match(
    getRegistrationValidationMessage(missingRegistrationResult),
    /종류, 색상, 계절 정보를 입력해주세요/
  );

  const invalidRegistrationResult = validateClosetRegistration({
    category: "분류 확인 필요",
    color: "색상 확인 필요",
    seasons: ["장마"],
  });
  assert.deepEqual(invalidRegistrationResult, {
    valid: false,
    missingFields: [],
    invalidFields: ["category", "color", "season"],
  });
  assert.match(
    getRegistrationValidationMessage(invalidRegistrationResult),
    /종류, 색상, 계절 정보를 확인해주세요/
  );

  const missingOfficialClassification = getProductRegistrationReviewFields({
    category: "아우터",
    color: "블랙",
    seasons: ["봄", "가을"],
    missingOfficialFields: ["productCategory", "productColor"],
  });
  assert.deepEqual(missingOfficialClassification, []);

  const confirmedOfficialClassification = getProductRegistrationReviewFields({
    category: "하의",
    color: "네이비",
    seasons: ["봄", "가을"],
    missingOfficialFields: ["productCategory", "productColor"],
    editedFields: ["category", "color"],
  });
  assert.deepEqual(confirmedOfficialClassification, []);
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

  const legacyEnglishColorItem = toRecommendationInputItem({
    ...createClosetItem("legacy-black-top", "상의"),
    color: "BLACK",
  });
  assert.equal(legacyEnglishColorItem.color, "블랙");

  const legacyColorShoppingRecommendations = getRecommendedShoppingItems([
    createClosetItem("legacy-shopping-top-black", "상의", { color: "BLACK" }),
    createClosetItem("legacy-shopping-top-ivory", "상의", { color: "OFF WHITE" }),
    createClosetItem("legacy-shopping-bottom", "하의", {
      color: "BROWN",
      detailCategory: "치노 팬츠",
      material: "면",
    }),
  ]);
  assert.ok(
    legacyColorShoppingRecommendations.some(
      (recommendation) => recommendation.title === "연청 데님팬츠"
    )
  );

  await listen(fixtureServer, fixturePort);
  const apiProcess = spawn(process.execPath, ["server/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(apiPort),
      NODE_ENV: "test",
      ALLOW_PRIVATE_PRODUCT_URLS_FOR_TESTS: "true",
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
        productName: "TWO TUCK WIDE",
        productCategory: "Apparel > Bottoms > Pants",
      }).category,
      "하의"
    );
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

    const shacketTarget = getProductAnalysisTarget({
      productName: "DENIM SHACKET",
      productCategory: "Apparel > Shirts",
    });
    assert.equal(shacketTarget.category, "아우터");
    assert.equal(shacketTarget.detailCategory, "셔켓");
    assert.equal(shacketTarget.material, "데님");
    const overshirtTarget = getProductAnalysisTarget({
      productName: "LINEN OVERSHIRT",
      productCategory: "Apparel > Shirts",
    });
    assert.equal(overshirtTarget.category, "아우터");
    assert.equal(overshirtTarget.detailCategory, "오버셔츠");
    assert.equal(overshirtTarget.material, "린넨");
    const correctedShacketAnalysis = applyProductAnalysisTarget(
      {
        category: "상의",
        subCategory: "셔츠",
        detailCategory: "데님 셔츠",
      },
      shacketTarget
    );
    assert.equal(correctedShacketAnalysis.category, "아우터");
    assert.equal(correctedShacketAnalysis.detailCategory, "셔켓");
    assert.equal(
      getProductAnalysisTarget({
        productName: "LINEN SHIRT",
        productCategory: "Apparel > Shirts",
      }).category,
      "상의"
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
    assert.equal(pantsTarget.detailCategory, "와이드 팬츠");
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
        detailCategory: "와이드 팬츠",
        color: "블랙",
        style: "캐주얼",
        styleTags: ["캐주얼", "미니멀", "포멀"],
      }
    );

    const shortSleeveTShirtTarget = getProductAnalysisTarget({
      productName: "BASIC SHORT SLEEVE TEE",
      productCategory: "Apparel > Tops > T-Shirts",
    });
    assert.equal(shortSleeveTShirtTarget.category, "상의");
    assert.equal(shortSleeveTShirtTarget.subCategory, "티셔츠");
    assert.equal(shortSleeveTShirtTarget.detailCategory, "반팔 티셔츠");

    assert.equal(
      getProductAnalysisTarget({ productName: "ESSENTIAL LONG-SLEEVE T-SHIRT" })
        .detailCategory,
      "긴팔 티셔츠"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "COTTON SLEEVELESS TOP" }).detailCategory,
      "민소매 티셔츠"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "SUMMER SHORT SLEEVE KNIT" })
        .detailCategory,
      "반팔 니트"
    );
    const knitZipUpCases = [
      ["면 100% 니트 집업", "면 100%"],
      ["코튼 니트 집업", "코튼 100%"],
      ["울 니트 집업", "울 100%"],
      ["아크릴 니트 집업", "아크릴 100%"],
      ["니트 가디건 집업", "면 100%"],
      ["KNITTED ZIP CARDIGAN", "cotton 100%"],
    ];
    knitZipUpCases.forEach(([productName, summary]) => {
      const target = getProductAnalysisTarget({
        productName,
        productCategory: "Apparel > Tops",
        materialComposition: { summary, source: "official" },
      });
      assert.equal(target.category, "아우터", productName);
      assert.equal(target.subCategory, "집업", productName);
      assert.equal(target.detailCategory, "니트 집업", productName);
      assert.equal(target.material, "니트", productName);
    });

    const regularZipUpCases = [
      ["면 100% 후드 집업", "후드 집업"],
      ["COTTON ZIP SWEATSHIRT", "집업"],
      ["쭈리 집업", "집업"],
      ["저지 트랙 집업", "집업"],
    ];
    regularZipUpCases.forEach(([productName, detailCategory]) => {
      assert.equal(
        getProductAnalysisTarget({
          productName,
          materialComposition: { summary: "면 100%", source: "official" },
        }).detailCategory,
        detailCategory,
        productName
      );
    });

    const protectedKnitZipUp = inferProductAttributesFromConfirmedProduct({
      productName: "코튼 니트 집업",
      currentItem: {
        id: "protected-knit-zip-up",
        imageUri: "file:///protected-knit-zip-up.png",
        category: "아우터",
        subCategory: "집업",
        detailCategory: "사용자 지정 집업",
        userEditedClassificationFields: ["detailCategory"],
        createdAt,
      },
    });
    assert.equal(protectedKnitZipUp.detailCategory, undefined);
    assert.equal(
      getProductAnalysisTarget({ productName: "OXFORD SHORT SLEEVE SHIRT" })
        .detailCategory,
      "옥스포드 셔츠"
    );

    const balloonPantsTarget = getProductAnalysisTarget({
      productName: "워시드 벌룬 와이드 팬츠",
      productCategory: "Apparel > Bottoms > Pants",
    });
    assert.equal(balloonPantsTarget.category, "하의");
    assert.equal(balloonPantsTarget.subCategory, "팬츠");
    assert.equal(balloonPantsTarget.detailCategory, "벌룬 팬츠");
    assert.equal(
      getProductAnalysisTarget({ productName: "Balloon Fit Pants" }).detailCategory,
      "벌룬 팬츠"
    );

    const barrelDenimTarget = getProductAnalysisTarget({
      productName: "배럴 레그 데님 팬츠",
    });
    assert.equal(barrelDenimTarget.detailCategory, "배럴 팬츠");
    assert.equal(barrelDenimTarget.material, "데님");
    assert.equal(
      getProductAnalysisTarget({ productName: "커브드 코튼 팬츠" }).detailCategory,
      "커브드 팬츠"
    );

    const balloonSleeveTarget = getProductAnalysisTarget({
      productName: "벌룬 소매 블라우스",
      productCategory: "Apparel > Tops > Blouses",
    });
    assert.equal(balloonSleeveTarget.category, "상의");
    assert.equal(balloonSleeveTarget.detailCategory, "블라우스");

    const protectedBalloonClassification = inferProductAttributesFromConfirmedProduct({
      productName: "벌룬 와이드 팬츠",
      currentItem: {
        id: "protected-bottom",
        imageUri: "file:///protected-bottom.png",
        category: "하의",
        subCategory: "팬츠",
        detailCategory: "사용자 지정 팬츠",
        userEditedClassificationFields: ["detailCategory"],
        createdAt,
      },
    });
    assert.equal(protectedBalloonClassification.detailCategory, undefined);

    const bottomSilhouetteCases = [
      ["투턱 와이드 팬츠", "와이드 팬츠"],
      ["테이퍼드 코튼 팬츠", "테이퍼드 팬츠"],
      ["슬림핏 팬츠", "슬림 팬츠"],
      ["스키니 데님 팬츠", "스키니 팬츠"],
      ["부츠컷 데님 팬츠", "부츠컷 팬츠"],
      ["플레어 팬츠", "플레어 팬츠"],
    ];
    bottomSilhouetteCases.forEach(([productName, detailCategory]) => {
      assert.equal(
        getProductAnalysisTarget({ productName }).detailCategory,
        detailCategory,
        productName
      );
    });
    assert.equal(
      getProductAnalysisTarget({ productName: "스키니 데님 팬츠" }).material,
      "데님"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "와이드 데님 팬츠" }).detailCategory,
      "와이드 데님 팬츠"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "와이드 슬랙스" }).detailCategory,
      "와이드 슬랙스"
    );
    const bermudaTarget = getProductAnalysisTarget({
      productName: "BERMUDA DENIM SHORTS",
    });
    assert.equal(bermudaTarget.detailCategory, "버뮤다 쇼츠");
    assert.equal(bermudaTarget.material, "데님");
    const basicPantsFitCases = [
      ["배기 팬츠", "배기 팬츠"],
      ["RELAXED LOOSE FIT PANTS", "루즈 팬츠"],
      ["STRAIGHT PANTS", "스트레이트 팬츠"],
    ];
    basicPantsFitCases.forEach(([productName, detailCategory]) => {
      assert.equal(
        getProductAnalysisTarget({ productName }).detailCategory,
        detailCategory,
        productName
      );
    });
    assert.equal(
      getProductAnalysisTarget({ productName: "BAGGY CARGO PANTS" }).detailCategory,
      "카고 팬츠"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "STRAIGHT DENIM JEANS" }).detailCategory,
      "스트레이트 데님 팬츠"
    );
    const additionalBottomTypeCases = [
      ["DENIM JEGGINGS", "제깅스"],
      ["DAILY LEGGINGS", "레깅스"],
      ["CAPRI PANTS", "카프리 팬츠"],
      ["PLEATED CULOTTES", "큐롯 팬츠"],
    ];
    additionalBottomTypeCases.forEach(([productName, detailCategory]) => {
      assert.equal(
        getProductAnalysisTarget({ productName }).detailCategory,
        detailCategory,
        productName
      );
    });
    assert.equal(
      getProductAnalysisTarget({ productName: "DENIM JEGGINGS" }).material,
      "데님"
    );
    const officialLeggingsTarget = getProductAnalysisTarget({
      productName: "LOOK 2026",
      productCategory: "Fashion > Leggings",
    });
    assert.equal(officialLeggingsTarget.category, "하의");
    assert.equal(officialLeggingsTarget.detailCategory, "레깅스");
    const correctedLeggingsAnalysis = applyProductAnalysisTarget(
      {
        category: "아우터",
        subCategory: "자켓",
        detailCategory: "테일러드 재킷",
      },
      officialLeggingsTarget
    );
    assert.equal(correctedLeggingsAnalysis.category, "하의");
    assert.equal(correctedLeggingsAnalysis.detailCategory, "레깅스");
    assert.equal(
      getProductAnalysisTarget({
        productName: "부츠컷 그래픽 티셔츠",
        productCategory: "Apparel > Tops > T-Shirts",
      }).category,
      "상의"
    );

    const pleatedSkirtTarget = getProductAnalysisTarget({
      productName: "PLEATED MIDI SKIRT",
      productCategory: "Apparel > Bottoms > Skirts",
    });
    assert.equal(pleatedSkirtTarget.category, "하의");
    assert.equal(pleatedSkirtTarget.subCategory, "스커트");
    assert.equal(pleatedSkirtTarget.detailCategory, "플리츠 스커트");

    const denimMiniSkirtTarget = getProductAnalysisTarget({
      productName: "데님 미니 스커트",
    });
    assert.equal(denimMiniSkirtTarget.detailCategory, "미니 스커트");
    assert.equal(denimMiniSkirtTarget.material, "데님");

    assert.equal(
      getProductAnalysisTarget({ productName: "A-LINE SKIRT" }).detailCategory,
      "A라인 스커트"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "MAXI SKIRT" }).detailCategory,
      "롱 스커트"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "DAILY SKIRT" }).detailCategory,
      "스커트"
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

    const slingbackShoesTarget = getProductAnalysisTarget({
      productName: "슬링백 펌프스",
      productCategory: "Fashion > Shoes > Pumps",
    });
    assert.equal(slingbackShoesTarget.category, "신발");
    assert.equal(slingbackShoesTarget.subCategory, "구두");
    assert.equal(slingbackShoesTarget.detailCategory, "슬링백 슈즈");

    const beltBagTarget = getProductAnalysisTarget({
      productName: "레더 벨트 백",
      productCategory: "Fashion > Bags > Waist Bags",
    });
    assert.equal(beltBagTarget.category, "액세서리");
    assert.equal(beltBagTarget.subCategory, "가방");

    const slingbackWithoutCategory = getProductAnalysisTarget({
      productName: "레더 슬링백 펌프스",
    });
    assert.equal(slingbackWithoutCategory.category, "신발");
    assert.equal(slingbackWithoutCategory.detailCategory, "슬링백 슈즈");

    const waistBagWithoutCategory = getProductAnalysisTarget({
      productName: "나일론 벨트 백",
    });
    assert.equal(waistBagWithoutCategory.category, "액세서리");
    assert.equal(waistBagWithoutCategory.subCategory, "가방");
    assert.equal(waistBagWithoutCategory.detailCategory, "웨이스트백");

    assert.equal(
      getProductAnalysisTarget({ productName: "슬링백" }).detailCategory,
      "슬링백"
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "레더 벨트" }).detailCategory,
      "벨트"
    );

    assert.equal(
      getProductAnalysisTarget({ productName: "울트라 스트레치 팬츠" }).material,
      undefined
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "모던 와이드 슬랙스" }).material,
      undefined
    );
    assert.equal(
      getProductAnalysisTarget({ productName: "울 테일러드 팬츠" }).material,
      "울"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "베이직 팬츠",
        materialComposition: {
          summary: "모 100%",
          items: [{ name: "모", percentage: 100 }],
        },
      }).material,
      "울"
    );
    assert.deepEqual(parseMaterialSummaryItems("면 95% 울 5%"), [
      { name: "면", percentage: 95 },
      { name: "울", percentage: 5 },
    ]);
    assert.equal(
      getSignificantMaterialText({ summary: "cotton 95% wool 5%" }),
      "cotton"
    );
    assert.equal(
      getSignificantMaterialText({
        summary: "겉감: 나일론 100% / 안감: 폴리에스터 100%",
      }),
      "나일론 폴리에스터"
    );
    assert.equal(
      getPrimaryMaterialText({
        summary: "겉감: 나일론 100% / 안감: 울 100%",
      }),
      "나일론"
    );
    assert.deepEqual(
      parseMaterialSummaryItems(
        "겉감: 면 60%, 나일론 40% / 안감: 폴리에스터 100%"
      ),
      [
        { name: "면", percentage: 60, section: "outer" },
        { name: "나일론", percentage: 40, section: "outer" },
        { name: "폴리에스터", percentage: 100, section: "lining" },
      ]
    );
    assert.deepEqual(
      parseMaterialSummaryItems(
        "겉감1: 면 100% / 겉감 2: 나일론 100% / 안감(1): 폴리에스터 100%"
      ),
      [
        { name: "면", percentage: 100, section: "outer" },
        { name: "나일론", percentage: 100, section: "outer" },
        { name: "폴리에스터", percentage: 100, section: "lining" },
      ]
    );
    assert.deepEqual(
      parseMaterialSummaryItems(
        "shell 1: cotton 100% / lining (2): polyester 100%"
      ),
      [
        { name: "cotton", percentage: 100, section: "outer" },
        { name: "polyester", percentage: 100, section: "lining" },
      ]
    );
    assert.deepEqual(
      parseMaterialSummaryItems(
        "겉감 1 면 60%, 나일론 40% / 안감(2) 폴리에스터 100%"
      ),
      [
        { name: "면", percentage: 60, section: "outer" },
        { name: "나일론", percentage: 40, section: "outer" },
        { name: "폴리에스터", percentage: 100, section: "lining" },
      ]
    );
    assert.deepEqual(
      parseMaterialSummaryItems(
        "shell 1 cotton 100% / lining (2) polyester 100%"
      ),
      [
        { name: "cotton", percentage: 100, section: "outer" },
        { name: "polyester", percentage: 100, section: "lining" },
      ]
    );
    assert.deepEqual(
      parseMaterialSummaryItems(
        "겉감: 면, 폴리에스터 / 안감: 폴리에스터"
      ),
      [
        { name: "면", percentage: null, section: "outer" },
        { name: "폴리에스터", percentage: null, section: "outer" },
        { name: "폴리에스터", percentage: null, section: "lining" },
      ]
    );
    assert.equal(
      getPrimaryMaterialText({
        summary: "겉감: 면 / 안감: 울",
      }),
      "면"
    );
    assert.deepEqual(
      parseMaterialSummaryItems("겉감: 면 / 안감: 폴리에스터 100%"),
      [
        { name: "면", percentage: null, section: "outer" },
        { name: "폴리에스터", percentage: 100, section: "lining" },
      ]
    );
    assert.deepEqual(
      parseMaterialSummaryItems(
        "겉감: 면 60% 나일론 40% / 안감: 폴리에스터 100%"
      ),
      [
        { name: "면", percentage: 60, section: "outer" },
        { name: "나일론", percentage: 40, section: "outer" },
        { name: "폴리에스터", percentage: 100, section: "lining" },
      ]
    );
    assert.deepEqual(parseMaterialSummaryItems("소재 판단 어려움"), []);
    assert.equal(
      getPrimaryMaterialText({
        summary: "shell: cotton 60%, nylon 40% / lining: polyester 100%",
      }),
      "cotton nylon"
    );
    const trimWoolComposition = {
      summary: "겉감: 면 100% / 배색: 울 100%",
      items: [
        { name: "면", percentage: 100, section: "outer" },
        { name: "울", percentage: 100, section: "trim" },
      ],
    };
    assert.equal(getSignificantMaterialText(trimWoolComposition), "면");
    assert.equal(
      getProductAnalysisTarget({
        productName: "베이직 상의",
        materialComposition: trimWoolComposition,
      }).material,
      "면"
    );
    const filledOuter = createClosetItem("filled-outer-material", "아우터", {
      material: "폴리에스터",
      confirmedProduct: {
        brand: "NAES",
        productName: "베이직 퀼팅 재킷",
        confirmedAt: createdAt,
        materialComposition: {
          summary: "겉감: 나일론 100% / 충전재: 폴리에스터 100%",
          items: [
            { name: "나일론", percentage: 100, section: "outer" },
            { name: "폴리에스터", percentage: 100, section: "filling" },
          ],
        },
      },
    });
    assert.equal(
      getRecommendationMaterialText(filledOuter),
      "나일론 충전재 폴리에스터"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "베이직 윈드브레이커",
        materialComposition: {
          summary: "겉감: 나일론 100% / 안감: 울 100%",
          items: [
            { name: "나일론", percentage: 100, section: "outer" },
            { name: "울", percentage: 100, section: "lining" },
          ],
        },
      }).material,
      "나일론"
    );
    assert.equal(
      getSignificantMaterialText({ summary: "린넨 혼방" }),
      "린넨 혼방"
    );
    const minorWoolComposition = {
      summary: "면 95%, 울 5%",
      items: [
        { name: "면", percentage: 95 },
        { name: "울", percentage: 5 },
      ],
    };
    assert.equal(
      getProductAnalysisTarget({
        productName: "베이직 팬츠",
        materialComposition: minorWoolComposition,
      }).material,
      "면 95%, 울 5%"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "울 블렌드 팬츠",
        materialComposition: minorWoolComposition,
      }).material,
      "울"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "베이직 팬츠",
        materialComposition: {
          summary: "폴리에스터 60%, 울 40%",
          items: [
            { name: "폴리에스터", percentage: 60 },
            { name: "울", percentage: 40 },
          ],
        },
      }).material,
      "울"
    );
    const balancedLinenWoolComposition = {
      summary: "린넨 50%, 울 50%",
      items: [
        { name: "린넨", percentage: 50 },
        { name: "울", percentage: 50 },
      ],
    };
    assert.equal(
      getProductAnalysisTarget({
        productName: "베이직 셔츠",
        materialComposition: balancedLinenWoolComposition,
      }).material,
      "린넨 50%, 울 50%"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "울 블렌드 셔츠",
        materialComposition: balancedLinenWoolComposition,
      }).material,
      "울"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "린넨 블렌드 셔츠",
        materialComposition: balancedLinenWoolComposition,
      }).material,
      "린넨"
    );
    assert.equal(
      getProductAnalysisTarget({
        productName: "베이직 셔츠",
        materialComposition: {
          summary: "린넨 95%, 울 5%",
          items: [
            { name: "린넨", percentage: 95 },
            { name: "울", percentage: 5 },
          ],
        },
      }).material,
      "린넨"
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
