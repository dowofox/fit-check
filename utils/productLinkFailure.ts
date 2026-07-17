export type ProductLinkFailureKind =
  | "invalid_link"
  | "unsupported_shop"
  | "connection"
  | "missing_image"
  | "unknown";

export type ProductLinkFailure = {
  kind: ProductLinkFailureKind;
  title: string;
  message: string;
};

export type ProductExtractionErrorResponse = {
  error?: string;
  message?: string;
};

export function getProductLinkFailure(
  errorCode?: string,
  status?: number
): ProductLinkFailure {
  if (
    ["unsafe_product_url", "too_many_product_redirects"].includes(errorCode || "")
  ) {
    return {
      kind: "invalid_link",
      title: "공개 상품 링크를 입력해주세요",
      message: "로컬·사내 주소가 아닌 쇼핑몰의 공개 상품 페이지를 사용해주세요.",
    };
  }

  if (
    status === 400 ||
    [
      "product_url_required",
      "invalid_product_url",
      "unsupported_product_url_protocol",
    ].includes(errorCode || "")
  ) {
    return {
      kind: "invalid_link",
      title: "링크를 확인해주세요",
      message: "상품 페이지의 전체 주소를 다시 붙여넣어 주세요.",
    };
  }

  if (status === 422 || errorCode === "product_information_not_found") {
    return {
      kind: "unsupported_shop",
      title: "이 쇼핑몰은 자동 등록이 어려워요",
      message: "등록에 필요한 상품 정보를 찾지 못했어요. 사진이나 직접 입력으로 등록할 수 있어요.",
    };
  }

  if (
    ["product_page_unreachable", "product_page_timeout"].includes(errorCode || "") ||
    status === 502 ||
    status === 504
  ) {
    return {
      kind: "connection",
      title: "상품 페이지에 연결하지 못했어요",
      message: "네트워크 상태를 확인한 뒤 다시 시도해주세요.",
    };
  }

  return {
    kind: "unknown",
    title: "상품 정보를 가져오지 못했어요",
    message: "잠시 후 다시 시도하거나 직접 입력해주세요.",
  };
}

export function formatProductLinkFailure(failure: ProductLinkFailure) {
  return `${failure.title}\n${failure.message}`;
}
