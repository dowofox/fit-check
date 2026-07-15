import type {
  ClosetItem,
  MaterialComposition,
  ProductClassificationField,
} from "@/utils/storage";
import {
  PRODUCT_CATEGORY_FALLBACK_RULES,
  PRODUCT_CLASSIFICATION_RULES,
} from "@/utils/productClassificationRules";
import { normalizeProductColor } from "@/utils/color";
import {
  getPrimaryMaterialText,
  getSignificantMaterialText,
  hasMaterialSectionData,
} from "@/utils/materialComposition";

export type ProductClassificationInput = {
  productName?: string;
  productCategory?: string;
  brand?: string;
  productColor?: string;
  materialComposition?: MaterialComposition;
  currentItem?: ClosetItem;
};

export type ProductClassificationResult = {
  category?: string;
  subCategory?: string;
  detailCategory?: string;
  material?: string;
  styleTags?: string[];
  confidence?: number;
  reasons?: string[];
};

export type ProductAnalysisTarget = {
  productName?: string;
  brand?: string;
  color?: string;
  category?: string;
  subCategory?: string;
  detailCategory?: string;
  material?: string;
  styleTags?: string[];
};

export type ProductAnalysisShape = {
  category?: string;
  subCategory?: string;
  detailCategory?: string;
  color?: string;
  material?: string;
  style?: string;
  styleTags?: string[];
};

type ClassificationCandidate = Omit<ProductClassificationResult, "confidence" | "reasons">;
type ProductAttributeField = Exclude<ProductClassificationField, "season" | "color">;

export function getResolvedItemMaterial(item: ClosetItem) {
  const userEditedMaterial = item.userEditedClassificationFields?.includes("material");
  const itemMaterial = item.material?.trim();

  if (userEditedMaterial && itemMaterial) return itemMaterial;

  const officialComposition = item.confirmedProduct?.materialComposition;
  const officialMaterial =
    officialComposition?.summary?.trim() || getSignificantMaterialText(officialComposition);

  return officialMaterial || itemMaterial || "";
}

