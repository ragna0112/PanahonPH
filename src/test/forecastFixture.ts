// Synthetic forecast arrays for tests only. Never imported by production components.
export const FORECAST_NOW = Date.parse("2026-10-25T23:35:00+08:00");
export const DAY_START = Date.parse("2026-10-25T00:00:00+08:00");
export function forecastFixture() {
  return {
    timezone: "Asia/Manila",
    utc_offset_seconds: 28800,
    hourly_units: {
      time: "unixtime",
      temperature_2m: "°C",
      precipitation_probability: "%",
    },
    daily_units: {
      time: "unixtime",
      weather_code: "wmo code",
      temperature_2m_max: "°C",
      temperature_2m_min: "°C",
      precipitation_probability_max: "%",
    },
    hourly: {
      time: Array.from(
        { length: 168 },
        (_, index) => DAY_START / 1000 + index * 3600,
      ),
      temperature_2m: Array<number | null>(168).fill(28),
      precipitation_probability: Array<number | null>(168).fill(40),
    },
    daily: {
      time: Array.from(
        { length: 7 },
        (_, index) => DAY_START / 1000 + index * 86400,
      ),
      weather_code: Array<number | null>(7).fill(3),
      temperature_2m_max: Array<number | null>(7).fill(32),
      temperature_2m_min: Array<number | null>(7).fill(25),
      precipitation_probability_max: Array<number | null>(7).fill(70),
    },
  };
}
