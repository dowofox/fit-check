export const MAX_ANALYSIS_IMAGE_BYTES = 15 * 1024 * 1024;
export const ANALYSIS_IMAGE_FETCH_TIMEOUT_MS = 15_000;

export type EncodedAnalysisImage = {
  base64: string;
  mimeType: string;
};

export type AnalysisImageErrorCode =
  | "empty"
  | "too_large"
  | "unexpected_type"
  | "fetch_failed"
  | "fetch_timeout"
  | "encoding_failed";

export class AnalysisImageError extends Error {
  code: AnalysisImageErrorCode;

  constructor(code: AnalysisImageErrorCode, message: string) {
    super(message);
    this.name = "AnalysisImageError";
    this.code = code;
  }
}

export function validateAnalysisImageMetadata(
  size: number,
  mimeType = ""
) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new AnalysisImageError("empty", "Image response was empty");
  }
  if (size > MAX_ANALYSIS_IMAGE_BYTES) {
    throw new AnalysisImageError("too_large", "Image exceeds analysis size limit");
  }

  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (
    normalizedMimeType &&
    normalizedMimeType !== "application/octet-stream" &&
    !normalizedMimeType.startsWith("image/")
  ) {
    throw new AnalysisImageError(
      "unexpected_type",
      `Unexpected image response type: ${normalizedMimeType}`
    );
  }
}

function getImageDataFromDataUrl(dataUrl: string): EncodedAnalysisImage {
  const [header, base64] = dataUrl.split(",");
  if (!base64) {
    throw new AnalysisImageError("encoding_failed", "Image encoding failed");
  }

  return {
    base64,
    mimeType: header.match(/^data:(.*?);base64$/)?.[1] || "image/jpeg",
  };
}

async function fetchAnalysisImage(
  uri: string,
  timeoutMs: number
) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(uri, { signal: controller.signal });
  } catch (error) {
    if (didTimeout) {
      throw new AnalysisImageError(
        "fetch_timeout",
        "Image fetch exceeded the analysis timeout"
      );
    }

    throw new AnalysisImageError(
      "fetch_failed",
      error instanceof Error ? error.message : "Image fetch failed"
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function encodeAnalysisImageUri(
  uri: string,
  fetchTimeoutMs = ANALYSIS_IMAGE_FETCH_TIMEOUT_MS
) {
  const imageResponse = await fetchAnalysisImage(uri, fetchTimeoutMs);
  const isRemoteImage = /^https?:\/\//i.test(uri);

  if (isRemoteImage && !imageResponse.ok) {
    throw new AnalysisImageError(
      "fetch_failed",
      `Image fetch failed: ${imageResponse.status}`
    );
  }

  const contentLength = Number(imageResponse.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 0) {
    validateAnalysisImageMetadata(contentLength);
  }

  const imageBlob = await imageResponse.blob();
  validateAnalysisImageMetadata(imageBlob.size, imageBlob.type);

  return new Promise<EncodedAnalysisImage>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      try {
        if (typeof reader.result !== "string") {
          throw new AnalysisImageError("encoding_failed", "Image encoding failed");
        }
        resolve(getImageDataFromDataUrl(reader.result));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () =>
      reject(new AnalysisImageError("encoding_failed", "Image encoding failed"));
    reader.readAsDataURL(imageBlob);
  });
}

export function isAnalysisImageTooLargeError(error: unknown) {
  return error instanceof AnalysisImageError && error.code === "too_large";
}
