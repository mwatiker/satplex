# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Satplex** (satplex.io) is a real-time 3D satellite tracking web app. It renders thousands of orbital objects on an interactive globe using client-side SGP4 propagation. The project has three pieces: a React/TypeScript frontend, a Node.js backend server, and a thin Swift/SwiftUI iOS wrapper app.

## Commands

### Frontend (root directory)
```bash
npm run dev       # Start Vite dev server (proxies /api to localhost:3001)
npm run build     # TypeScript check + production build → dist/
npm run lint      # ESLint
npm run preview   # Serve the dist/ build locally
```

### Backend (server/)
```bash
cd server && npm start          # Start Express server on port 3001
cd server && node sync-pipeline.js  # Run the full data sync pipeline manually
```

The Vite dev server proxies all `/api` requests to `http://localhost:3001`, so both must be running for local full-stack development.

## Architecture

### Frontend (`src/`)

**Entry point:** `src/main.tsx` → `src/AppOptimized.tsx`

`AppOptimized.tsx` is the root component. It owns all top-level state: satellite list, selected satellite, ground track, filters, and layout mode (mobile vs desktop). It branches layout into:
- **Desktop**: left `<Sidebar>` (satellite list + filters) + right panel (`<SatelliteDetailView>`)
- **Mobile**: floating pill buttons + `<BottomSheet>` for details, `<FilterSheet>` and `<SatelliteList>` sheets

**Data flow:**
1. `fetchSatelliteData()` (`src/services/satelliteData.ts`) fetches a compact binary orbital buffer (`/api/orbital-binary`, 11 floats per satellite) + a lightweight JSON index (`/api/satellite-list`) + SatNOGS metadata. These are merged into `MergedSatellite[]` objects.
2. The binary buffer is transferred (zero-copy) to two Web Workers:
   - `satellite.worker.ts` — continuously propagates positions for the globe (responds to `GET_POSITIONS` ticks)
   - `track.worker.ts` — computes ground tracks for a selected satellite on demand
3. Workers use `satellite.js` (SGP4) via helpers in `src/utils/orbitalPhysics.ts`.
4. Deep satellite metadata is fetched lazily on selection via `fetchSatelliteDetail(noradId)` → `/api/satellite/${noradId}`.

**Filtering:** `useSatelliteFilters` hook (`src/hooks/useSatelliteFilters.ts`) handles all filter state and derives `filteredSatellites`. On desktop, filter changes propagate a `Set<number>` of visible NORAD IDs to the globe via `visibleNoradIds`. On mobile, filters are cleared when switching orientations.

**Globe rendering:** `SatelliteGlobeOptimized.tsx` uses `react-globe.gl` (Three.js under the hood) with custom GLSL shaders to render satellites as instanced geometry. Position buffers from the worker are written directly into GPU attribute arrays each frame.

**Routing:** React Router with a single parameterized route `/satellite/:noradId` for deep-linking to a specific satellite.

**iPad landscape detection:** The app detects iPad landscape via `navigator.userAgent` / `navigator.maxTouchPoints` and narrows sidebar panels from 360px to 240px.

**Device rotation:** Custom `satplexrotationstart` / `satplexrotationend` window events trigger a black overlay to prevent users seeing mid-rotation layout jank.

### Backend (`server/`)

**`server/index.js`** — Express server (port 3001). Serves the `dist/` static files and exposes these API routes:
- `GET /api/orbital-binary` — binary Float32Array of orbital elements (11 floats per satellite)
- `GET /api/satellite-list` — lightweight JSON index (name, noradId, objectType, apoapsis, launchYear, decayed, countries)
- `GET /api/satnogs` — SatNOGS metadata (telemetry status, descriptions)
- `GET /api/satellite/:noradId` — deep metadata from master DB + AI description
- `GET /api/health` — returns `cacheVersion` used by the frontend to bust its localStorage cache

**`server/master-satellite-data.json`** — the authoritative satellite database, built by the pipeline. This file is committed and updated daily.

**Data pipeline (`server/sync-pipeline.js`)** runs these steps in order:
1. `sync-satnogs.js` — fetch SatNOGS operational statuses
2. `sync-spacetrack.js` — fetch Space-Track.org full catalog + GCAT
3. `build-master-db.js` — merge all sources into `master-satellite-data.json`
4. `generate-descriptions.js` — generate AI descriptions for new satellites via DeepSeek API
5. `update-exclusions.js` — refresh `exclusion_list.json` based on propagation failures

### iOS wrapper (`xcode_files/`)

A minimal Xcode project that wraps the deployed site (`https://satplex.io/`) in a `WKWebView` for the App Store build — no bundled web assets, it just loads the live production URL.

- **`ContentView`** — `SatplexWebViewController` (UIKit) hosts the `WKWebView`, embedded into SwiftUI via `WebView: UIViewControllerRepresentable`. Defers the initial `webView.load()` until `viewDidLayoutSubviews()` reports real, non-zero bounds (view.bounds at `viewDidLoad` time isn't reliably settled to the final launch orientation, especially on larger iPads). On rotation, `viewWillTransition` shows a native black overlay, waits for the animation, then injects `--app-width`/`--app-height` CSS vars and `window.__satplexIsLandscape` into the page via `evaluateJavaScript` and dispatches a `resize` event — this is the bridge the frontend's `useIsMobile` hook (`src/hooks/useIsMobile.ts`) reads on iPad instead of trusting raw `innerWidth`/`innerHeight`.
- **`satelliteProjectXCodeApp`** — the `@main` SwiftUI `App` entry point, just presents `ContentView`.

### Deployment & CI

- **Push to `main`** triggers `.github/workflows/deploy.yml`, which SSH-deploys to a DigitalOcean droplet running `~/deploy.sh`.
- **Daily cron** (midnight UTC) runs `.github/workflows/daily-sync.yml`: runs the sync pipeline, commits updated JSON files, then deploys.
- Commits from the bot use `[skip ci]` to avoid triggering the deploy workflow a second time.
- `VITE_API_BASE_URL` controls the API base in the frontend; defaults to `https://satplex.io` if unset.
