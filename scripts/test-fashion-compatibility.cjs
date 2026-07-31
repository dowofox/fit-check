const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveProjectAlias(
  request,
  parent,
  isMain,
  options
) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(
    this,
    resolvedRequest,
    parent,
    isMain,
    options
  );
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
  getOutfitRecommendationResult,
} = require("../utils/outfitRecommend.ts");
const {
  evaluateLegacyFashionCompatibility,
} = require("../utils/fashionCompatibility/legacyEvaluator.ts");
const {
  LEGACY_FASHION_RULES,
  getFashionRuleMetadata,
} = require("../utils/fashionCompatibility/ruleRegistry.ts");
const {
  createLegacyOnlyComparison,
} = require("../utils/fashionCompatibility/types.ts");
const {
  OUTFIT_SITUATIONS,
} = require("../utils/outfitSituation.ts");

const createdAt = "2026-07-01T00:00:00.000Z";

function createItem(id, category, overrides = {}) {
  return {
    id,
    imageUri: `file:///${id}.png`,
    category,
    color:
      category === "상의"
        ? "화이트"
        : category === "하의"
          ? "베이지"
          : "블랙",
    detailCategory:
      category === "상의"
        ? "반팔 티셔츠"
        : category === "하의"
          ? "와이드 팬츠"
          : category === "신발"
            ? "스니커즈"
            : category,
    seasons: ["여름"],
    season: "여름",
    style: "캐주얼",
    styleTags: ["캐주얼", "데일리"],
    createdAt,
    ...overrides,
  };
}

function baseItems(prefix, top = {}, bottom = {}, shoes = {}) {
  return [
    createItem(`${prefix}-top`, "상의", top),
    createItem(`${prefix}-bottom`, "하의", bottom),
    createItem(`${prefix}-shoes`, "신발", shoes),
  ];
}

const croppedTop = {
  garmentProfile: {
    silhouette: "cropped",
    volume: 4,
    visualWeight: 3,
    lengthBalance: "short",
    fitIntent: "trueToSize",
    pointLevel: 2,
    structure: "soft",
    drape: "medium",
  },
};
const wideBottom = {
  garmentProfile: {
    silhouette: "wide",
    volume: 8,
    visualWeight: 4,
    lengthBalance: "long",
    fitIntent: "relaxed",
    pointLevel: 2,
    structure: "normal",
    drape: "medium",
  },
};

const profile = {
  height: "175",
  shoulderWidth: "45",
  chestCircumference: "100",
  waistCircumference: "80",
  hipCircumference: "100",
  thighCircumference: "60",
  inseam: "80",
  bodyType: "보통",
};

const measuredTop = {
  ...croppedTop,
  size: "M",
  confirmedProduct: {
    brand: "NAES",
    productName: "크롭 반팔 티셔츠",
    confirmedAt: createdAt,
    productSizeGuide: {
      unit: "cm",
      sizes: [
        {
          size: "M",
          totalLength: 55,
          shoulder: 50,
          chest: 56,
          sleeve: 22,
        },
      ],
    },
  },
};
const measuredBottom = {
  ...wideBottom,
  size: "M",
  confirmedProduct: {
    brand: "NAES",
    productName: "와이드 팬츠",
    confirmedAt: createdAt,
    productSizeGuide: {
      unit: "cm",
      sizes: [
        {
          size: "M",
          totalLength: 106,
          waist: 42,
          hip: 56,
          thigh: 36,
          hem: 28,
        },
      ],
    },
  },
};

const situations = Object.fromEntries(
  OUTFIT_SITUATIONS.map((situation) => [situation.id, situation])
);

