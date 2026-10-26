// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import LocationSearch from "./LocationSearch";
import { searchLocations } from "../services/geocoding";
import type { WeatherLocation } from "../services/locations";

vi.mock("../services/geocoding", () => ({ searchLocations: vi.fn() }));
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
const typeQuery = (value: string) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
const advance = async (ms = 300) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("location search interaction", () => {
  it("debounces 300ms, skipping empty/short input and resetting the timer on each edit", async () => {
    search.mockResolvedValue([]);
    render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("ab");
    await advance(1000);
    expect(search).not.toHaveBeenCalled();
    typeQuery("Ceb");
    await advance(299);
    expect(search).not.toHaveBeenCalled();
    typeQuery("Cebu");
    await advance(299);
    expect(search).not.toHaveBeenCalled();
    await advance(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0]).toBe("Cebu");
    typeQuery("");
    await advance();
    expect(search).toHaveBeenCalledTimes(1);
  });
  it("shows loading then a clear empty state", async () => {
    search.mockResolvedValue([]);
    render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("NoSuchPlace");
    expect(screen.getByText("Searching Philippine locations…")).toBeTruthy();
    await advance();
    expect(screen.getByText(/No Philippine places found/)).toBeTruthy();
  });
  it("shows a failed request and retries the same query", async () => {
    search
      .mockRejectedValueOnce(new Error("Check your connection."))
      .mockResolvedValueOnce(places);
    render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("San Jose");
    await advance();
    expect(screen.getByText("Check your connection.")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry location search" }),
    );
    await advance();
    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[1][0]).toBe("San Jose");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
  it("shows province/region and selects the exact duplicate-name ID by keyboard, retaining input focus", async () => {
    const onSelect = vi.fn();
    search.mockResolvedValue(places);
    render(<LocationSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    input.focus();
    typeQuery("San Jose");
    await advance();
    expect(
      screen.getByText("Occidental Mindoro, Mimaropa, Philippines"),
    ).toBeTruthy();
    expect(
      screen.getByText("Camarines Sur, Bicol Region, Philippines"),
    ).toBeTruthy();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("location-1");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe("location-2");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(places[1]);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(input);
  });
  it("supports clicking a result and closes on Escape or outside focus", async () => {
    const onSelect = vi.fn();
    search.mockResolvedValue(places);
    render(
      <>
        <LocationSearch onSelect={onSelect} />
        <button>Outside</button>
      </>,
    );
    const input = screen.getByRole("combobox");
    input.focus();
    typeQuery("San Jose");
    await advance();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await advance();
    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(onSelect).toHaveBeenCalledWith(places[0]);
    input.focus();
    typeQuery("San Jose");
    await advance();
    fireEvent.blur(input, {
      relatedTarget: screen.getByRole("button", { name: "Outside" }),
    });
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
  it("cancels on edit immediately and ignores older results that arrive during the next debounce", async () => {
    let oldResolve!: (places: WeatherLocation[]) => void;
    search
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldResolve = resolve;
          }),
      )
      .mockResolvedValueOnce([places[1]]);
    render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("San");
    await advance();
    const oldSignal = search.mock.calls[0][1];
    typeQuery("San Jose");
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      oldResolve([places[0]]);
    });
    expect(screen.queryByRole("option")).toBeNull();
    await advance();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.getByText("Camarines Sur, Bicol Region, Philippines"),
    ).toBeTruthy();
  });
  it("keeps newer results when an older successful response arrives last", async () => {
    let oldResolve!: (places: WeatherLocation[]) => void;
    search
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldResolve = resolve;
          }),
      )
      .mockResolvedValueOnce([places[1]]);
    render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("San");
    await advance();
    typeQuery("San Jose");
    await advance();
    await act(async () => {
      oldResolve([places[0]]);
    });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.getByText("Camarines Sur, Bicol Region, Philippines"),
    ).toBeTruthy();
    expect(
      screen.queryByText("Occidental Mindoro, Mimaropa, Philippines"),
    ).toBeNull();
  });
  it("ignores a late error from a cancelled request after newer results arrive", async () => {
    let oldReject!: (error: Error) => void;
    search
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            oldReject = reject;
          }),
      )
      .mockResolvedValueOnce(places);
    render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("San");
    await advance();
    typeQuery("San Jose");
    await advance();
    await act(async () => {
      oldReject(new DOMException("cancelled", "AbortError"));
    });
    expect(
      screen.queryByRole("button", { name: "Retry location search" }),
    ).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
  it("cancels on Escape and does not reopen for a late response", async () => {
    let complete!: (places: WeatherLocation[]) => void;
    search.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("San");
    await advance();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(search.mock.calls[0][1]?.aborted).toBe(true);
    await act(async () => {
      complete(places);
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("aborts on unmount", async () => {
    search.mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<LocationSearch onSelect={vi.fn()} />);
    typeQuery("San");
    await advance();
    const signal = search.mock.calls[0][1];
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});

it("does not select a result when Enter is used to finish IME composition", async () => {
  search.mockResolvedValue(places);
  const select = vi.fn();
  render(<LocationSearch onSelect={select} />);
  typeQuery("San Jose");
  await advance();
  const input = screen.getByRole("combobox");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  const active = input.getAttribute("aria-activedescendant");
  expect(document.getElementById(active!)?.getAttribute("aria-selected")).toBe(
    "true",
  );
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(select).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(select).toHaveBeenCalledWith(places[0]);
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(input.getAttribute("aria-activedescendant")).toBeNull();
  expect(document.activeElement).toBe(input);
});
