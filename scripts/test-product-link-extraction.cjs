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
      <meta property="og:image" content="/images/shirt.jpg">
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"린넨 데일리 셔츠",
        "brand":{"@type":"Brand","name":"NAES"},
        "image":"/fallback.jpg",
        "offers":{"@type":"Offer","price":"59000"}
      }</script>
    </head><body><dl><dt>소재</dt><dd>린넨 55%, 면 45%</dd></dl></body></html>`);
    return;
  }

  if (request.url === "/partial") {
    response.end(`<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"데일리 티셔츠",
        "image":"/images/tshirt.jpg"
      }</script>
    </head><body></body></html>`);
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
      ENABLE_PRODUCT_SIZE_GUIDE: "false",
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
    assert.equal(
      complete.body.productImageUrl,
      `http://127.0.0.1:${fixturePort}/images/shirt.jpg`
    );
    assert.equal(complete.body.extractionSource, "structured_metadata");
    assert.equal(complete.body.extractionStatus, "complete");

    const partial = await extract("/partial");
    assert.equal(partial.response.status, 200);
    assert.equal(partial.body.brand, "");
    assert.equal(partial.body.extractionStatus, "partial");
    assert.ok(partial.body.missingFields.includes("brand"));
    assert.ok(partial.body.missingFields.includes("materialComposition"));

    const unsupported = await extract("/article");
    assert.equal(unsupported.response.status, 422);
    assert.equal(unsupported.body.error, "unsupported_product_page");

    console.log("상품 링크 지원 범위 회귀 테스트 3개 통과");
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
