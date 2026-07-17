export type ProductUrlValidationError =
  | "product_url_required"
  | "invalid_product_url"
  | "unsupported_product_url_protocol";

export type ProductUrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; error: ProductUrlValidationError };

export function validateProductUrlInput(value?: string): ProductUrlValidationResult {
  const trimmedValue = value?.trim() || "";
  if (!trimmedValue) return { ok: false, error: "product_url_required" };

  let normalizedValue = trimmedValue;
  if (trimmedValue.startsWith("//")) {
    normalizedValue = `https:${trimmedValue}`;
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue)) {
    const localAddressPattern =
      /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#]|$)/i;
    const domainPattern =
      /^(?:www\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i;

    if (localAddressPattern.test(trimmedValue)) {
      normalizedValue = `http://${trimmedValue}`;
    } else if (domainPattern.test(trimmedValue)) {
      normalizedValue = `https://${trimmedValue}`;
    }
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { ok: false, error: "unsupported_product_url_protocol" };
    }
    if (!parsedUrl.hostname) return { ok: false, error: "invalid_product_url" };

    return { ok: true, url: parsedUrl.toString() };
  } catch {
    return { ok: false, error: "invalid_product_url" };
  }
}
