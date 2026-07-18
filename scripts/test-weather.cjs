const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const storageMemory = new Map();
let permissionResponse;
let requestedPermissionResponse;
let requestPermissionCalls;
let servicesEnabled;
let currentLocationFactory;

global.__DEV__ = false;

const asyncStorage = {
  async getItem(key) {
    return storageMemory.get(key) ?? null;
  },
  async setItem(key, value) {
    storageMemory.set(key, value);
  },
};

const locationMock = {
  Accuracy: { Balanced: 3 },
  async getForegroundPermissionsAsync() {
    return permissionResponse;
  },
  async requestForegroundPermissionsAsync() {
    requestPermissionCalls += 1;
    return requestedPermissionResponse ?? permissionResponse;
  },
  async hasServicesEnabledAsync() {
    return servicesEnabled;
  },
  getCurrentPositionAsync() {
    return currentLocationFactory();
  },
};

const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

Module._load = function loadWithMocks(request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return { __esModule: true, default: asyncStorage };
  }
  if (request === "expo-location") {
    return locationMock;
  }

  return originalLoad.call(this, request, parent, isMain);
};

Module._resolveFilename = function resolveProjectAlias(
  request,
  parent,
  isMain,
  options
) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;

  return originalResolveFilename.call(
    this,
    resolvedRequest,
    parent,
    isMain,
    options
  );
};

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(result.outputText, filename);
};

const {
  getCachedWeatherRecommendationResult,
  getCurrentWeatherRecommendationResult,
} = require("../utils/weather.ts");

function createPermission(status, canAskAgain = true) {
  return {
    status,
    canAskAgain,
    granted: status === "granted",
    expires: "never",
  };
}

function createFetchResponse({ ok = true, status = 200, data } = {}) {
  return {
    ok,
    status,
    async json() {
      return data;
    },
  };
}

test.beforeEach(() => {
  storageMemory.clear();
  permissionResponse = createPermission("granted");
  requestedPermissionResponse = undefined;
  requestPermissionCalls = 0;
  servicesEnabled = true;
  currentLocationFactory = async () => ({
    coords: { latitude: 37.5, longitude: 127 },
  });
  global.fetch = async () =>
    createFetchResponse({
      data: {
        current: { temperature_2m: 27, weather_code: 0 },
        hourly: {
          time: [new Date().toISOString()],
          precipitation_probability: [10],
        },
      },
    });
});

test("denied location permission is reported without requesting it again", async () => {
  permissionResponse = createPermission("denied", true);

  const result = await getCurrentWeatherRecommendationResult(100);

  assert.equal(result.failed, true);
  assert.equal(result.weatherFound, false);
  assert.equal(result.failureReason, "permission_denied");
  assert.equal(requestPermissionCalls, 0);
});

test("blocked location permission has a distinct failure reason", async () => {
  permissionResponse = createPermission("denied", false);

  const result = await getCurrentWeatherRecommendationResult(100);

  assert.equal(result.failureReason, "permission_blocked");
  assert.equal(result.permissionStatus, "denied");
});

test("disabled location services stop before location and weather requests", async () => {
  servicesEnabled = false;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return createFetchResponse();
  };

  const result = await getCurrentWeatherRecommendationResult(100);

  assert.equal(result.failureReason, "location_service_disabled");
  assert.equal(fetchCalls, 0);
});

test("a slow current location is reported as a timeout", async () => {
  currentLocationFactory = () => new Promise(() => {});

  const result = await getCurrentWeatherRecommendationResult(10);

  assert.equal(result.failureReason, "current_location_timeout");
  assert.equal(result.timeout, true);
});

test("weather HTTP and response errors remain distinguishable", async () => {
  global.fetch = async () => createFetchResponse({ ok: false, status: 503 });
  const httpResult = await getCurrentWeatherRecommendationResult(100);
  assert.equal(httpResult.failureReason, "weather_api_http_error");
  assert.equal(httpResult.apiStatus, 503);

  global.fetch = async () =>
    createFetchResponse({ data: { current: { weather_code: 0 } } });
  const invalidResult = await getCurrentWeatherRecommendationResult(100);
  assert.equal(invalidResult.failureReason, "weather_api_invalid_response");
});

test("weather network and API timeout failures remain distinguishable", async () => {
  global.fetch = async () => {
    throw new TypeError("network unavailable");
  };
  const networkResult = await getCurrentWeatherRecommendationResult(100);
  assert.equal(networkResult.failureReason, "network_unavailable");

  global.fetch = () => new Promise(() => {});
  const timeoutResult = await getCurrentWeatherRecommendationResult(10);
  assert.equal(timeoutResult.failureReason, "weather_api_timeout");
  assert.equal(timeoutResult.timeout, true);
});

test("undetermined permission is requested once before weather lookup", async () => {
  permissionResponse = createPermission("undetermined");
  requestedPermissionResponse = createPermission("granted");

  const result = await getCurrentWeatherRecommendationResult(100);

  assert.equal(result.weatherFound, true);
  assert.equal(requestPermissionCalls, 1);
});

test("successful live weather is cached and restored without coordinates", async () => {
  const liveResult = await getCurrentWeatherRecommendationResult(100);
  const cachedResult = await getCachedWeatherRecommendationResult();

  assert.equal(liveResult.failed, false);
  assert.equal(liveResult.weatherFound, true);
  assert.equal(liveResult.weather?.temperature, 27);
  assert.equal(cachedResult.cacheHit, true);
  assert.deepEqual(cachedResult.weather, liveResult.weather);
  assert.equal(
    storageMemory.get("naes_weather_cache").includes("latitude"),
    false
  );
  assert.equal(
    storageMemory.get("naes_weather_cache").includes("longitude"),
    false
  );
});

test("empty, expired, and invalid weather caches have explicit miss reasons", async () => {
  assert.equal(
    (await getCachedWeatherRecommendationResult()).cacheMissReason,
    "weather_cache_empty"
  );

  storageMemory.set(
    "naes_weather_cache",
    JSON.stringify({
      cachedAt: Date.now() - 1000 * 60 * 60 * 3,
      weather: { temperature: 20 },
    })
  );
  assert.equal(
    (await getCachedWeatherRecommendationResult()).cacheMissReason,
    "weather_cache_expired"
  );

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    storageMemory.set("naes_weather_cache", "{broken-json");
    assert.equal(
      (await getCachedWeatherRecommendationResult()).cacheMissReason,
      "weather_cache_invalid"
    );
  } finally {
    console.error = originalConsoleError;
  }
});
