import type { WeatherLocation } from "./locations";

export interface HourlyForecast {
  time: number;
  temperature: number | null;
  precipitationProbability: number | null;
}
export interface DailyForecast {
  time: number;
  weatherCode: number | null;
  high: number | null;
  low: number | null;
  precipitationProbabilityMax: number | null;
}
export interface Forecast {
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  fetchedAt: number;
}
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const hourlyFields = { temperature_2m: "°C", precipitation_probability: "%" };
const dailyFields = {
  weather_code: "wmo code",
  temperature_2m_max: "°C",
  temperature_2m_min: "°C",
  precipitation_probability_max: "%",
};
const invalid = () =>
  new Error("Open-Meteo returned invalid forecast data. Please retry.");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function manilaDateKey(time: number): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(time);
  const part = (name: string) =>
    parts.find((value) => value.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function manilaDayStart(time: number): number {
  return Date.parse(`${manilaDateKey(time)}T00:00:00+08:00`);
}
export function formatForecastDate(time: number): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(time);
}
export function formatForecastHour(time: number): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hour12: true,
  }).format(time);
}

function times(value: unknown, step: number): number[] {
  if (!Array.isArray(value) || !value.length) throw invalid();
  const parsed: number[] = [];
  for (const item of value) {
    if (
      typeof item !== "number" ||
      !Number.isSafeInteger(item) ||
      item <= 0 ||
      !Number.isFinite(new Date(item * 1000).getTime())
    )
      throw invalid();
    const time = item * 1000;
    if (
      time % HOUR !== 0 ||
      (parsed.length > 0 && time - parsed[parsed.length - 1] !== step)
    )
      throw invalid();
    if (step === DAY && manilaDayStart(time) !== time) throw invalid();
    parsed.push(time);
  }
  return parsed;
}
function series(
  group: Record<string, unknown>,
  units: Record<string, unknown>,
  field: string,
  unit: string,
  length: number,
): (number | null)[] {
  const value = group[field];
  // An omitted series is unavailable for every timestamp; a mismatched array is malformed.
  if (value === undefined || value === null)
    return Array<number | null>(length).fill(null);
  if (!Array.isArray(value) || value.length !== length || units[field] !== unit)
    throw invalid();
  return Array.from(value, (entry: unknown) => {
    if (entry === null || entry === undefined) return null;
    if (typeof entry !== "number" || !Number.isFinite(entry)) throw invalid();
    if (unit === "%" && (entry < 0 || entry > 100)) throw invalid();
    if (unit === "wmo code" && (!Number.isInteger(entry) || entry < 0))
      throw invalid();
    return entry;
  });
}

export function parseForecast(body: unknown, fetchedAt: number): Forecast {
  if (
    !isRecord(body) ||
    body.error === true ||
    body.timezone !== "Asia/Manila" ||
    !isRecord(body.hourly) ||
    !isRecord(body.daily) ||
    !isRecord(body.hourly_units) ||
    !isRecord(body.daily_units) ||
    body.hourly_units.time !== "unixtime" ||
    body.daily_units.time !== "unixtime"
  )
    throw invalid();
  const hourlyTimes = times(body.hourly.time, HOUR);
  const dailyTimes = times(body.daily.time, DAY);
  const temperature = series(
    body.hourly,
    body.hourly_units,
    "temperature_2m",
    "°C",
    hourlyTimes.length,
  );
  const probability = series(
    body.hourly,
    body.hourly_units,
    "precipitation_probability",
    "%",
    hourlyTimes.length,
  );
  const codes = series(
    body.daily,
    body.daily_units,
    "weather_code",
    "wmo code",
    dailyTimes.length,
  );
  const highs = series(
    body.daily,
    body.daily_units,
    "temperature_2m_max",
    "°C",
    dailyTimes.length,
  );
  const lows = series(
    body.daily,
    body.daily_units,
    "temperature_2m_min",
    "°C",
    dailyTimes.length,
  );
  const maxProbability = series(
    body.daily,
    body.daily_units,
    "precipitation_probability_max",
    "%",
    dailyTimes.length,
  );
  const hourly = hourlyTimes.map((time, index) => ({
    time,
    temperature: temperature[index],
    precipitationProbability: probability[index],
  }));
  const daily = dailyTimes.map((time, index) => {
    if (
      highs[index] !== null &&
      lows[index] !== null &&
      highs[index] < lows[index]
    )
      throw invalid();
    return {
      time,
      weatherCode: codes[index],
      high: highs[index],
      low: lows[index],
      precipitationProbabilityMax: maxProbability[index],
    };
  });
  const forecast = { hourly, daily, fetchedAt };
  if (!selectForecastWindow(forecast, fetchedAt))
    throw new Error(
      "The forecast does not cover the next 24 hours and seven days. Please retry for an up-to-date forecast.",
    );
  return forecast;
}

// Keep the complete validated response in memory, and select the visible window separately.
export function selectForecastWindow(
  forecast: Forecast,
  now: number,
): Forecast | null {
  const startHour = Math.floor(now / HOUR) * HOUR;
  const startDay = manilaDayStart(now);
  const hourly = forecast.hourly.filter(
    (point) => point.time >= startHour && point.time < startHour + DAY,
  );
  const daily = forecast.daily.filter(
    (point) => point.time >= startDay && point.time < startDay + 7 * DAY,
  );
  if (
    hourly.length !== 24 ||
    hourly[0].time !== startHour ||
    daily.length !== 7 ||
    daily[0].time !== startDay
  )
    return null;
  return { hourly, daily, fetchedAt: forecast.fetchedAt };
}

export async function fetchForecast(
  location: WeatherLocation,
  signal?: AbortSignal,
): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: Object.keys(hourlyFields).join(","),
    daily: Object.keys(dailyFields).join(","),
    temperature_unit: "celsius",
    timezone: "Asia/Manila",
    timeformat: "unixtime",
    forecast_days: "8",
  });
  const timeout = AbortSignal.timeout(15_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { signal: requestSignal },
    );
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "Forecast requests are limited. Wait a moment, then retry."
          : `Forecast request failed (HTTP ${response.status}). Please retry.`,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (requestSignal.aborted) throw requestSignal.reason;
      throw new Error(
        "Open-Meteo returned unreadable forecast data. Please retry.",
      );
    }
    return parseForecast(body, Date.now());
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted)
      throw new Error("The forecast request timed out. Please retry.");
    if (error instanceof TypeError)
      throw new Error(
        "Unable to load forecasts. Check your connection and retry.",
      );
    throw error;
  }
}
