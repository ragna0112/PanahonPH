// @vitest-environment jsdom
import { clearWeatherCache } from "./services/weatherCache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { FAVORITES_KEY, serializeFavorites } from "./services/favorites";
import { fetchCurrentWeather } from "./services/weather";
import { fetchForecast, parseForecast } from "./services/forecast";
import { searchLocations } from "./services/geocoding";
import { MANILA } from "./services/locations";
import type { Forecast } from "./services/forecast";
import { forecastFixture, FORECAST_NOW } from "./test/forecastFixture";

vi.mock("./services/weather", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/weather")>()),
  fetchCurrentWeather: vi.fn(),
}));
vi.mock("./services/forecast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/forecast")>()),
  fetchForecast: vi.fn(),
}));
vi.mock("./services/geocoding", () => ({ searchLocations: vi.fn() }));
const forecastFetch = vi.mocked(fetchForecast);
const currentFetch = vi.mocked(fetchCurrentWeather);
const places = [
  {
    id: 1,
    name: "San Jose",
    latitude: 12.35,
    longitude: 121.07,
    province: "Occidental Mindoro",
  },
  {
    id: 2,
    name: "San Jose",
    latitude: 13.88,
    longitude: 123.51,
    province: "Camarines Sur",
  },
];
const data = (high: number) => {
  const body = forecastFixture();
  body.daily.temperature_2m_max.fill(high);
  return parseForecast(body, FORECAST_NOW);
};
beforeEach(() => {
  const entries = new Map<string, string>();
  vi.spyOn(window, "localStorage", "get").mockReturnValue({
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  });
  vi.spyOn(Date, "now").mockReturnValue(FORECAST_NOW);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return this instanceof HTMLDivElement
        ? new DOMRect(0, 0, 600, 210)
        : new DOMRect(0, 0, 0, 0);
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  currentFetch.mockResolvedValue({
    temperature: 30.2,
    feelsLike: 34.1,
    humidity: 74,
    windSpeed: 8.5,
    weatherCode: 3,
    isDay: true,
    validAt: FORECAST_NOW,
    fetchedAt: FORECAST_NOW,
  });
  vi.mocked(searchLocations).mockResolvedValue(places);
});
afterEach(() => {
  clearWeatherCache();
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function choose(index: number) {
  await userEvent.type(screen.getByRole("combobox"), "San Jose");
  await userEvent.click((await screen.findAllByRole("option"))[index]);
}

describe("forecast requests alongside current weather", () => {
  it("keeps current weather usable when forecasts fail and retries only forecasts", async () => {
    forecastFetch
      .mockRejectedValueOnce(new Error("Forecast HTTP failure."))
      .mockResolvedValueOnce(data(32));
    render(<App />);
    expect(await screen.findByText("30.2°C")).toBeTruthy();
    expect(await screen.findByText("Forecast HTTP failure.")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry forecasts" }),
    );
    expect(await screen.findByText("Seven-day forecast")).toBeTruthy();
    expect(currentFetch).toHaveBeenCalledTimes(1);
    expect(forecastFetch).toHaveBeenCalledTimes(2);
    expect(forecastFetch.mock.calls[1][0]).toEqual(MANILA);
  });
  it("clears the old forecast immediately and ignores responses arriving out of order", async () => {
    let first!: (value: Forecast) => void;
    let second!: (value: Forecast) => void;
    forecastFetch
      .mockResolvedValueOnce(data(32))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            second = resolve;
          }),
      );
    render(<App />);
    await screen.findByText("Seven-day forecast");
    expect(screen.getAllByText("32°C")).toHaveLength(7);
    await choose(0);
    expect(screen.queryByText("32°C")).toBeNull();
    expect(screen.queryByText(/Forecast fetched by this app:/)).toBeNull();
    await waitFor(() => expect(forecastFetch).toHaveBeenCalledTimes(2));
    const oldSignal = forecastFetch.mock.calls[1][1];
    await choose(1);
    expect(oldSignal?.aborted).toBe(true);
    expect(forecastFetch.mock.calls[2][0]).toEqual(places[1]);
    await act(async () => {
      second(data(35));
    });
    expect(await screen.findAllByText("35°C")).toHaveLength(7);
    await act(async () => {
      first(data(33));
    });
    expect(screen.queryByText("33°C")).toBeNull();
    expect(screen.getAllByText("35°C")).toHaveLength(7);
  });
  it("does not show a cancelled forecast error after a new selection succeeds", async () => {
    let rejectOld!: (error: Error) => void;
    forecastFetch
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOld = reject;
          }),
      )
      .mockResolvedValueOnce(data(36));
    render(<App />);
    await waitFor(() => expect(forecastFetch).toHaveBeenCalledTimes(1));
    await choose(1);
    await screen.findByText("Seven-day forecast");
    await act(async () => {
      rejectOld(new DOMException("Cancelled", "AbortError"));
    });
    expect(screen.queryByText("Cancelled")).toBeNull();
    expect(screen.getAllByText("36°C")).toHaveLength(7);
  });
  it("manual refresh bypasses cache, retains readings, deduplicates clicks and preserves current data on partial failure", async () => {
    let failCurrent!: (error: Error) => void;
    let finishForecast!: (forecast: Forecast) => void;
    forecastFetch.mockResolvedValueOnce(data(32)).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishForecast = resolve;
        }),
    );
    render(<App />);
    await screen.findByText("Seven-day forecast");
    const button = await screen.findByRole("button", {
      name: "Refresh current weather and forecasts",
    });
    currentFetch.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failCurrent = reject;
        }),
    );
    fireEvent.click(button);
    fireEvent.click(button);
    expect(currentFetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("30.2°C")).toBeTruthy();
    expect(screen.getAllByText("32°C")).toHaveLength(7);
    await waitFor(() => expect(forecastFetch).toHaveBeenCalledTimes(2));
    await act(async () => {
      failCurrent(new Error("offline"));
      finishForecast({ ...data(37), fetchedAt: FORECAST_NOW + 60_000 });
    });
    expect(screen.getByText(/Current weather refresh failed:/)).toBeTruthy();
    expect(screen.getByText("30.2°C")).toBeTruthy();
    expect(screen.getAllByText("37°C")).toHaveLength(7);
    expect(screen.getByText(/Fetched by this app:/).textContent).toContain(
      "11:35:00 PM",
    );
    expect(
      screen.getByText(/Forecast fetched by this app:/).textContent,
    ).toContain("11:36:00 PM");
  });
  it("keeps forecasts when refresh fails but updates successful current weather", async () => {
    forecastFetch
      .mockResolvedValueOnce(data(32))
      .mockRejectedValueOnce(new Error("forecast offline"));
    render(<App />);
    await screen.findByText("Seven-day forecast");
    currentFetch.mockResolvedValueOnce({
      temperature: 31.3,
      feelsLike: 35,
      humidity: 70,
      windSpeed: 5,
      weatherCode: 3,
      isDay: true,
      validAt: FORECAST_NOW,
      fetchedAt: FORECAST_NOW + 60_000,
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Refresh current weather and forecasts",
      }),
    );
    expect(await screen.findByText("31.3°C")).toBeTruthy();
    expect(await screen.findByText(/Forecast refresh failed:/)).toBeTruthy();
    expect(screen.getAllByText("32°C")).toHaveLength(7);
  });
  it("selects favorites with both resources and reuses fresh cache when switching back", async () => {
    window.localStorage.setItem(
      FAVORITES_KEY,
      serializeFavorites([MANILA, places[1]]),
    );
    forecastFetch.mockResolvedValue(data(32));
    render(<App />);
    await screen.findByText("Seven-day forecast");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select San Jose, Camarines Sur, Philippines",
      }),
    );
    await waitFor(() => expect(forecastFetch).toHaveBeenCalledTimes(2));
    expect(currentFetch.mock.calls[1][0]).toEqual(places[1]);
    expect(forecastFetch.mock.calls[1][0]).toEqual(places[1]);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select Manila, Metro Manila, Philippines",
      }),
    );
    await screen.findByText("Seven-day forecast");
    expect(currentFetch).toHaveBeenCalledTimes(2);
    expect(forecastFetch).toHaveBeenCalledTimes(2);
  });
});
