# Verification record

## Milestone 6 — interface and accessibility

Verified October 26, 2026. The following records earlier checks; they are separate from the production-build verification in milestone 7.

- `npm run check` and all 179 Vitest tests pass, including the full suite with `TZ=America/New_York`. New regression checks cover landmarks/skip targets, selected-location headings, concise status text, IME selection protection, favorite announcements/toggle state/removal focus, retry focus, table keyboard access, and refresh focus/in-flight guards. Existing weather/search/favorite/cache/rollover tests remain intact.
- axe-core 4.14.0 is a **development-only** dependency. Vitest scans the dashboard and expanded forecast table for WCAG A/AA structural issues; jsdom contrast and canvas-dependent visible-label checking are disabled because jsdom cannot reliably render them. The real browser scan included WCAG 2/2.1 A/AA rules and best practices, found text-contrast/visible-label issues, and reported zero violations after fixes. Some chart contrast checks were marked incomplete, so the automated result is not a full WCAG compliance claim.
- In the browser, rendered foreground/background pairs were cross-checked with WCAG relative-luminance calculations; the checked visible text pairs met at least 4.5:1. The input boundary and button borders were checked against 3:1, and focus indicators use a light ring on the dark card and a brown ring on light panels. Decorative weather/metric icons are paired with readable labels.
- Browser viewport checks covered **320, 390, 768, and 1280 CSS pixels**, both normal text and a doubled root text size (200%). Page scroll width matched viewport width. A tablet header overflow exposed by enlarged text was fixed. Charts, tooltip values, daily cards, long names/province labels, and the expanded forecast table were visually inspected; the table scrolls inside its own region when necessary.
- Manual browser keyboard checks covered skip-to-content, search arrows/Enter/Escape, selection, saving, switching to a favorite, removal and focus recovery, refresh, and search/current-weather/forecast retries. Live Manila/Cebu City weather and forecasts continued to load; refresh kept focus and successful same-location readings visible.
- A temporary, isolated browser QA entry used synthetic responses to exercise loading, empty search results, initial request errors, failed refresh with stale readings, long location labels, missing chart values, and blocked storage/session favorites. It was removed before the production build and commit. No mock data is imported by the production entry.
- [Before](screenshots/milestone6-before.png) and [after](screenshots/milestone6-after.png) desktop captures document the visual changes using live weather.

Remaining verification limits: the available in-app browser does not expose native browser zoom, and its zoom shortcut had no effect. **Native 200% browser zoom was not verified**; 200% text resizing and a 640px viewport (the CSS-width equivalent of a 1280px view at 200% zoom) were checked instead. No physical-device or screen-reader testing was performed. Synchronized pointer tooltips supplement, rather than replace, the keyboard-accessible table. Provider failures and model-data limitations still apply. Actual deployment was outside milestone 6; preparation and final verification are recorded below.

## Milestone 7 — clean install and production build

Verified October 26, 2026. No deployment was performed.

### Reproducible local checks

A fresh temporary directory was populated from tracked source files plus the new `.nvmrc`, including the milestone 7 Node/runtime and metadata changes. It had no existing/shared `node_modules`, build output, environment files, or dependency symlink. The primary working directory and its installed dependencies were left intact.

- Runtime: Node **24.22.1**, npm **11.12.1**. A temporary Node 24 runtime from the official npm `node` package was used because the host default was Node 25.9.0. The repository now selects Node 24 with `.nvmrc` and `engines.node=24.x`.
- `npm ci`: success; 166 packages installed, 167 audited, zero vulnerabilities reported by that install's npm audit. This is a point-in-time report, not a permanent security guarantee.
- `npm run check`: Oxlint, strict TypeScript checks, and Vite production build all passed.
- `npm test`: **179/179** tests across 13 files passed.
- `TZ=America/New_York npm test`: **179/179** passed. This runs the existing timezone/default-formatting and controlled-clock rollover checks; the operating system/browser timezone itself was not changed.
- The lockfile's dependency versions were preserved. Only the root Node engine metadata changed; no dependency upgrades or unrelated refactoring were made.

### Production preview

The temporary directory's built `dist/` was served with:

```sh
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

The in-app browser visited this production preview, separate from the existing development server. Live Open-Meteo requests were used, with no mocks or QA harness:

1. Loaded Manila current weather and forecasts.
2. Saved Manila; searched for Cebu City, selected it with Arrow Down/Enter, and saved it.
3. Reloaded and confirmed both favorites persisted. Reload began at Manila as designed.
4. Selected the Cebu City favorite and loaded its coordinates' current weather and forecasts.
5. Refreshed both resources. The button stayed focused and unavailable while updating; successful fetch timestamps advanced independently of the weather-valid time.
6. Opened the hourly table by keyboard: **24 data rows**, two rendered chart SVGs, and **seven daily cards** were present. Inspected the hourly chart axes and daily cards. Returned to the Manila favorite and confirmed its weather/forecasts.
7. At **320, 390, 768, and 1280 CSS-pixel** viewports, document scroll width equaled viewport width; no page-level horizontal overflow was observed. The temporary viewport override was reset afterward.

Browser console error/warning logs were empty during the tested flow. No failed API requests surfaced in the UI or console: search, both weather resources, and refresh completed successfully. Local HTTP checks returned **200** with expected HTML/JavaScript/CSS content types for the index and entry assets; the separately loaded forecast chunk was rendered successfully in the browser. This was a smoke test, not continuous monitoring or a captured HAR/network reliability study.

The [current screenshot](screenshots/dashboard.png) comes from this local production build. It is not evidence of a public deployment.

### Source and output audit

- Tracked-file inspection found no `node_modules`, `dist`, `.env` files, or local hosting output. Existing `.gitignore` rules exclude dependencies, build output, and local environment files.
- Text-file review and common credential-signature searches found no credentials/private keys. This is not an exhaustive third-party secret scan or Git-history security audit.
- The production import paths and generated HTML/JavaScript/CSS were checked for test/mock fixtures, Vitest/Testing Library/axe-core markers, temporary QA entries, Vite development entries, and local absolute filesystem paths. None were found. Production output consisted of the index, stylesheet, main bundle, and lazy forecast bundle.
- Source tests and fixtures remain tracked for reproducible testing, but are not part of the production import graph. Build tools/devDependencies are needed at install/build time; they are not a development-server runtime requirement for the static output.
- README relative links and screenshot files were checked. The page description now describes completed features, and the visible development counter reads 7/7.

### Deployment preparation and remaining limits

No existing hosting configuration was present. Vercel's Vite detection and root/static output defaults fit this app, so no `vercel.json`, rewrites, server plugin, or custom Vite base was added. README records Node 24.x, `npm ci`, `npm run build`, `dist`, no required environment variables, and post-deployment checks. Official Vercel/Vite and provider terms/licence pages were checked on October 26, 2026; links are in README.

Open-Meteo's terms distinguish noncommercial educational/personal use from commercial/promotional activities. Public portfolio use must be assessed against that distinction before publishing; the guide does not claim blanket free-tier eligibility or provider endorsement.

The Vercel cloud install/build, public HTTPS origin, hosting-specific API behavior, and any custom domain remain unverified because deployment was explicitly outside this milestone. No physical-device, screen-reader, or native 200% browser-zoom testing was added. Earlier accessibility limits still apply. No extra milestones were created.
