import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { searchLocations } from "../services/geocoding";
import { locationDetails } from "../services/locations";
import type { WeatherLocation } from "../services/locations";

type SearchState =
  | { status: "idle" | "loading" }
  | { status: "success"; results: WeatherLocation[] }
  | { status: "error"; message: string };

export default function LocationSearch({
  onSelect,
}: {
  onSelect: (location: WeatherLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [active, setActive] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const options = state.status === "success" ? state.results : [];
  const invalidate = () => {
    generation.current += 1;
    request.current?.abort();
  };
  const close = () => {
    invalidate();
    setOpen(false);
    setActive(-1);
  };

  useEffect(() => {
    if (!open || query.trim().length < 3) return;
    const controller = new AbortController();
    request.current = controller;
    const version = generation.current;
    const timer = window.setTimeout(() => {
      searchLocations(query, controller.signal).then(
        (results) => {
          if (!controller.signal.aborted && version === generation.current)
            setState({ status: "success", results });
        },
        (error: unknown) => {
          if (!controller.signal.aborted && version === generation.current)
            setState({
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Location search failed. Please retry.",
            });
        },
      );
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, attempt]);

  const choose = (location: WeatherLocation) => {
    close();
    setQuery("");
    setState({ status: "idle" });
    onSelect(location);
    input.current?.focus();
  };
  return (
    <div
      className="location-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <div className="search-box">
        <Search size={20} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-label="Search Philippine cities and municipalities"
          aria-expanded={open}
          aria-controls={open ? "location-results" : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 && options[active]
              ? `location-${options[active].id}`
              : undefined
          }
          aria-describedby="search-help"
          placeholder="Search a Philippine city or municipality"
          value={query}
          autoComplete="off"
          maxLength={120}
          onChange={(event) => {
            invalidate();
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
            setState({
              status:
                event.target.value.trim().length >= 3 ? "loading" : "idle",
            });
          }}
          onFocus={() => {
            if (!open) {
              setOpen(true);
              setState({
                status: query.trim().length >= 3 ? "loading" : "idle",
              });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                setOpen(true);
                setState({
                  status: query.trim().length >= 3 ? "loading" : "idle",
                });
                return;
              }
              if (options.length) {
                const next =
                  event.key === "ArrowDown"
                    ? (active + 1) % options.length
                    : active <= 0
                      ? options.length - 1
                      : active - 1;
                setActive(next);
                document
                  .getElementById(`location-${options[next].id}`)
                  ?.scrollIntoView({ block: "nearest" });
              }
            }
            if (
              event.key === "Enter" &&
              open &&
              active >= 0 &&
              options[active]
            ) {
              event.preventDefault();
              choose(options[active]);
            }
          }}
        />
        <span className="search-country" aria-hidden="true">
          PH
        </span>
      </div>
      {open && (
        <div className="search-dropdown">
          <p id="search-help" className="search-help">
            Philippine places only · Type at least 3 characters. Use ↑ ↓ and
            Enter to select; Escape to close.
          </p>
          <div role="status" aria-live="polite" className="search-status">
            {state.status === "idle" && "Search for a city or municipality."}
            {state.status === "loading" && "Searching Philippine locations…"}
            {state.status === "error" && state.message}
            {state.status === "success" &&
              (options.length
                ? `${options.length} matching places. Choose a location.`
                : "No Philippine places found. Try another spelling or a longer name.")}
          </div>
          {state.status === "error" && (
            <button
              className="search-retry"
              onClick={() => {
                invalidate();
                setState({ status: "loading" });
                setAttempt((value) => value + 1);
                input.current?.focus();
              }}
            >
              Retry location search
            </button>
          )}
          <ul
            id="location-results"
            role="listbox"
            aria-label="Philippine locations"
          >
            {options.map((location, index) => (
              <li
                key={location.id}
                id={`location-${location.id}`}
                role="option"
                aria-selected={active === index}
                className={active === index ? "active-option" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(location)}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <strong>{location.name}</strong>
                  <small>{locationDetails(location)}</small>
                  <small className="result-coordinates">
                    {location.latitude.toFixed(4)}°N,{" "}
                    {location.longitude.toFixed(4)}°E
                  </small>
                </span>
              </li>
            ))}
          </ul>
          <p className="search-credit">
            Location data: <a href="https://open-meteo.com/">Open-Meteo</a> /{" "}
            <a href="https://www.geonames.org/">GeoNames</a> ·{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </p>
        </div>
      )}
      {!open && (
        <span id="search-help" className="sr-only">
          Type at least 3 characters. Use arrow keys and Enter to select a
          Philippine location.
        </span>
      )}
    </div>
  );
}
