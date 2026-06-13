import * as Location from "expo-location";

import type { OutfitRecommendationWeather } from "@/utils/outfitRecommend";

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

function getWeatherConditionFromCode(code?: number) {
  if (code == null) return "날씨 정보 없음";
  if (code === 0) return "맑음";
  if ([1, 2].includes(code)) return "대체로 맑음";
  if (code === 3) return "흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "비";
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

export function formatWeatherRecommendationLabel(weather: OutfitRecommendationWeather | null) {
  if (!weather || typeof weather.temperature !== "number") return null;

  return `오늘 ${Math.round(weather.temperature)}도 · ${weather.condition || "날씨"} 기준 추천`;
}

export async function getCurrentWeatherForRecommendation(): Promise<OutfitRecommendationWeather | null> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") return null;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = location.coords;
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    "&current=temperature_2m,weather_code,precipitation,rain,snowfall" +
    "&hourly=precipitation_probability" +
    "&forecast_days=1" +
    "&timezone=auto";

  const response = await fetch(url);

  if (!response.ok) return null;

  const data = (await response.json()) as OpenMeteoResponse;
  const temperature = data.current?.temperature_2m;

  if (typeof temperature !== "number") return null;

  return {
    temperature,
    condition: getWeatherConditionFromCode(data.current?.weather_code),
    rainChance: getRainChance(data),
  };
}
