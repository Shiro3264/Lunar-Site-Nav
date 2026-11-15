# LunaNav — Lunar Landing Site Navigator & Mission Intelligence System

LunaNav is a scientific mission-planning web application for evaluating
candidate lunar landing sites, with particular focus on the Lunar South Pole.
It combines a React / Three.js interactive 3D interface with a Django REST
backend that queries JPL Horizons ephemeris data, NASA LOLA terrain data, and
NAIF SPICE orientation kernels.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Backend Setup](#backend-setup)
5. [Frontend Setup](#frontend-setup)
6. [Environment Variables](#environment-variables)
7. [Database Migrations & Seed Data](#database-migrations--seed-data)
8. [Running the Application](#running-the-application)
9. [API Documentation](#api-documentation)
10. [Testing](#testing)
11. [Optional Scientific Data](#optional-scientific-data)
12. [Known Scientific Limitations](#known-scientific-limitations)

---

## Quick Start

```bash
# 1 — Backend
cd lubar_landing_website/backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
copy .env.example .env          # Windows
# cp .env.example .env          # macOS / Linux
python manage.py migrate
python manage.py seed_sites
python manage.py runserver

# 2 — Frontend (new terminal)
cd lubar_landing_website/frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Architecture

```
lubar_landing_website/
├── backend/                    Python 3.12 · Django 5 · DRF
│   ├── apps/                   Django applications (one per domain)
│   │   ├── core/               Health, metadata, shared utilities
│   │   ├── landing_sites/      Candidate and custom site CRUD
│   │   ├── ephemeris/          JPL Horizons + SPICE orientation
│   │   ├── lunar_terrain/      LOLA DEM endpoints
│   │   ├── illumination/       Terrain-aware sunlight timeline
│   │   ├── solar_energy/       Panel power estimates
│   │   ├── communication/      Earth link geometry
│   │   ├── suitability/        Weighted suitability index + ranking
│   │   └── mission_reports/    Report generation & persistence
│   ├── integrations/
│   │   ├── horizons/           JPL Horizons HTTP client + parser
│   │   ├── lola.py             NASA LOLA DEM rasterio integration
│   │   └── spice.py            NAIF SPICE orientation (optional)
│   ├── scientific_engine/      Pure-Python science layer
│   │   ├── coordinates.py      Frame transformations (bf / ENU / scene)
│   │   ├── terrain.py          Elevation, slope, horizon, ray-clear
│   │   ├── illumination.py     Four distinct visibility notions
│   │   ├── communication.py    Earth LOS and mast geometry
│   │   ├── solar_energy.py     Direct-beam power model
│   │   ├── suitability.py      Explainable 0-100 suitability index
│   │   └── services.py         Orchestration layer
│   ├── scientific_data/
│   │   ├── lola/               Place LOLA DEM tiles here (optional)
│   │   └── spice/              Place NAIF SPICE kernels here (optional)
│   └── tests/                  pytest test suite
│
└── frontend/                   React 18 · Vite · TypeScript
    ├── src/
    │   ├── landing/            Migrated marketing landing page
    │   ├── pages/              All 15 dashboard tool pages
    │   ├── three/              React Three Fiber components
    │   ├── components/         Shared UI components
    │   ├── hooks/              useAsync and other hooks
    │   ├── lib/                API client, constants, utilities
    │   └── state/              AppContext (global state)
    └── e2e/                    Playwright end-to-end tests
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.12 | Required. 3.15 not supported (NumPy/SciPy lack wheels). |
| Node.js | 18 LTS or 20 LTS | Required for frontend. |
| npm | 9+ | Included with Node. |
| PostgreSQL | 14+ | Optional — SQLite used automatically without it. |

---

## Backend Setup

```bash
cd lubar_landing_website/backend

# Create virtual environment with Python 3.12
"C:\Users\<you>\AppData\Local\Programs\Python\Python312\python.exe" -m venv .venv

# Activate (Windows PowerShell)
.venv\Scripts\activate

# Activate (macOS / Linux)
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env     # Windows
# cp .env.example .env     # macOS / Linux
# Edit .env — at minimum set DJANGO_SECRET_KEY
```

---

## Frontend Setup

```bash
cd lubar_landing_website/frontend
npm install
```

The frontend's `.env.example` is pre-configured for local development.
No changes are required to run against the local Django server.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | *(required)* | Django secret key — set a long random string |
| `DJANGO_DEBUG` | `true` | Set `false` in production |
| `POSTGRES_DB` | *(blank)* | Leave blank to use SQLite |
| `LOLA_DEM_DIR` | `scientific_data/lola` | Directory for LOLA DEM tiles |
| `SPICE_KERNEL_DIR` | `scientific_data/spice` | Directory for NAIF SPICE kernels |
| `HORIZONS_CACHE_TTL` | `3600` | Horizons response cache TTL (seconds) |

Full list in `backend/.env.example`.

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | *(blank)* | Leave blank — Vite proxy handles `/api` |
| `VITE_API_PROXY` | `http://127.0.0.1:8000` | Django dev server URL |

---

## Database Migrations & Seed Data

```bash
cd lubar_landing_website/backend
.venv\Scripts\activate

# Create all tables
python manage.py migrate

# Load the four initial candidate sites
python manage.py seed_sites

# (Optional) Force-replace any existing seed data
python manage.py seed_sites --purge
```

---

## Running the Application

**Terminal 1 — Backend:**
```bash
cd lubar_landing_website/backend
.venv\Scripts\activate
python manage.py runserver
# Running at http://127.0.0.1:8000
```

**Terminal 2 — Frontend:**
```bash
cd lubar_landing_website/frontend
npm run dev
# Running at http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## API Documentation

With the backend running, interactive API docs are available at:

- **Swagger UI:** http://127.0.0.1:8000/api/docs/
- **ReDoc:** http://127.0.0.1:8000/api/redoc/
- **OpenAPI schema:** http://127.0.0.1:8000/api/schema/

### Key endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/health/` | Service health + integration status |
| GET | `/api/meta/` | Frames, conventions, candidate sites |
| GET | `/api/sites/` | List landing sites |
| POST | `/api/sites/` | Create custom site |
| GET | `/api/sites/{slug}/` | Retrieve one site |
| GET | `/api/sites/{slug}/analysis/` | Full site analysis |
| POST | `/api/sites/compare/` | Side-by-side comparison |
| POST | `/api/coordinates/validate/` | Validate coordinate |
| POST | `/api/ephemeris/analyze/` | Full ephemeris analysis |
| GET | `/api/ephemeris/timeline/` | Sun + Earth timeline |
| GET | `/api/moon/orientation/` | SPICE orientation at epoch |
| GET | `/api/moon/rotation/` | Rotation series |
| GET | `/api/terrain/elevation/` | Elevation + slope |
| GET | `/api/terrain/mesh/` | 3D terrain grid |
| GET | `/api/terrain/horizon/` | Horizon profile |
| POST | `/api/illumination/analyze/` | Sunlight timeline |
| POST | `/api/solar/estimate/` | Solar energy estimate |
| POST | `/api/communication/analyze/` | Earth link analysis |
| POST | `/api/suitability/assess/` | Suitability index |
| POST | `/api/suitability/rank/` | Site ranking |
| POST | `/api/reports/generate/` | Generate mission report |

---

## Testing

### Backend (pytest)

```bash
cd lubar_landing_website/backend
.venv\Scripts\activate

# Run all tests
pytest tests/ -v

# Run specific test module
pytest tests/test_coordinates.py -v
pytest tests/test_suitability.py -v
pytest tests/test_horizons_parser.py -v
pytest tests/test_terrain.py -v
pytest tests/test_illumination.py -v
pytest tests/test_api_sites.py -v
```

### Frontend (Vitest)

```bash
cd lubar_landing_website/frontend

# Run all unit tests once
npm test

# Watch mode
npm run test:watch
```

### End-to-end (Playwright)

```bash
cd lubar_landing_website/frontend

# Install browsers (first time only)
npx playwright install chromium

# Run e2e tests (requires both servers running)
npm run e2e

# Run with UI mode
npx playwright test --ui
```

---

## Optional Scientific Data

LunaNav runs without either dataset; it falls back to clearly-labelled
lower-confidence estimates in both cases.

### NASA LOLA DEM tiles

Download south-pole DEM products from the NASA PDS:
https://pds.nasa.gov/ → LRO → LOLA → Polar DEMs

Place GeoTIFF (`.tif`) or JP2 (`.jp2`) tiles in:
```
backend/scientific_data/lola/
```

### NAIF SPICE kernels

Download from https://naif.jpl.nasa.gov/naif/data.html

Required files (place in `backend/scientific_data/spice/`):
```
naif0012.tls
pck00010.tpc
moon_de440_250416.tf
moon_pa_de440_200625.bpc
```

Without these kernels the orientation module falls back to a linear
IAU_MOON approximation with confidence labelled `"low"`.

---

## Known Scientific Limitations

1. **Shape model is spherical.** The Moon's true shape is triaxial. All
   coordinate conversions use R = 1737.4 km to match JPL Horizons'
   `coord@301` geometry. Deviations from the true ellipsoid are < 10 km
   at the poles and are not corrected.

2. **SPICE fallback omits libration.** Without NAIF kernels the orientation
   module uses a linear IAU_MOON model that excludes physical libration
   (errors up to a few degrees). The API labels this `confidence: "low"`.

3. **Terrain is synthetic without LOLA tiles.** The procedural fallback is
   deterministic but not measured. All synthetic results are labelled
   `source: "synthetic_illustrative"`.

4. **Solar power model is an estimate.** The direct-beam model omits dust
   accumulation, cell temperature derating, pointing losses, battery
   round-trip efficiency, and wiring losses beyond the user-supplied derate.
   It is not a flight power budget.

5. **Suitability scores are decision-support heuristics.** A score of 90/100
   is NOT a 90% probability of landing success. The index ranks candidate
   sites by transparent, physically-motivated sub-scores to support human
   decision-making, not to certify flight readiness.

6. **Horizons step and window limits.** The API caps timelines at 720 steps
   per request (`MAX_TIMELINE_STEPS`). Very long windows at fine step sizes
   will be truncated.

7. **UTC vs TDB epoch offset.** SPICE operates in TDB; JPL Horizons
   timestamps are UT. The ~69-second offset is negligible for orbital
   geometry and sub-solar/sub-Earth point display but is documented here.

8. **Terrain horizon maximum range.** The horizon profile uses a 30 km
   maximum look-ahead by default. Very flat polar terrain may have
   obstructions beyond this range that are missed.

9. **No atmospheric model.** The Moon has no appreciable atmosphere.
   There is no refraction correction, no sky background model, and no
   atmospheric path loss in the communication analysis.

10. **No real-time data.** All analyses use the user-selected time window
    queried from JPL Horizons. The app does not stream live telemetry.
