export type ProductExtractionSummaryInput = {
  productName?: string;
  productImageUrl?: string;
  materialComposition?: {
    summary?: string;
  };
  productSizeGuide?: {
    sizes?: unknown[];
  };
};

export type ProductExtractionStatusItem = {
  key: "product" | "image" | "material" | "sizeGuide";
  label: string;
  available: boolean;
};

export type ProductExtractionSummary = {
  items: ProductExtractionStatusItem[];
  isComplete: boolean;
  message: string;
};

function getExtractionMessage(items: ProductExtractionStatusItem[]) {
  const unavailableKeys = new Set(
    items.filter((item) => !item.available).map((item) => item.key)
  );

  if (unavailableKeys.size === 0) {
    return "상품명, 대표 이미지, 공식 소재와 상품 실측을 가져왔어요.";
  }

  if (unavailableKeys.has("image")) {
    return "대표 이미지는 가져오지 못했어요. 옷 사진을 추가하면 확인된 상품 정보와 함께 등록할 수 있어요.";
  }

  const missingDetails = [
    unavailableKeys.has("material") ? "공식 소재" : "",
    unavailableKeys.has("sizeGuide") ? "상품 실측" : "",
  ].filter(Boolean);

  if (missingDetails.length > 0) {
    return `${missingDetails.join(" · ")} 정보는 자동으로 가져오지 못했어요. 저장 후 상세 화면에서 보완할 수 있어요.`;
  }

  return "일부 상품 정보는 자동으로 가져오지 못했어요. 저장 전 등록 정보를 확인해주세요.";
}

export function getProductExtractionSummary(
  product: ProductExtractionSummaryInput
): ProductExtractionSummary {
  const items: ProductExtractionStatusItem[] = [
    {
      key: "product",
      label: "상품명",
      available: Boolean(product.productName?.trim()),
    },
    {
      key: "image",
      label: "대표 이미지",
      available: Boolean(product.productImageUrl?.trim()),
    },
    {
      key: "material",
      label: "공식 소재",
      available: Boolean(product.materialComposition?.summary?.trim()),
    },
    {
      key: "sizeGuide",
      label: "상품 실측",
      available: Boolean(product.productSizeGuide?.sizes?.length),
    },
  ];

  return {
    items,
    isComplete: items.every((item) => item.available),
    message: getExtractionMessage(items),
  };
}
