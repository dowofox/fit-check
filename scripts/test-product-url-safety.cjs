const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertPublicProductUrl,
  createSafeLookup,
  fetchPublicProductPage,
  isPrivateIpAddress,
  isUnsafeProductHostname,
} = require("../server/productUrlSafety");

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("private and local product URL targets are rejected", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ]) {
    assert.equal(isPrivateIpAddress(address), true, address);
  }

  assert.equal(isUnsafeProductHostname("localhost"), true);
  assert.equal(isUnsafeProductHostname("shop.localhost"), true);
  await assert.rejects(
    assertPublicProductUrl("http://shop.example.com/product", {
      lookup: async () => [{ address: "192.168.0.20", family: 4 }],
    }),
    { code: "unsafe_product_url" }
  );
});

test("public shopping URLs remain available", async () => {
  const result = await assertPublicProductUrl("https://shop.example.com/product", {
    lookup: publicLookup,
  });
  assert.equal(result.toString(), "https://shop.example.com/product");
});

test("every redirect destination is validated before it is fetched", async () => {
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(url);
    return {
      status: 302,
      headers: new Headers({ location: "http://127.0.0.1/admin" }),
    };
  };

  await assert.rejects(
    fetchPublicProductPage("https://share.example.com/product", {
      fetchImpl,
      lookup: publicLookup,
    }),
    { code: "unsafe_product_url" }
  );
  assert.deepEqual(requestedUrls, ["https://share.example.com/product"]);
});

test("the connection lookup rejects a private address after preflight validation", async () => {
  const safeLookup = createSafeLookup(
    async () => [{ address: "169.254.169.254", family: 4 }]
  );

  await assert.rejects(
    new Promise((resolve, reject) => {
      safeLookup("shop.example.com", {}, (error, address) => {
        if (error) reject(error);
        else resolve(address);
      });
    }),
    { code: "unsafe_product_url" }
  );
});

test("safe relative redirects still resolve to the final product URL", async () => {
  const responses = [
    {
      status: 302,
      headers: new Headers({ location: "/products/123" }),
    },
    {
      status: 200,
      ok: true,
      headers: new Headers(),
    },
  ];

  const result = await fetchPublicProductPage("https://shop.example.com/share", {
    fetchImpl: async () => responses.shift(),
    lookup: publicLookup,
  });

  assert.equal(result.finalUrl, "https://shop.example.com/products/123");
  assert.equal(result.response.status, 200);
});
