// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import ForecastPanel from "./ForecastPanel";
import { fetchForecast, parseForecast } from "../services/forecast";
import {
  FORECAST_NOW,
  DAY_START,
  forecastFixture,
} from "../test/forecastFixture";
import { MANILA } from "../services/locations";
import { clearWeatherCache } from "../services/weatherCache";
vi.mock("../services/forecast", async (original) => ({
  ...(await original<typeof import("../services/forecast")>()),
  fetchForecast: vi.fn(),
}));
const fetchMock = vi.mocked(fetchForecast);
const data = (days = 8) => {
  const body = forecastFixture();
  body.hourly.time = Array.from(
    { length: days * 24 },
    (_, i) => DAY_START / 1000 + i * 3600,
  );
  body.hourly.temperature_2m = Array(days * 24).fill(28);
  body.hourly.precipitation_probability = Array(days * 24).fill(40);
  body.daily.time = Array.from(
    { length: days },
    (_, i) => DAY_START / 1000 + i * 86400,
  );
  body.daily.weather_code = Array(days).fill(3);
  body.daily.temperature_2m_max = Array(days).fill(32);
  body.daily.temperature_2m_min = Array(days).fill(25);
  body.daily.precipitation_probability_max = Array(days).fill(70);
  return parseForecast(body, FORECAST_NOW);
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FORECAST_NOW);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, 600, 210),
  );
});
afterEach(() => {
  cleanup();
  clearWeatherCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
it("moves hourly and daily windows at Manila midnight without fetching if retained arrays cover them", async () => {
  fetchMock.mockResolvedValue(data());
  render(<ForecastPanel location={MANILA} />);
  await settle();
  fireEvent.click(screen.getByText("View all 24 hourly values as a table"));
  expect(screen.getAllByRole("article")[0].getAttribute("aria-label")).toBe(
    "Sun, Oct 25",
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(25 * 60_000 + 100);
  });
  expect(screen.getAllByRole("article")[0].getAttribute("aria-label")).toBe(
    "Mon, Oct 26",
  );
  const rows = screen.getAllByRole("row");
  expect(rows[1].textContent).toContain("Mon, Oct 26 · 12 AM");
  expect(rows[24].textContent).toContain("Mon, Oct 26 · 11 PM");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("rechecks when returning from a hidden tab and fetches once for insufficient coverage, without repeated retries", async () => {
  fetchMock
    .mockResolvedValueOnce(data(7))
    .mockRejectedValue(new Error("offline"));
  render(<ForecastPanel location={MANILA} />);
  await settle();
  const hidden = vi.spyOn(document, "hidden", "get");
  hidden.mockReturnValue(true);
  vi.setSystemTime(Date.parse("2026-10-26T02:30:00+08:00"));
  fireEvent(document, new Event("visibilitychange"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Seven-day forecast")).toBeNull();
  expect(screen.getByText(/Earlier forecast fetched:/)).toBeTruthy();
  fireEvent(window, new Event("focus"));
  fireEvent(document, new Event("visibilitychange"));
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("fetches replacement arrays once when midnight needs an uncovered seventh day", async () => {
  const next = data(8);
  next.hourly = next.hourly.map((point) => ({
    ...point,
    time: point.time + 86_400_000,
  }));
  next.daily = next.daily.map((point) => ({
    ...point,
    time: point.time + 86_400_000,
  }));
  next.fetchedAt = DAY_START + 86_400_000 + 50;
  fetchMock.mockResolvedValueOnce(data(7)).mockResolvedValueOnce(next);
  render(<ForecastPanel location={MANILA} />);
  await settle();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(25 * 60_000 + 100);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole("article")[0].getAttribute("aria-label")).toBe(
    "Mon, Oct 26",
  );
  expect(screen.getAllByRole("article")[6].getAttribute("aria-label")).toBe(
    "Sun, Nov 1",
  );
});
it("advances at a normal hour and rechecks a covered window on tab return without new requests", async () => {
  const start = DAY_START + 10 * 3_600_000 + 55 * 60_000;
  vi.setSystemTime(start);
  fetchMock.mockResolvedValue({ ...data(), fetchedAt: start });
  render(<ForecastPanel location={MANILA} />);
  await settle();
  fireEvent.click(screen.getByText("View all 24 hourly values as a table"));
  expect(screen.getAllByRole("row")[1].textContent).toContain("10 AM");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 100);
  });
  expect(screen.getAllByRole("row")[1].textContent).toContain("11 AM");
  vi.setSystemTime(DAY_START + 25 * 3_600_000);
  fireEvent(document, new Event("visibilitychange"));
  await settle();
  expect(screen.getAllByRole("row")[1].textContent).toContain(
    "Mon, Oct 26 · 1 AM",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("cleans up listeners and boundary timer on unmount", async () => {
  fetchMock.mockResolvedValue(data());
  const remove = vi.spyOn(document, "removeEventListener");
  const panel = render(<ForecastPanel location={MANILA} />);
  await settle();
  panel.unmount();
  expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  const calls = fetchMock.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_600_000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});
