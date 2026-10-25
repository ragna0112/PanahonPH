export interface CurrentWeather {
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  isDay: boolean | null;
  validAt: number | null;
  fetchedAt: number;
}

const fields = {
  temperature_2m: "°C",
  apparent_temperature: "°C",
  relative_humidity_2m: "%",
  wind_speed_10m: "km/h",
  weather_code: "wmo code",
  is_day: "",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      "Open-Meteo returned an invalid weather value. Please retry.",
    );
  }
  return value;
}

export function parseCurrentWeather(
  body: unknown,
  fetchedAt: number,
): CurrentWeather {
  if (
    !isRecord(body) ||
    body.error === true ||
    !isRecord(body.current) ||
    !isRecord(body.current_units) ||
    body.timezone !== "Asia/Manila"
  ) {
    throw new Error(
      "Open-Meteo returned an unexpected response. Please retry.",
    );
  }
  const current = body.current;
  const values: Record<string, number | null> = {};
  for (const [field, unit] of Object.entries(fields)) {
    values[field] = nullableNumber(current[field]);
    if (values[field] !== null && body.current_units[field] !== unit) {
      throw new Error("Open-Meteo returned unexpected units. Please retry.");
    }
  }
  const humidity = values.relative_humidity_2m;
  const wind = values.wind_speed_10m;
  const code = values.weather_code;
  const day = values.is_day;
  const time = nullableNumber(current.time);
  if (
    (humidity !== null && (humidity < 0 || humidity > 100)) ||
    (wind !== null && wind < 0) ||
    (code !== null && (!Number.isInteger(code) || code < 0)) ||
    (day !== null && day !== 0 && day !== 1) ||
    (time !== null &&
      (body.current_units.time !== "unixtime" ||
        time <= 0 ||
        !Number.isFinite(new Date(time * 1000).getTime())))
  ) {
    throw new Error(
      "Open-Meteo returned invalid current conditions. Please retry.",
    );
  }
  return {
    temperature: values.temperature_2m,
    feelsLike: values.apparent_temperature,
    humidity,
    windSpeed: wind,
    weatherCode: code,
    isDay: day === null ? null : day === 1,
    validAt: time === null ? null : time * 1000,
    fetchedAt,
  };
}

export async function fetchManilaWeather(
  signal?: AbortSignal,
): Promise<CurrentWeather> {
  const params = new URLSearchParams({
    latitude: "14.5995",
    longitude: "120.9842",
    current: Object.keys(fields).join(","),
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    timezone: "Asia/Manila",
    timeformat: "unixtime",
  });
  // Timeout also bounds reading the response body. The caller can cancel on unmount.
  const timeout = AbortSignal.timeout(15_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { signal: requestSignal },
    );
    if (!response.ok) {
      throw new Error(
        response.status === 429
          ? "Open-Meteo's request limit was reached. Wait a moment, then retry."
          : `Weather request failed (HTTP ${response.status}). Please retry.`,
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (requestSignal.aborted) throw requestSignal.reason;
      throw new Error("Open-Meteo returned unreadable data. Please retry.");
    }
    return parseCurrentWeather(body, Date.now());
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted)
      throw new Error("The weather request timed out. Please retry.");
    if (error instanceof TypeError)
      throw new Error(
        "Unable to reach Open-Meteo. Check your connection and retry.",
      );
    throw error;
  }
}

export function formatManilaTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(timestamp);
}
