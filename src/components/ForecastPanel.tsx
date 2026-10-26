import { useEffect, useId, useMemo, useRef } from "react";
import { CalendarDays, RefreshCw, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchForecast,
  formatForecastDate,
  formatForecastHour,
  selectForecastWindow,
} from "../services/forecast";
import type { Forecast } from "../services/forecast";
import type { WeatherLocation } from "../services/locations";
import { formatManilaTime } from "../services/weather";
import { describeWeather } from "../services/weatherCodes";
import { useWeatherResource } from "../hooks/useWeatherResource";
import { useForecastClock } from "../hooks/useForecastClock";
import WeatherSymbol from "./WeatherSymbol";

const reading = (value: number | null, unit: string) =>
  value === null
    ? "Unavailable"
    : `${value.toLocaleString("en-PH", { maximumFractionDigits: 1 })}${unit}`;

export function ForecastTooltip({
  active,
  timestamp,
  value,
  unit,
}: {
  active?: boolean;
  timestamp: number | null;
  value: unknown;
  unit: string;
}) {
  if (!active || timestamp === null) return null;
  return (
    <div className="forecast-tooltip">
      <strong>
        {formatForecastDate(timestamp)} · {formatForecastHour(timestamp)}
      </strong>
      <p>{reading(typeof value === "number" ? value : null, unit)}</p>
      <small>Asia/Manila</small>
    </div>
  );
}
function HourTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value: number };
}) {
  if (!payload) return null;
  const date = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(payload.value);
  return (
    <text
      x={x}
      y={Number(y) + 12}
      textAnchor="middle"
      fill="#526e5c"
      fontSize={10}
    >
      <tspan x={x}>{date}</tspan>
      <tspan x={x} dy={14}>
        {formatForecastHour(payload.value)}
      </tspan>
    </text>
  );
}

