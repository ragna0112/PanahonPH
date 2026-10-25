import type { WeatherLocation } from "./locations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const populatedPlaces = new Set([
  "PPL",
  "PPLA",
  "PPLA2",
  "PPLA3",
  "PPLA4",
  "PPLA5",
  "PPLC",
]);
const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function parseLocations(body: unknown): WeatherLocation[] {
  if (
    !isRecord(body) ||
    body.error === true ||
    (body.results !== undefined && !Array.isArray(body.results))
  ) {
    throw new Error(
      "The location service returned unexpected data. Please retry.",
    );
  }
  const seen = new Set<number>();
  const locations: WeatherLocation[] = [];
  for (const item of body.results ?? []) {
    // Do not trust server-side filtering or use country names to infer codes.
    if (!isRecord(item) || item.country_code !== "PH") continue;
    if (
      typeof item.feature_code !== "string" ||
      !populatedPlaces.has(item.feature_code)
    )
      continue;
    if (
      typeof item.id !== "number" ||
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      typeof item.latitude !== "number" ||
      !Number.isFinite(item.latitude) ||
      Math.abs(item.latitude) > 90 ||
      typeof item.longitude !== "number" ||
      !Number.isFinite(item.longitude) ||
      Math.abs(item.longitude) > 180
    ) {
      throw new Error(
        "The location service returned an invalid place. Please retry.",
      );
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    locations.push({
      id: item.id,
      name: item.name.trim(),
      latitude: item.latitude,
      longitude: item.longitude,
      province: optionalText(item.admin2),
      region: optionalText(item.admin1),
    });
  }
  return locations;
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<WeatherLocation[]> {
  const name = query.trim();
  if (name.length < 3) return [];
  const params = new URLSearchParams({
    name,
    countryCode: "PH",
    count: "10",
    language: "en",
    format: "json",
  });
  const timeout = AbortSignal.timeout(15_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?${params}`,
      { signal: requestSignal },
    );
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "Location search is busy. Wait a moment, then retry."
          : `Location search failed (HTTP ${response.status}). Please retry.`,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (requestSignal.aborted) throw requestSignal.reason;
      throw new Error(
        "The location service returned unreadable data. Please retry.",
      );
    }
    return parseLocations(body);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted)
      throw new Error("Location search timed out. Please retry.");
    if (error instanceof TypeError)
      throw new Error(
        "Unable to search locations. Check your connection and retry.",
      );
    throw error;
  }
}
