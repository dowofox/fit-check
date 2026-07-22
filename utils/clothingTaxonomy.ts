import {
  PRODUCT_CATEGORY_FALLBACK_RULES,
  PRODUCT_CLASSIFICATION_RULES,
  type ProductClassificationGroup,
  type ProductClassificationRule,
} from "@/utils/productClassificationRules";

type ClassificationMatchInput = {
  productName?: string;
  productCategory?: string;
};

export type ClothingTaxonomyEntry = {
  id: string;
  group: ProductClassificationGroup;
  category: string;
  subCategory: string;
  detailCategory: string;
  aliases: string[];
  styleTags?: string[];
  material?: string;
};

export type TaxonomyClassificationShape = {
  category?: string;
  subCategory?: string;
  detailCategory?: string;
  style?: string;
  styleTags?: string[];
};

export function normalizeTaxonomyText(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[\-_\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function includesTaxonomyKeyword(value: string, keyword: string) {
  const normalizedKeyword = normalizeTaxonomyText(keyword);
  if (!normalizedKeyword) return false;

  const keywordParts = normalizedKeyword.split(/\s+/).filter(Boolean);
  const isEnglishKeyword = /^[a-z0-9 ]+$/.test(normalizedKeyword);

  if (isEnglishKeyword) {
    const valueParts = value.split(/\s+/).filter(Boolean);
    if (keywordParts.length === 1) return valueParts.includes(keywordParts[0]);
    if (value.includes(normalizedKeyword)) return true;
    return keywordParts.length > 2 && keywordParts.every((part) => valueParts.includes(part));
  }

  if (/^[가-힣]$/.test(normalizedKeyword)) {
    return value
      .split(/[\s,/%()[\]{}·:;]+/)
      .filter(Boolean)
      .includes(normalizedKeyword);
  }

  if (value.includes(normalizedKeyword)) return true;

  if (keywordParts.length < 2 || keywordParts.some((part) => part.length < 2)) {
    return false;
  }

  return keywordParts.every((part) => value.includes(part));
}

export function includesAnyTaxonomyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => includesTaxonomyKeyword(value, keyword));
}

const UNSUPPORTED_ONE_PIECE_KEYWORDS = [
  "원피스",
  "점프수트",
  "점프 슈트",
  "jumpsuit",
  "jump suit",
  "romper",
];

const SUPPORTED_DRESS_CONTEXTS = [
  "dress shirt",
  "dress shirts",
  "dress shoe",
  "dress shoes",
  "dress pants",
  "dress trousers",
];

export function isUnsupportedOnePieceClassification({
  productName,
  productCategory,
}: ClassificationMatchInput) {
  const normalizedProductName = normalizeTaxonomyText(productName);
  const normalizedProductCategory = normalizeTaxonomyText(productCategory);
  const hasExplicitOnePieceCategory = includesAnyTaxonomyKeyword(
    normalizedProductCategory,
    [...UNSUPPORTED_ONE_PIECE_KEYWORDS, "dress", "dresses"]
  );
  const hasExplicitOnePieceName = includesAnyTaxonomyKeyword(
    normalizedProductName,
    UNSUPPORTED_ONE_PIECE_KEYWORDS
  );
  const hasDressName = includesTaxonomyKeyword(normalizedProductName, "dress");
  const hasSupportedDressContext = includesAnyTaxonomyKeyword(
    normalizedProductName,
    SUPPORTED_DRESS_CONTEXTS
  );

  return (
    hasExplicitOnePieceCategory ||
    hasExplicitOnePieceName ||
    (hasDressName && !hasSupportedDressContext)
  );
}

function matchesRule(value: string, rule: ProductClassificationRule) {
  if (!includesAnyTaxonomyKeyword(value, rule.keywords)) return false;
  if (
    rule.excludedKeywords?.some((keyword) =>
      includesTaxonomyKeyword(value, keyword)
    )
  ) {
    return false;
  }

  return (rule.requiredKeywords || []).every((keyword) =>
    includesTaxonomyKeyword(value, keyword)
  );
}

