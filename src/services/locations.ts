export interface WeatherLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  province?: string;
  region?: string;
}

// Stable GeoNames ID for Manila; retain the foundation's initial coordinates.
export const MANILA: WeatherLocation = {
  id: 1701668,
  name: "Manila",
  latitude: 14.5995,
  longitude: 120.9842,
  region: "Metro Manila",
};

export function locationDetails(location: WeatherLocation): string {
  return [
    ...new Set([location.province, location.region].filter(Boolean)),
    "Philippines",
  ].join(", ");
}
