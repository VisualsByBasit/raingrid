// Current Islamabad weather and the next 24 hours' rain chance, from
// Open-Meteo (free, no key). Context only: no RAIN//GRID number uses it.
// The parser is pure and unit tested; anything unexpected returns null and
// the card stays hidden.

import { CITY } from "../config/city";

export const WEATHER_SOURCE = { label: "Open-Meteo", url: "https://open-meteo.com/" };

export const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${CITY.center[1]}&longitude=${CITY.center[0]}` +
  "&current=temperature_2m,precipitation,weather_code" +
  "&hourly=precipitation_probability&forecast_hours=24&timezone=Asia%2FKarachi";

export interface Weather {
  tempC: number;
  label: string; // "Clear", "Rain", ...
  icon: "sun" | "cloud" | "fog" | "rain" | "storm" | "snow";
  rainingNow: boolean;
  rainChance24h: number; // highest hourly chance over the next 24 h, %
  time: string; // local ISO time of the reading
}

// WMO weather codes, as Open-Meteo documents them, grouped.
export function describeCode(code: number): Pick<Weather, "label" | "icon"> {
  if (code === 0) return { label: "Clear", icon: "sun" };
  if (code <= 2) return { label: "Partly cloudy", icon: "cloud" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "rain" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "snow" };
  if (code >= 80 && code <= 82) return { label: "Rain showers", icon: "rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", icon: "snow" };
  if (code >= 95) return { label: "Thunderstorm", icon: "storm" };
  return { label: "Weather", icon: "cloud" };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseWeather(json: unknown): Weather | null {
  if (!json || typeof json !== "object") return null;
  const j = json as { current?: Record<string, unknown>; hourly?: { precipitation_probability?: unknown } };
  const temp = num(j.current?.temperature_2m);
  const code = num(j.current?.weather_code);
  const precip = num(j.current?.precipitation) ?? 0;
  const time = typeof j.current?.time === "string" ? j.current.time : null;
  const probs = Array.isArray(j.hourly?.precipitation_probability)
    ? (j.hourly.precipitation_probability as unknown[]).map(num).filter((v): v is number => v !== null)
    : [];
  if (temp === null || code === null || time === null || probs.length === 0) return null;
  const { label, icon } = describeCode(code);
  return {
    tempC: Math.round(temp),
    label,
    icon,
    rainingNow: precip > 0 || icon === "rain" || icon === "storm",
    rainChance24h: Math.max(0, Math.min(100, Math.round(Math.max(...probs)))),
    time,
  };
}

// "Low", "Some", "Likely" for a rain chance.
export function chanceWord(pct: number): string {
  if (pct >= 60) return "Rain likely";
  if (pct >= 30) return "Some chance of rain";
  return "Little chance of rain";
}
