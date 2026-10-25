// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { fetchManilaWeather } from "./services/weather";
import type { CurrentWeather } from "./services/weather";

vi.mock("./services/weather", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/weather")>()),
  fetchManilaWeather: vi.fn(),
}));
const fetchWeather = vi.mocked(fetchManilaWeather);
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
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
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
      screen.getByText("Hourly and seven-day forecasts not connected yet"),
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
    const signal = fetchWeather.mock.calls[0][0];
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
