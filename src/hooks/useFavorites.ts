import { useState } from "react";
import type { WeatherLocation } from "../services/locations";
import {
  FAVORITES_KEY,
  parseFavorites,
  serializeFavorites,
} from "../services/favorites";
export function useFavorites() {
  const [saved, setSaved] = useState(() => {
    try {
      return parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
    } catch {
      return {
        locations: [] as WeatherLocation[],
        warning:
          "Browser storage is unavailable. Favorites will work for this session, but changes cannot be saved.",
      };
    }
  });
  const update = (locations: WeatherLocation[]) => {
    let warning: string | null = null;
    try {
      window.localStorage.setItem(FAVORITES_KEY, serializeFavorites(locations));
    } catch {
      warning =
        "Changes could not be saved in this browser. Your favorites still work for this session; reloading may lose these changes.";
    }
    setSaved({ locations, warning });
  };
  return {
    ...saved,
    save: (place: WeatherLocation) => {
      if (!saved.locations.some((item) => item.id === place.id))
        update([...saved.locations, place]);
    },
    remove: (id: number) =>
      update(saved.locations.filter((item) => item.id !== id)),
  };
}
