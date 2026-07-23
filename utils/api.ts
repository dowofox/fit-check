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

export class ApiRequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`API request exceeded ${timeoutMs}ms`);
    this.name = "ApiRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function isApiRequestTimeoutError(
  error: unknown
): error is ApiRequestTimeoutError {
  return error instanceof ApiRequestTimeoutError;
}

export async function fetchApiWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  timeoutMs: number,
  fetchImplementation: typeof fetch = fetch
) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  let didTimeout = false;
  const handleExternalAbort = () => {
    controller.abort();
  };

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", handleExternalAbort, {
      once: true,
    });
  }
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImplementation(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) throw new ApiRequestTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", handleExternalAbort);
  }
}