const fixtures = [
  {
    name: "basic-casual",
    items: baseItems("basic", croppedTop, wideBottom),
  },
  {
    name: "cropped-wide",
    items: baseItems("cropped", croppedTop, wideBottom),
  },
  {
    name: "oversized-slim",
    items: baseItems(
      "oversized",
      {
        garmentProfile: {
          ...croppedTop.garmentProfile,
          silhouette: "oversized",
          volume: 8,
          lengthBalance: "regular",
        },
      },
      {
        garmentProfile: {
          ...wideBottom.garmentProfile,
          silhouette: "slim",
          volume: 2,
          lengthBalance: "regular",
        },
      }
    ),
  },
  {
    name: "multiple-accents",
    items: baseItems(
      "accents",
      { ...croppedTop, color: "레드" },
      { ...wideBottom, color: "블루" },
      { color: "옐로우" }
    ),
  },
  {
    name: "avoid-colors",
    items: baseItems(
      "avoid",
      {
        ...croppedTop,
        styleProfile: { avoidColors: ["베이지"] },
      },
      wideBottom
    ),
  },
  {
    name: "measurement",
    items: baseItems("measurement", measuredTop, measuredBottom),
    profile,
  },
  {
    name: "image-impression",
    items: baseItems("impression", croppedTop, wideBottom),
  },
  {
    name: "text-fallback",
    items: baseItems(
      "fallback",
      {
        garmentProfile: undefined,
        detailCategory: "크롭 반팔 티셔츠",
        description: "짧은 기장",
      },
      {
        garmentProfile: undefined,
        detailCategory: "와이드 팬츠",
        fit: "와이드",
      }
    ),
  },
  {
    name: "user-material",
    items: baseItems(
      "material",
      {
        ...croppedTop,
        material: "린넨 60%",
        userEditedClassificationFields: ["material"],
        confirmedProduct: {
          brand: "NAES",
          productName: "테스트 상의",
          confirmedAt: createdAt,
          materialComposition: {
            summary: "울 100%",
            items: [{ name: "울", percentage: 100 }],
            source: "official",
          },
        },
      },
      wideBottom
    ),
  },
  {
    name: "body-adjustment",
    items: baseItems("body", measuredTop, measuredBottom),
    profile: { ...profile, bodyType: "상체 발달" },
  },
  {
    name: "date-situation",
    items: baseItems(
      "date",
      {
        ...croppedTop,
        detailCategory: "니트 셔츠",
        styleTags: ["미니멀", "댄디"],
      },
      {
        ...wideBottom,
        detailCategory: "와이드 슬랙스",
        styleTags: ["미니멀", "댄디"],
      },
      {
        detailCategory: "로퍼",
        styleTags: ["미니멀", "댄디"],
      }
    ),
    options: { situation: situations.date },
  },
  {
    name: "outerwear",
    items: [
      ...baseItems("outer", croppedTop, wideBottom),
      createItem("outer-layer", "아우터", {
        detailCategory: "바람막이",
        styleTags: ["스포티", "고프코어"],
      }),
    ],
  },
  {
    name: "shoes",
    items: baseItems("shoes", croppedTop, wideBottom, {
      detailCategory: "화이트 스니커즈",
      color: "화이트",
    }),
  },
  {
    name: "temperature-boundary",
    items: baseItems("temperature", croppedTop, wideBottom),
    options: {
      weather: {
        temperature: 24,
        apparentTemperature: 24,
        condition: "맑음",
        rainChance: 0,
      },
    },
  },
  {
    name: "hard-block",
    items: baseItems(
      "hard-block",
      {
        detailCategory: "패딩",
        seasons: ["겨울"],
        season: "겨울",
        material: "다운 충전재",
      },
      wideBottom
    ),
    options: {
      allowSeasonFallback: true,
      weather: {
        temperature: 30,
        apparentTemperature: 31,
        condition: "맑음",
        rainChance: 0,
      },
    },
  },
];