export default function ForecastPanel({
  location,
  refreshToken = 0,
  onBusyChange,
}: {
  location: WeatherLocation;
  refreshToken?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const {
    data: rawData,
    pending,
    error,
    refresh,
  } = useWeatherResource(location, "forecast", fetchForecast);
  const now = useForecastClock();
  const window = useMemo(
    () => (rawData ? selectForecastWindow(rawData, now) : null),
    [rawData, now],
  );
  const state = {
    status: window ? "success" : pending ? "loading" : "error",
    data: window as Forecast,
    message:
      error ??
      "Earlier forecast data no longer covers the required window. Please retry.",
  };
  const syncId = useId();
  const lastRefresh = useRef(refreshToken);
  const lastAutomaticHour = useRef<number | null>(null);
  useEffect(() => {
    onBusyChange?.(pending);
  }, [onBusyChange, pending]);
  useEffect(() => {
    if (lastRefresh.current !== refreshToken) {
      lastRefresh.current = refreshToken;
      refresh();
    }
  }, [refreshToken, refresh]);
  useEffect(() => {
    const hour = Math.floor(now / 3_600_000);
    if (pending && rawData && !window) lastAutomaticHour.current = hour;
    if (
      rawData &&
      !window &&
      !pending &&
      !error &&
      lastAutomaticHour.current !== hour
    ) {
      lastAutomaticHour.current = hour;
      refresh();
    }
  }, [now, rawData, pending, error, refresh, window]);

  return (
    <section
      className="forecasts"
      aria-labelledby="forecast-title"
      aria-busy={pending}
    >
      <div className="section-heading">
        <h2 id="forecast-title">
          <CalendarDays size={18} aria-hidden="true" /> Looking ahead ·{" "}
          {location.name}
        </h2>
        <span>Asia/Manila</span>
      </div>
      {rawData && pending && (
        <p className="forecast-refresh-status" role="status">
          Updating forecasts. Earlier readings remain visible when they cover
          the current window.
        </p>
      )}
      {rawData && error && (
        <div className="forecast-refresh-status" role="status">
          <p>
            Forecast refresh failed: {error}{" "}
            {window
              ? "Displayed readings are from an earlier fetch."
              : "Earlier forecast data no longer covers the required window; charts and cards are unavailable."}
          </p>
          <p>
            Earlier forecast fetched: {formatManilaTime(rawData.fetchedAt)} ·
            Asia/Manila
          </p>
          {window && (
            <button className="search-retry" onClick={refresh}>
              Retry forecasts
            </button>
          )}
        </div>
      )}
      {state.status !== "success" ? (
        <div className="forecast-message" role="status" aria-live="polite">
          <TrendingUp size={28} aria-hidden="true" />
          <h3>
            {state.status === "loading"
              ? "Loading hourly and seven-day forecasts…"
              : "Forecasts are temporarily unavailable."}
          </h3>
          {state.status === "error" && (
            <>
              <p>{state.message}</p>
              <button className="search-retry" onClick={refresh}>
                <RefreshCw size={14} aria-hidden="true" /> Retry forecasts
              </button>
            </>
          )}
          <p>
            Current weather has its own request and remains available if it
            succeeds.
          </p>
        </div>
      ) : (
        <>
          <p className="forecast-intro">
            Next 24 hourly points, starting at the current Manila hour.{" "}
            {formatForecastDate(state.data.hourly[0].time)} ·{" "}
            {formatForecastHour(state.data.hourly[0].time)} to{" "}
            {formatForecastDate(state.data.hourly[23].time)} ·{" "}
            {formatForecastHour(state.data.hourly[23].time)}.
          </p>
          <p className="forecast-definition">
            Precipitation probability (%) is the chance of more than 0.1 mm in
            the preceding hour ending at the labeled time. It is not rainfall
            amount (mm). Missing values appear as gaps.
          </p>
          <div className="forecast-charts">
            {(
              [
                {
                  key: "temperature",
                  title: "Hourly temperature",
                  unit: "°C",
                  color: "#286c52",
                },
                {
                  key: "precipitationProbability",
                  title: "Hourly precipitation probability",
                  unit: "%",
                  color: "#386e9c",
                },
              ] as const
            ).map((chart) => (
              <figure key={chart.key} className="forecast-chart">
                <figcaption>
                  {chart.title} <span>({chart.unit})</span>
                </figcaption>
                <div
                  className="chart-container"
                  role="img"
                  aria-label={`${chart.title} in ${chart.unit}. All 24 values are available in the hourly forecast table below.`}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    initialDimension={{ width: 280, height: 210 }}
                  >
                    <LineChart
                      data={state.data.hourly}
                      syncId={syncId}
                      margin={{ top: 12, right: 20, bottom: 8, left: 0 }}
                      accessibilityLayer={false}
                    >
                      <CartesianGrid stroke="#e5ece7" vertical={false} />
                      <XAxis
                        dataKey="time"
                        ticks={[0, 8, 16, 23].map(
                          (index) => state.data.hourly[index].time,
                        )}
                        tick={<HourTick />}
                        height={42}
                        interval={0}
                        padding={{ left: 12, right: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        width={40}
                        domain={
                          chart.unit === "%" ? [0, 100] : ["auto", "auto"]
                        }
                        ticks={
                          chart.unit === "%" ? [0, 25, 50, 75, 100] : undefined
                        }
                        tick={{ fontSize: 10, fill: "#526e5c" }}
                        tickLine={false}
                        axisLine={false}
                        allowDataOverflow={chart.unit === "%"}
                      />
                      <Tooltip
                        filterNull={false}
                        content={({ active, label, payload }) => (
                          <ForecastTooltip
                            active={active}
                            timestamp={typeof label === "number" ? label : null}
                            value={payload?.[0]?.value}
                            unit={chart.unit}
                          />
                        )}
                      />
                      <Line
                        type="linear"
                        dataKey={chart.key}
                        name={chart.title}
                        stroke={chart.color}
                        strokeWidth={2}
                        dot={{ r: 2, fill: chart.color }}
                        activeDot={{ r: 4 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </figure>
            ))}
          </div>
          <details className="hourly-table">
            <summary>View all 24 hourly values as a table</summary>
            <table>
              <caption>
                Hourly forecast · Asia/Manila. Probability applies to the
                preceding hour; — means unavailable.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Forecast date &amp; time</th>
                  <th scope="col">Temperature (°C)</th>
                  <th scope="col">Precipitation probability (%)</th>
                </tr>
              </thead>
              <tbody>
                {state.data.hourly.map((point) => (
                  <tr key={point.time}>
                    <th scope="row">
                      <time dateTime={new Date(point.time).toISOString()}>
                        {formatForecastDate(point.time)} ·{" "}
                        {formatForecastHour(point.time)}
                      </time>
                    </th>
                    <td>
                      {point.temperature === null
                        ? "—"
                        : reading(point.temperature, "°C")}
                    </td>
                    <td>
                      {point.precipitationProbability === null
                        ? "—"
                        : reading(point.precipitationProbability, "%")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <div className="daily-heading">
            <h3>Seven-day forecast</h3>
            <p>
              Starting today in Asia/Manila. Daily high/low temperatures, most
              severe condition, and maximum hourly precipitation probability for
              each day.
            </p>
          </div>
          <div className="daily-grid">
            {state.data.daily.map((day, index) => (
              <article
                className="daily-card"
                key={day.time}
                aria-label={formatForecastDate(day.time)}
              >
                <h4>
                  {index === 0
                    ? "Today"
                    : new Intl.DateTimeFormat("en-PH", {
                        timeZone: "Asia/Manila",
                        weekday: "long",
                      }).format(day.time)}
                </h4>
                <time dateTime={new Date(day.time).toISOString()}>
                  {formatForecastDate(day.time)}
                </time>
                <WeatherSymbol code={day.weatherCode} />
                <p className="daily-condition">
                  {describeWeather(day.weatherCode, true).description}
                </p>
                <p>
                  High <strong>{reading(day.high, "°C")}</strong>
                </p>
                <p>
                  Low <strong>{reading(day.low, "°C")}</strong>
                </p>
                <p className="daily-probability">
                  <span>Max precipitation probability</span>
                  <strong>
                    {reading(day.precipitationProbabilityMax, "%")}
                  </strong>
                </p>
              </article>
            ))}
          </div>
          <p className="forecast-fetch-time">
            Forecast fetched by this app:{" "}
            <time dateTime={new Date(state.data.fetchedAt).toISOString()}>
              {formatManilaTime(state.data.fetchedAt)}
            </time>{" "}
            · Asia/Manila. Chart times are forecast valid times; cards summarize
            each Manila calendar day. Fetch time is not the model run time.
          </p>
        </>
      )}
      <p className="data-attribution">
        <a href="https://open-meteo.com/">Forecast data by Open-Meteo.com</a> ·{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> ·
        Model forecasts; values rounded for display.
      </p>
    </section>
  );
}
