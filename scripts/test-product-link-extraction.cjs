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

async function extractUrl(url) {
  const response = await fetch(`http://127.0.0.1:${apiPort}/extract-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  return { response, body: await response.json() };
}

async function extract(pathname) {
  return extractUrl(`http://127.0.0.1:${fixturePort}${pathname}`);
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
      <dl><dt>소재</dt><dd>겉감1: 나일론 60%, 폴리에스터 40% / 안감(2): 레이온 100%</dd></dl>
    </body></html>`);
    return;
  }

  if (request.url === "/colonless-layered-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"콜론 없는 레이어드 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/colonless-layered-jacket.jpg"
      }</script>
    </head><body>
      <dl><dt>소재</dt><dd>겉감 1 면 60%, 나일론 40% / 안감(2) 폴리에스터 100%</dd></dl>
    </body></html>`);
    return;
  }

  if (request.url === "/structured-section-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"구조화 소재 패딩 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "outerMaterial":[
          {"name":"nylon","percentage":60},
          {"name":"polyester","percentage":40}
        ],
        "liningMaterial":{"name":"rayon","percentage":100},
        "fillingComposition":{"name":"polyester","percentage":100},
        "image":"/images/structured-material-padding.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/structured-material-map") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"맵 소재 코튼 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "outerMaterial":{"cotton":"60%","nylon":40},
        "liningMaterial":{"polyester":100},
        "image":"/images/material-map-jacket.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/section-material-without-percentages") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"함량 미표기 코튼 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/material-without-percentages.jpg"
      }</script>
    </head><body>
      <dl><dt>제품 소재</dt><dd>겉감: 면, 폴리에스터 / 안감: 폴리에스터</dd></dl>
    </body></html>`);
    return;
  }

  if (request.url === "/mixed-percentage-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"혼합 표기 코튼 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/mixed-percentage-material.jpg"
      }</script>
    </head><body>
      <dl><dt>제품 소재</dt><dd>겉감: 면 / 안감: 폴리에스터 100%</dd></dl>
    </body></html>`);
    return;
  }

  if (request.url === "/down-filling-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"구스다운 패딩 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/goose-down-padding.jpg"
      }</script>
    </head><body>
      <dl><dt>제품 소재</dt><dd>겉감: 나일론 100% / 충전재: 거위솜털 80%, 거위깃털 20%</dd></dl>
    </body></html>`);
    return;
  }

  if (request.url === "/synthetic-filling-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"합성 보온재 패딩 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/synthetic-filling-padding.jpg"
      }</script>
    </head><body>
      <dl><dt>제품 소재</dt><dd>겉감: 나일론 100% / 충전재: 웰론 70%, thinsulate 20%, PrimaLoft 10%</dd></dl>
    </body></html>`);
    return;
  }

  if (request.url === "/detailed-material-source") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"코튼 블렌드 재킷",
        "brand":{"@type":"Brand","name":"NAES"},
        "material":{"name":"cotton","percentage":100},
        "image":"/images/cotton-blend-jacket.jpg"
      }</script>
    </head><body>
      <dl><dt>제품 소재</dt><dd>겉감: 면 60%, 나일론 40% / 안감: 폴리에스터 100%</dd></dl>
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

  if (request.url === "/regenerated-fiber-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"재생섬유 혼방 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "material":[
          {"name":"cotton","percentage":60},
          {"name":"tencel","percentage":25},
          {"name":"modal","percentage":10},
          {"name":"cupro","percentage":5}
        ],
        "image":"/images/regenerated-fiber-shirt.jpg"
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

  if (request.url === "/size-number-format") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/decimal-pants.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"소수 실측 팬츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/decimal-pants.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>허리단면</th><th>엉덩이단면</th><th>허벅지단면</th><th>밑단</th></tr>
        <tr><td>M</td><td>105,5 cm</td><td>41.5 cm</td><td>52 cm</td><td>34~36 cm</td><td>0</td></tr>
      </table>
    </body></html>`);
    return;
  }

  if (request.url === "/size-duplicates") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/duplicate-size-shirt.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"중복 실측 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/duplicate-size-shirt.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>어깨</th><th>가슴단면</th></tr>
        <tr><td>M</td><td>70</td><td>-</td><td>55</td></tr>
        <tr><td>M</td><td>70</td><td>48</td><td>55</td></tr>
        <tr><td>L</td><td>72</td><td>50</td><td>57</td></tr>
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
        <tr><td>ONE SIZE FITS ALL (44~66)</td><td>71</td><td>58</td></tr>
        <tr><td>OSFA(44-66)</td><td>72</td><td>59</td></tr>
      </table>
    </body></html>`);
    return;
  }

  if (request.url === "/size-english-aliases") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/english-size-top.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"영문 사이즈 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/english-size-top.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>가슴단면</th></tr>
        <tr><td>SMALL</td><td>66</td><td>52</td></tr>
        <tr><td>MEDIUM</td><td>68</td><td>54</td></tr>
        <tr><td>LARGE</td><td>70</td><td>56</td></tr>
        <tr><td>X-LARGE</td><td>72</td><td>58</td></tr>
        <tr><td>XX-LARGE</td><td>74</td><td>60</td></tr>
        <tr><td>EXTRA SMALL</td><td>64</td><td>50</td></tr>
        <tr><td>EXTRA LARGE</td><td>72</td><td>58</td></tr>
        <tr><td>DOUBLE EXTRA LARGE</td><td>74</td><td>60</td></tr>
        <tr><td>TRIPLE EXTRA LARGE</td><td>76</td><td>62</td></tr>
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
      "겉감: 나일론 60%, 폴리에스터 40% / 안감: 레이온 100%"
    );
    assert.deepEqual(layeredMaterial.body.materialComposition.items, [
      { name: "나일론", percentage: 60, section: "outer" },
      { name: "폴리에스터", percentage: 40, section: "outer" },
      { name: "레이온", percentage: 100, section: "lining" },
    ]);

    const colonlessLayeredMaterial = await extract("/colonless-layered-material");
    assert.equal(colonlessLayeredMaterial.response.status, 200);
    assert.equal(
      colonlessLayeredMaterial.body.materialComposition.summary,
      "겉감: 면 60%, 나일론 40% / 안감: 폴리에스터 100%"
    );
    assert.deepEqual(colonlessLayeredMaterial.body.materialComposition.items, [
      { name: "면", percentage: 60, section: "outer" },
      { name: "나일론", percentage: 40, section: "outer" },
      { name: "폴리에스터", percentage: 100, section: "lining" },
    ]);

    const structuredSectionMaterial = await extract("/structured-section-material");
    assert.equal(structuredSectionMaterial.response.status, 200);
    assert.equal(
      structuredSectionMaterial.body.materialComposition.summary,
      "겉감: 나일론 60%, 폴리에스터 40% / 안감: 레이온 100% / 충전재: 폴리에스터 100%"
    );
    assert.deepEqual(structuredSectionMaterial.body.materialComposition.items, [
      { name: "나일론", percentage: 60, section: "outer" },
      { name: "폴리에스터", percentage: 40, section: "outer" },
      { name: "레이온", percentage: 100, section: "lining" },
      { name: "폴리에스터", percentage: 100, section: "filling" },
    ]);

    const structuredMaterialMap = await extract("/structured-material-map");
    assert.equal(structuredMaterialMap.response.status, 200);
    assert.equal(
      structuredMaterialMap.body.materialComposition.summary,
      "겉감: 면 60%, 나일론 40% / 안감: 폴리에스터 100%"
    );
    assert.deepEqual(structuredMaterialMap.body.materialComposition.items, [
      { name: "면", percentage: 60, section: "outer" },
      { name: "나일론", percentage: 40, section: "outer" },
      { name: "폴리에스터", percentage: 100, section: "lining" },
    ]);

    const materialWithoutPercentages = await extract(
      "/section-material-without-percentages"
    );
    assert.equal(materialWithoutPercentages.response.status, 200);
    assert.equal(
      materialWithoutPercentages.body.materialComposition.summary,
      "겉감: 면, 폴리에스터 / 안감: 폴리에스터"
    );
    assert.deepEqual(materialWithoutPercentages.body.materialComposition.items, [
      { name: "면", percentage: null, section: "outer" },
      { name: "폴리에스터", percentage: null, section: "outer" },
      { name: "폴리에스터", percentage: null, section: "lining" },
    ]);

    const mixedPercentageMaterial = await extract("/mixed-percentage-material");
    assert.equal(mixedPercentageMaterial.response.status, 200);
    assert.equal(
      mixedPercentageMaterial.body.materialComposition.summary,
      "겉감: 면 / 안감: 폴리에스터 100%"
    );
    assert.deepEqual(mixedPercentageMaterial.body.materialComposition.items, [
      { name: "면", percentage: null, section: "outer" },
      { name: "폴리에스터", percentage: 100, section: "lining" },
    ]);

    const downFillingMaterial = await extract("/down-filling-material");
    assert.equal(downFillingMaterial.response.status, 200);
    assert.equal(
      downFillingMaterial.body.materialComposition.summary,
      "겉감: 나일론 100% / 충전재: 구스다운 80%, 깃털 20%"
    );
    assert.deepEqual(downFillingMaterial.body.materialComposition.items, [
      { name: "나일론", percentage: 100, section: "outer" },
      { name: "구스다운", percentage: 80, section: "filling" },
      { name: "깃털", percentage: 20, section: "filling" },
    ]);

    const syntheticFillingMaterial = await extract("/synthetic-filling-material");
    assert.equal(syntheticFillingMaterial.response.status, 200);
    assert.equal(
      syntheticFillingMaterial.body.materialComposition.summary,
      "겉감: 나일론 100% / 충전재: 웰론 70%, 신슐레이트 20%, 프리마로프트 10%"
    );
    assert.deepEqual(syntheticFillingMaterial.body.materialComposition.items, [
      { name: "나일론", percentage: 100, section: "outer" },
      { name: "웰론", percentage: 70, section: "filling" },
      { name: "신슐레이트", percentage: 20, section: "filling" },
      { name: "프리마로프트", percentage: 10, section: "filling" },
    ]);

    const detailedMaterialSource = await extract("/detailed-material-source");
    assert.equal(detailedMaterialSource.response.status, 200);
    assert.equal(
      detailedMaterialSource.body.materialComposition.summary,
      "겉감: 면 60%, 나일론 40% / 안감: 폴리에스터 100%"
    );
    assert.deepEqual(detailedMaterialSource.body.materialComposition.items, [
      { name: "면", percentage: 60, section: "outer" },
      { name: "나일론", percentage: 40, section: "outer" },
      { name: "폴리에스터", percentage: 100, section: "lining" },
    ]);

    const materialObject = await extract("/material-object");
    assert.equal(materialObject.response.status, 200);
    assert.equal(materialObject.body.materialComposition.summary, "면 100%");
    assert.deepEqual(materialObject.body.materialComposition.items, [
      { name: "면", percentage: 100 },
    ]);

    const regeneratedFiber = await extract("/regenerated-fiber-material");
    assert.equal(
      regeneratedFiber.body.materialComposition.summary,
      "면 60%, 리오셀 25%, 모달 10%, 큐프로 5%"
    );
    assert.deepEqual(regeneratedFiber.body.materialComposition.items, [
      { name: "면", percentage: 60 },
      { name: "리오셀", percentage: 25 },
      { name: "모달", percentage: 10 },
      { name: "큐프로", percentage: 5 },
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

    const numberFormat = await extract("/size-number-format");
    const formattedMeasurement = numberFormat.body.productSizeGuide.sizes[0];
    assert.equal(formattedMeasurement.totalLength, 105.5);
    assert.equal(formattedMeasurement.waist, 41.5);
    assert.equal(formattedMeasurement.hip, 52);
    assert.equal(formattedMeasurement.thigh, undefined);
    assert.equal(formattedMeasurement.hem, undefined);

    const duplicateSizes = await extract("/size-duplicates");
    assert.deepEqual(
      duplicateSizes.body.productSizeGuide.sizes.map((measurement) => measurement.size),
      ["M", "L"]
    );
    assert.equal(duplicateSizes.body.productSizeGuide.sizes[0].shoulder, 48);

    const freeAliases = await extract("/size-free-aliases");
    assert.deepEqual(
      freeAliases.body.productSizeGuide.sizes.map((measurement) => measurement.size),
      ["FREE"]
    );
    assert.deepEqual(
      freeAliases.body.productSizeGuide.sizes.map((measurement) => measurement.numericRange),
      [{ min: 44, max: 66 }]
    );

    const englishAliases = await extract("/size-english-aliases");
    assert.deepEqual(
      englishAliases.body.productSizeGuide.sizes.map((measurement) => measurement.size),
      ["S", "M", "L", "XL", "XXL", "XS", "XXXL"]
    );

    const schemelessProduct = await extractUrl(
      `127.0.0.1:${fixturePort}/product`
    );
    assert.equal(schemelessProduct.response.status, 200);
    assert.equal(
      schemelessProduct.body.productUrl,
      `http://127.0.0.1:${fixturePort}/product`
    );

    const invalidUrl = await extractUrl("not a product link");
    assert.equal(invalidUrl.response.status, 400);
    assert.equal(invalidUrl.body.error, "invalid_product_url");

    const unsupportedProtocol = await extractUrl("ftp://example.com/product");
    assert.equal(unsupportedProtocol.response.status, 400);
    assert.equal(unsupportedProtocol.body.error, "unsupported_product_url_protocol");

    const unsupported = await extract("/article");
    assert.equal(unsupported.response.status, 422);
    assert.equal(unsupported.body.error, "unsupported_product_page");

    console.log("상품 링크 지원 범위 및 실측 기준 회귀 테스트 23개 통과");
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
