import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchForecast,
  formatForecastDate,
  formatForecastHour,
  manilaDateKey,
  parseForecast as parseForecastData,
  selectForecastWindow,
} from "./forecast";
import {
  forecastFixture,
  FORECAST_NOW,
  DAY_START,
} from "../test/forecastFixture";
import { MANILA } from "./locations";

const parseForecast = (body: unknown, now: number) =>
  selectForecastWindow(parseForecastData(body, now), now)!;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("forecast parsing and Manila times", () => {
  it("selects 24 hourly points across midnight starting at the current hour", () => {
    const data = parseForecast(forecastFixture(), FORECAST_NOW);
    expect(data.hourly).toHaveLength(24);
    expect(data.hourly[0].time).toBe(Date.parse("2026-10-25T23:00:00+08:00"));
    expect(data.hourly[1].time).toBe(Date.parse("2026-10-26T00:00:00+08:00"));
    expect(data.hourly[23].time).toBe(Date.parse("2026-10-26T22:00:00+08:00"));
    expect(data.daily).toHaveLength(7);
    expect(data.daily[0].time).toBe(DAY_START);
    expect(data.fetchedAt).toBe(FORECAST_NOW);
  });
  it("includes today's midnight hour when fetched at midnight", () => {
    const data = parseForecast(forecastFixture(), DAY_START);
    expect(data.hourly[0].time).toBe(DAY_START);
    expect(data.hourly[23].time).toBe(DAY_START + 23 * 3600000);
  });
  it("labels all seven days and midnight correctly without double-applying UTC+8", () => {
    const data = parseForecast(forecastFixture(), FORECAST_NOW);
    expect(data.daily.map((day) => manilaDateKey(day.time))).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
    expect(formatForecastDate(data.hourly[1].time)).toBe("Mon, Oct 26");
    expect(formatForecastHour(data.hourly[1].time)).toBe("12 AM");
    expect(formatForecastHour(data.hourly[9].time)).toBe("8 AM");
  });
  it("remains in Manila when the host/browser default timezone differs", () => {
    // Force the default formatter to New York; explicit Asia/Manila must still win.
    const NativeFormat = Intl.DateTimeFormat;
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      function (locales, options) {
        return new NativeFormat(locales, {
          timeZone: "America/New_York",
          ...options,
        });
      },
    );
    expect(new Intl.DateTimeFormat("en-US").format(DAY_START)).toBe(
      "10/24/2026",
    );
    expect(manilaDateKey(DAY_START)).toBe("2026-10-25");
    expect(formatForecastDate(DAY_START)).toBe("Sun, Oct 25");
    expect(formatForecastHour(DAY_START)).toBe("12 AM");
  });
  it("preserves nulls and real zero probabilities", () => {
    const body = forecastFixture();
    body.hourly.temperature_2m[23] = null;
    body.hourly.precipitation_probability[23] = 0;
    body.daily.precipitation_probability_max[0] = null;
    const data = parseForecast(body, FORECAST_NOW);
    expect(data.hourly[0]).toMatchObject({
      temperature: null,
      precipitationProbability: 0,
    });
    expect(data.daily[0].precipitationProbabilityMax).toBeNull();
  });
  it("treats entirely omitted or null measurement series as unavailable", () => {
    const body = forecastFixture();
    const data = parseForecast(
      {
        ...body,
        hourly: { time: body.hourly.time, precipitation_probability: null },
        daily: { time: body.daily.time },
      },
      FORECAST_NOW,
    );
    expect(
      data.hourly.every(
        (hour) =>
          hour.temperature === null && hour.precipitationProbability === null,
      ),
    ).toBe(true);
    expect(data.daily[0]).toMatchObject({
      high: null,
      low: null,
      weatherCode: null,
      precipitationProbabilityMax: null,
    });
  });
  it.each([
    null,
    {},
    { error: true },
    { ...forecastFixture(), timezone: "UTC" },
    { ...forecastFixture(), hourly: null },
  ])("rejects an invalid response envelope %j", (body) => {
    expect(() => parseForecast(body, FORECAST_NOW)).toThrow(
      "invalid forecast data",
    );
  });
  it("rejects mismatched array lengths", () => {
    const body = forecastFixture();
    body.hourly.temperature_2m.pop();
    expect(() => parseForecast(body, FORECAST_NOW)).toThrow(
      "invalid forecast data",
    );
    const daily = forecastFixture();
    daily.daily.weather_code.pop();
    expect(() => parseForecast(daily, FORECAST_NOW)).toThrow(
      "invalid forecast data",
    );
  });
  it.each(["28", Infinity, NaN, {}])(
    "rejects malformed readings %j",
    (value) => {
      const body = forecastFixture();
      expect(() =>
        parseForecast(
          {
            ...body,
            hourly: {
              ...body.hourly,
              temperature_2m: body.hourly.temperature_2m.map(() => value),
            },
          },
          FORECAST_NOW,
        ),
      ).toThrow("invalid forecast data");
    },
  );
  it.each([-1, 101])("rejects out-of-range probabilities %s", (value) => {
    const body = forecastFixture();
    body.hourly.precipitation_probability[0] = value;
    expect(() => parseForecast(body, FORECAST_NOW)).toThrow();
    const daily = forecastFixture();
    daily.daily.precipitation_probability_max[0] = value;
    expect(() => parseForecast(daily, FORECAST_NOW)).toThrow();
  });
  it("rejects wrong measurement/time units and invalid daily high/low", () => {
    const body = forecastFixture();
    body.hourly_units.temperature_2m = "°F";
    expect(() => parseForecast(body, FORECAST_NOW)).toThrow();
    const time = forecastFixture();
    time.daily_units.time = "iso8601";
    expect(() => parseForecast(time, FORECAST_NOW)).toThrow();
    const daily = forecastFixture();
    daily.daily.temperature_2m_min[0] = 40;
    expect(() => parseForecast(daily, FORECAST_NOW)).toThrow();
  });
  it.each([null, "2026-10-25", -1, 1e20])(
    "rejects invalid timestamp %j",
    (time) => {
      const body = forecastFixture();
      expect(() =>
        parseForecast(
          {
            ...body,
            hourly: {
              ...body.hourly,
              time: [time, ...body.hourly.time.slice(1)],
            },
          },
          FORECAST_NOW,
        ),
      ).toThrow();
    },
  );
  it("rejects missing, duplicate, unordered, gapped, or misaligned timestamps", () => {
    for (const change of [0, -3600, 7200, 30]) {
      const body = forecastFixture();
      body.hourly.time[1] = body.hourly.time[0] + change;
      expect(() => parseForecast(body, FORECAST_NOW)).toThrow();
    }
    const body = forecastFixture();
    body.daily.time = body.daily.time.map((value) => value + 3600);
    expect(() => parseForecast(body, FORECAST_NOW)).toThrow();
  });
  it("rejects incomplete coverage instead of silently showing fewer than 24 hours/seven days", () => {
    expect(() =>
      parseForecast(forecastFixture(), FORECAST_NOW + 86400000),
    ).toThrow("does not cover");
  });
});

