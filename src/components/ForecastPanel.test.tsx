// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForecastPanel, { ForecastTooltip } from "./ForecastPanel";
import { fetchForecast, parseForecast } from "../services/forecast";
import { MANILA } from "../services/locations";
import { forecastFixture, FORECAST_NOW } from "../test/forecastFixture";
import type { Forecast } from "../services/forecast";

vi.mock("../services/forecast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/forecast")>()),
  fetchForecast: vi.fn(),
}));
const fetchMock = vi.mocked(fetchForecast);
const data = () => parseForecast(forecastFixture(), FORECAST_NOW);
beforeEach(() => {
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
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("forecast presentation", () => {
  it("shows loading without readings, then aligned charts, seven daily cards, and all 24 table rows", async () => {
    let complete!: (data: Forecast) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const { container } = render(<ForecastPanel location={MANILA} />);
    expect(
      screen.getByText("Loading hourly and seven-day forecasts…"),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    await act(async () => {
      complete(data());
    });
    expect(screen.getByText("Hourly temperature")).toBeTruthy();
    expect(screen.getByText("Hourly precipitation probability")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(container.querySelectorAll(".daily-card")).toHaveLength(7);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText(/not rainfall amount \(mm\)/)).toBeTruthy();
    expect(screen.getAllByText("Max precipitation probability")).toHaveLength(
      7,
    );
    expect(screen.getByText(/Forecast fetched by this app:/)).toBeTruthy();
    expect(
      screen.getByText(/Fetch time is not the model run time/),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByText("View all 24 hourly values as a table"),
    );
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(25);
    expect(
      within(table).getByRole("columnheader", { name: "Temperature (°C)" }),
    ).toBeTruthy();
    expect(
      within(table).getByRole("columnheader", {
        name: "Precipitation probability (%)",
      }),
    ).toBeTruthy();
    expect(within(table).getByText("Mon, Oct 26 · 12 AM")).toBeTruthy();
    expect(within(table).getAllByText("40%")).toHaveLength(24);
    // A fixed 0–100% axis is rendered by Recharts, independent of the data's range.
    await waitFor(() =>
      expect(
        container.querySelectorAll(".recharts-yAxis-tick-labels"),
      ).toHaveLength(2),
    );
    const probabilityAxis = container.querySelectorAll(
      ".recharts-yAxis-tick-labels",
    )[1];
    expect(probabilityAxis.textContent).toContain("100");
    expect(probabilityAxis.textContent).toContain("0");
  });
  it("preserves missing values in cards/table and leaves separate chart segments", async () => {
    const body = forecastFixture();
    body.hourly.temperature_2m[28] = null;
    body.hourly.precipitation_probability[28] = null;
    body.daily.temperature_2m_max[0] = null;
    body.daily.weather_code[0] = null;
    body.daily.precipitation_probability_max[0] = null;
    fetchMock.mockResolvedValue(parseForecast(body, FORECAST_NOW));
    const { container } = render(<ForecastPanel location={MANILA} />);
    await screen.findByText("Seven-day forecast");
    expect(screen.getByText("Conditions unavailable")).toBeTruthy();
    const today = screen.getByRole("article", { name: "Sun, Oct 25" });
    expect(within(today).getAllByText("Unavailable")).toHaveLength(2);
    await userEvent.click(
      screen.getByText("View all 24 hourly values as a table"),
    );
    const row = screen.getByRole("row", { name: /Mon, Oct 26 · 4 AM/ });
    expect(within(row).getAllByText("—")).toHaveLength(2);
    await waitFor(() =>
      expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(
        2,
      ),
    );
    for (const path of container.querySelectorAll(".recharts-line-curve")) {
      // A missing middle point produces two SVG subpaths, rather than connecting across it.
      expect((path.getAttribute("d")?.match(/M/g) ?? []).length).toBe(2);
    }
  });
  it("shows errors with a working retry for the same location", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("Forecast service unavailable."))
      .mockResolvedValueOnce(data());
    render(<ForecastPanel location={MANILA} />);
    expect(
      await screen.findByText("Forecast service unavailable."),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry forecasts" }),
    );
    expect(await screen.findByText("Seven-day forecast")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toEqual(MANILA);
  });
  it("cancels its request on unmount", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<ForecastPanel location={MANILA} />);
    const signal = fetchMock.mock.calls[0][1];
    unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("tooltips include date, Manila time, value and units, and handle missing readings", () => {
    const { rerender } = render(
      <ForecastTooltip
        active
        timestamp={Date.parse("2026-10-25T16:00:00Z")}
        value={40}
        unit="%"
      />,
    );
    expect(screen.getByText("Mon, Oct 26 · 12 AM")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("Asia/Manila")).toBeTruthy();
    rerender(
      <ForecastTooltip
        active
        timestamp={Date.parse("2026-10-25T16:00:00Z")}
        value={28.1}
        unit="°C"
      />,
    );
    expect(screen.getByText("28.1°C")).toBeTruthy();
    rerender(
      <ForecastTooltip
        active
        timestamp={FORECAST_NOW}
        value={null}
        unit="°C"
      />,
    );
    expect(screen.getByText("Unavailable")).toBeTruthy();
  });
});
