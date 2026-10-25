# PanahonPH — Philippine Weather Dashboard

A student portfolio project built one milestone at a time: readable, responsive weather information for Philippine cities and municipalities.

## Current progress

Milestones 1–4 are complete. Manila is the initial location, and Philippine location search lets you choose other places. The dashboard fetches current modeled weather for the selected location: temperature, feels-like temperature, relative humidity, wind speed, and understandable conditions with day/night icons. Loading, missing readings, service failures, and retry are handled. Saved locations remain disabled until milestone 5. Two aligned hourly charts and seven daily forecast cards are connected, with a table alternative for every hourly reading.

- [x] 1 — Project foundation and responsive dashboard shell
- [x] 2 — Live current weather for Manila
- [x] 3 — Philippine city and municipality search
- [x] 4 — Hourly charts and seven-day forecasts
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
- `src/components/LocationSearch.tsx` owns the accessible search dropdown, 300 ms debounce, cancellation, keyboard selection, and search retry.
- `src/services/geocoding.ts` validates Philippine search results from Open-Meteo.
- `src/services/locations.ts` defines typed places, the initial Manila location, and province/region labels.
- `src/components/ForecastPanel.tsx` fetches and renders independent forecasts, charts, daily cards, a text/table alternative, and forecast retry. The panel is loaded separately from the initial dashboard bundle.
- `src/services/forecast.ts` validates forecast arrays and selects 24 hourly points plus seven Manila calendar days.
- `src/services/weather.ts` requests and validates current weather for supplied coordinates, then returns a typed object with separate model-valid and fetch timestamps.
- `src/services/weatherCodes.ts` maps documented WMO codes to descriptions and icon names, with an unavailable fallback.
- `src/index.css` loads Tailwind CSS and defines the visual design and responsive breakpoints.
- `vite.config.ts` enables React and the official Tailwind Vite plugin.

React renders the interface, TypeScript checks data and component contracts, and Vite runs the development server and builds the site. Tailwind CSS 4 is installed through its Vite integration. Recharts renders the temperature and precipitation probability charts in the separately loaded forecast panel. Lucide provides decorative interface icons.

When `App` mounts, its React effect calls `fetchCurrentWeather` with the initial Manila location (GeoNames ID 1701668; coordinates 14.5995, 120.9842). After selection, it uses that result’s returned latitude and longitude. The service requests weather from Open-Meteo's `/v1/forecast` endpoint with only `current` fields: `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `wind_speed_10m`, `weather_code`, and `is_day`. It explicitly requests Celsius, km/h, Asia/Manila, and Unix timestamps. Open-Meteo may return a nearby model grid cell instead of the exact requested point.

The JSON starts as `unknown`: the service validates the response shape, timezone, units, finite numeric values, humidity/wind ranges, weather-code integer, and day/night flag. Null or omitted readings remain unavailable. HTTP errors, rate limits, unreadable JSON, unexpected responses, network failures, and a 15-second timeout produce helpful errors. The effect stores loading, success, or error state; React renders the matching panel. Retry starts a new request. Changing location immediately aborts the old request and clears all old readings and timestamps before the new place heading appears. Effect cleanup also cancels requests. Aborted responses and errors cannot update the dashboard, even when a network request finishes late. React StrictMode may start then cancel an extra request during development.

There is no backend, database, authentication, persisted location state, automatic polling, or caching. Refreshing the page requests data again; broader refresh behavior belongs to milestone 5.

Tests use clearly isolated synthetic fixtures and mocked requests, never sample readings in the production dashboard. Vitest covers documented weather codes (including 97), unknown/missing codes, day/night icons, API success and failures, invalid data/units, missing values versus real zeroes, cancellation/timeout, Manila time conversion, and dashboard loading, errors, repeated retry, success, and cleanup.

## Data sources and limitations

