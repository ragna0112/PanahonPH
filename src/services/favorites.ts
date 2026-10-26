import type { WeatherLocation } from "./locations";
export const FAVORITES_KEY = "panahonph.favorites";
interface SavedLocation extends WeatherLocation {
  countryCode: "PH";
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
export function parseFavorites(raw: string | null): {
  locations: WeatherLocation[];
  warning: string | null;
} {
  if (raw === null) return { locations: [], warning: null };
  try {
    const body: unknown = JSON.parse(raw);
    if (!record(body) || body.version !== 1 || !Array.isArray(body.locations))
      throw new Error();
    const locations: WeatherLocation[] = [];
    const seen = new Set<number>();
    let invalid = false;
    for (const item of body.locations) {
      if (
        !record(item) ||
        item.countryCode !== "PH" ||
        typeof item.id !== "number" ||
        !Number.isSafeInteger(item.id) ||
        item.id <= 0 ||
        !text(item.name, 120) ||
        typeof item.latitude !== "number" ||
        !Number.isFinite(item.latitude) ||
        Math.abs(item.latitude) > 90 ||
        typeof item.longitude !== "number" ||
        !Number.isFinite(item.longitude) ||
        Math.abs(item.longitude) > 180 ||
        (item.province !== undefined && !text(item.province, 160)) ||
        (item.region !== undefined && !text(item.region, 160))
      ) {
        invalid = true;
        continue;
      }
      if (seen.has(item.id)) {
        invalid = true;
        continue;
      }
      seen.add(item.id);
      locations.push({
        id: item.id,
        name: (item.name as string).trim(),
        latitude: item.latitude,
        longitude: item.longitude,
        ...(item.province
          ? { province: (item.province as string).trim() }
          : {}),
        ...(item.region ? { region: (item.region as string).trim() } : {}),
      });
    }
    return {
      locations,
      warning: invalid
        ? "Some saved places were invalid or duplicated and were ignored."
        : null,
    };
  } catch {
    return {
      locations: [],
      warning:
        "Saved places could not be read. You can start a new favorites list.",
    };
  }
}
export function serializeFavorites(locations: WeatherLocation[]): string {
  const saved: SavedLocation[] = locations.map(
    ({ id, name, latitude, longitude, province, region }) => ({
      id,
      name,
      latitude,
      longitude,
      province,
      region,
      countryCode: "PH",
    }),
  );
  return JSON.stringify({ version: 1, locations: saved });
}
