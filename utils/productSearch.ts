import { Alert, Linking } from "react-native";

export type ProductSearchProvider = "naver" | "musinsa" | "google";

export async function openProductSearch(provider: ProductSearchProvider, query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return;

  const encodedQuery = encodeURIComponent(trimmedQuery);
  const urls = {
    naver: `https://search.shopping.naver.com/search/all?query=${encodedQuery}`,
    musinsa: `https://www.musinsa.com/search/musinsa/integration?q=${encodedQuery}`,
    google: `https://www.google.com/search?q=${encodedQuery}`,
  };

  try {
    await Linking.openURL(urls[provider]);
  } catch (error) {
    console.error("상품 검색 열기 실패:", error);
    Alert.alert("검색 실패", "검색 페이지를 열지 못했어요. 다시 시도해주세요.");
  }
}
