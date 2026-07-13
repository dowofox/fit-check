import type {
  ClosetItem,
  MaterialComposition,
  ProductClassificationField,
} from "@/utils/storage";
import { PRODUCT_CLASSIFICATION_RULES } from "@/utils/productClassificationRules";

export type ProductClassificationInput = {
  productName?: string;
  brand?: string;
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

type ClassificationCandidate = Omit<ProductClassificationResult, "confidence" | "reasons">;

export function getResolvedItemMaterial(item: ClosetItem) {
  const userEditedMaterial = item.userEditedClassificationFields?.includes("material");
  const itemMaterial = item.material?.trim();

  if (userEditedMaterial && itemMaterial) return itemMaterial;

  return item.confirmedProduct?.materialComposition?.summary?.trim() || itemMaterial || "";
}

function normalizeSearchText(value?: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[\-_\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function getMaterialSearchText(materialComposition?: MaterialComposition) {
  return normalizeSearchText(
    [
      materialComposition?.summary,
      ...(materialComposition?.items || []).map((item) => item.name),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getOfficialMaterial(
  productName: string,
  materialComposition?: MaterialComposition
) {
  const materialText = getMaterialSearchText(materialComposition);
  const combinedText = `${productName} ${materialText}`;

  if (includesAny(productName, ["데님", "denim", "jeans", "청바지"])) return "데님";
  if (includesAny(combinedText, ["린넨", "linen"])) return "린넨";
  if (
    includesAny(productName, ["울 ", "울100", "울 100", "wool"]) ||
    includesAny(materialText, ["울", "wool", "모 ", "모100", "모 100"])
  ) {
    return "울";
  }
  if (includesAny(productName, ["플란넬", "flannel"])) return "플란넬";
  if (includesAny(productName, ["니트", "knit"])) return "니트";

  return materialComposition?.summary?.trim() || undefined;
}

function mergeStyleTags(inferredTags: string[], currentTags?: string[]) {
  return [...new Set([...inferredTags, ...(currentTags || [])].filter(Boolean))].slice(0, 3);
}

function getKeywordClassification(
  productName: string,
  materialComposition?: MaterialComposition,
  currentItem?: ClosetItem
) {
  const officialMaterial = getOfficialMaterial(productName, materialComposition);
  const currentTags = currentItem?.styleTags;
  const matchedRule = PRODUCT_CLASSIFICATION_RULES.find((rule) =>
    includesAny(productName, rule.keywords)
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
  brand,
  materialComposition,
  currentItem,
}: ProductClassificationInput): ProductClassificationResult {
  const normalizedProductName = normalizeSearchText(productName);
  if (!normalizedProductName && !materialComposition) return {};

  const { candidate, matchedLabel } = getKeywordClassification(
    normalizedProductName,
    materialComposition,
    currentItem
  );
  const protectedFields = new Set<ProductClassificationField>(
    currentItem?.userEditedClassificationFields || []
  );
  const result: ProductClassificationResult = {};

  (Object.keys(candidate) as ProductClassificationField[]).forEach((field) => {
    if (protectedFields.has(field)) return;

    const value = candidate[field];
    if (value !== undefined) {
      (result as Record<ProductClassificationField, string | string[] | undefined>)[field] = value;
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
  if (brand?.trim()) {
    reasons.push(`${brand.trim()}의 확정 상품 정보를 기준으로 판단했어요.`);
  }

  return {
    ...result,
    confidence: matchedLabel ? 95 : 80,
    reasons,
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
