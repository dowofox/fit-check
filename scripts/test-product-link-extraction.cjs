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

  if (request.url === "/missing-classification") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"공식 분류 누락 상품",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/missing-classification.jpg",
        "material":"면 100%",
        "offers":{"@type":"Offer","price":"49000"}
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/structured-image-array") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"구조화 이미지 배열 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":[
          {},
          {"@type":"ImageObject","contentUrl":"/images/valid-array-shirt.jpg"}
        ]
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/product-group-variant") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProductGroup",
        name: "그룹 공통 니트",
        url: "/product-group-variant?view=group",
        brand: { "@type": "Brand", name: "GROUP BRAND" },
        category: "상의 > 니트",
        image: "/images/group-knit.jpg",
        hasVariant: [
          {
            "@type": "Product",
            url: "/other-group-variant",
            color: "블랙",
            offers: { price: "59000" },
          },
          {
            "@type": "Product",
            url: "/product-group-variant",
            color: "아이보리",
            material: "면 100%",
            offers: { price: "61000" },
          },
        ],
      })}</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/product-is-variant-of") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "아이보리 선택 니트",
        url: "/product-is-variant-of",
        color: "아이보리",
        offers: { price: "64000" },
        isVariantOf: {
          "@type": "ProductGroup",
          name: "공통 니트 그룹",
          brand: { "@type": "Brand", name: "PARENT BRAND" },
          category: "상의 > 니트",
          image: "/images/parent-group-knit.jpg",
          material: "울 100%",
        },
      })}</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/product-is-variant-of-multiple") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "부모 후보가 여러 개인 니트",
        url: "/product-is-variant-of-multiple",
        image: "/images/ambiguous-parent-knit.jpg",
        isVariantOf: [
          {
            "@type": "ProductGroup",
            brand: { "@type": "Brand", name: "FIRST PARENT" },
          },
          {
            "@type": "ProductGroup",
            brand: { "@type": "Brand", name: "SECOND PARENT" },
          },
        ],
      })}</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/product-group-reference") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "ProductGroup",
            "@id": "#referenced-knit-group",
            name: "참조 공통 니트",
            brand: { "@type": "Brand", name: "REFERENCE BRAND" },
            category: "상의 > 니트",
            image: "/images/referenced-group-knit.jpg",
            material: "아크릴 100%",
          },
          {
            "@type": "Product",
            name: "네이비 선택 니트",
            url: "/product-group-reference",
            color: "네이비",
            offers: { price: "68000" },
            isVariantOf: { "@id": "#referenced-knit-group" },
          },
        ],
      })}</script>
    </head><body></body></html>`);
    return;
  }

  if (["/structured-price-specification", "/structured-price-conflict"].includes(request.url)) {
    const offers = request.url === "/structured-price-specification"
      ? [
          { "@type": "Offer", availability: "https://schema.org/SoldOut" },
          {
            "@type": "Offer",
            priceSpecification: { "@type": "PriceSpecification", price: "72000" },
          },
        ]
      : [
          { "@type": "Offer", price: "50000" },
          { "@type": "Offer", price: "60000" },
        ];
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "구조화 가격 니트",
        url: request.url,
        image: "/images/structured-price-knit.jpg",
        offers,
      })}</script>
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

  if (request.url === "/manufacturer-brand") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"제조사 브랜드 셔츠",
        "manufacturer":{"@type":"Organization","name":"OFFICIAL MAKER"},
        "image":"/images/manufacturer-shirt.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/brand-priority") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"브랜드 우선순위 셔츠",
        "brand":{"@type":"Brand","name":"OFFICIAL BRAND"},
        "manufacturer":{"@type":"Organization","name":"FACTORY NAME"},
        "image":"/images/brand-priority-shirt.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (["/additional-property-brand", "/additional-property-multi-brand"].includes(request.url)) {
    const additionalProperty = request.url === "/additional-property-brand"
      ? [{ "@type": "PropertyValue", "name": "브랜드명", "value": "PROPERTY BRAND" }]
      : [
          { "@type": "PropertyValue", "name": "브랜드", "value": "FIRST BRAND" },
          { "@type": "PropertyValue", "name": "브랜드", "value": "SECOND BRAND" },
        ];
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "공식 속성 브랜드 셔츠",
        image: "/images/property-brand-shirt.jpg",
        additionalProperty,
      })}</script>
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

  if (request.url === "/animal-fiber-material") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"동물성 섬유 블렌드 니트",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/animal-fiber-knit.jpg"
      }</script>
    </head><body>
      <dl><dt>제품 소재</dt><dd>겉감: 면 40%, alpaca 20%, mohair 20%, angora 20%</dd></dl>
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

  if (["/additional-property-color", "/additional-property-multi-color"].includes(request.url)) {
    const additionalProperty = request.url === "/additional-property-color"
      ? [{ "@type": "PropertyValue", "name": "컬러", "value": "딥 네이비" }]
      : [
          { "@type": "PropertyValue", "name": "Color", "value": "Black" },
          { "@type": "PropertyValue", "name": "Color", "value": "White" },
        ];
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/property-color-shirt.jpg">
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "공식 속성 색상 셔츠",
        brand: { "@type": "Brand", name: "NAES" },
        image: "/images/property-color-shirt.jpg",
        additionalProperty,
      })}</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/item-category") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/item-category-pants.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"아이템 카테고리 팬츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "itemCategory":["Apparel","Bottoms","Pants"],
        "image":"/images/item-category-pants.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/category-priority") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/category-priority-pants.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"카테고리 우선순위 팬츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "category":"Pants",
        "itemCategory":["Apparel","Bottoms"],
        "image":"/images/category-priority-pants.jpg"
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (["/additional-property-category", "/additional-property-multi-category"].includes(request.url)) {
    const additionalProperty = request.url === "/additional-property-category"
      ? [{ "@type": "PropertyValue", "name": "품목명", "value": "Apparel > Bottoms > Pants" }]
      : [
          { "@type": "PropertyValue", "name": "품목", "value": "Pants" },
          { "@type": "PropertyValue", "name": "품목", "value": "Jackets" },
        ];
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/property-category-product.jpg">
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "공식 속성 품목 상품",
        brand: { "@type": "Brand", name: "NAES" },
        image: "/images/property-category-product.jpg",
        additionalProperty,
      })}</script>
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
    const hemHeader = request.url === "/size-flat"
      ? "밑단단면"
      : request.url === "/size-circumference"
        ? "밑단둘레"
        : "hem";
    const waistValue = request.url === "/size-circumference" ? "82" : "41";
    const hipValue = request.url === "/size-circumference" ? "104" : "52";
    const hemValue = request.url === "/size-circumference" ? "44" : "22";

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
        <tr><th>사이즈</th><th>총장</th><th>${waistHeader}</th><th>${hipHeader}</th><th>${hemHeader}</th></tr>
        <tr><td>M</td><td>104</td><td>${waistValue}</td><td>${hipValue}</td><td>${hemValue}</td></tr>
      </table>
    </body></html>`);
    return;
  }

  if (request.url === "/size-empty-middle-cell") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/empty-cell-shirt.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"빈 실측 셀 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/empty-cell-shirt.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>어깨</th><th>가슴단면</th><th>소매</th></tr>
        <tr><td>M</td><td>70</td><td></td><td>55</td><td>23</td></tr>
      </table>
    </body></html>`);
    return;
  }

  if (request.url === "/size-structured-hem-circumference") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/structured-hem-pants.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"구조화 밑단둘레 팬츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/structured-hem-pants.jpg",
        "sizeGuide":{"sizes":[
          {"size":"M","totalLength":104,"hemCircumference":44}
        ]}
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/size-structured-length-aliases") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/structured-lengths.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"구조화 길이 별칭 상품",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/structured-lengths.jpg",
        "sizeGuide":{"sizes":[
          {"size":"M","bodyLength":70,"sleeveLength":61},
          {"size":"L","garmentLength":72,"armLength":62},
          {"size":"32","outseam":105,"frontRiseLength":30}
        ]}
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/size-structured-width-aliases") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/structured-widths.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"구조화 폭 별칭 상품",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/structured-widths.jpg",
        "sizeGuide":{"sizes":[
          {"size":"M","shoulderWidth":48,"chestWidth":55,"waistWidth":41,"hipWidth":52,"thighWidth":34,"hemWidth":22},
          {"size":"L","shoulderWidth":50,"bustCircumference":114,"waistCircumference":86,"hipCircumference":108,"thighCircumference":72,"hemCircumference":46}
        ]}
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/size-snake-case-keys") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/snake-case-size.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"Snake Case Size Product",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/snake-case-size.jpg",
        "size_guide":{"sizes":[
          {"SIZE_NAME":"M","body_length":70,"shoulder_width":48,"bust_circumference":110,"sleeve_length":61},
          {"size_name":"L","measurements":[
            {"measurement_name":"waist_width","size_value":43},
            {"measurement_name":"hip_width","size_value":54},
            {"measurement_name":"front_rise_length","size_value":30}
          ]}
        ]}
      }</script>
    </head><body></body></html>`);
    return;
  }

  if (request.url === "/size-english-length-headers") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/english-length-shirt.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"English Length Shirt",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/english-length-shirt.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>Size</th><th>Body Length</th><th>Shoulder</th><th>Chest</th><th>Sleeve Length</th></tr>
        <tr><td>M</td><td>70</td><td>48</td><td>55</td><td>61</td></tr>
      </table>
    </body></html>`);
    return;
  }

  if (request.url === "/size-english-foot-length") {
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/english-shoes.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"English Size Shoes",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/english-shoes.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>Size</th><th>Foot Length</th></tr>
        <tr><td>270</td><td>27</td></tr>
      </table>
    </body></html>`);
    return;
  }

  if (["/size-front-back-rise", "/size-parenthesized-rise"].includes(request.url)) {
    const usesParenthesizedHeaders = request.url === "/size-parenthesized-rise";
    const frontRiseHeader = usesParenthesizedHeaders ? "밑위(앞)" : "앞밑위";
    const backRiseHeader = usesParenthesizedHeaders ? "밑위(뒤)" : "뒷밑위";
    response.end(`<!doctype html><html><head>
      <meta property="og:image" content="/images/rise-pants.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"앞뒤 밑위 실측 팬츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/rise-pants.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>${frontRiseHeader}</th><th>${backRiseHeader}</th><th>허리단면</th></tr>
        <tr><td>M</td><td>105</td><td>30</td><td>40</td><td>41</td></tr>
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

  if (request.url === "/size-korean-free-aliases") {
    response.end(`<!doctype html><html><head>
      <meta property="og:site_name" content="NAES SHOP">
      <meta property="og:image" content="/images/korean-free-top.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"한글 프리사이즈 니트",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/images/korean-free-top.jpg"
      }</script>
    </head><body>
      <table>
        <tr><th>사이즈</th><th>총장</th><th>가슴단면</th></tr>
        <tr><td>프리</td><td>68</td><td>55</td></tr>
        <tr><td>프리 사이즈</td><td>69</td><td>56</td></tr>
        <tr><td>원사이즈</td><td>70</td><td>57</td></tr>
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
      NODE_ENV: "test",
      ALLOW_PRIVATE_PRODUCT_URLS_FOR_TESTS: "true",
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

    const missingClassification = await extract("/missing-classification");
    assert.equal(missingClassification.response.status, 200);
    assert.equal(missingClassification.body.extractionStatus, "partial");
    assert.ok(missingClassification.body.missingFields.includes("productCategory"));
    assert.ok(missingClassification.body.missingFields.includes("productColor"));
    assert.ok(!missingClassification.body.missingFields.includes("brand"));
    assert.ok(!missingClassification.body.missingFields.includes("productImageUrl"));
    assert.ok(!missingClassification.body.missingFields.includes("materialComposition"));

    const metaBrand = await extract("/meta-brand");
    assert.equal(metaBrand.response.status, 200);
    assert.equal(metaBrand.body.brand, "META BRAND");
    assert.equal(metaBrand.body.price, "39000");

    const brandArray = await extract("/brand-array");
    assert.equal(brandArray.response.status, 200);
    assert.equal(brandArray.body.brand, "NAES / COLLAB");

    const manufacturerBrand = await extract("/manufacturer-brand");
    assert.equal(manufacturerBrand.body.brand, "");

    const brandPriority = await extract("/brand-priority");
    assert.equal(brandPriority.body.brand, "OFFICIAL BRAND");

    const additionalPropertyBrand = await extract("/additional-property-brand");
    assert.equal(additionalPropertyBrand.body.brand, "PROPERTY BRAND");

    const ambiguousAdditionalPropertyBrand = await extract(
      "/additional-property-multi-brand"
    );
    assert.equal(ambiguousAdditionalPropertyBrand.body.brand, "");

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

    const animalFiberMaterial = await extract("/animal-fiber-material");
    assert.equal(animalFiberMaterial.response.status, 200);
    assert.equal(
      animalFiberMaterial.body.materialComposition.summary,
      "겉감: 면 40%, 알파카 20%, 모헤어 20%, 앙고라 20%"
    );
    assert.deepEqual(animalFiberMaterial.body.materialComposition.items, [
      { name: "면", percentage: 40, section: "outer" },
      { name: "알파카", percentage: 20, section: "outer" },
      { name: "모헤어", percentage: 20, section: "outer" },
      { name: "앙고라", percentage: 20, section: "outer" },
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

    const structuredImageArray = await extract("/structured-image-array");
    assert.equal(structuredImageArray.response.status, 200);
    assert.equal(
      structuredImageArray.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/valid-array-shirt.jpg`
    );

    const productGroupVariant = await extract("/product-group-variant");
    assert.equal(productGroupVariant.response.status, 200);
    assert.equal(productGroupVariant.body.productName, "그룹 공통 니트");
    assert.equal(productGroupVariant.body.brand, "GROUP BRAND");
    assert.equal(productGroupVariant.body.productCategory, "상의 > 니트");
    assert.equal(productGroupVariant.body.productColor, "아이보리");
    assert.equal(productGroupVariant.body.price, "61000");
    assert.equal(
      productGroupVariant.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/group-knit.jpg`
    );
    assert.equal(
      productGroupVariant.body.materialComposition.summary,
      "면 100%"
    );

    const productIsVariantOf = await extract("/product-is-variant-of");
    assert.equal(productIsVariantOf.response.status, 200);
    assert.equal(productIsVariantOf.body.productName, "아이보리 선택 니트");
    assert.equal(productIsVariantOf.body.brand, "PARENT BRAND");
    assert.equal(productIsVariantOf.body.productCategory, "상의 > 니트");
    assert.equal(productIsVariantOf.body.productColor, "아이보리");
    assert.equal(productIsVariantOf.body.price, "64000");
    assert.equal(
      productIsVariantOf.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/parent-group-knit.jpg`
    );
    assert.equal(productIsVariantOf.body.materialComposition.summary, "울 100%");

    const ambiguousParentGroup = await extract("/product-is-variant-of-multiple");
    assert.equal(ambiguousParentGroup.response.status, 200);
    assert.equal(ambiguousParentGroup.body.brand, "");

    const referencedParentGroup = await extract("/product-group-reference");
    assert.equal(referencedParentGroup.response.status, 200);
    assert.equal(referencedParentGroup.body.productName, "네이비 선택 니트");
    assert.equal(referencedParentGroup.body.brand, "REFERENCE BRAND");
    assert.equal(referencedParentGroup.body.productCategory, "상의 > 니트");
    assert.equal(referencedParentGroup.body.productColor, "네이비");
    assert.equal(referencedParentGroup.body.price, "68000");
    assert.equal(
      referencedParentGroup.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/referenced-group-knit.jpg`
    );
    assert.equal(
      referencedParentGroup.body.materialComposition.summary,
      "아크릴 100%"
    );

    const structuredPriceSpecification = await extract(
      "/structured-price-specification"
    );
    assert.equal(structuredPriceSpecification.response.status, 200);
    assert.equal(structuredPriceSpecification.body.price, "72000");

    const conflictingStructuredPrices = await extract("/structured-price-conflict");
    assert.equal(conflictingStructuredPrices.response.status, 200);
    assert.equal(conflictingStructuredPrices.body.price, "");

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

    const additionalPropertyColor = await extract("/additional-property-color");
    assert.equal(additionalPropertyColor.body.productColor, "딥 네이비");

    const ambiguousAdditionalPropertyColor = await extract(
      "/additional-property-multi-color"
    );
    assert.equal(ambiguousAdditionalPropertyColor.body.productColor, "");

    const itemCategory = await extract("/item-category");
    assert.equal(itemCategory.body.productCategory, "Apparel > Bottoms > Pants");

    const categoryPriority = await extract("/category-priority");
    assert.equal(categoryPriority.body.productCategory, "Pants");

    const additionalPropertyCategory = await extract("/additional-property-category");
    assert.equal(
      additionalPropertyCategory.body.productCategory,
      "Apparel > Bottoms > Pants"
    );

    const ambiguousAdditionalPropertyCategory = await extract(
      "/additional-property-multi-category"
    );
    assert.equal(ambiguousAdditionalPropertyCategory.body.productCategory, "");

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
    assert.equal(flatMeasurement.hem, 22);
    assert.equal(circumferenceMeasurement.waist, 41);
    assert.equal(circumferenceMeasurement.hip, 52);
    assert.equal(circumferenceMeasurement.hem, 22);
    assert.equal(genericMeasurement.waist, 41);
    assert.equal(genericMeasurement.hip, 52);
    assert.equal(genericMeasurement.hem, 22);

    const structuredHemSize = await extract("/size-structured-hem-circumference");
    const structuredHemMeasurement =
      structuredHemSize.body.productSizeGuide.sizes[0];
    assert.equal(structuredHemMeasurement.totalLength, 104);
    assert.equal(structuredHemMeasurement.hem, 22);

    const structuredLengthSize = await extract("/size-structured-length-aliases");
    const structuredLengthMeasurements =
      structuredLengthSize.body.productSizeGuide.sizes;
    assert.equal(structuredLengthMeasurements[0].totalLength, 70);
    assert.equal(structuredLengthMeasurements[0].sleeve, 61);
    assert.equal(structuredLengthMeasurements[1].totalLength, 72);
    assert.equal(structuredLengthMeasurements[1].sleeve, 62);
    assert.equal(structuredLengthMeasurements[2].totalLength, 105);
    assert.equal(structuredLengthMeasurements[2].rise, 30);

    const structuredWidthSize = await extract("/size-structured-width-aliases");
    const structuredWidthMeasurements =
      structuredWidthSize.body.productSizeGuide.sizes;
    assert.deepEqual(
      {
        shoulder: structuredWidthMeasurements[0].shoulder,
        chest: structuredWidthMeasurements[0].chest,
        waist: structuredWidthMeasurements[0].waist,
        hip: structuredWidthMeasurements[0].hip,
        thigh: structuredWidthMeasurements[0].thigh,
        hem: structuredWidthMeasurements[0].hem,
      },
      { shoulder: 48, chest: 55, waist: 41, hip: 52, thigh: 34, hem: 22 }
    );
    assert.deepEqual(
      {
        shoulder: structuredWidthMeasurements[1].shoulder,
        chest: structuredWidthMeasurements[1].chest,
        waist: structuredWidthMeasurements[1].waist,
        hip: structuredWidthMeasurements[1].hip,
        thigh: structuredWidthMeasurements[1].thigh,
        hem: structuredWidthMeasurements[1].hem,
      },
      { shoulder: 50, chest: 57, waist: 43, hip: 54, thigh: 36, hem: 23 }
    );

    const snakeCaseSize = await extract("/size-snake-case-keys");
    const snakeCaseMeasurements = snakeCaseSize.body.productSizeGuide.sizes;
    assert.deepEqual(
      {
        size: snakeCaseMeasurements[0].size,
        totalLength: snakeCaseMeasurements[0].totalLength,
        shoulder: snakeCaseMeasurements[0].shoulder,
        chest: snakeCaseMeasurements[0].chest,
        sleeve: snakeCaseMeasurements[0].sleeve,
      },
      { size: "M", totalLength: 70, shoulder: 48, chest: 55, sleeve: 61 }
    );
    assert.deepEqual(
      {
        size: snakeCaseMeasurements[1].size,
        waist: snakeCaseMeasurements[1].waist,
        hip: snakeCaseMeasurements[1].hip,
        rise: snakeCaseMeasurements[1].rise,
      },
      { size: "L", waist: 43, hip: 54, rise: 30 }
    );

    const englishLengthSize = await extract("/size-english-length-headers");
    const englishLengthMeasurement =
      englishLengthSize.body.productSizeGuide.sizes[0];
    assert.equal(englishLengthMeasurement.totalLength, 70);
    assert.equal(englishLengthMeasurement.shoulder, 48);
    assert.equal(englishLengthMeasurement.chest, 55);
    assert.equal(englishLengthMeasurement.sleeve, 61);

    const englishFootLengthSize = await extract("/size-english-foot-length");
    const englishFootLengthMeasurement =
      englishFootLengthSize.body.productSizeGuide.sizes[0];
    assert.equal(englishFootLengthMeasurement.totalLength, undefined);
    assert.equal(englishFootLengthMeasurement.footLength, 27);

    const emptyMiddleCellSize = await extract("/size-empty-middle-cell");
    const emptyMiddleCellMeasurement =
      emptyMiddleCellSize.body.productSizeGuide.sizes[0];
    assert.equal(emptyMiddleCellMeasurement.totalLength, 70);
    assert.equal(emptyMiddleCellMeasurement.shoulder, undefined);
    assert.equal(emptyMiddleCellMeasurement.chest, 55);
    assert.equal(emptyMiddleCellMeasurement.sleeve, 23);

    const frontBackRiseSize = await extract("/size-front-back-rise");
    const frontBackRiseMeasurement = frontBackRiseSize.body.productSizeGuide.sizes[0];
    assert.equal(frontBackRiseMeasurement.rise, 30);
    assert.equal(frontBackRiseMeasurement.totalLength, 105);
    assert.equal(frontBackRiseMeasurement.waist, 41);

    const parenthesizedRiseSize = await extract("/size-parenthesized-rise");
    const parenthesizedRiseMeasurement =
      parenthesizedRiseSize.body.productSizeGuide.sizes[0];
    assert.equal(parenthesizedRiseMeasurement.rise, 30);

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

    const koreanFreeAliases = await extract("/size-korean-free-aliases");
    assert.deepEqual(
      koreanFreeAliases.body.productSizeGuide.sizes.map((measurement) => measurement.size),
      ["FREE"]
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
