import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import type { OutfitRecommendationWeather } from "@/utils/outfitRecommend";
import {
  endPerformanceTimer,
  startPerformanceTimer,
} from "@/utils/performance";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    precipitation?: number;
    rain?: number;
    snowfall?: number;
    time?: string;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
  };
};

const WEATHER_CACHE_KEY = "naes_weather_cache";
const WEATHER_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 2;
const DEFAULT_WEATHER_TIMEOUT_MS = 4500;
const LAST_KNOWN_LOCATION_MAX_AGE_MS = 1000 * 60 * 15;
const LAST_KNOWN_LOCATION_TIMEOUT_MS = 600;

type WeatherCache = {
  weather: OutfitRecommendationWeather;
  cachedAt: number;
};

export type WeatherFailureReason =
  | "permission_denied"
  | "permission_blocked"
  | "location_service_disabled"
  | "current_location_timeout"
  | "current_location_unavailable"
  | "network_unavailable"
  | "weather_api_timeout"
  | "weather_api_http_error"
  | "weather_api_invalid_response"
  | "unknown_error";

export type CurrentWeatherRecommendationResult = {
  weather: OutfitRecommendationWeather | null;
  weatherFound: boolean;
  failed: boolean;
  skipped: boolean;
  failureReason?: WeatherFailureReason;
  skipReason?: string;
  permissionStatus?: string;
  locationSource?: "current" | "last-known";
  apiStatus?: number;
  timeout: boolean;
};

export type CachedWeatherRecommendationResult = {
  weather: OutfitRecommendationWeather | null;
  cacheHit: boolean;
  cacheMissReason:
    | null
    | "weather_cache_empty"
    | "weather_cache_expired"
    | "weather_cache_invalid"
    | "weather_cache_read_failed";
};

type TimedResult<T> =
  | { status: "success"; value: T }
  | { status: "timeout" }
  | { status: "failed"; error: unknown };

let currentWeatherRequest: Promise<CurrentWeatherRecommendationResult> | null = null;

function settleWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<TimedResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: "timeout" });
    }, Math.max(1, timeoutMs));

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve({ status: "success", value });
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve({ status: "failed", error });
      }
    );
  });
}

function getRemainingTime(deadline: number) {
  return Math.max(1, deadline - Date.now());
}

function getWeatherConditionFromCode(code?: number) {
  if (code == null) return "날씨 정보 없음";
  if (code === 0) return "맑음";
  if ([1, 2].includes(code)) return "대체로 맑음";
  if (code === 3) return "흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "비";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "비";

  return "흐림";
}

function getNearestRainChance(response: OpenMeteoResponse) {
  const times = response.hourly?.time;
  const probabilities = response.hourly?.precipitation_probability;

  if (!times?.length || !probabilities?.length) return 0;

  const now = Date.now();
  let nearestIndex = 0;
  let nearestDiff = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - now);

    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIndex = index;
    }
  });

  return probabilities[nearestIndex] ?? 0;
}

function getRainChance(response: OpenMeteoResponse) {
  const nearestRainChance = getNearestRainChance(response);
  const currentPrecipitation =
    (response.current?.precipitation ?? 0) +
    (response.current?.rain ?? 0) +
    (response.current?.snowfall ?? 0);

  if (nearestRainChance > 0) return nearestRainChance;
  return currentPrecipitation > 0 ? 80 : 0;
}

export function formatWeatherRecommendationLabel(
  weather: OutfitRecommendationWeather | null
) {
  if (!weather || typeof weather.temperature !== "number") return null;

  return `오늘 ${Math.round(weather.temperature)}도 · ${
    weather.condition || "날씨"
  } 기준 추천`;
}

async function saveWeatherCache(weather: OutfitRecommendationWeather) {
  const timer = startPerformanceTimer("weather.cache.write");
  const cache: WeatherCache = {
    weather,
    cachedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
    endPerformanceTimer(timer, { success: true, weatherFound: true });
  } catch (error) {
    endPerformanceTimer(timer, {
      success: false,
      failureReason: "weather_cache_write_failed",
      weatherFound: true,
    });
    console.error("날씨 캐시 저장 실패:", error);
  }
}

