import { useCallback, useEffect, useRef, useState } from "react";
import type { WeatherLocation } from "../services/locations";
import type { CurrentWeather } from "../services/weather";
import type { Forecast } from "../services/forecast";
import {
  isFresh,
  locationKey,
  readCache,
  writeCache,
} from "../services/weatherCache";

type Data = { current: CurrentWeather; forecast: Forecast };
interface State<T> {
  key: string;
  data?: T;
  pending: boolean;
  error: string | null;
}

// Each independently loaded resource keeps its last successful reading during refresh.
export function useWeatherResource<K extends keyof Data>(
  location: WeatherLocation,
  kind: K,
  loader: (place: WeatherLocation, signal?: AbortSignal) => Promise<Data[K]>,
) {
  const key = locationKey(location);
  const initialState = (): State<Data[K]> => {
    const cached = readCache(location, kind);
    return {
      key,
      data: cached,
      pending: !cached || !isFresh(cached),
      error: null,
    };
  };
  const [state, setState] = useState<State<Data[K]>>(initialState);
  if (state.key !== key) setState(initialState());
  const request = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    request.current?.abort();
    request.current = null;
  }, []);
  const refresh = useCallback(() => {
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController();
    request.current = controller;
    setState((previous) => ({
      key,
      data: previous.key === key ? previous.data : readCache(location, kind),
      pending: true,
      error: null,
    }));
    void loader(location, controller.signal)
      .then(
        (data) => {
          if (controller.signal.aborted) return;
          writeCache(location, kind, data);
          setState({ key, data, pending: false, error: null });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setState((previous) => ({
            key,
            data: previous.key === key ? previous.data : undefined,
            pending: false,
            error:
              error instanceof Error
                ? error.message
                : "The request failed. Please retry.",
          }));
        },
      )
      .finally(() => {
        if (request.current === controller) request.current = null;
      });
  }, [key, kind, loader, location]);
  useEffect(() => {
    const cached = readCache(location, kind);
    if (!cached || !isFresh(cached)) refresh();
    return cancel;
  }, [cancel, key, kind, location, refresh]);
  // Location changes must never render the previous resource, even before effect cleanup.
  const visible =
    state.key === key
      ? state
      : { key, data: readCache(location, kind), pending: true, error: null };
  return { ...visible, refresh, cancel };
}
