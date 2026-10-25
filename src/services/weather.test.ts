import { MANILA } from "./locations";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCurrentWeather,
  formatManilaTime,
  parseCurrentWeather,
} from "./weather";

// Synthetic fixtures for tests only; never imported into the dashboard.
function fixture() {
  return {
    timezone: "Asia/Manila",
    current_units: {
      time: "unixtime",
      temperature_2m: "°C",
      apparent_temperature: "°C",
      relative_humidity_2m: "%",
      wind_speed_10m: "km/h",
      weather_code: "wmo code",
      is_day: "",
    },
    current: {
      time: 1792929600,
      temperature_2m: 30.2,
      apparent_temperature: 34.1,
      relative_humidity_2m: 74,
      wind_speed_10m: 8.5,
      weather_code: 3,
      is_day: 0,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("current-weather API", () => {
  it("uses selected coordinates rather than the name or Manila coordinates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(fixture())));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCurrentWeather({
      id: 2,
      name: "San Jose",
      latitude: 13.88,
      longitude: 123.51,
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("latitude")).toBe("13.88");
    expect(url.searchParams.get("longitude")).toBe("123.51");
    expect(url.searchParams.has("name")).toBe(false);
  });
  it("requests only current fields with explicit Manila timezone and metric units", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(fixture())));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValueOnce(1792930000000);
    const data = await fetchCurrentWeather(MANILA);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: "14.5995",
      longitude: "120.9842",
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      timezone: "Asia/Manila",
      timeformat: "unixtime",
    });
    expect(data).toEqual({
      temperature: 30.2,
      feelsLike: 34.1,
      humidity: 74,
      windSpeed: 8.5,
      weatherCode: 3,
      isDay: false,
      validAt: 1792929600000,
      fetchedAt: 1792930000000,
    });
    vi.restoreAllMocks();
  });
  it.each([400, 500, 503])(
    "rejects HTTP %s rather than rendering an error body",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("unavailable", { status })),
      );
      await expect(fetchCurrentWeather(MANILA)).rejects.toThrow(
        `HTTP ${status}`,
      );
    },
  );
  it("gives a useful rate-limit error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    await expect(fetchCurrentWeather(MANILA)).rejects.toThrow("request limit");
  });
  it("explains network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(fetchCurrentWeather(MANILA)).rejects.toThrow(
      "Check your connection",
    );
  });
  it("rejects malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(fetchCurrentWeather(MANILA)).rejects.toThrow(
      "unreadable data",
    );
  });
  it.each([
    null,
    [],
    {},
    { error: true },
    { ...fixture(), timezone: "UTC" },
    { ...fixture(), current: null },
  ])("rejects an invalid response envelope: %j", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body))),
    );
    await expect(fetchCurrentWeather(MANILA)).rejects.toThrow(
      "unexpected response",
    );
  });
  it("times out a stalled request", async () => {
    const NativeSignal = AbortSignal;
    const timeout = NativeSignal.abort(
      new DOMException("timeout", "TimeoutError"),
    );
    vi.stubGlobal("AbortSignal", {
      timeout: () => timeout,
      any: NativeSignal.any,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout.reason));
    await expect(fetchCurrentWeather(MANILA)).rejects.toThrow("timed out");
  });
  it("preserves cancellation for the caller", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options: RequestInit) =>
        Promise.reject(options.signal?.reason),
      ),
    );
    await expect(
      fetchCurrentWeather(MANILA, controller.signal),
    ).rejects.toHaveProperty("name", "AbortError");
  });
});

describe("response validation and time", () => {
  it("keeps null and missing values unavailable, preserving real zeroes", () => {
    const body = fixture();
    const partial = {
      ...body,
      current: {
        time: null,
        temperature_2m: null,
        relative_humidity_2m: 0,
        wind_speed_10m: 0,
        weather_code: 0,
        is_day: 1,
      },
    };
    expect(parseCurrentWeather(partial, 42)).toEqual({
      temperature: null,
      feelsLike: null,
      humidity: 0,
      windSpeed: 0,
      weatherCode: 0,
      isDay: true,
      validAt: null,
      fetchedAt: 42,
    });
  });
  it.each(["30", NaN, Infinity, {}])(
    "rejects a non-finite or non-numeric reading: %j",
    (value) => {
      const body = fixture();
      expect(() =>
        parseCurrentWeather(
          { ...body, current: { ...body.current, temperature_2m: value } },
          42,
        ),
      ).toThrow("invalid weather value");
    },
  );
  it.each([
    ["relative_humidity_2m", 101],
    ["wind_speed_10m", -1],
    ["weather_code", 2.5],
    ["is_day", 2],
    ["time", -1],
  ])("rejects invalid %s", (field, value) => {
    const body = fixture();
    expect(() =>
      parseCurrentWeather(
        { ...body, current: { ...body.current, [field]: value } },
        42,
      ),
    ).toThrow("invalid current conditions");
  });
  it("rejects unexpected units rather than mislabeling data", () => {
    const body = fixture();
    expect(() =>
      parseCurrentWeather(
        {
          ...body,
          current_units: { ...body.current_units, temperature_2m: "°F" },
        },
        42,
      ),
    ).toThrow("unexpected units");
  });
  it("formats UTC timestamps in Manila regardless of the device timezone", () => {
    const formatted = formatManilaTime(Date.UTC(2026, 9, 25, 17, 5));
    expect(formatted).toContain("Oct 26, 2026");
    expect(formatted).toContain("1:05:00");
    expect(formatted).toContain("AM");
  });
});
