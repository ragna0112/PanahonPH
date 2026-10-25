# PanahonPH — Philippine Weather Dashboard

A student portfolio project built one milestone at a time: readable, responsive weather information for Philippine cities and municipalities.

## Current progress

Milestone 1 is complete. The dashboard is a responsive shell with honest empty states. **Weather data is not connected yet.** Manila is a planned initial location, not a live reading. Search and saved-location controls are intentionally disabled and labeled with their future milestones.

- [x] 1 — Project foundation and responsive dashboard shell
- [ ] 2 — Live current weather for Manila
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
npm run preview    # Serves an existing production build locally
```

No API keys or environment variables are needed. Do not commit secrets or local .env files.

## Small architecture

- `src/main.tsx` mounts React and loads the shared stylesheet.
- `src/App.tsx` contains the dashboard sections and a small reusable `EmptyMetric` component. Each metric receives its icon, label, and unit description as props.
- `src/index.css` loads Tailwind CSS and defines the visual design and responsive breakpoints.
- `vite.config.ts` enables React and the official Tailwind Vite plugin.

React renders the interface, TypeScript checks data and component contracts, and Vite runs the development server and builds the site. Tailwind CSS 4 is installed through its Vite integration. Recharts is installed with compatible React peer dependencies for milestone 4; it is not rendered or bundled into the dashboard yet. Lucide provides decorative interface icons.

There is no API service yet. A small typed service layer will be introduced with the first real request in milestone 2. There is no backend, database, authentication, or persisted location state. Logic tests will be added when API transformations, filtering, and error handling are introduced; this milestone has no such logic to test.

## Data sources and limitations

[Open-Meteo](https://open-meteo.com/) is the planned weather and geocoding provider. No requests are made in this milestone. Before integration, verify the current official [weather API documentation](https://open-meteo.com/en/docs), [geocoding documentation](https://open-meteo.com/en/docs/geocoding-api), [terms](https://open-meteo.com/en/terms), and attribution requirements.

Future readings will use Celsius, readable metric units, and Asia/Manila times. Precipitation probability (%) will be distinguished from rainfall amount (mm). Philippine search results will include province or region when available. Timestamp labels will explain what their time represents.

This is a portfolio project, not an official PAGASA warning service. No live weather, forecast, or last-updated time is displayed yet. The sun and cloud are decorative illustrations, not reported conditions.

## Build and deployment

`npm run build` produces a static site in `dist/`; `npm run preview` lets you inspect it locally. Deployment platform configuration and fresh-install verification are planned for milestone 7. The site has not been deployed. Hosting under a repository subpath may require configuring Vite's `base` setting.

## Setup references

- [Vite requirements and scripts](https://vite.dev/guide/)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Recharts](https://github.com/recharts/recharts)

Exact installed versions are recorded in `package-lock.json`. Use `npm ci` to reproduce them.
