// @vitest-environment jsdom
import { clearWeatherCache } from "./services/weatherCache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { fetchCurrentWeather } from "./services/weather";
import { searchLocations } from "./services/geocoding";
import { MANILA } from "./services/locations";
import type { WeatherLocation } from "./services/locations";
import type { CurrentWeather } from "./services/weather";

vi.mock("./services/forecast", () => ({
  fetchForecast: vi.fn(() => new Promise(() => {})),
}));
vi.mock("./services/geocoding", () => ({ searchLocations: vi.fn() }));
vi.mock("./services/weather", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/weather")>()),
  fetchCurrentWeather: vi.fn(),
}));
const weatherFetch = vi.mocked(fetchCurrentWeather);
const search = vi.mocked(searchLocations);
const places: WeatherLocation[] = [
  {
    id: 1,
    name: "San Jose",
    latitude: 12.35,
    longitude: 121.07,
    province: "Occidental Mindoro",
    region: "Mimaropa",
  },
  {
    id: 2,
    name: "San Jose",
    latitude: 13.88,
    longitude: 123.51,
    province: "Camarines Sur",
    region: "Bicol Region",
  },
];
const weather: CurrentWeather = {
  temperature: 30.2,
  feelsLike: 34.1,
  humidity: 74,
  windSpeed: 8.5,
  weatherCode: 3,
  isDay: true,
  validAt: 1792929600000,
  fetchedAt: 1792930000000,
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
});
afterEach(() => {
  clearWeatherCache();
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});
async function select(index: number) {
  await userEvent.type(screen.getByRole("combobox"), "San Jose");
  const options = await screen.findAllByRole("option");
  await userEvent.click(options[index]);
}

describe("selected location and its weather", () => {
  it("starts in Manila, uses the selected place object, and hides old weather immediately", async () => {
    search.mockResolvedValue(places);
    weatherFetch
      .mockResolvedValueOnce(weather)
      .mockImplementationOnce(() => new Promise(() => {}));
    const { container } = render(<App />);
    await screen.findByText("30.2°C");
    expect(weatherFetch.mock.calls[0][0]).toEqual(MANILA);
    await select(1);
    expect(container.querySelector(".location")?.textContent).toContain(
      "San Jose",
    );
    expect(container.querySelector(".location")?.textContent).toContain(
      "Camarines Sur",
    );
    expect(screen.queryByText("30.2°C")).toBeNull();
    expect(screen.queryByText("34.1°C")).toBeNull();
    expect(screen.queryByText(/Fetched by this app:/)).toBeNull();
    expect(
      screen.getByText("Loading current weather from Open-Meteo."),
    ).toBeTruthy();
    expect(weatherFetch.mock.calls[1][0]).toEqual(places[1]);
  });
  it("uses IDs for duplicate names and ignores out-of-order weather during rapid switching", async () => {
    search.mockResolvedValue(places);
    let resolveFirst!: (data: CurrentWeather) => void;
    let resolveSecond!: (data: CurrentWeather) => void;
    weatherFetch
      .mockResolvedValueOnce(weather)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const { container } = render(<App />);
    await screen.findByText("30.2°C");
    await select(0);
    const firstSignal = weatherFetch.mock.calls[1][1];
    await select(1);
    expect(firstSignal?.aborted).toBe(true);
    expect(weatherFetch.mock.calls[2][0]).toEqual(places[1]);
    await act(async () => {
      resolveSecond({ ...weather, temperature: 25 });
    });
    expect(await screen.findByText("25°C")).toBeTruthy();
    await act(async () => {
      resolveFirst({ ...weather, temperature: 35 });
    });
    expect(screen.queryByText("35°C")).toBeNull();
    expect(screen.getByText("25°C")).toBeTruthy();
    expect(container.querySelector(".location")?.textContent).toContain(
      "Camarines Sur",
    );
  });
  it("ignores cancelled weather errors and retries weather for the selected coordinates", async () => {
    search.mockResolvedValue(places);
    let rejectManila!: (error: Error) => void;
    weatherFetch
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectManila = reject;
          }),
      )
      .mockRejectedValueOnce(new Error("New location temporarily unavailable."))
      .mockResolvedValueOnce({ ...weather, temperature: 27 });
    render(<App />);
    await select(0);
    await act(async () => {
      rejectManila(new DOMException("cancelled", "AbortError"));
    });
    expect(
      await screen.findByText("New location temporarily unavailable."),
    ).toBeTruthy();
    expect(screen.queryByText("cancelled")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry weather request" }),
    );
    await waitFor(() =>
      expect(weatherFetch.mock.calls[2][0]).toEqual(places[0]),
    );
    expect(await screen.findByText("27°C")).toBeTruthy();
  });
});
