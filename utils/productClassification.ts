import type {
  ClosetItem,
  MaterialComposition,
  ProductClassificationField,
} from "@/utils/storage";

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
  let candidate: ClassificationCandidate = {};
  let matchedLabel = "";

  if (includesAny(productName, ["니트 가디건", "knit cardigan"])) {
    candidate = {
      category: "아우터",
      subCategory: "가디건",
      detailCategory: "니트 가디건",
      material: "니트",
      styleTags: mergeStyleTags(["미니멀", "깔끔함"], currentTags),
    };
    matchedLabel = "니트 가디건";
  } else if (includesAny(productName, ["데님 자켓", "데님 재킷", "denim jacket"])) {
    candidate = {
      category: "아우터",
      subCategory: "자켓",
      detailCategory: "데님 자켓",
      material: "데님",
      styleTags: mergeStyleTags(["캐주얼", "데일리"], currentTags),
    };
    matchedLabel = "데님 자켓";
  } else if (includesAny(productName, ["데님 셔츠", "denim shirt"])) {
    candidate = {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "데님 셔츠",
      material: "데님",
      styleTags: mergeStyleTags(["캐주얼", "데일리"], currentTags),
    };
    matchedLabel = "데님 셔츠";
  } else if (includesAny(productName, ["린넨 셔츠", "linen shirt"])) {
    candidate = {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "린넨 셔츠",
      material: "린넨",
      styleTags: mergeStyleTags(["미니멀", "데일리"], currentTags),
    };
    matchedLabel = "린넨 셔츠";
  } else if (includesAny(productName, ["플란넬 셔츠", "flannel shirt"])) {
    candidate = {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "플란넬 셔츠",
      material: "플란넬",
      styleTags: mergeStyleTags(["캐주얼", "아메카지"], currentTags),
    };
    matchedLabel = "플란넬 셔츠";
  } else if (includesAny(productName, ["옥스포드 셔츠", "oxford shirt"])) {
    candidate = {
      category: "상의",
      subCategory: "셔츠",
      detailCategory: "옥스포드 셔츠",
      material: officialMaterial,
      styleTags: mergeStyleTags(["미니멀", "깔끔함"], currentTags),
    };
    matchedLabel = "옥스포드 셔츠";
  } else if (
    includesAny(productName, [
      "반팔 니트",
      "반소매 니트",
      "short sleeve knit",
      "short sleeved knit",
      "half sleeve knit",
    ])
  ) {
    candidate = {
      category: "상의",
      subCategory: "니트",
      detailCategory: "반팔 니트",
      material: "니트",
      styleTags: mergeStyleTags(["미니멀", "깔끔함"], currentTags),
    };
    matchedLabel = "반팔 니트";
  } else if (includesAny(productName, ["데님 팬츠", "denim pants", "denim jeans", "청바지", "jeans"])) {
    candidate = {
      category: "하의",
      subCategory: "팬츠",
      detailCategory: "데님 팬츠",
      material: "데님",
      styleTags: mergeStyleTags(["캐주얼", "데일리"], currentTags),
    };
    matchedLabel = "데님 팬츠";
  } else if (includesAny(productName, ["린넨 팬츠", "linen pants", "linen trousers"])) {
    candidate = {
      category: "하의",
      subCategory: "팬츠",
      detailCategory: "린넨 팬츠",
      material: "린넨",
      styleTags: mergeStyleTags(["미니멀", "데일리"], currentTags),
    };
    matchedLabel = "린넨 팬츠";
  } else if (officialMaterial) {
    candidate.material = officialMaterial;
  }

  return { candidate, matchedLabel };
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