describe("forecast requests", () => {
  it("requests hourly/daily fields for selected coordinates and uses fetch time separately", async () => {
    vi.spyOn(Date, "now").mockReturnValue(FORECAST_NOW);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(forecastFixture())));
    vi.stubGlobal("fetch", fetchMock);
    const data = await fetchForecast({
      id: 2,
      name: "Cebu City",
      latitude: 10.3167,
      longitude: 123.8907,
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: "10.3167",
      longitude: "123.8907",
      hourly: "temperature_2m,precipitation_probability",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: "celsius",
      timezone: "Asia/Manila",
      timeformat: "unixtime",
      forecast_days: "8",
    });
    expect(data.fetchedAt).toBe(FORECAST_NOW);
    expect(url.searchParams.has("current")).toBe(false);
  });
  it.each([400, 503])("reports HTTP %s errors", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status })),
    );
    await expect(fetchForecast(MANILA)).rejects.toThrow(`HTTP ${status}`);
  });
  it("reports rate limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    await expect(fetchForecast(MANILA)).rejects.toThrow("limited");
  });
  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(fetchForecast(MANILA)).rejects.toThrow(
      "Check your connection",
    );
  });
  it("reports unreadable JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid")));
    await expect(fetchForecast(MANILA)).rejects.toThrow(
      "unreadable forecast data",
    );
  });
  it("preserves caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options: RequestInit) =>
        Promise.reject(options.signal?.reason),
      ),
    );
    await expect(
      fetchForecast(MANILA, controller.signal),
    ).rejects.toHaveProperty("name", "AbortError");
  });
  it("reports timeout independently", async () => {
    const NativeSignal = AbortSignal;
    const timeout = NativeSignal.abort(
      new DOMException("timeout", "TimeoutError"),
    );
    vi.stubGlobal("AbortSignal", {
      timeout: () => timeout,
      any: NativeSignal.any,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout.reason));
    await expect(fetchForecast(MANILA)).rejects.toThrow("timed out");
  });
});
