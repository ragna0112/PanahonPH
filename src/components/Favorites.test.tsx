// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Favorites from "./Favorites";
import { MANILA } from "../services/locations";
import { FAVORITES_KEY, serializeFavorites } from "../services/favorites";
let entries: Map<string, string>;
let storage: Storage;
beforeEach(() => {
  entries = new Map();
  storage = {
    getItem: vi.fn((key) => entries.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      entries.set(key, value);
    }),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };
  vi.spyOn(window, "localStorage", "get").mockReturnValue(storage);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("saves, persists after remount, selects and removes without changing the displayed location", () => {
  const onSelect = vi.fn();
  const first = render(<Favorites location={MANILA} onSelect={onSelect} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Save Manila to favorites" }),
  );
  expect(entries.get(FAVORITES_KEY)).toBe(serializeFavorites([MANILA]));
  first.unmount();
  render(<Favorites location={MANILA} onSelect={onSelect} />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Select Manila, Metro Manila, Philippines",
    }),
  );
  expect(onSelect).toHaveBeenCalledWith(MANILA);
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Manila from favorites" }),
  );
  expect(screen.getByText(/Save this location/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Save Manila to favorites" }),
  ).toBeTruthy();
  expect(onSelect).toHaveBeenCalledTimes(1);
});
it("treats the same ID with new labels/coordinates as the same favorite", () => {
  entries.set(FAVORITES_KEY, serializeFavorites([MANILA]));
  render(
    <Favorites
      location={{ ...MANILA, name: "City of Manila", latitude: 14.6042 }}
      onSelect={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", {
      name: "Remove City of Manila from favorites",
    }),
  ).toBeTruthy();
  expect(screen.getByText("1 saved")).toBeTruthy();
});
it("recovers malformed JSON", () => {
  entries.set(FAVORITES_KEY, "broken");
  render(<Favorites location={MANILA} onSelect={vi.fn()} />);
  expect(screen.getByText(/could not be read/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Save Manila to favorites" }),
  );
  expect(screen.getByText("1 saved")).toBeTruthy();
});
it("keeps session save/remove usable when storage cannot be read or written", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  render(<Favorites location={MANILA} onSelect={vi.fn()} />);
  expect(screen.getByText(/storage is unavailable/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Save Manila to favorites" }),
  );
  expect(screen.getByText("1 saved")).toBeTruthy();
  expect(screen.getByText(/Changes could not be saved/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Manila from favorites" }),
  );
  expect(screen.getByText("0 saved")).toBeTruthy();
});
it("handles quota errors without rolling back session favorites", () => {
  vi.mocked(storage.setItem).mockImplementation(() => {
    throw new DOMException("full", "QuotaExceededError");
  });
  render(<Favorites location={MANILA} onSelect={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Save Manila to favorites" }),
  );
  expect(screen.getByText("1 saved")).toBeTruthy();
  expect(screen.getByText(/Changes could not be saved/)).toBeTruthy();
});
