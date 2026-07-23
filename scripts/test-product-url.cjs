const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

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
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

const { validateProductUrlInput } = require("../utils/productUrl.ts");
const {
  parseExtractedProductResponse,
} = require("../utils/productExtractionResponse.ts");
const {
  ApiRequestTimeoutError,
  fetchApiWithTimeout,
  isApiRequestTimeoutError,
  resolveApiBaseUrl,
} = require("../utils/api.ts");
const {
  formatProductLinkFailure,
  getProductLinkFailure,
} = require("../utils/productLinkFailure.ts");

test("API 주소는 환경 설정을 우선하고 끝의 슬래시를 제거한다", () => {
  assert.equal(
    resolveApiBaseUrl(" https://api.naes.example.com/// "),
    "https://api.naes.example.com"
  );
  assert.equal(resolveApiBaseUrl(), "http://192.168.219.104:3001");
});

test("API 요청은 제한 시간을 넘기면 중단한다", async () => {
  const hangingFetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });

  await assert.rejects(
    fetchApiWithTimeout("https://api.naes.example.com", {}, 5, hangingFetch),
    (error) => {
      assert.equal(error instanceof ApiRequestTimeoutError, true);
      assert.equal(error.timeoutMs, 5);
      assert.equal(isApiRequestTimeoutError(error), true);
      return true;
    }
  );
});

test("외부 취소 신호는 타임아웃과 구분해 API 요청을 중단한다", async () => {
  const controller = new AbortController();
  const hangingFetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("cancelled by user");
        error.name = "AbortError";
        reject(error);
      });
    });
  const request = fetchApiWithTimeout(
    "https://api.naes.example.com",
    { signal: controller.signal },
    1_000,
    hangingFetch
  );

  controller.abort();

  await assert.rejects(request, (error) => {
    assert.equal(error.name, "AbortError");
    assert.equal(isApiRequestTimeoutError(error), false);
    return true;
  });
});

test("상품 도메인만 붙여넣어도 HTTPS 주소로 정규화한다", () => {
  assert.deepEqual(validateProductUrlInput("musinsa.com/products/123"), {
    ok: true,
    url: "https://musinsa.com/products/123",
  });
});

test("무신사 공유 링크와 개발용 로컬 주소를 유지한다", () => {
  assert.equal(
    validateProductUrlInput("https://musinsa.onelink.me/example").ok,
    true
  );
  assert.deepEqual(validateProductUrlInput("localhost:3000/product"), {
    ok: true,
    url: "http://localhost:3000/product",
  });
});

test("빈 값과 비 HTTP 스킴, 잘못된 문자열을 요청 전에 거부한다", () => {
  assert.deepEqual(validateProductUrlInput(" "), {
    ok: false,
    error: "product_url_required",
  });
  assert.deepEqual(validateProductUrlInput("file:///closet/item"), {
    ok: false,
    error: "unsupported_product_url_protocol",
  });
  assert.deepEqual(validateProductUrlInput("상품 링크 아님"), {
    ok: false,
    error: "invalid_product_url",
  });
});

test("상품 추출 오류를 사용자가 취할 행동별로 구분한다", () => {
  assert.equal(getProductLinkFailure("invalid_product_url", 400).kind, "invalid_link");
  assert.equal(
    getProductLinkFailure("product_information_not_found", 422).kind,
    "unsupported_shop"
  );
  assert.equal(getProductLinkFailure("product_page_timeout", 504).kind, "connection");
  assert.match(
    getProductLinkFailure("unsafe_product_url", 400).message,
    /공개 상품 페이지/
  );
  assert.match(
    formatProductLinkFailure(getProductLinkFailure("product_page_timeout", 504)),
    /다시 시도/
  );
  assert.match(getProductLinkFailure("product_page_timeout", 504).title, /시간/);
  assert.match(getProductLinkFailure("product_page_unreachable", 502).message, /네트워크/);
});

test("상품 추출 성공 응답은 문자열과 URL을 검증해 정규화한다", () => {
  const result = parseExtractedProductResponse(
    {
      brand: " NAES ",
      productName: " 린넨 셔츠 ",
      productUrl: "shop.example.com/products/1",
      productImageUrl: "https://cdn.example.com/item.jpg",
      mallName: 123,
      missingFields: ["material", 42, " sizeGuide "],
      extractionStatus: "complete",
    },
    "https://fallback.example.com/products/1"
  );

  assert.equal(result.brand, "NAES");
  assert.equal(result.productName, "린넨 셔츠");
  assert.equal(result.productUrl, "https://shop.example.com/products/1");
  assert.equal(result.productImageUrl, "https://cdn.example.com/item.jpg");
  assert.equal(result.mallName, undefined);
  assert.deepEqual(result.missingFields, ["material", "sizeGuide"]);
});

test("잘못된 상품 이미지 URL은 버리고 비어 있는 성공 응답은 거부한다", () => {
  const withoutInvalidImage = parseExtractedProductResponse(
    {
      productName: "데님 팬츠",
      productUrl: "https://shop.example.com/products/2",
      productImageUrl: { src: "https://cdn.example.com/item.jpg" },
    },
    "https://shop.example.com/products/2"
  );

  assert.equal(withoutInvalidImage.productImageUrl, undefined);
  assert.equal(
    parseExtractedProductResponse({}, "https://shop.example.com/products/3"),
    null
  );
  assert.equal(
    parseExtractedProductResponse("not-an-object", "https://shop.example.com/products/3"),
    null
  );
});
