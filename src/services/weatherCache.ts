import type { CurrentWeather } from "./weather";
import type { Forecast } from "./forecast";
import type { WeatherLocation } from "./locations";

export const CACHE_FRESH_MS = 5 * 60_000;
export const CACHE_LOCATION_LIMIT = 8;
type CachedData = { current: CurrentWeather; forecast: Forecast };
const cache = new Map<string, Partial<CachedData>>();
export const locationKey = (place: WeatherLocation) =>
  `${place.id}:${place.latitude}:${place.longitude}`;
export function readCache<K extends keyof CachedData>(
  place: WeatherLocation,
  kind: K,
): CachedData[K] | undefined {
  const key = locationKey(place);
  const entry = cache.get(key);
  if (entry) {
    cache.delete(key);
    cache.set(key, entry);
  }
  return entry?.[kind];
}
export function writeCache<K extends keyof CachedData>(
  place: WeatherLocation,
  kind: K,
  data: CachedData[K],
): void {
  const key = locationKey(place);
  const entry = cache.get(key) ?? {};
  entry[kind] = data;
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > CACHE_LOCATION_LIMIT)
    cache.delete(cache.keys().next().value!);
}
export const isFresh = (data: { fetchedAt: number }, now = Date.now()) =>
  now >= data.fetchedAt && now - data.fetchedAt < CACHE_FRESH_MS;
export function clearWeatherCache(): void {
  cache.clear();
}