function getMatchingKeywordSpecificity(value: string, rule: ProductClassificationRule) {
  return rule.keywords.reduce((highest, keyword) => {
    if (!includesTaxonomyKeyword(value, keyword)) return highest;
    const normalizedKeyword = normalizeTaxonomyText(keyword);
    const wordCount = normalizedKeyword.split(/\s+/).filter(Boolean).length;
    return Math.max(highest, wordCount * 100 + normalizedKeyword.length);
  }, 0);
}

function findCategoryGroup(value: string) {
  return PRODUCT_CATEGORY_FALLBACK_RULES.find((rule) =>
    matchesRule(value, rule)
  )?.group;
}

function findBestRule(value: string, rules: ProductClassificationRule[]) {
  return rules
    .map((rule, index) => ({
      rule,
      index,
      priority: rule.priority || 0,
      specificity: getMatchingKeywordSpecificity(value, rule),
    }))
    .filter((candidate) => candidate.specificity > 0 && matchesRule(value, candidate.rule))
    .sort(
      (first, second) =>
        second.priority - first.priority ||
        second.specificity - first.specificity ||
        first.index - second.index
    )[0]?.rule;
}

export function findProductClassificationRule({
  productName,
  productCategory,
}: ClassificationMatchInput) {
  const normalizedProductName = normalizeTaxonomyText(productName);
  const normalizedProductCategory = normalizeTaxonomyText(productCategory);
  if (!normalizedProductName && !normalizedProductCategory) return undefined;
  if (isUnsupportedOnePieceClassification({ productName, productCategory })) {
    return undefined;
  }

  const overridingRule = findBestRule(
    normalizedProductName,
    PRODUCT_CLASSIFICATION_RULES.filter((rule) => rule.overridesCategoryGroup)
  );
  const categoryGroup =
    overridingRule?.group ||
    findCategoryGroup(normalizedProductCategory) ||
    findCategoryGroup(normalizedProductName);
  const specificRules = categoryGroup
    ? PRODUCT_CLASSIFICATION_RULES.filter((rule) => rule.group === categoryGroup)
    : PRODUCT_CLASSIFICATION_RULES;
  const fallbackRules = categoryGroup
    ? PRODUCT_CATEGORY_FALLBACK_RULES.filter((rule) => rule.group === categoryGroup)
    : PRODUCT_CATEGORY_FALLBACK_RULES;

  return (
    overridingRule ||
    findBestRule(normalizedProductName, specificRules) ||
    findBestRule(normalizedProductCategory, specificRules) ||
    findBestRule(normalizedProductName, fallbackRules) ||
    findBestRule(normalizedProductCategory, fallbackRules)
  );
}

export const CLOTHING_TAXONOMY: ClothingTaxonomyEntry[] =
  PRODUCT_CLASSIFICATION_RULES.map((rule) => ({
    id: rule.id,
    group: rule.group,
    category: rule.attributes.category,
    subCategory: rule.attributes.subCategory,
    detailCategory: rule.attributes.detailCategory,
    aliases: [...rule.keywords],
    styleTags: rule.attributes.styleTags,
    material: rule.attributes.material,
  }));

export function normalizePhotoClassificationWithTaxonomy<
  T extends TaxonomyClassificationShape,
>(analysis: T): T {
  const matchedRule = findProductClassificationRule({
    productName: [analysis.detailCategory, analysis.subCategory].filter(Boolean).join(" "),
    productCategory: analysis.category,
  });
  if (!matchedRule || matchedRule.attributes.category === "액세서리") return analysis;

  const styleTags = [
    ...(analysis.styleTags || []),
    ...(matchedRule.attributes.styleTags || []),
  ].filter((tag, index, tags) => Boolean(tag) && tags.indexOf(tag) === index).slice(0, 3);

  return {
    ...analysis,
    category: matchedRule.attributes.category,
    subCategory: matchedRule.attributes.subCategory,
    detailCategory: matchedRule.attributes.detailCategory,
    ...(styleTags.length
      ? {
          styleTags,
          style: styleTags[0] || analysis.style,
        }
      : {}),
  };
}