function toParitySnapshot(fixture) {
  const diagnostics = [];
  const result = getOutfitRecommendationResult(
    fixture.items,
    fixture.profile || null,
    "여름",
    [],
    {
      ...(fixture.options || {}),
      onDiagnostics: (diagnostic) => diagnostics.push(diagnostic),
    }
  );

  return {
    recommendationIds: result.recommendations.map(
      (recommendation) => recommendation.id
    ),
    scores: result.recommendations.map((recommendation) => recommendation.score),
    grades: result.recommendations.map((recommendation) => recommendation.grade),
    breakdowns: result.recommendations.map(
      (recommendation) => recommendation.breakdown
    ),
    reasons: result.recommendations.map(
      (recommendation) => recommendation.reasons
    ),
    warnings: result.recommendations.map(
      (recommendation) => recommendation.warnings
    ),
    alternativeIds: result.recommendations.map((recommendation) =>
      (recommendation.alternatives || []).map(
        (alternative) => alternative.id
      )
    ),
    candidateCounts: diagnostics
      .filter(
        (diagnostic) =>
          typeof diagnostic.candidateCount === "number" ||
          typeof diagnostic.generatedCombinationCount === "number" ||
          typeof diagnostic.scoredCombinationCount === "number"
      )
      .map((diagnostic) => ({
        stage: diagnostic.stage,
        candidateCount: diagnostic.candidateCount,
        generatedCombinationCount:
          diagnostic.generatedCombinationCount,
        scoredCombinationCount: diagnostic.scoredCombinationCount,
      })),
    emptyReason: result.emptyReason,
    missingCategories: result.missingCategories,
  };
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

const GOLDEN_DIGESTS = {
  "basic-casual":
    "655c1b3fba309ae27c2ec6076e1ca338449b6b3378b2eb6eb8515bfd5d0a0e21",
  "cropped-wide":
    "0c2db0b0fd297590ee7f923974738530e1b13e997c3ea24908d8657d395c6361",
  "oversized-slim":
    "382af4ba9b6e6af8f5ac80781e1ad6a18e74db5e6a51c019e050fb5b1dbdd7f4",
  "multiple-accents":
    "382af4ba9b6e6af8f5ac80781e1ad6a18e74db5e6a51c019e050fb5b1dbdd7f4",
  "avoid-colors":
    "fb1ce2249020aa404a953736892a9c474429b24f01b430e147af3fe385fa7072",
  measurement:
    "5258d091b6d3d51ca52ba1ca31fb2cf09cb9b8ef60694606007c37ded1ac2f0d",
  "image-impression":
    "841d8838c96f20e1598e2282596e628f376f7c1cb20db4f873a65e72f9fbf9e5",
  "text-fallback":
    "77842bbec8fa06bffb81621d1ac8f361e99351f2c05ba287745d69efde99ecaa",
  "user-material":
    "04d650e42ce44cf92831f5e9eb24c18192f788fa3b83b8593762562873002ec3",
  "body-adjustment":
    "4202dd43c20c71db998132d5b212bd4530fcb65743022b81556afd736b0618d2",
  "date-situation":
    "bc08037795f2ddedbd1b40e9803ef855eaaccec659a512755ba84cf3751eb56c",
  outerwear:
    "d3f06475f9f997a46eff57c2861f3405f825497b13deaa6c57fd895cc8e5ef9d",
  shoes:
    "185e90839a4bdf58236fa365bce8d6e59d979e9a1d0efe3caaecb4ad955037c0",
  "temperature-boundary":
    "841fb14461bce524aa6de4f1916698a0c5b02018147e046e411a844549505c23",
  "hard-block":
    "a69ac0fee7ca88217f8b68ee1ec5e4e5699e8e46db9ebf5d7e129ee8266058f0",
};

if (process.env.CAPTURE_FASHION_PARITY === "1") {
  const captured = Object.fromEntries(
    fixtures.map((fixture) => [
      fixture.name,
      digest(toParitySnapshot(fixture)),
    ])
  );
  process.stdout.write(`${JSON.stringify(captured, null, 2)}\n`);
} else {
  test("legacy recommendation parity fixtures remain unchanged", () => {
    fixtures.forEach((fixture) => {
      assert.equal(
        digest(toParitySnapshot(fixture)),
        GOLDEN_DIGESTS[fixture.name],
        fixture.name
      );
    });
  });
}

test("legacy rule registry metadata is complete and conservative", () => {
  const ids = LEGACY_FASHION_RULES.map((rule) => rule.id);

  assert.equal(new Set(ids).size, ids.length);
  LEGACY_FASHION_RULES.forEach((rule) => {
    assert.equal(typeof rule.enabled, "boolean", rule.id);
    assert.ok(rule.version, rule.id);
    assert.ok(rule.confidence >= 0 && rule.confidence <= 1, rule.id);
    assert.equal(rule.sourceType, "temporary_heuristic", rule.id);
    assert.deepEqual(rule.sourceReferences, [], rule.id);
  });
});

test("legacy evaluator records only registered evidence without changing output text", () => {
  const items = baseItems("evidence", measuredTop, measuredBottom);
  const reasons = [];
  const warnings = [];
  const result = evaluateLegacyFashionCompatibility({
    items,
    top: items[0],
    bottom: items[1],
    currentSeason: "여름",
    profile,
    reasons,
    warnings,
  });

  assert.ok(result.evidence.length > 0);
  result.evidence.forEach((entry) => {
    assert.ok(getFashionRuleMetadata(entry.ruleId), entry.ruleId);
    assert.ok(entry.confidence >= 0 && entry.confidence <= 1);
    assert.equal(
      Object.values(entry.diagnostics || {}).some(
        (value) =>
          typeof value === "string" &&
          (value.includes("file://") || value.includes("http"))
      ),
      false
    );
  });
  assert.strictEqual(result.reasons, reasons);
  assert.strictEqual(result.warnings, warnings);
  assert.equal(result.breakdown.silhouette >= 0, true);
  assert.equal(result.breakdown.wearFit >= 0, true);
});

test("shadow extension defaults to legacy-only without a fabricated score", () => {
  assert.deepEqual(createLegacyOnlyComparison(82), {
    legacyScore: 82,
    disagreementReasons: [],
    mode: "legacy-only",
  });
});