function normalizeSearchText(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[\-_\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesKeyword(value: string, keyword: string) {
  const normalizedKeyword = normalizeSearchText(keyword);
  const keywordParts = normalizedKeyword.split(/\s+/).filter(Boolean);
  const isEnglishKeyword = /^[a-z0-9 ]+$/.test(normalizedKeyword);

  if (isEnglishKeyword) {
    const valueParts = value.split(/\s+/).filter(Boolean);
    return keywordParts.every((part) => valueParts.includes(part));
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

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => includesKeyword(value, keyword));
}

function getMaterialSearchText(materialComposition?: MaterialComposition) {
  return normalizeSearchText(getPrimaryMaterialText(materialComposition));
}

function getOfficialMaterial(
  productName: string,
  materialComposition?: MaterialComposition
) {
  const materialText = getMaterialSearchText(materialComposition);
  const materialSummary =
    materialComposition?.summary?.trim() || getSignificantMaterialText(materialComposition);
  const primaryMaterial = getPrimaryMaterialText(materialComposition);
  const hasNamedLinen = includesAny(productName, ["린넨", "linen"]);
  const hasNamedWool = includesAny(productName, [
    "울 ",
    "울100",
    "울 100",
    "wool",
    "모 ",
    "모100",
    "모 100",
  ]);
  const hasOfficialLinen = includesAny(materialText, ["린넨", "linen"]);
  const hasOfficialWool = includesAny(materialText, [
    "울",
    "wool",
    "모 ",
    "모100",
    "모 100",
  ]);

  if (includesAny(productName, ["데님", "denim", "jeans", "청바지"])) return "데님";
  if (hasNamedLinen && hasNamedWool) return materialSummary || "린넨 울";
  if (hasNamedLinen) return "린넨";
  if (hasNamedWool) return "울";
  if (hasOfficialLinen && hasOfficialWool) return materialSummary || "린넨 울";
  if (hasOfficialLinen) return "린넨";
  if (hasOfficialWool) return "울";
  if (includesAny(productName, ["플란넬", "flannel"])) return "플란넬";
  if (includesAny(productName, ["니트", "knit"])) return "니트";
  if (hasMaterialSectionData(materialComposition) && primaryMaterial) {
    return primaryMaterial;
  }

  return materialSummary || undefined;
}

function mergeStyleTags(inferredTags: string[], currentTags?: string[]) {
  return [...new Set([...inferredTags, ...(currentTags || [])].filter(Boolean))].slice(0, 3);
}

function getKeywordClassification(
  productName: string,
  productCategory: string,
  materialComposition?: MaterialComposition,
  currentItem?: ClosetItem
) {
  const classificationText = [productName, productCategory].filter(Boolean).join(" ");
  const officialMaterial = getOfficialMaterial(classificationText, materialComposition);
  const currentTags = currentItem?.styleTags;
  const overridingNameRule = PRODUCT_CLASSIFICATION_RULES.find(
    (rule) =>
      rule.overridesCategoryGroup && includesAny(productName, rule.keywords)
  );
  const officialCategoryGroup =
    overridingNameRule?.group ||
    PRODUCT_CATEGORY_FALLBACK_RULES.find((rule) =>
      includesAny(productCategory, rule.keywords)
    )?.group;
  const specificRules = officialCategoryGroup
    ? PRODUCT_CLASSIFICATION_RULES.filter((rule) => rule.group === officialCategoryGroup)
    : PRODUCT_CLASSIFICATION_RULES;
  const fallbackRules = officialCategoryGroup
    ? PRODUCT_CATEGORY_FALLBACK_RULES.filter((rule) => rule.group === officialCategoryGroup)
    : PRODUCT_CATEGORY_FALLBACK_RULES;
  const specificRule =
    overridingNameRule ||
    specificRules.find((rule) =>
      includesAny(classificationText, rule.keywords)
    );
  const matchedRule =
    specificRule ||
    fallbackRules.find((rule) =>
      includesAny(classificationText, rule.keywords)
    );
  const candidate: ClassificationCandidate = matchedRule
    ? {
        ...matchedRule.attributes,
        material: matchedRule.attributes.material || officialMaterial,
        styleTags: matchedRule.attributes.styleTags
          ? mergeStyleTags(matchedRule.attributes.styleTags, currentTags)
          : undefined,
      }
    : officialMaterial
      ? { material: officialMaterial }
      : {};

  return { candidate, matchedLabel: matchedRule?.label || "" };
}

export function inferProductAttributesFromConfirmedProduct({
  productName,
  productCategory,
  brand,
  materialComposition,
  currentItem,
}: ProductClassificationInput): ProductClassificationResult {
  const normalizedProductName = normalizeSearchText(productName);
  const normalizedProductCategory = normalizeSearchText(productCategory);
  const classificationText = [normalizedProductName, normalizedProductCategory]
    .filter(Boolean)
    .join(" ");
  if (!classificationText && !materialComposition) return {};

  const { candidate, matchedLabel } = getKeywordClassification(
    normalizedProductName,
    normalizedProductCategory,
    materialComposition,
    currentItem
  );
  const protectedFields = new Set<ProductClassificationField>(
    currentItem?.userEditedClassificationFields || []
  );
  const result: ProductClassificationResult = {};

  (Object.keys(candidate) as ProductAttributeField[]).forEach((field) => {
    if (protectedFields.has(field)) return;

    const value = candidate[field];
    if (value !== undefined) {
      (result as Record<ProductAttributeField, string | string[] | undefined>)[field] = value;
    }
  });

  const hasUpdates = [
    result.category,
    result.subCategory,
    result.detailCategory,
    result.material,
    result.styleTags,
  ].some((value) => value !== undefined);
  if (!hasUpdates) return {};

  const reasons: string[] = [];
  if (matchedLabel) {
    reasons.push(`상품명에서 '${matchedLabel}' 분류 근거를 확인했어요.`);
  }
  if (materialComposition?.summary) {
    reasons.push(`공식 소재 정보 '${materialComposition.summary}'를 참고했어요.`);
  }
  if (productCategory?.trim()) {
    reasons.push(`공식 상품 카테고리 '${productCategory.trim()}'를 참고했어요.`);
  }
  if (brand?.trim()) {
    reasons.push(`${brand.trim()}의 확정 상품 정보를 기준으로 판단했어요.`);
  }

  return {
    ...result,
    confidence: matchedLabel ? 95 : 80,
    reasons,
  };
}

export function getProductAnalysisTarget(
  input: ProductClassificationInput
): ProductAnalysisTarget {
  const classification = inferProductAttributesFromConfirmedProduct(input);
  const productName = input.productName?.trim() || undefined;
  const brand = input.brand?.trim() || undefined;
  const color = normalizeProductColor(input.productColor);

  return {
    productName,
    brand,
    color,
    category: classification.category,
    subCategory: classification.subCategory,
    detailCategory: classification.detailCategory,
    material: classification.material,
    styleTags: classification.styleTags,
  };
}

export function applyProductAnalysisTarget<T extends ProductAnalysisShape>(
  analysis: T,
  target?: ProductAnalysisTarget
): T {
  if (!target) return analysis;

  const styleTags = target.styleTags?.length
    ? mergeStyleTags(target.styleTags, analysis.styleTags)
    : undefined;

  return {
    ...analysis,
    ...(target.category ? { category: target.category } : {}),
    ...(target.subCategory ? { subCategory: target.subCategory } : {}),
    ...(target.detailCategory ? { detailCategory: target.detailCategory } : {}),
    ...(target.color ? { color: target.color } : {}),
    ...(target.material ? { material: target.material } : {}),
    ...(styleTags?.length
      ? {
          styleTags,
          style: styleTags[0] || analysis.style,
        }
      : {}),
  };
}

export function getProductClassificationNotice(
  result: ProductClassificationResult,
  currentItem: ClosetItem
) {
  if (
    result.detailCategory &&
    result.detailCategory !== currentItem.detailCategory
  ) {
    return `상품명 기준으로 세부 카테고리를 '${result.detailCategory}'로 보정했어요.`;
  }

  const changedLabels = [
    result.category && result.category !== currentItem.category ? "카테고리" : "",
    result.subCategory && result.subCategory !== currentItem.subCategory ? "기본 종류" : "",
    result.material && result.material !== currentItem.material ? "소재" : "",
    result.styleTags &&
    JSON.stringify(result.styleTags) !== JSON.stringify(currentItem.styleTags || [])
      ? "스타일 태그"
      : "",
  ].filter(Boolean);

  return changedLabels.length > 0
    ? `상품명과 공식 소재 기준으로 ${changedLabels.join(", ")} 정보를 보정했어요.`
    : "";
}
