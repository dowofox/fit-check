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
  formatProductLinkFailure,
  getProductLinkFailure,
} = require("../utils/productLinkFailure.ts");

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
    formatProductLinkFailure(getProductLinkFailure("product_page_timeout", 504)),
    /네트워크 상태/
  );
});
