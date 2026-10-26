// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useWeatherResource } from "./useWeatherResource";
import {
  CACHE_FRESH_MS,
  CACHE_LOCATION_LIMIT,
  clearWeatherCache,
  readCache,
  writeCache,
} from "../services/weatherCache";
import { MANILA } from "../services/locations";
import type { CurrentWeather } from "../services/weather";
const NOW = Date.parse("2026-10-26T10:00:00+08:00");
const weather = (temp = 30): CurrentWeather => ({
  temperature: temp,
  feelsLike: 34,
  humidity: 70,
  windSpeed: 5,
  weatherCode: 3,
  isDay: true,
  validAt: NOW,
  fetchedAt: Date.now(),
});
const cebu = {
  id: 1717512,
  name: "Cebu City",
  latitude: 10.3167,
  longitude: 123.8907,
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  clearWeatherCache();
  vi.useRealTimers();
});
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
it("reuses fresh cached readings with original fetch time, expires after five minutes, and bypasses on manual refresh", async () => {
  const loader = vi.fn().mockImplementation(async () => weather());
  const hook = renderHook(
    ({ place }) => useWeatherResource(place, "current", loader),
    { initialProps: { place: MANILA } },
  );
  await flush();
  expect(loader).toHaveBeenCalledTimes(1);
  hook.rerender({ place: cebu });
  await flush();
  expect(loader).toHaveBeenCalledTimes(2);
  vi.setSystemTime(NOW + 60_000);
  hook.rerender({ place: MANILA });
  await flush();
  expect(loader).toHaveBeenCalledTimes(2);
  expect(hook.result.current.data?.fetchedAt).toBe(NOW);
  act(() => hook.result.current.refresh());
  await flush();
  expect(loader).toHaveBeenCalledTimes(3);
  expect(hook.result.current.data?.fetchedAt).toBe(NOW + 60_000);
  hook.rerender({ place: cebu });
  await flush();
  vi.setSystemTime(NOW + 60_000 + CACHE_FRESH_MS);
  hook.rerender({ place: MANILA });
  await flush();
  expect(loader).toHaveBeenCalledTimes(4);
});
it("deduplicates in-flight refresh clicks, retains previous readings and timestamps on failure", async () => {
  let reject!: (error: Error) => void;
  const loader = vi
    .fn()
    .mockResolvedValueOnce(weather())
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
  const hook = renderHook(() => useWeatherResource(MANILA, "current", loader));
  await flush();
  act(() => {
    hook.result.current.refresh();
    hook.result.current.refresh();
    hook.result.current.refresh();
  });
  expect(loader).toHaveBeenCalledTimes(2);
  expect(hook.result.current.data?.temperature).toBe(30);
  expect(hook.result.current.pending).toBe(true);
  await act(async () => {
    reject(new Error("offline"));
  });
  expect(hook.result.current.error).toBe("offline");
  expect(hook.result.current.data?.fetchedAt).toBe(NOW);
});
it("cancels a switched request and never caches a late result under either location", async () => {
  let old!: (data: CurrentWeather) => void;
  const loader = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          old = resolve;
        }),
    )
    .mockResolvedValueOnce(weather(25));
  const hook = renderHook(
    ({ place }) => useWeatherResource(place, "current", loader),
    { initialProps: { place: MANILA } },
  );
  const signal = loader.mock.calls[0][1];
  hook.rerender({ place: cebu });
  await flush();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    old(weather(40));
  });
  expect(hook.result.current.data?.temperature).toBe(25);
  expect(readCache(MANILA, "current")).toBeUndefined();
});
it("bounds the memory cache and separates coordinates as well as IDs", () => {
  for (let id = 1; id <= CACHE_LOCATION_LIMIT + 1; id++)
    writeCache({ ...MANILA, id }, "current", weather(id));
  expect(readCache({ ...MANILA, id: 1 }, "current")).toBeUndefined();
  expect(readCache({ ...MANILA, id: 9 }, "current")?.temperature).toBe(9);
  expect(
    readCache({ ...MANILA, id: 9, latitude: 15 }, "current"),
  ).toBeUndefined();
});
