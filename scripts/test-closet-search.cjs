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

const {
  filterClosetItemsByQuery,
  sortClosetItems,
} = require("../utils/closetSearch.ts");

const items = [
  {
    id: "denim",
    imageUri: "https://example.com/denim.jpg",
    category: "하의",
    detailCategory: "와이드 데님 팬츠",
    color: "연청",
    styleTags: ["캐주얼", "데일리"],
    createdAt: "2026-07-17T00:00:00.000Z",
  },
  {
    id: "knit",
    imageUri: "https://example.com/knit.jpg",
    category: "상의",
    detailCategory: "반팔 니트",
    color: "블랙",
    material: "코튼 니트",
    confirmedProduct: {
      brand: "MAISON MINED",
      productName: "Doodle Knit Top",
      confirmedAt: "2026-07-17T00:00:00.000Z",
    },
    createdAt: "2026-07-17T00:00:00.000Z",
  },
];

test("옷장 검색은 세부 종류와 색상을 찾는다", () => {
  assert.deepEqual(
    filterClosetItemsByQuery(items, "연청 데님").map((item) => item.id),
    ["denim"]
  );
});

test("옷장 검색은 공식 상품명과 브랜드를 대소문자 없이 찾는다", () => {
  assert.deepEqual(
    filterClosetItemsByQuery(items, "maison knit").map((item) => item.id),
    ["knit"]
  );
});

test("빈 검색어는 기존 목록과 순서를 유지한다", () => {
  assert.equal(filterClosetItemsByQuery(items, "   "), items);
});

test("옷장 정렬은 등록일을 기준으로 하고 잘못된 날짜는 마지막에 둔다", () => {
  const datedItems = [
    { ...items[0], id: "old", createdAt: "2025-01-01T00:00:00.000Z" },
    { ...items[1], id: "invalid", createdAt: "날짜 없음" },
    { ...items[0], id: "new", createdAt: "2026-01-01T00:00:00.000Z" },
  ];

  assert.deepEqual(
    sortClosetItems(datedItems, "newest").map((item) => item.id),
    ["new", "old", "invalid"]
  );
  assert.deepEqual(
    sortClosetItems(datedItems, "oldest").map((item) => item.id),
    ["old", "new", "invalid"]
  );
});
