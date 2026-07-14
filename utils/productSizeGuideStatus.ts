export function getProductSizeGuideStatusMessage(
  sizeGuideStatus?: string,
  hasProductSizeGuide = false
) {
  if (hasProductSizeGuide) {
    return "상품 실측표를 찾았어요.";
  }

  switch (sizeGuideStatus) {
    case "image_only":
      return "실측표가 이미지로만 제공돼 자동으로 읽지 못했어요. 상품은 등록하고 실측은 직접 입력할 수 있어요.";
    case "productId_not_found":
      return "실측 확인에 필요한 상품 번호를 찾지 못했어요. 상품은 등록하고 실측은 직접 입력할 수 있어요.";
    case "api_failed":
      return "상품 실측 정보를 불러오지 못했어요. 상품 등록은 계속할 수 있고 실측은 직접 입력할 수 있어요.";
    case "disabled":
      return "상품 실측 자동 확인이 꺼져 있어요. 등록 후 직접 입력할 수 있어요.";
    case "no_text_size_guide":
    case "manual_required":
    default:
      return "자동으로 읽을 수 있는 실측표를 찾지 못했어요. 상품은 등록하고 실측은 직접 입력할 수 있어요.";
  }
}