export async function getCachedWeatherRecommendationResult(): Promise<CachedWeatherRecommendationResult> {
  const timer = startPerformanceTimer("weather.cache.read");
  let rawCache: string | null;

  try {
    rawCache = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
  } catch (error) {
    const result: CachedWeatherRecommendationResult = {
      weather: null,
      cacheHit: false,
      cacheMissReason: "weather_cache_read_failed",
    };
    endPerformanceTimer(timer, {
      success: false,
      cacheHit: false,
      weatherFound: false,
      failureReason: result.cacheMissReason,
    });
    console.error("날씨 캐시 불러오기 실패:", error);
    return result;
  }

  if (!rawCache) {
    const result: CachedWeatherRecommendationResult = {
      weather: null,
      cacheHit: false,
      cacheMissReason: "weather_cache_empty",
    };
    endPerformanceTimer(timer, {
      success: true,
      cacheHit: false,
      weatherFound: false,
      failureReason: result.cacheMissReason,
    });
    return result;
  }

  try {
    const cache = JSON.parse(rawCache) as WeatherCache;
    if (
      typeof cache.cachedAt !== "number" ||
      typeof cache.weather?.temperature !== "number"
    ) {
      const result: CachedWeatherRecommendationResult = {
        weather: null,
        cacheHit: false,
        cacheMissReason: "weather_cache_invalid",
      };
      endPerformanceTimer(timer, {
        success: false,
        cacheHit: false,
        weatherFound: false,
        failureReason: result.cacheMissReason,
      });
      return result;
    }

    if (Date.now() - cache.cachedAt > WEATHER_CACHE_MAX_AGE_MS) {
      const result: CachedWeatherRecommendationResult = {
        weather: null,
        cacheHit: false,
        cacheMissReason: "weather_cache_expired",
      };
      endPerformanceTimer(timer, {
        success: true,
        cacheHit: false,
        weatherFound: false,
        failureReason: result.cacheMissReason,
      });
      return result;
    }

    endPerformanceTimer(timer, {
      success: true,
      cacheHit: true,
      weatherFound: true,
    });
    return {
      weather: cache.weather,
      cacheHit: true,
      cacheMissReason: null,
    };
  } catch (error) {
    const result: CachedWeatherRecommendationResult = {
      weather: null,
      cacheHit: false,
      cacheMissReason: "weather_cache_invalid",
    };
    endPerformanceTimer(timer, {
      success: false,
      cacheHit: false,
      weatherFound: false,
      failureReason: result.cacheMissReason,
    });
    console.error("날씨 캐시 형식 오류:", error);
    return result;
  }
}

export async function getCachedWeatherForRecommendation(): Promise<OutfitRecommendationWeather | null> {
  return (await getCachedWeatherRecommendationResult()).weather;
}

function createFailureResult(
  failureReason: WeatherFailureReason,
  details: Partial<CurrentWeatherRecommendationResult> = {}
): CurrentWeatherRecommendationResult {
  return {
    weather: null,
    weatherFound: false,
    failed: true,
    skipped: false,
    failureReason,
    timeout:
      failureReason === "current_location_timeout" ||
      failureReason === "weather_api_timeout",
    ...details,
  };
}

