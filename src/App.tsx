import {
  ArrowUpRight,
  CloudSun,
  Cloud,
  Droplets,
  Wind,
  Thermometer,
  MapPin,
  Clock3,
  Radio,
  Code2,
  Sun,
  Moon,
  CloudMoon,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CircleHelp,
  RefreshCw,
} from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { fetchCurrentWeather, formatManilaTime } from "./services/weather";
import LocationSearch from "./components/LocationSearch";
import { MANILA, locationDetails } from "./services/locations";
import type { WeatherLocation } from "./services/locations";
import Favorites from "./components/Favorites";
import { useWeatherResource } from "./hooks/useWeatherResource";
import { describeWeather } from "./services/weatherCodes";
import type { WeatherIcon } from "./services/weatherCodes";
import type { LucideIcon } from "lucide-react";

const ForecastPanel = lazy(() => import("./components/ForecastPanel"));

const weatherIcons: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  unknown: CircleHelp,
};

function Metric({
  icon: Icon,
  label,
  detail,
  value,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <div className="metric">
      <Icon size={20} aria-hidden="true" />
      <p>{label}</p>
      <strong
        className={label === "Conditions" ? "condition-value" : undefined}
      >
        {value}
      </strong>
      <span>{detail}</span>
    </div>
  );
}

