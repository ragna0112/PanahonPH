# PanahonPH — Philippine Weather Dashboard

A student portfolio project built one milestone at a time: readable, responsive weather information for Philippine cities and municipalities.

## Current progress

Milestones 1 and 2 are complete. The dashboard fetches current modeled weather for Manila: temperature, feels-like temperature, relative humidity, wind speed, and understandable conditions with day/night icons. Loading, missing readings, service failures, and retry are handled. Search and saved-location controls remain disabled for their future milestones. Hourly and seven-day forecasts are explicitly not connected until milestone 4.

- [x] 1 — Project foundation and responsive dashboard shell
- [x] 2 — Live current weather for Manila
- [ ] 3 — Philippine city and municipality search
- [ ] 4 — Hourly charts and seven-day forecasts
- [ ] 5 — Favorites and refresh behavior
- [ ] 6 — Interface polish and accessibility
- [ ] 7 — Final verification and deployment preparation

## Run locally

Use Node.js 22.12+ (22 LTS), or Node 24+. Use a supported LTS release for ongoing development. npm is included with Node.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

```sh
npm run lint       # Oxlint checks React and TypeScript source
npm run typecheck  # TypeScript checks the app and Vite configuration
npm run build      # TypeScript checks, then builds into dist/
npm run check      # All three checks
npm test           # API, weather-code, and dashboard behavior tests
npm run preview    # Serves an existing production build locally
```

No API keys or environment variables are needed. Do not commit secrets or local .env files.

## Small architecture

- `src/main.tsx` mounts React and loads the shared stylesheet.
- `src/App.tsx` contains the dashboard sections and a reusable `Metric` component. Each metric receives its icon, label, formatted reading, and unit description as props.
- `src/services/weather.ts` requests and validates current weather, then returns a typed object with separate model-valid and fetch timestamps.
- `src/services/weatherCodes.ts` maps documented WMO codes to descriptions and icon names, with an unavailable fallback.
- `src/index.css` loads Tailwind CSS and defines the visual design and responsive breakpoints.
- `vite.config.ts` enables React and the official Tailwind Vite plugin.

React renders the interface, TypeScript checks data and component contracts, and Vite runs the development server and builds the site. Tailwind CSS 4 is installed through its Vite integration. Recharts is installed with compatible React peer dependencies for milestone 4; it is not rendered or bundled into the dashboard yet. Lucide provides decorative interface icons.

When `App` mounts, its React effect calls `fetchManilaWeather`. The service requests Manila coordinates (14.5995, 120.9842) from Open-Meteo's `/v1/forecast` endpoint with only `current` fields: `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `wind_speed_10m`, `weather_code`, and `is_day`. It explicitly requests Celsius, km/h, Asia/Manila, and Unix timestamps. Open-Meteo may return a nearby model grid cell instead of the exact requested point.

The JSON starts as `unknown`: the service validates the response shape, timezone, units, finite numeric values, humidity/wind ranges, weather-code integer, and day/night flag. Null or omitted readings remain unavailable. HTTP errors, rate limits, unreadable JSON, unexpected responses, network failures, and a 15-second timeout produce helpful errors. The effect stores loading, success, or error state; React renders the matching panel. Retry starts a new request. Unmount cleanup cancels the request and prevents outdated responses from changing state. React StrictMode may start then cancel an extra request during development.

There is no backend, database, authentication, search, persisted location state, automatic polling, or caching. Refreshing the page requests data again; broader refresh behavior belongs to milestone 5.

Tests use clearly isolated synthetic fixtures and mocked requests, never sample readings in the production dashboard. Vitest covers documented weather codes (including 97), unknown/missing codes, day/night icons, API success and failures, invalid data/units, missing values versus real zeroes, cancellation/timeout, Manila time conversion, and dashboard loading, errors, repeated retry, success, and cleanup.

## Data sources and limitations

Current weather is fetched live from [Open-Meteo](https://open-meteo.com/). Official [forecast API documentation](https://open-meteo.com/en/docs), [terms](https://open-meteo.com/en/terms), and [licence conditions](https://open-meteo.com/en/licence) were reviewed on October 25, 2026. The free API is for noncommercial use with limits of 600 calls/minute, 5,000/hour, 10,000/day, and 300,000/month. This is an educational project without advertising or subscriptions; recheck terms before commercial or promotional deployment.

Data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Visible attribution links the provider and licence beside the dashboard panels and discloses presentation changes: values are rounded and weather codes are converted into descriptions/icons.

Open-Meteo's current conditions use weather-model data, not a local station observation. **Model data valid at** is the API's `current.time` (the time the modeled conditions apply). **Fetched by this app** is the device-clock time after receiving and reading the response; it is not the model run/update time. Both are displayed with date and seconds in **Asia/Manila (UTC+08:00)** using `Intl.DateTimeFormat`, independent of the device timezone. Unix timestamps avoid ambiguous parsing of local ISO strings. Device-clock accuracy affects the fetch timestamp. Missing model timestamps are labeled unavailable.

Temperatures use Celsius; wind speed uses km/h. Missing numeric readings display `—`. Missing or unknown weather codes display “Conditions unavailable” and a question-mark icon. Missing day/night information uses a neutral icon. No reading is substituted or inferred from another value. There is no freshness guarantee or automatic polling; check the model-valid time when assessing age. This is not an official PAGASA warning service.

Precipitation and forecasts are not requested in milestone 2. Future precipitation probability (%) will be distinguished from rainfall amount (mm). Philippine-only geocoding will be introduced in milestone 3 after verifying its official documentation.

## Verification

- `npm run check`: lint, strict TypeScript, production build.
- `npm test`: service validation and error cases, weather-code mapping, timestamp formatting, and dashboard state/retry behavior.
- Live request checked both directly and in the browser.
- Browser layout checked at 1280px desktop and in 320px/390px mobile iframe viewports, including loading, live conditions, timestamps, metrics, attribution, and forecast placeholders. This covers milestone 1's outstanding mobile check. These are browser viewport checks, not physical-device testing.

## Build and deployment

`npm run build` produces a static site in `dist/`; `npm run preview` lets you inspect it locally. Deployment platform configuration and fresh-install verification are planned for milestone 7. The site has not been deployed. Hosting under a repository subpath may require configuring Vite's `base` setting.

## Setup references

- [Vite requirements and scripts](https://vite.dev/guide/)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Recharts](https://github.com/recharts/recharts)

Exact installed versions are recorded in `package-lock.json`. Use `npm ci` to reproduce them.
