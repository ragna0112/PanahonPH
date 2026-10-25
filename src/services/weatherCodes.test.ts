import { describe, expect, it } from "vitest";
import { describeWeather } from "./weatherCodes";

describe("Open-Meteo WMO weather descriptions", () => {
  it.each([
    [0, "Clear sky", "sun"],
    [1, "Mainly clear", "cloud-sun"],
    [2, "Partly cloudy", "cloud-sun"],
    [3, "Overcast", "cloud"],
    [45, "Fog", "fog"],
    [48, "Depositing rime fog", "fog"],
    [51, "Light drizzle", "drizzle"],
    [53, "Moderate drizzle", "drizzle"],
    [55, "Dense drizzle", "drizzle"],
    [56, "Light freezing drizzle", "drizzle"],
    [57, "Dense freezing drizzle", "drizzle"],
    [61, "Slight rain", "rain"],
    [63, "Moderate rain", "rain"],
    [65, "Heavy rain", "rain"],
    [66, "Light freezing rain", "rain"],
    [67, "Heavy freezing rain", "rain"],
    [71, "Slight snowfall", "snow"],
    [73, "Moderate snowfall", "snow"],
    [75, "Heavy snowfall", "snow"],
    [77, "Snow grains", "snow"],
    [80, "Slight rain showers", "rain"],
    [81, "Moderate rain showers", "rain"],
    [82, "Violent rain showers", "rain"],
    [85, "Slight snow showers", "snow"],
    [86, "Heavy snow showers", "snow"],
    [95, "Thunderstorm", "storm"],
    [96, "Thunderstorm with slight hail", "storm"],
    [97, "Heavy thunderstorm", "storm"],
    [99, "Thunderstorm with heavy hail", "storm"],
  ] as const)(
    "maps code %s to its description and icon",
    (code, description, icon) => {
      expect(describeWeather(code, true)).toEqual({ description, icon });
    },
  );
  it.each([null, -1, 4, 999, NaN])(
    "does not invent conditions for %s",
    (code) => {
      expect(describeWeather(code)).toEqual({
        description: "Conditions unavailable",
        icon: "unknown",
      });
    },
  );
  it("uses night icons when is_day is false", () => {
    expect(describeWeather(0, false).icon).toBe("moon");
    expect(describeWeather(2, false).icon).toBe("cloud-moon");
    expect(describeWeather(65, false).icon).toBe("rain");
  });
  it("does not imply daylight when day/night is missing", () => {
    expect(describeWeather(0).icon).toBe("cloud");
  });
});
