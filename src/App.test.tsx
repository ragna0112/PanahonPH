// @vitest-environment jsdom
import { clearWeatherCache } from "./services/weatherCache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { fetchCurrentWeather } from "./services/weather";
import type { CurrentWeather } from "./services/weather";

vi.mock("./services/forecast", () => ({
  fetchForecast: vi.fn(() => new Promise(() => {})),
}));
vi.mock("./services/weather", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/weather")>()),
  fetchCurrentWeather: vi.fn(),
}));
const fetchWeather = vi.mocked(fetchCurrentWeather);
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

describe("current-weather dashboard", () => {
  it("shows loading without fabricated readings, then renders the service result", async () => {
    let complete!: (value: CurrentWeather) => void;
    fetchWeather.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<App />);
    expect(
      screen.getByText("Loading current weather from Open-Meteo."),
    ).toBeTruthy();
    expect(screen.queryByText("30.2°C")).toBeNull();
    complete(weather);
    expect(await screen.findByText("30.2°C")).toBeTruthy();
    expect(screen.getByText(/Model data valid at:/)).toBeTruthy();
    expect(screen.getByText(/Fetched by this app:/)).toBeTruthy();
    expect(screen.getByText(/Not a station observation/)).toBeTruthy();
    expect(
      screen.getByText("Loading hourly and seven-day forecasts…"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Weather data by Open-Meteo.com" })
        .getAttribute("href"),
    ).toBe("https://open-meteo.com/");
  });
  it("retries a failed request and clears the error when real data arrives", async () => {
    fetchWeather
      .mockRejectedValueOnce(new Error("Network unavailable. Please retry."))
      .mockResolvedValueOnce(weather);
    render(<App />);
    expect(
      await screen.findByText("Network unavailable. Please retry."),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry weather request" }),
    );
    expect(await screen.findByText("30.2°C")).toBeTruthy();
    expect(fetchWeather).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Network unavailable. Please retry.")).toBeNull();
  });
  it("keeps repeated failures retryable", async () => {
    fetchWeather.mockRejectedValue(new Error("Service unavailable."));
    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Retry weather request" }),
    );
    await waitFor(() => expect(fetchWeather).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("button", { name: "Retry weather request" }),
    ).toBeTruthy();
  });
  it("shows missing data honestly, including missing model time", async () => {
    fetchWeather.mockResolvedValue({
      ...weather,
      temperature: null,
      feelsLike: null,
      humidity: null,
      windSpeed: null,
      weatherCode: null,
      validAt: null,
    });
    render(<App />);
    expect(await screen.findByText(/Some data is unavailable/)).toBeTruthy();
    expect(screen.getByText(/Model data valid at:/).textContent).toContain(
      "Unavailable",
    );
    expect(screen.queryByText("30.2°C")).toBeNull();
    expect(screen.getAllByText("—").length).toBe(4);
    expect(screen.getAllByText("Conditions unavailable").length).toBe(2);
  });
  it("cancels requests on unmount", () => {
    fetchWeather.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<App />);
    const signal = fetchWeather.mock.calls[0][1];
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

it("provides landmarks, a focusable skip target, a selected-place heading, and concise status", async () => {
  fetchWeather.mockResolvedValue(weather);
  render(<App />);
  await screen.findByText("30.2°C");
  const main = screen.getByRole("main");
  expect(main.tabIndex).toBe(-1);
  expect(
    screen.getByRole("link", { name: "Skip to content" }).getAttribute("href"),
  ).toBe("#main");
  expect(
    screen.getByRole("heading", {
      level: 2,
      name: "Manila Metro Manila, Philippines",
    }),
  ).toBeTruthy();
  const status = screen.getByText("Current weather for Manila updated.");
  expect(status.getAttribute("role")).toBe("status");
  expect(status.textContent).not.toContain("30.2");
  // Canvas-dependent contrast/visible-label checks run in the real browser instead.
  const results = await axe.run(document.body, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    rules: {
      "color-contrast": { enabled: false },
      "label-content-name-mismatch": { enabled: false },
    },
  });
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
it("keeps keyboard focus on the location heading when retry removes its button", async () => {
  fetchWeather
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(weather);
  render(<App />);
  const retry = await screen.findByRole("button", {
    name: "Retry weather request",
  });
  retry.focus();
  await userEvent.keyboard("{Enter}");
  await screen.findByText("30.2°C");
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "Manila Metro Manila, Philippines" }),
  );
});
