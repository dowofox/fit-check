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
  PRODUCT_CLASSIFICATION_RULES,
} = require("../utils/productClassificationRules.ts");
const {
  CLOTHING_TAXONOMY,
  findProductClassificationRule,
  normalizePhotoClassificationWithTaxonomy,
  normalizeTaxonomyText,
} = require("../utils/clothingTaxonomy.ts");
const {
  getProductAnalysisTarget,
  inferProductAttributesFromConfirmedProduct,
} = require("../utils/productClassification.ts");
const {
  getCanonicalDetailCategories,
  getPhotoClassificationTaxonomyInstruction,
} = require("../server/clothingTaxonomy.js");

const EXPECTED_CATEGORY_BY_GROUP = {
  상의: "상의",
  아우터: "아우터",
  하의: "하의",
  신발: "신발",
  가방: "액세서리",
  모자: "액세서리",
  액세서리: "액세서리",
};

const PRODUCT_CATEGORY_BY_GROUP = {
  상의: "상의",
  아우터: "아우터",
  하의: "하의",
  신발: "신발",
  가방: "가방",
  모자: "모자",
  액세서리: "액세서리",
};

function getFirstAlias(rule, pattern) {
  return rule.keywords.find((keyword) => pattern.test(keyword));
}

test("classification taxonomy has unique, complete, category-safe rules", () => {
  const ids = new Set();
  const duplicateKeywords = new Map();
  const canonicalDetails = new Map();

  PRODUCT_CLASSIFICATION_RULES.forEach((rule) => {
    assert.ok(rule.id, "rule id is required");
    assert.equal(ids.has(rule.id), false, `duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    assert.ok(rule.attributes.detailCategory?.trim(), `${rule.id} detailCategory`);
    const canonicalKey = `${rule.group}:${rule.attributes.detailCategory.trim()}`;
    assert.equal(
      canonicalDetails.get(canonicalKey),
      undefined,
      `duplicate canonical detail: ${canonicalKey}`,
    );
    canonicalDetails.set(canonicalKey, rule.id);
    assert.equal(
      rule.attributes.category,
      EXPECTED_CATEGORY_BY_GROUP[rule.group],
      `${rule.id} category/group mismatch`,
    );
    assert.ok(rule.attributes.subCategory?.trim(), `${rule.id} subCategory`);

    rule.keywords.forEach((keyword) => {
      const normalizedKeyword = normalizeTaxonomyText(keyword);
      const key = `${rule.group}:${normalizedKeyword}`;
      const previousRule = duplicateKeywords.get(key);
      assert.equal(
        previousRule,
        undefined,
        `duplicate keyword in ${rule.group}: ${keyword} (${previousRule}, ${rule.id})`,
      );
      duplicateKeywords.set(key, rule.id);
    });
  });

  assert.equal(CLOTHING_TAXONOMY.length, PRODUCT_CLASSIFICATION_RULES.length);
});

test("every canonical item is reachable by Korean and English shopping aliases", () => {
  PRODUCT_CLASSIFICATION_RULES.forEach((rule) => {
    const koreanAlias = getFirstAlias(rule, /[가-힣]/);
    const englishAlias = getFirstAlias(rule, /[a-z]/i);
    assert.ok(koreanAlias, `${rule.id} needs a Korean alias`);
    assert.ok(englishAlias, `${rule.id} needs an English alias`);

    [koreanAlias, englishAlias].forEach((productName) => {
      const matchedRule = findProductClassificationRule({
        productName,
        productCategory: PRODUCT_CATEGORY_BY_GROUP[rule.group],
      });
      assert.equal(
        matchedRule?.attributes.detailCategory,
        rule.attributes.detailCategory,
        `${rule.id} is unreachable with '${productName}'`,
      );
    });
  });
});

test("high-frequency Korean and English names resolve to canonical details", () => {
  const cases = [
    ["데님 셔츠", "상의", "데님 셔츠"],
    ["SHORT SLEEVE KNIT", "상의", "반팔 니트"],
    ["니트 가디건", "아우터", "니트 가디건"],
    ["와이드 슬랙스", "하의", "와이드 슬랙스"],
    ["카고 팬츠", "하의", "카고 팬츠"],
    ["바람막이", "아우터", "바람막이"],
    ["레더 자켓", "아우터", "레더 자켓"],
    ["PENNY LOAFERS", "신발", "페니 로퍼"],
    ["TASSEL LOAFER", "신발", "태슬 로퍼"],
    ["TRAIL RUNNING SHOES", "신발", "트레일 러닝화"],
    ["RETRO RUNNER SNEAKERS", "신발", "레트로 러너"],
    ["CANVAS HIGH TOP SNEAKERS", "신발", "하이탑 스니커즈"],
    ["MONK STRAP SHOES", "신발", "몽크스트랩"],
    ["OXFORD SHOES", "신발", "옥스포드화"],
    ["MARY JANE FLATS", "신발", "메리제인 슈즈"],
    ["FISHERMAN SANDALS", "신발", "피셔맨 샌들"],
    ["SPORT SANDALS", "신발", "스포츠 샌들"],
    ["CHUKKA BOOTS", "신발", "처카부츠"],
    ["COMBAT BOOTS", "신발", "컴뱃부츠"],
    ["RAIN BOOTS", "신발", "레인부츠"],
    ["SLIP ON SHOES", "신발", "슬립온"],
    ["CLOG MULE", "신발", "클로그"],
  ];

  cases.forEach(([productName, productCategory, detailCategory]) => {
    assert.equal(
      inferProductAttributesFromConfirmedProduct({ productName, productCategory })
        .detailCategory,
      detailCategory,
      productName,
    );
  });
});

test("official and product-name category context prevents cross-category collisions", () => {
  const cases = [
    ["부츠컷 데님 팬츠", "하의", "부츠컷 팬츠"],
    ["슬링백 가방", "액세서리 가방", "슬링백"],
    ["러닝 바람막이", "아우터", "바람막이"],
    ["트레킹 팬츠", "하의", "팬츠"],
    ["옥스포드 셔츠", "상의", "옥스포드 셔츠"],
    ["POLO BRAND BASIC T-SHIRT", "상의", "기본 티셔츠"],
    ["부츠컷 그래픽 티셔츠", "상의", "티셔츠"],
    ["워커 팬츠", "하의", "팬츠"],
  ];

  cases.forEach(([productName, productCategory, detailCategory]) => {
    assert.equal(
      inferProductAttributesFromConfirmedProduct({ productName, productCategory })
        .detailCategory,
      detailCategory,
      productName,
    );
  });
});

test("unsupported one-piece products are not collapsed into tops or bottoms", () => {
  const onePiece = inferProductAttributesFromConfirmedProduct({
    productName: "MAXI DRESS",
    productCategory: "여성 > 원피스",
  });
  const jumpsuit = inferProductAttributesFromConfirmedProduct({
    productName: "UTILITY JUMPSUIT PANTS",
    productCategory: "Apparel > Jumpsuits",
  });
  const dressShirt = inferProductAttributesFromConfirmedProduct({
    productName: "CLASSIC DRESS SHIRT",
    productCategory: "상의",
  });

  assert.equal(onePiece.category, undefined);
  assert.equal(onePiece.detailCategory, undefined);
  assert.equal(jumpsuit.category, undefined);
  assert.equal(jumpsuit.detailCategory, undefined);
  assert.equal(dressShirt.detailCategory, "드레스 셔츠");
  assert.deepEqual(
    getProductAnalysisTarget({
      productName: "UTILITY JUMPSUIT PANTS",
      productCategory: "Apparel > Jumpsuits",
    }),
    {
      productName: "UTILITY JUMPSUIT PANTS",
      brand: undefined,
      color: undefined,
      category: "기타",
      subCategory: "분류 확인 필요",
      detailCategory: "분류 확인 필요",
    },
  );
});

test("photo analysis uses the canonical taxonomy without forcing uncertain items", () => {
  assert.deepEqual(
    normalizePhotoClassificationWithTaxonomy({
      category: "신발",
      subCategory: "러닝 슈즈",
      detailCategory: "트레일 러닝 슈즈",
      styleTags: ["스포티"],
    }),
    {
      category: "신발",
      subCategory: "운동화",
      detailCategory: "트레일 러닝화",
      style: "스포티",
      styleTags: ["스포티", "고프코어"],
    },
  );
  assert.deepEqual(
    normalizePhotoClassificationWithTaxonomy({
      category: "기타",
      subCategory: "분류 확인 필요",
      detailCategory: "판단 어려움",
    }),
    {
      category: "기타",
      subCategory: "분류 확인 필요",
      detailCategory: "판단 어려움",
    },
  );
});

test("manual classification fields remain protected from confirmed-product updates", () => {
  const result = inferProductAttributesFromConfirmedProduct({
    productName: "TRAIL RUNNING SHOES",
    productCategory: "신발",
    currentItem: {
      id: "manual-item",
      imageUri: "",
      category: "신발",
      subCategory: "사용자 신발",
      detailCategory: "직접 입력한 신발",
      color: "검정",
      style: "캐주얼",
      season: "",
      seasons: [],
      userEditedClassificationFields: ["category", "subCategory", "detailCategory"],
      createdAt: "2026-07-22T00:00:00.000Z",
    },
  });

  assert.equal(result.category, undefined);
  assert.equal(result.subCategory, undefined);
  assert.equal(result.detailCategory, undefined);
});

test("server photo prompt reads every canonical detail from the shared rule source", () => {
  const serverDetails = new Set(getCanonicalDetailCategories());
  PRODUCT_CLASSIFICATION_RULES.forEach((rule) => {
    assert.equal(
      serverDetails.has(rule.attributes.detailCategory),
      true,
      rule.attributes.detailCategory,
    );
  });

  const instruction = getPhotoClassificationTaxonomyInstruction();
  assert.match(instruction, /트레일 러닝화/);
  assert.match(instruction, /벌룬 팬츠/);
  assert.match(instruction, /캠프칼라 셔츠/);
  assert.match(instruction, /상의나 하의로 축소하지 말고/);
});
