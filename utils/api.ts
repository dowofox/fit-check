const LOCAL_API_BASE_URL = "http://192.168.219.104:3001";

export function resolveApiBaseUrl(configuredUrl?: string) {
  const baseUrl = configuredUrl?.trim() || LOCAL_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

// EAS/Expo 환경변수가 없으면 같은 Wi-Fi의 로컬 개발 서버를 사용합니다.
export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL
);

export const API_ENDPOINTS = {
  analyze: `${API_BASE_URL}/analyze`,
  analyzeClothes: `${API_BASE_URL}/analyze-clothes`,
  extractProduct: `${API_BASE_URL}/extract-product`,
} as const;

export const API_TIMEOUTS = {
  analyze: 90_000,
  extractProduct: 30_000,
} as const;

export async function fetchApiWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImplementation(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