Current weather is fetched live from [Open-Meteo](https://open-meteo.com/). Official [forecast API documentation](https://open-meteo.com/en/docs), [terms](https://open-meteo.com/en/terms), and [licence conditions](https://open-meteo.com/en/licence) were reviewed on October 25, 2026. The free API is for noncommercial use with limits of 600 calls/minute, 5,000/hour, 10,000/day, and 300,000/month. This is an educational project without advertising or subscriptions; recheck terms before commercial or promotional deployment.

Data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Visible attribution links the provider and licence beside the dashboard panels and discloses presentation changes: values are rounded and weather codes are converted into descriptions/icons.

Open-Meteo's current conditions use weather-model data, not a local station observation. **Model data valid at** is the API's `current.time` (the time the modeled conditions apply). **Fetched by this app** is the device-clock time after receiving and reading the response; it is not the model run/update time. Both are displayed with date and seconds in **Asia/Manila (UTC+08:00)** using `Intl.DateTimeFormat`, independent of the device timezone. Unix timestamps avoid ambiguous parsing of local ISO strings. Device-clock accuracy affects the fetch timestamp. Missing model timestamps are labeled unavailable.

Temperatures use Celsius; wind speed uses km/h. Missing numeric readings display `—`. Missing or unknown weather codes display “Conditions unavailable” and a question-mark icon. Missing day/night information uses a neutral icon. No reading is substituted or inferred from another value. There is no freshness guarantee or automatic polling; check the model-valid time when assessing age. This is not an official PAGASA warning service.

Hourly and daily precipitation probabilities use **%**, not rainfall amounts in **mm**. This milestone does not request precipitation amounts.

## Philippine location search

The official [Open-Meteo geocoding documentation](https://open-meteo.com/en/docs/geocoding-api) was verified on October 25, 2026. Search sends a trimmed name to `/v1/search` with `countryCode=PH`, `count=10`, and `language=en`. The country filter is applied by the API before the result limit. Queries shorter than three characters do not make requests; input changes wait 300 ms before requesting. Each edit cancels the current request immediately, including during the next debounce. Version checks and abort signals stop late results/errors from replacing a newer search. Escape, focus leaving the search, selection, and unmount also cancel pending work.

Geocoding turns the name into candidate places with stable GeoNames IDs and WGS84 coordinates. The client independently requires `country_code === "PH"`, valid numeric coordinates, an integer ID, and a nonempty name. It accepts active populated-place/administrative-seat codes (`PPL`, `PPLA` through `PPLA5`, `PPLC`) and excludes boundaries, mountains, and abandoned places. [GeoNames feature definitions](https://www.geonames.org/export/codes.html) describe these codes. The provider can include villages and other smaller populated places; the results are not an authoritative list of legally designated cities or municipalities. Coverage, aliases, and ranking depend on the provider, so try another spelling or a province/region qualifier if a place is missing. Administrative qualifiers follow the provider's matching rules.

Results show province (`admin2`) and region (`admin1`) when returned, plus coordinates for disambiguation. Missing administrative fields are omitted rather than invented. Places with the same name remain separate results; duplicate IDs alone are removed. Selecting a result passes its full typed location object to the weather service, which sends those exact returned coordinates. Names are display labels, not lookup keys. The initial Manila seed retains milestone 2's coordinates; selecting Manila from search uses the coordinates returned by geocoding.

Use Arrow Down/Up to navigate, Enter to select, and Escape to close. Focus stays on the labeled combobox during navigation and returns there after selection. The active result is connected through `aria-activedescendant`; results use listbox/option semantics. Loading, empty results, and errors have status text; a failed search offers retry for the current query. The dropdown scrolls vertically inside its input width on mobile. Location data attribution links Open-Meteo and GeoNames under CC BY 4.0 in the dropdown and below the dashboard.

## Hourly and seven-day forecasts

The official [forecast documentation and field definitions](https://open-meteo.com/en/docs) were verified again on October 25, 2026. A separate `/v1/forecast` request uses the selected coordinates, `timezone=Asia/Manila`, `timeformat=unixtime`, Celsius, and `forecast_days=7`:

- Hourly: `temperature_2m` and `precipitation_probability`.
- Daily: `weather_code`, `temperature_2m_max`, `temperature_2m_min`, and `precipitation_probability_max`.

The API supplies parallel arrays: `hourly.time[i]`, temperature at index `i`, and probability at index `i` describe the same forecast timestamp. The service validates them and builds one typed object per timestamp. It selects 24 consecutive hourly points starting at the hour containing the fetch time, continuing into tomorrow. For example, a fetch at 11:35 PM Manila time shows 11 PM today through 10 PM tomorrow. It does not stop at midnight. Seven daily records start at Manila midnight today. This selection is fixed when fetched; there is no background polling, general refresh, or automatic midnight rollover yet. The device clock determines the selection window.

All timestamps are numeric Unix seconds from the API, converted once to milliseconds. `Intl.DateTimeFormat` explicitly uses Asia/Manila for charts, tooltips, tables, cards, and timestamps. Returned hourly/daily times are already absolute instants: no extra UTC+8 is added. The service computes Manila midnight using an explicit `+08:00` date solely to select the daily window; it does not shift the API's timestamps. Daily timestamps must represent consecutive Manila midnights. The next hour is selected by flooring the instant to the hour, which also works for Manila's whole-hour UTC offset.

Validation checks response structure, units, equal array lengths, finite numeric readings, 0–100% probability ranges, weather-code integers, and daily high/low consistency. Time arrays must be valid, ordered, unique, aligned, and consecutive at one-hour or one-day intervals. Incomplete 24-hour/seven-day coverage raises a retryable error. A null/omitted measurement series remains unavailable; a provided series with the wrong length or malformed numbers is rejected. Individual null readings remain null. Recharts uses straight segments and `connectNulls=false`, leaving gaps across missing readings. The table uses `—`; cards and tooltips say “Unavailable.” No missing reading is replaced by zero.

The two charts share time axes and synchronized tooltips. Temperature uses °C; the precipitation probability axis is fixed at 0–100%. Per the provider, hourly precipitation probability is the chance of more than 0.1 mm during the **preceding hour ending at the labeled time**. It is not an amount of rain. Daily cards show maximum/minimum temperature, the most severe forecast condition, and **maximum hourly precipitation probability** for each Manila calendar day. This maximum is not the probability of any rain occurring over the entire day.

Tooltips include date, time, value, and unit. The keyboard-accessible “View all 24 hourly values as a table” disclosure supplies every reading without requiring chart interaction. Daily cards wrap into two columns on mobile, and the table fits the page width. Model forecast valid times/dates are distinct from **Forecast fetched by this app**, which is the device-clock receipt time, not the model run time. Provider and CC BY 4.0 attribution appear inside the forecast panel.

Current weather and forecasts have independent requests, loading/error states, and retry buttons. A forecast failure does not clear successful current weather; retrying forecasts does not request current weather again. The forecast panel is keyed by selected ID and coordinates, so location changes immediately unmount the old panel and cancel its request. Old results and cancelled errors cannot overwrite the new panel. Favorites and general refresh remain for milestone 5.

## Verification

- `npm run check`: lint, strict TypeScript, production build.
- `npm test`: service validation/errors, weather-code mapping, timestamp formatting, dashboard state/retry, PH filtering, duplicate names/IDs, debounce, keyboard/click selection, and out-of-order search/weather/forecast responses. Forecast tests include malformed/missing arrays, missing-value chart gaps, 24-hour selection across midnight, seven-day labels, probability units/axis, tooltips, independent failures/retry, and Manila formatting with a different default timezone. Synthetic fixtures remain isolated to tests; the dashboard uses real API data.
- All 150 tests also passed under `TZ=America/New_York npm test`; an explicit default-timezone override test verifies Manila formatting. The operating system/browser timezone setting itself was not changed.
- Page scroll width matched viewport width at 320px, 390px, and 1280px, with no page-level horizontal overflow.
- Live weather and geocoding requests checked directly and in the browser, including duplicate-name selection and the resulting location/weather update.
- Browser layout checked at 1280px desktop and 320px/390px browser viewport overrides (also in mobile iframe viewports), including live forecasts for Manila and Cebu City, chart labels/tooltips, daily cards, the hourly table, timestamps, and attribution. Milestone 1’s outstanding mobile layout check was covered in milestone 2. These are browser viewport checks, not physical-device testing.

## Build and deployment

`npm run build` produces a static site in `dist/`; `npm run preview` lets you inspect it locally. Deployment platform configuration and fresh-install verification are planned for milestone 7. The site has not been deployed. Hosting under a repository subpath may require configuring Vite's `base` setting.

## Setup references

- [Vite requirements and scripts](https://vite.dev/guide/)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Recharts](https://github.com/recharts/recharts)

Exact installed versions are recorded in `package-lock.json`. Use `npm ci` to reproduce them.