async function loadCurrentWeatherRecommendationResult(
  timeoutMs = DEFAULT_WEATHER_TIMEOUT_MS
): Promise<CurrentWeatherRecommendationResult> {
  const totalTimer = startPerformanceTimer("weather.refresh.total");
  const deadline = Date.now() + timeoutMs;
  let permissionStatus: string | undefined;
  let locationSource: "current" | "last-known" | undefined;
  let apiStatus: number | undefined;
  let result: CurrentWeatherRecommendationResult = createFailureResult(
    "unknown_error"
  );

  try {
    const permissionCheckTimer = startPerformanceTimer("weather.permission.check");
    const permissionCheck = await settleWithin(
      Location.getForegroundPermissionsAsync(),
      getRemainingTime(deadline)
    );
    if (permissionCheck.status !== "success") {
      endPerformanceTimer(permissionCheckTimer, {
        success: false,
        failureReason: "unknown_error",
        timeout: permissionCheck.status === "timeout",
      });
      result = createFailureResult("unknown_error", {
        timeout: permissionCheck.status === "timeout",
      });
      return result;
    }

    let permission = permissionCheck.value;
    permissionStatus = permission.status;
    endPerformanceTimer(permissionCheckTimer, {
      success: true,
      permissionStatus,
    });

    if (permission.status === "undetermined") {
      const permissionRequestTimer = startPerformanceTimer(
        "weather.permission.request"
      );
      const permissionRequest = await settleWithin(
        Location.requestForegroundPermissionsAsync(),
        getRemainingTime(deadline)
      );
      if (permissionRequest.status !== "success") {
        endPerformanceTimer(permissionRequestTimer, {
          success: false,
          failureReason: "unknown_error",
          timeout: permissionRequest.status === "timeout",
        });
        result = createFailureResult("unknown_error", {
          permissionStatus,
          timeout: permissionRequest.status === "timeout",
        });
        return result;
      }

      permission = permissionRequest.value;
      permissionStatus = permission.status;
      endPerformanceTimer(permissionRequestTimer, {
        success: permission.status === "granted",
        permissionStatus,
        failureReason:
          permission.status === "granted"
            ? null
            : permission.canAskAgain
              ? "permission_denied"
              : "permission_blocked",
      });
    }

    if (permission.status !== "granted") {
      result = createFailureResult(
        permission.canAskAgain ? "permission_denied" : "permission_blocked",
        { permissionStatus }
      );
      return result;
    }

    const serviceCheck = await settleWithin(
      Location.hasServicesEnabledAsync(),
      getRemainingTime(deadline)
    );
    if (serviceCheck.status !== "success" || !serviceCheck.value) {
      result = createFailureResult(
        serviceCheck.status === "success"
          ? "location_service_disabled"
          : "current_location_unavailable",
        { permissionStatus, timeout: serviceCheck.status === "timeout" }
      );
      return result;
    }

    const lastKnownTimer = startPerformanceTimer("weather.location.last-known");
    const lastKnownResult = await settleWithin(
      Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
        requiredAccuracy: 5000,
      }),
      Math.min(getRemainingTime(deadline), LAST_KNOWN_LOCATION_TIMEOUT_MS)
    );
    const lastKnownLocation =
      lastKnownResult.status === "success" ? lastKnownResult.value : null;
    let location = lastKnownLocation;

    endPerformanceTimer(lastKnownTimer, {
      success: Boolean(lastKnownLocation),
      skipped: false,
      failureReason:
        lastKnownResult.status === "timeout"
          ? "last_known_location_timeout"
          : lastKnownResult.status === "failed"
            ? "last_known_location_unavailable"
            : lastKnownLocation
              ? null
              : "last_known_location_empty",
      locationSource: lastKnownLocation ? "last-known" : "none",
      timeout: lastKnownResult.status === "timeout",
    });

    if (lastKnownLocation) {
      locationSource = "last-known";
    } else {
      const locationTimer = startPerformanceTimer("weather.location.current");
      const locationResult = await settleWithin(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        getRemainingTime(deadline)
      );
      if (locationResult.status !== "success") {
        const failureReason =
          locationResult.status === "timeout"
            ? "current_location_timeout"
            : "current_location_unavailable";
        endPerformanceTimer(locationTimer, {
          success: false,
          failureReason,
          permissionStatus,
          timeout: locationResult.status === "timeout",
          locationSource: "current",
        });
        result = createFailureResult(failureReason, {
          permissionStatus,
          locationSource: "current",
        });
        return result;
      }
      location = locationResult.value;
      locationSource = "current";
      endPerformanceTimer(locationTimer, {
        success: true,
        permissionStatus,
        locationSource,
        timeout: false,
      });
    }

    const reverseGeocodeTimer = startPerformanceTimer("weather.reverse-geocode");
    endPerformanceTimer(reverseGeocodeTimer, {
      success: true,
      skipped: true,
      skipReason: "open_meteo_accepts_coordinates",
    });

    if (!location) {
      result = createFailureResult("current_location_unavailable", {
        permissionStatus,
        locationSource,
      });
      return result;
    }

    const { latitude, longitude } = location.coords;
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      "&current=temperature_2m,weather_code,precipitation,rain,snowfall" +
      "&hourly=precipitation_probability" +
      "&forecast_days=1" +
      "&timezone=auto";

    const apiTimer = startPerformanceTimer("weather.api.request");
    const abortController = new AbortController();
    const responseResult = await settleWithin(
      fetch(url, { signal: abortController.signal }),
      getRemainingTime(deadline)
    );
    if (responseResult.status === "timeout") abortController.abort();
    if (responseResult.status !== "success") {
      const failureReason =
        responseResult.status === "timeout"
          ? "weather_api_timeout"
          : "network_unavailable";
      endPerformanceTimer(apiTimer, {
        success: false,
        failureReason,
        timeout: responseResult.status === "timeout",
        locationSource,
      });
      result = createFailureResult(failureReason, {
        permissionStatus,
        locationSource,
      });
      return result;
    }

    apiStatus = responseResult.value.status;
    endPerformanceTimer(apiTimer, {
      success: responseResult.value.ok,
      failureReason: responseResult.value.ok
        ? null
        : "weather_api_http_error",
      apiStatus,
      timeout: false,
      locationSource,
    });
    if (!responseResult.value.ok) {
      result = createFailureResult("weather_api_http_error", {
        permissionStatus,
        locationSource,
        apiStatus,
      });
      return result;
    }

    const parseTimer = startPerformanceTimer("weather.api.parse");
    const parseResult = await settleWithin(
      responseResult.value.json() as Promise<OpenMeteoResponse>,
      getRemainingTime(deadline)
    );
    const temperature =
      parseResult.status === "success"
        ? parseResult.value.current?.temperature_2m
        : undefined;
    if (parseResult.status !== "success" || typeof temperature !== "number") {
      endPerformanceTimer(parseTimer, {
        success: false,
        failureReason: "weather_api_invalid_response",
        apiStatus,
        timeout: parseResult.status === "timeout",
        weatherFound: false,
      });
      result = createFailureResult("weather_api_invalid_response", {
        permissionStatus,
        locationSource,
        apiStatus,
        timeout: parseResult.status === "timeout",
      });
      return result;
    }

    const weather: OutfitRecommendationWeather = {
      temperature,
      condition: getWeatherConditionFromCode(
        parseResult.value.current?.weather_code
      ),
      rainChance: getRainChance(parseResult.value),
    };
    endPerformanceTimer(parseTimer, {
      success: true,
      apiStatus,
      weatherFound: true,
    });
    await saveWeatherCache(weather);

    result = {
      weather,
      weatherFound: true,
      failed: false,
      skipped: false,
      permissionStatus,
      locationSource,
      apiStatus,
      timeout: false,
    };
    return result;
  } catch (error) {
    console.error("현재 날씨 조회 실패:", error);
    result = createFailureResult("unknown_error", {
      permissionStatus,
      locationSource,
      apiStatus,
    });
    return result;
  } finally {
    endPerformanceTimer(totalTimer, {
      success: result?.weatherFound === true,
      failed: result?.failed ?? true,
      skipped: result?.skipped ?? false,
      failureReason: result?.failureReason,
      permissionStatus: result?.permissionStatus ?? permissionStatus,
      locationSource: result?.locationSource ?? locationSource ?? "none",
      apiStatus: result?.apiStatus ?? apiStatus,
      timeout: result?.timeout ?? false,
      weatherFound: result?.weatherFound ?? false,
    });
  }
}

export function getCurrentWeatherRecommendationResult(
  timeoutMs = DEFAULT_WEATHER_TIMEOUT_MS
): Promise<CurrentWeatherRecommendationResult> {
  if (currentWeatherRequest) return currentWeatherRequest;

  const request = loadCurrentWeatherRecommendationResult(timeoutMs);
  currentWeatherRequest = request;
  void request.finally(() => {
    if (currentWeatherRequest === request) currentWeatherRequest = null;
  });

  return request;
}

export async function getCurrentWeatherForRecommendation(
  timeoutMs = DEFAULT_WEATHER_TIMEOUT_MS
): Promise<OutfitRecommendationWeather | null> {
  return (await getCurrentWeatherRecommendationResult(timeoutMs)).weather;
}