function App() {
  const [location, setLocation] = useState<WeatherLocation>(MANILA);
  const current = useWeatherResource(location, "current", fetchCurrentWeather);
  const [refreshToken, setRefreshToken] = useState(0);
  const [forecastBusy, setForecastBusy] = useState(true);
  const locationHeading = useRef<HTMLHeadingElement>(null);
  const retryCurrent = () => {
    locationHeading.current?.focus();
    current.refresh();
  };
  const data = current.data ?? null;
  const state = {
    status: data ? "success" : current.pending ? "loading" : "error",
    message: current.error,
  };
  const selectLocation = (place: WeatherLocation) => {
    if (
      place.id === location.id &&
      place.latitude === location.latitude &&
      place.longitude === location.longitude
    )
      return;
    current.cancel();
    setForecastBusy(true);
    setLocation(place);
  };
  const condition = describeWeather(
    data?.weatherCode ?? null,
    data?.isDay ?? null,
  );
  const ConditionIcon = weatherIcons[condition.icon];
  const reading = (value: number | null | undefined, unit: string) =>
    value == null
      ? "—"
      : `${value.toLocaleString("en-PH", { maximumFractionDigits: 1 })}${unit}`;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a href="#" className="brand">
          <span className="brand-mark">
            <CloudSun size={27} aria-hidden="true" />
          </span>
          <span>
            Panahon<span className="brand-ph">PH</span>
            <small aria-hidden="true">YOUR LOCAL SKY, AT A GLANCE</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#main">
            Overview
          </a>
          <a href="#project">
            About the project <ArrowUpRight size={14} />
          </a>
        </nav>
        <span className="country">
          <span /> Philippines
        </span>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="intro">
          <div>
            <p className="eyebrow">A LITTLE CLARITY, RAIN OR SHINE</p>
            <h1>Your day starts with the sky.</h1>
            <p className="subtle">
              Weather across the Philippines, all in one place.
            </p>
          </div>
          <div className="timezone">
            <Clock3 size={16} /> Philippine Standard Time
            <span>Asia/Manila · UTC+08:00</span>
          </div>
        </div>
        <div className="search-row">
          <LocationSearch onSelect={selectLocation} />
          <span className="unit">
            °C <span>/</span> Metric units
          </span>
        </div>
        <div className="refresh-toolbar">
          <button
            aria-disabled={current.pending || forecastBusy}
            onClick={() => {
              if (current.pending || forecastBusy) return;
              current.refresh();
              setRefreshToken((value) => value + 1);
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {current.pending || forecastBusy
              ? "Updating weather…"
              : "Refresh current weather and forecasts"}
          </button>
          <span>Refresh gets new data for {location.name}.</span>
        </div>
        <p className="sr-only" role="status" aria-atomic="true">
          {current.pending
            ? `Loading current weather for ${location.name}.`
            : current.error
              ? `Current weather for ${location.name} could not be updated.`
              : `Current weather for ${location.name} updated.`}
        </p>
        <div className="dashboard-grid">
          <section className="current-card" aria-labelledby="current-title">
            <div className="card-top">
              <h2 className="location" ref={locationHeading} tabIndex={-1}>
                <MapPin size={18} /> {location.name}{" "}
                <small>{locationDetails(location)}</small>
              </h2>
              <span className="outline-badge">
                {state.status === "success"
                  ? "MODEL DATA"
                  : state.status === "loading"
                    ? "CONNECTING"
                    : "UNAVAILABLE"}
              </span>
            </div>
            {data && current.pending && (
              <p className="current-update">
                Updating current weather. Earlier readings remain visible.
              </p>
            )}
            {data && current.error && (
              <div className="current-update">
                <p>
                  Current weather refresh failed: {current.error} Displayed
                  readings are from an earlier fetch.
                </p>
                <button className="retry-button" onClick={retryCurrent}>
                  Retry weather request
                </button>
              </div>
            )}
            <div className="current-body" aria-busy={current.pending}>
              <div className="current-content">
                <p className="eyebrow" id="current-title">
                  CURRENT WEATHER
                </p>
                {state.status === "loading" ? (
                  <>
                    <h3>
                      Checking
                      <br />
                      {location.name}’s sky…
                    </h3>
                    <p>Loading current weather from Open-Meteo.</p>
                  </>
                ) : state.status === "error" ? (
                  <>
                    <h3>
                      A little cloudy
                      <br />
                      on our end.
                    </h3>
                    <p>{state.message}</p>
                    <button className="retry-button" onClick={retryCurrent}>
                      <RefreshCw size={14} aria-hidden="true" /> Retry weather
                      request
                    </button>
                  </>
                ) : (
                  <>
                    <p className="live-temperature">
                      {reading(data?.temperature, "")}
                      {data?.temperature != null && (
                        <>
                          <wbr />
                          °C
                        </>
                      )}
                    </p>
                    <p className="weather-description">
                      {condition.description}
                    </p>
                    <span className="connection">
                      <span /> Model estimate · Not a station observation
                    </span>
                    {[
                      data?.temperature,
                      data?.feelsLike,
                      data?.humidity,
                      data?.windSpeed,
                      data?.weatherCode,
                      data?.isDay,
                      data?.validAt,
                    ].some((value) => value == null) && (
                      <p className="missing-note">
                        Some data is unavailable. Missing readings are shown as
                        —.
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="weather-art live-weather-art" aria-hidden="true">
                <ConditionIcon
                  className="current-weather-icon"
                  strokeWidth={1.2}
                />
              </div>
            </div>
            <div className="current-footer weather-timestamps">
              <Radio size={15} aria-hidden="true" />
              {data ? (
                <div>
                  <p>
                    Model data valid at:{" "}
                    {data.validAt === null ? (
                      "Unavailable"
                    ) : (
                      <time dateTime={new Date(data.validAt).toISOString()}>
                        {formatManilaTime(data.validAt)}
                      </time>
                    )}
                  </p>
                  <p>
                    Fetched by this app:{" "}
                    <time dateTime={new Date(data.fetchedAt).toISOString()}>
                      {formatManilaTime(data.fetchedAt)}
                    </time>
                  </p>
                  <span>Both times in Asia/Manila (UTC+08:00)</span>
                </div>
              ) : (
                <span>
                  {state.status === "loading"
                    ? "Waiting for the weather service…"
                    : "No weather data available. Use retry to try again."}
                </span>
              )}
            </div>
          </section>
          <Favorites location={location} onSelect={selectLocation} />
          <section
            className="conditions-card"
            aria-labelledby="conditions-title"
          >
            <div className="section-heading">
              <h2 id="conditions-title">The details</h2>
              <span>Current conditions</span>
            </div>
            <div className="metrics-grid">
              <Metric
                icon={Thermometer}
                label="Feels like"
                value={reading(data?.feelsLike, "°C")}
                detail="Degrees Celsius"
              />
              <Metric
                icon={Droplets}
                label="Humidity"
                value={reading(data?.humidity, "%")}
                detail="Relative humidity · %"
              />
              <Metric
                icon={Wind}
                label="Wind speed"
                value={reading(data?.windSpeed, " km/h")}
                detail="Kilometers per hour"
              />
              <Metric
                icon={ConditionIcon}
                label="Conditions"
                value={data ? condition.description : "—"}
                detail={
                  data?.weatherCode == null
                    ? "Weather code unavailable"
                    : `WMO code ${data.weatherCode}`
                }
              />
            </div>
          </section>
        </div>
        <p className="data-attribution">
          <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a> ·{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> ·
          Values rounded; weather codes converted to descriptions and icons.
          Location data via Open-Meteo /{" "}
          <a href="https://www.geonames.org/">GeoNames</a>.
        </p>
        <Suspense
          fallback={
            <section className="forecasts" role="status">
              Loading hourly and seven-day forecasts…
            </section>
          }
        >
          <ForecastPanel
            key={`${location.id}:${location.latitude}:${location.longitude}`}
            location={location}
            refreshToken={refreshToken}
            onBusyChange={setForecastBusy}
          />
        </Suspense>
        <section id="project" className="project-note">
          <span className="note-icon">
            <CloudSun size={21} />
          </span>
          <div>
            <h2>Good things are on the horizon.</h2>
            <p>
              Current weather, hourly charts, and seven-day forecasts are
              connected. Save your places and refresh their weather whenever you
              need.
            </p>
          </div>
          <span className="progress-badge">
            07 <span>/ 07 milestones</span>
          </span>
        </section>
      </main>
      <footer>
        <span>
          PanahonPH <span className="footer-dot">·</span> Made for the
          Philippine skies.
        </span>
        <div>
          <span>
            Weather data:{" "}
            <a href="https://open-meteo.com/">
              Open-Meteo <ArrowUpRight size={12} />
            </a>
          </span>
          <a href="https://github.com/ragna0112/PanahonPH">
            <Code2 size={15} /> Source code
          </a>
        </div>
        <p>Portfolio project · Not an official PAGASA warning service.</p>
      </footer>
    </div>
  );
}

export default App;
