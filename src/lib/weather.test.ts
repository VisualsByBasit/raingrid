import { describe, expect, it } from "vitest";
import { WEATHER_URL, chanceWord, describeCode, parseWeather } from "./weather";

// Trimmed from a real Open-Meteo response for Islamabad.
const sample = {
  current: { time: "2026-10-25T20:30", interval: 900, temperature_2m: 18.1, precipitation: 0, weather_code: 0 },
  hourly: { time: ["2026-10-25T20:00", "2026-10-25T21:00"], precipitation_probability: [0, 35] },
};

describe("weather", () => {
  it("asks Open-Meteo for Islamabad with no key", () => {
    expect(WEATHER_URL).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=33\.69&longitude=73\.05/);
    expect(WEATHER_URL).toContain("forecast_hours=24");
    expect(WEATHER_URL).not.toMatch(/apikey|key=/i);
  });

  it("parses current weather and the highest 24 h rain chance", () => {
    expect(parseWeather(sample)).toEqual({
      tempC: 18,
      label: "Clear",
      icon: "sun",
      rainingNow: false,
      rainChance24h: 35,
      time: "2026-10-25T20:30",
    });
  });

  it("knows it is raining from the code or the precipitation", () => {
    expect(parseWeather({ ...sample, current: { ...sample.current, weather_code: 63 } })?.rainingNow).toBe(true);
    expect(parseWeather({ ...sample, current: { ...sample.current, precipitation: 0.2 } })?.rainingNow).toBe(true);
  });

  it("returns null for anything unexpected, so the card hides", () => {
    expect(parseWeather(null)).toBeNull();
    expect(parseWeather({ error: true, reason: "x" })).toBeNull();
    expect(parseWeather({ ...sample, hourly: { precipitation_probability: [] } })).toBeNull();
    expect(parseWeather({ ...sample, current: { ...sample.current, temperature_2m: "18" } })).toBeNull();
  });

  it("groups WMO codes", () => {
    expect(describeCode(3).label).toBe("Overcast");
    expect(describeCode(81).icon).toBe("rain");
    expect(describeCode(95).label).toBe("Thunderstorm");
  });

  it("words the chance", () => {
    expect(chanceWord(10)).toBe("Little chance of rain");
    expect(chanceWord(30)).toBe("Some chance of rain");
    expect(chanceWord(80)).toBe("Rain likely");
  });
});
