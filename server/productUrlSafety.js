const dns = require("dns").promises;
const net = require("net");
const { Agent } = require("undici");

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

class ProductUrlSafetyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProductUrlSafetyError";
    this.code = code;
  }
}

function normalizeIpAddress(value = "") {
  return value.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function isPrivateIpv4Address(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 88) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51) ||
    (first === 203 && second === 0 && parts[2] === 113) ||
    first >= 224
  );
}

function isPrivateIpv6Address(address) {
  const normalized = normalizeIpAddress(address);
  if (normalized === "::" || normalized === "::1") return true;

  const mappedIpv4 = normalized.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4) return isPrivateIpv4Address(mappedIpv4[1]);

  const [leftPart, rightPart = ""] = normalized.split("::");
  const leftGroups = leftPart ? leftPart.split(":") : [];
  const rightGroups = rightPart ? rightPart.split(":") : [];
  const zeroGroups = Array(Math.max(0, 8 - leftGroups.length - rightGroups.length)).fill("0");
  const groups = normalized.includes("::")
    ? [...leftGroups, ...zeroGroups, ...rightGroups]
    : normalized.split(":");

  if (
    groups.length === 8 &&
    groups.slice(0, 5).every((group) => Number.parseInt(group || "0", 16) === 0) &&
    Number.parseInt(groups[5] || "0", 16) === 0xffff
  ) {
    const high = Number.parseInt(groups[6] || "0", 16);
    const low = Number.parseInt(groups[7] || "0", 16);
    const mappedAddress = [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
    return isPrivateIpv4Address(mappedAddress);
  }

  const firstGroup = normalized.split(":")[0];
  const firstValue = Number.parseInt(firstGroup || "0", 16);
  return (
    (firstValue >= 0xfc00 && firstValue <= 0xfdff) ||
    (firstValue >= 0xfe80 && firstValue <= 0xfebf) ||
    (firstValue >= 0xff00 && firstValue <= 0xffff) ||
    normalized.startsWith("2001:db8:")
  );
}

function isPrivateIpAddress(value) {
  const address = normalizeIpAddress(value);
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4Address(address);
  if (version === 6) return isPrivateIpv6Address(address);
  return true;
}

function isUnsafeProductHostname(value = "") {
  const hostname = normalizeIpAddress(value).replace(/\.$/, "");
  if (!hostname) return true;
  if (net.isIP(hostname)) return isPrivateIpAddress(hostname);

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal"
  );
}

function ensurePublicResolvedAddresses(addresses) {
  const resolvedAddresses = Array.isArray(addresses) ? addresses : [addresses];

  if (
    resolvedAddresses.length === 0 ||
    resolvedAddresses.some((entry) => !entry?.address || isPrivateIpAddress(entry.address))
  ) {
    throw new ProductUrlSafetyError(
      "unsafe_product_url",
      "공개된 쇼핑 상품 링크만 사용할 수 있습니다."
    );
  }

  return resolvedAddresses;
}

function createSafeLookup(lookup = dns.lookup) {
  return (hostname, options, callback) => {
    Promise.resolve(lookup(hostname, { ...options, all: true, verbatim: true }))
      .then((addresses) => {
        const publicAddresses = ensurePublicResolvedAddresses(addresses);

        if (options?.all) {
          callback(null, publicAddresses);
          return;
        }

        callback(null, publicAddresses[0].address, publicAddresses[0].family);
      })
      .catch((error) => callback(error));
  };
}

const SAFE_FETCH_DISPATCHER = new Agent({
  connect: { lookup: createSafeLookup() },
});

async function assertPublicProductUrl(value, options = {}) {
  const lookup = options.lookup || dns.lookup;
  const parsedUrl = value instanceof URL ? value : new URL(value);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new ProductUrlSafetyError(
      "unsupported_product_url_protocol",
      "HTTP 또는 HTTPS 상품 링크만 지원합니다."
    );
  }

  if (options.allowPrivate === true) return parsedUrl;

  if (isUnsafeProductHostname(parsedUrl.hostname)) {
    throw new ProductUrlSafetyError(
      "unsafe_product_url",
      "공개된 쇼핑 상품 링크만 사용할 수 있습니다."
    );
  }

  const addresses = await lookup(parsedUrl.hostname, { all: true, verbatim: true });
  ensurePublicResolvedAddresses(addresses);

  return parsedUrl;
}

async function fetchPublicProductPage(value, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = value instanceof URL ? value : new URL(value);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const safeUrl = await assertPublicProductUrl(currentUrl, {
      lookup: options.lookup,
      allowPrivate: options.allowPrivate,
    });
    const response = await fetchImpl(safeUrl.toString(), {
      headers: options.headers,
      signal: options.signal,
      redirect: "manual",
      ...(options.allowPrivate
        ? {}
        : options.dispatcher
          ? { dispatcher: options.dispatcher }
          : fetchImpl === globalThis.fetch
            ? { dispatcher: SAFE_FETCH_DISPATCHER }
            : {}),
    });

    if (!REDIRECT_STATUS_CODES.has(response.status)) {
      return { response, finalUrl: safeUrl.toString() };
    }

    const location = response.headers?.get?.("location");
    if (!location) return { response, finalUrl: safeUrl.toString() };
    if (redirectCount === maxRedirects) {
      throw new ProductUrlSafetyError(
        "too_many_product_redirects",
        "상품 링크의 이동 횟수가 너무 많습니다."
      );
    }

    currentUrl = new URL(location, safeUrl);
  }

  throw new ProductUrlSafetyError(
    "too_many_product_redirects",
    "상품 링크의 이동 횟수가 너무 많습니다."
  );
}

module.exports = {
  ProductUrlSafetyError,
  assertPublicProductUrl,
  createSafeLookup,
  fetchPublicProductPage,
  isPrivateIpAddress,
  isUnsafeProductHostname,
};
