const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const fixturePort = 3912;
const apiPort = 3911;
const projectRoot = path.resolve(__dirname, "..");

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

  throw new Error("extract-product 테스트 서버가 시작되지 않았습니다.");
}

async function extract(pathname) {
  const response = await fetch(`http://127.0.0.1:${apiPort}/extract-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `http://127.0.0.1:${fixturePort}${pathname}` }),
  });

  return { response, body: await response.json() };
}

const fixtureServer = http.createServer((request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");

  if (request.url === "/product") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/shirt-full-look.jpg">
      <meta property="product:brand" content="WRONG META BRAND">
      <meta property="product:price:amount" content="990">
      <meta name="twitter:data1" content="WRONG TWITTER DATA">
      <meta property="product:category" content="Outerwear">
      <meta property="product:color" content="블랙">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"린넨 데일리 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "category":"Apparel > Shirts",
        "color":"아이보리",
        "image":"/images/shirt-product.jpg",
        "offers":{"@type":"Offer","price":"59000"}
      }</script>
    </head><body><dl><dt>소재</dt><dd>린넨 55%, 면 45%</dd></dl></body></html>`);
    return;
  }

  if (request.url === "/meta-image") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/meta-shirt.jpg">
      <meta property="product:color" content="네이비">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"메타 이미지 셔츠",
        "brand":{"@type":"Brand","name":"NAES"}
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/partial") {
    response.end(`<!doctype html><html><head>
      <meta name="twitter:label1" content="브랜드">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"데일리 티셔츠",
        "image":"/images/tshirt.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/meta-brand") {
    response.end(`<!doctype html><html><head>
      <meta property="product:brand" content="META BRAND">
      <meta property="product:price:amount" content="39000">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"메타 브랜드 티셔츠",
        "image":"/images/meta-brand-shirt.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/brand-array") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"공동 브랜드 스웨트셔츠",
        "brand":[
          {"@type":"Brand","name":"NAES"},
          {"@type":"Brand","name":"COLLAB"},
          {"@type":"Brand","name":"NAES"}
        ],
        "image":"/images/collaboration-sweatshirt.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (["/microfiber-material", "/polyamide-material"].includes(request.url)) {
    const isPolyamide = request.url === "/polyamide-material";
    const materialName = isPolyamide ? "polyamide" : "마이크로화이버";
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"${isPolyamide ? "나일론 윈드브레이커" : "마이크로화이버 셔츠"}",
        "brand":{"@type":"Brand","name":"NAES"},
        "material":[{"name":"${materialName}","percentage":100}],
        "image":"/images/${isPolyamide ? "nylon-windbreaker" : "microfiber-shirt"}.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/layered-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"레이어드 윈드브레이커",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/layered-windbreaker.jpg"
      }</script>
    </head><body>
      <dl><dt>소재</dt><dd>겉감: 나일론 100% / 안감: 폴리에스터 100%</dd></dl>
    </body></html>`);
    return;
  }

  if (request.url === "/material-object") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"코튼 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "material":{"name":"cotton","percentage":100},
        "image":"/images/cotton-shirt.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/product-group") {
    response.end(`<!doctype html><html><head>
      <meta property="product:color" content="Navy">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"ProductGroup",
        "name":"컬러 옵션 스웨트셔츠",
        "url":"/product-group",
        "brand":{"@type":"Brand","name":"NAES"},
        "category":"Apparel > Tops > Sweatshirts",
        "image":"/images/sweatshirt-group.jpg",
        "hasVariant":[
          {
            "@type":"Product",
            "name":"레드 스웨트셔츠",
            "color":"Red",
            "image":"/images/red-sweatshirt.jpg"
          },
          {
            "@type":"Product",
            "name":"네이비 스웨트셔츠",
            "color":"Navy",
            "image":"/images/navy-sweatshirt.jpg"
          }
        ]
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (["/product-group-same-material", "/product-group-mixed-material"].includes(request.url)) {
    const hasMixedMaterials = request.url === "/product-group-mixed-material";
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"ProductGroup",
        "name":"소재 옵션 셔츠",
        "url":"${request.url}",
        "brand":{"@type":"Brand","name":"NAES"},
        "category":"Shirts",
        "image":"/images/material-group-shirt.jpg",
        "hasVariant":[
          {
            "@type":"Product",
            "name":"첫 번째 셔츠",
            "material":"면 100%"
          },
          {
            "@type":"Product",
            "name":"두 번째 셔츠",
            "material":"${hasMixedMaterials ? "린넨 100%" : "면 100%"}"
          }
        ]
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/related-first") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"ItemList",
        "itemListElement":[{
          "@type":"Product",
          "name":"추천 레더 재킷",
          "brand":{"@type":"Brand","name":"OTHER"},
          "category":"Outerwear",
          "material":"울 100%",
          "image":"/images/related-jacket.jpg"
        }]
      }</script>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"투턱 와이드 팬츠",
        "url":"/related-first",
        "brand":{"@type":"Brand","name":"NAES"},
        "category":["Apparel","Bottoms","Pants"],
        "color":"Navy",
        "material":"면 100%",
        "image":"/images/main-pants.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/related-material-fallback") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"ItemList",
        "itemListElement":[{
          "@type":"Product",
          "name":"추천 울 니트",
          "material":"울 100%",
          "image":"/images/related-knit.jpg"
        }]
      }</script>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"코튼 와이드 팬츠",
        "url":"/related-material-fallback",
        "brand":{"@type":"Brand","name":"NAES"},
        "category":"Pants",
        "image":"/images/main-cotton-pants.jpg"
      }</script>
    </head><body><dl><dt>소재</dt><dd>면 100%</dd></dl></body></html>`);
    return;
  }

  if (["/multi-color", "/multi-color-no-meta"].includes(request.url)) {
    const selectedColorMeta = request.url === "/multi-color"
      ? '<meta property="product:color" content="Navy">'
      : "";
    response.end(`<!doctype html><html><head>
      ${selectedColorMeta}
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"멀티 컬러 티셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "category":"Shirts",
        "color":["Black","White","Navy"],
        "image":"/images/multi-color-shirt.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url?.startsWith("/canonical-product")) {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@graph":[
          {
            "@type":"Product",
            "name":"연관 상품 재킷",
            "url":"/related-product",
            "brand":{"@type":"Brand","name":"OTHER"},
            "image":"/images/related-product.jpg"
          },
          {
            "@type":"Product",
            "name":"공유 링크 와이드 팬츠",
            "url":"/canonical-product",
            "brand":{"@type":"Brand","name":"NAES"},
            "category":"Pants",
            "image":"/images/canonical-pants.jpg"
          }
        ]
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (["/size-flat", "/size-circumference", "/size-generic"].includes(request.url)) {
    const waistHeader = request.url === "/size-flat"
      ? "허리단면"
      : request.url === "/size-circumference"
        ? "허리둘레"
        : "waist";
    const hipHeader = request.url === "/size-circumference" ? "엉덩이둘레" : "엉덩이단면";
    const waistValue = request.url === "/size-circumference" ? "82" : "41";
    const hipValue = request.url === "/size-circumference" ? "104" : "52";

    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/pants.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"실측 테스트 팬츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/pants.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>${waistHeader}</th><th>${hipHeader}</th></tr>
        <tr><td>M</td><td>104</td><td>${waistValue}</td><td>${hipValue}</td></tr>
      </table>
    </body></html>`);
    return;
  }

  if (request.url === "/size-free-aliases") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/free-top.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"프리사이즈 니트",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/free-top.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>가슴단면</th></tr>
        <tr><td>FREE SIZE 44~66</td><td>68</td><td>55</td></tr>
        <tr><td>ONE-SIZE(44~66)</td><td>69</td><td>56</td></tr>
        <tr><td>O/S(44-66)</td><td>70</td><td>57</td></tr>
      </table>
    </body></html>`);
    return;
  }

  response.end(`<!doctype html><html><head>
    <meta property="og:title" content="패션 뉴스">
    <meta property="og:image" content="/news.jpg">
  </head><body>상품 페이지가 아닌 일반 글입니다.</body></html>`);
});

async function main() {
  await listen(fixtureServer, fixturePort);
  const apiProcess = spawn(process.execPath, ["server/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(apiPort),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || "test-key",
      ENABLE_PRODUCT_SIZE_GUIDE: "true",
      DEBUG_SIZE_GUIDE: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverError = "";
  apiProcess.stderr.on("data", (chunk) => {
    serverError += chunk.toString();
  });

  try {
    await waitForApi();

    const complete = await extract("/product");
    assert.equal(complete.response.status, 200);
    assert.equal(complete.body.productName, "린넨 데일리 셔츠");
    assert.equal(complete.body.brand, "NAES");
    assert.equal(complete.body.productCategory, "Apparel > Shirts");
    assert.equal(complete.body.productColor, "아이보리");
    assert.equal(complete.body.price, "59000");
    assert.equal(
      complete.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/shirt-product.jpg`
    );
    assert.equal(complete.body.extractionSource, "structured_metadata");
    assert.equal(complete.body.extractionStatus, "complete");

    const partial = await extract("/partial");
    assert.equal(partial.response.status, 200);
    assert.equal(partial.body.brand, "");
    assert.equal(partial.body.extractionStatus, "partial");
    assert.ok(partial.body.missingFields.includes("brand"));
    assert.ok(partial.body.missingFields.includes("materialComposition"));

    const metaBrand = await extract("/meta-brand");
    assert.equal(metaBrand.response.status, 200);
    assert.equal(metaBrand.body.brand, "META BRAND");
    assert.equal(metaBrand.body.price, "39000");

    const brandArray = await extract("/brand-array");
    assert.equal(brandArray.response.status, 200);
    assert.equal(brandArray.body.brand, "NAES / COLLAB");

    const microfiberMaterial = await extract("/microfiber-material");
    assert.equal(microfiberMaterial.response.status, 200);
    assert.equal(microfiberMaterial.body.materialComposition, undefined);
    assert.ok(microfiberMaterial.body.missingFields.includes("materialComposition"));

    const polyamideMaterial = await extract("/polyamide-material");
    assert.equal(polyamideMaterial.response.status, 200);
    assert.equal(polyamideMaterial.body.materialComposition.summary, "나일론 100%");

    const layeredMaterial = await extract("/layered-material");
    assert.equal(layeredMaterial.response.status, 200);
    assert.equal(
      layeredMaterial.body.materialComposition.summary,
      "나일론 100%, 폴리에스터 100%"
    );
    assert.deepEqual(layeredMaterial.body.materialComposition.items, [
      { name: "나일론", percentage: 100 },
      { name: "폴리에스터", percentage: 100 },
    ]);

    const materialObject = await extract("/material-object");
    assert.equal(materialObject.response.status, 200);
    assert.equal(materialObject.body.materialComposition.summary, "면 100%");
    assert.deepEqual(materialObject.body.materialComposition.items, [
      { name: "면", percentage: 100 },
    ]);

    const productGroup = await extract("/product-group");
    assert.equal(productGroup.response.status, 200);
    assert.equal(productGroup.body.productName, "컬러 옵션 스웨트셔츠");
    assert.equal(productGroup.body.brand, "NAES");
    assert.equal(productGroup.body.productCategory, "Apparel > Tops > Sweatshirts");
    assert.equal(productGroup.body.productColor, "Navy");
    assert.equal(
      productGroup.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/sweatshirt-group.jpg`
    );

    const productGroupSameMaterial = await extract("/product-group-same-material");
    assert.equal(productGroupSameMaterial.response.status, 200);
    assert.equal(
      productGroupSameMaterial.body.materialComposition.summary,
      "면 100%"
    );

    const productGroupMixedMaterial = await extract("/product-group-mixed-material");
    assert.equal(productGroupMixedMaterial.response.status, 200);
    assert.equal(productGroupMixedMaterial.body.materialComposition, undefined);
    assert.ok(
      productGroupMixedMaterial.body.missingFields.includes("materialComposition")
    );

    const metaImageFallback = await extract("/meta-image");
    assert.equal(metaImageFallback.response.status, 200);
    assert.equal(metaImageFallback.body.productColor, "네이비");
    assert.equal(
      metaImageFallback.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/meta-shirt.jpg`
    );

    const relatedFirst = await extract("/related-first");
    assert.equal(relatedFirst.response.status, 200);
    assert.equal(relatedFirst.body.productName, "투턱 와이드 팬츠");
    assert.equal(relatedFirst.body.brand, "NAES");
    assert.equal(relatedFirst.body.productCategory, "Apparel > Bottoms > Pants");
    assert.equal(relatedFirst.body.materialComposition.summary, "면 100%");
    assert.equal(
      relatedFirst.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/main-pants.jpg`
    );

    const relatedMaterialFallback = await extract("/related-material-fallback");
    assert.equal(relatedMaterialFallback.response.status, 200);
    assert.equal(relatedMaterialFallback.body.productName, "코튼 와이드 팬츠");
    assert.equal(relatedMaterialFallback.body.materialComposition.summary, "면 100%");

    const multiColor = await extract("/multi-color");
    assert.equal(multiColor.response.status, 200);
    assert.equal(multiColor.body.productColor, "Navy");

    const multiColorWithoutSelection = await extract("/multi-color-no-meta");
    assert.equal(multiColorWithoutSelection.response.status, 200);
    assert.equal(multiColorWithoutSelection.body.productColor, "");

    const canonicalProduct = await extract("/canonical-product?utm_source=share");
    assert.equal(canonicalProduct.response.status, 200);
    assert.equal(canonicalProduct.body.productName, "공유 링크 와이드 팬츠");
    assert.equal(canonicalProduct.body.brand, "NAES");

    const flatSize = await extract("/size-flat");
    const circumferenceSize = await extract("/size-circumference");
    const genericSize = await extract("/size-generic");
    const flatMeasurement = flatSize.body.productSizeGuide.sizes[0];
    const circumferenceMeasurement = circumferenceSize.body.productSizeGuide.sizes[0];
    const genericMeasurement = genericSize.body.productSizeGuide.sizes[0];

    assert.equal(flatMeasurement.waist, 41);
    assert.equal(flatMeasurement.hip, 52);
    assert.equal(circumferenceMeasurement.waist, 41);
    assert.equal(circumferenceMeasurement.hip, 52);
    assert.equal(genericMeasurement.waist, 41);
    assert.equal(genericMeasurement.hip, 52);

    const freeAliases = await extract("/size-free-aliases");
    assert.deepEqual(
      freeAliases.body.productSizeGuide.sizes.map((measurement) => measurement.size),
      ["FREE", "FREE", "FREE"]
    );
    assert.deepEqual(
      freeAliases.body.productSizeGuide.sizes.map((measurement) => measurement.numericRange),
      [
        { min: 44, max: 66 },
        { min: 44, max: 66 },
        { min: 44, max: 66 },
      ]
    );

    const unsupported = await extract("/article");
    assert.equal(unsupported.response.status, 422);
    assert.equal(unsupported.body.error, "unsupported_product_page");

    console.log("상품 링크 지원 범위 및 실측 기준 회귀 테스트 22개 통과");
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
