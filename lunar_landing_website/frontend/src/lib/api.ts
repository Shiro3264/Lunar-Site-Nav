/**
 * LunaNav API client.
 *
 * Thin, typed wrapper over the Django/DRF backend.  When `VITE_API_BASE_URL` is
 * empty the requests go to the Vite dev proxy (`/api`), which forwards to the
 * Django server.
 */
import axios, { AxiosError } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "";

export const http = axios.create({
  baseURL,
  timeout: 120_000,
  headers: { "Content-Type": "application/json" },
});

/** Normalised error message extracted from a DRF error body. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as
      | { error?: { detail?: unknown }; detail?: unknown }
      | undefined;
    const detail = data?.error?.detail ?? data?.detail;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

// --------------------------------------------------------------------------- //
// Shared types
// --------------------------------------------------------------------------- //
export interface TerrainContext {
  elevation_m: number | null;
  source: string;
  dataset: string;
  confidence: string;
  available: boolean;
  resolution_m: number | null;
  slope_deg: number | null;
  aspect_deg: number | null;
  roughness_rms_m: number | null;
  local_relief_m: number | null;
  note: string;
}

export interface Site {
  id: number;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string;
  notes: string;
  source: string;
  is_candidate: boolean;
  terrain?: TerrainContext | null;
}

export interface SunSample {
  time_utc: string | null;
  azimuth_deg: number | null;
  elevation_deg: number | null;
  angular_radius_deg: number;
  center_above_geometric_horizon: boolean | null;
  limb_above_geometric_horizon: boolean | null;
  azimuth_compass: string | null;
  site_daylight: boolean | null;
  interferer_above_horizon: boolean | null;
  direction_enu: [number, number, number] | null;
  direction_bodyfixed: [number, number, number] | null;
  direction_scene: [number, number, number] | null;
}

export interface IlluminationState {
  time_utc: string | null;
  sun_azimuth_deg: number | null;
  sun_elevation_deg: number | null;
  sun_angular_radius_deg: number;
  geometric_centre_above: boolean | null;
  geometric_limb_above: boolean | null;
  horizons_daylight: boolean | null;
  terrain_horizon_deg: number | null;
  terrain_clear: boolean | null;
  illuminated: boolean | null;
  incidence_angle_deg: number | null;
  reason: string;
  confidence: string;
  note: string;
}

export interface EarthLinkState {
  time_utc: string | null;
  earth_azimuth_deg: number | null;
  earth_elevation_deg: number | null;
  earth_angular_radius_deg: number;
  geometric_visible: boolean | null;
  limb_geometric_visible: boolean | null;
  terrain_visible: boolean | null;
  terrain_horizon_deg: number | null;
  elevation_margin_deg: number | null;
  required_mast_m: number | null;
  one_way_light_time_s: number | null;
  accessibility: string;
  confidence: string;
  note: string;
}

export interface TimelineRow {
  time: string;
  timestamp_aligned?: string | null;
  sun: SunSample | null;
  earth: SunSample | null;
  illumination: IlluminationState;
  earth_link: EarthLinkState;
  solar_power_w: number | null;
}

export interface IlluminationSummary {
  samples: number;
  illuminated_samples: number;
  illuminated_fraction: number | null;
  geometric_daylight_fraction: number | null;
  longest_continuous_illumination_h: number | null;
  longest_continuous_darkness_h: number | null;
  mean_sun_elevation_when_up_deg: number | null;
  sample_interval_h: number | null;
  note: string;
}

export interface SolarSummary {
  samples: number;
  interval_h: number | null;
  peak_power_w: number | null;
  mean_power_w: number | null;
  energy_wh: number | null;
  illuminated_fraction: number | null;
  equivalent_sun_hours: number | null;
  panel: Record<string, number>;
  note: string;
  assumptions: string[];
}

export interface CommunicationSummary {
  samples: number;
  geometric_fraction: number | null;
  terrain_fraction: number | null;
  max_required_mast_m: number | null;
  mean_elevation_deg: number | null;
  peak_elevation_deg: number | null;
  interval_h: number | null;
  note?: string;
}

export interface SubScore {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  rationale: string;
  inputs: Record<string, unknown>;
}

export interface SuitabilityResult {
  composite_score: number | null;
  grade: string;
  sub_scores: SubScore[];
  weights: Record<string, number>;
  missing_inputs: string[];
  disclaimer: string;
}

export interface AnalysisWindow {
  start_utc: string;
  stop_utc: string;
  step: string;
  interval_h?: number | null;
  samples?: number;
}

export interface AnalysisResult {
  site: {
    latitude_deg: number;
    longitude_deg: number;
    altitude_km?: number;
    slug?: string | null;
    name?: string;
    east_positive_longitude?: boolean;
    longitude_convention?: string;
  };
  window: AnalysisWindow;
  frames?: Record<string, string>;
  terrain: TerrainContext;
  timeline?: TimelineRow[];
  rows?: TimelineRow[];
  illumination_summary: IlluminationSummary;
  solar_summary: SolarSummary;
  communication_summary: CommunicationSummary;
  suitability: SuitabilityResult;
  ephemeris_meta?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  analysis_run_id?: number;
}

export interface HorizonProfile {
  latitude: number;
  longitude: number;
  observer_height_m: number;
  terrain_available: boolean;
  terrain_source: string;
  confidence: string;
  profile: { azimuth_deg: number; horizon_elevation_deg: number }[];
}

export interface TerrainMesh {
  size_km: number;
  grid: number;
  heights_m: number[][];
  min_m: number;
  max_m: number;
  source: string;
  confidence: string;
  available: boolean;
  note: string;
}

export interface MoonOrientation {
  epoch_utc: string;
  frame: string;
  source: string;
  confidence: string;
  pole_ra_deg: number;
  pole_dec_deg: number;
  prime_meridian_deg: number;
  bodyfixed_to_inertial: number[][];
  note: string;
}

export interface SubPoints {
  available: boolean;
  subsolar_lat_lon: [number, number] | null;
  subearth_lat_lon: [number, number] | null;
  orientation_frame?: string;
  orientation_source?: string;
  orientation_confidence?: string;
  note: string;
}

export interface MoonRotationSample {
  epoch_utc: string;
  pole_ra_deg: number;
  pole_dec_deg: number;
  prime_meridian_deg: number;
  bodyfixed_to_inertial: number[][];
}

export interface MoonRotation {
  frame: string;
  source: string;
  confidence: string;
  reference_frame: string;
  mean_radius_km: number;
  synchronous_rotation: boolean;
  sidereal_period_days: number;
  window: AnalysisWindow;
  samples: MoonRotationSample[];
  note: string;
}

export interface HealthStatus {
  status: string;
  time_utc: string;
  database: { connected: boolean; engine: string };
  integrations: {
    spice: { available: boolean; kernels: string[] };
    lola_dem: Record<string, unknown>;
  };
  version: string;
}

export interface AnalysisRequest {
  latitude?: number;
  longitude?: number;
  altitude_km?: number;
  site_slug?: string;
  start?: string;
  stop?: string;
  step?: string;
  allow_synthetic?: boolean;
  observer_height_m?: number;
  panel?: {
    area_m2?: number;
    efficiency?: number;
    tilt_from_horizontal_deg?: number;
    azimuth_deg?: number;
    system_derate?: number;
  };
  persist?: boolean;
}

// --------------------------------------------------------------------------- //
// Endpoints
// --------------------------------------------------------------------------- //
export const api = {
  health: () => http.get<HealthStatus>("/api/health/").then((r) => r.data),

  meta: () => http.get<Record<string, unknown>>("/api/meta/").then((r) => r.data),

  listSites: (enrich = false) =>
    http
      .get<{ count: number; results: Site[] }>("/api/sites/", {
        params: enrich ? { enrich: "true" } : {},
      })
      .then((r) => r.data),

  getSite: (slug: string) => http.get<Site>(`/api/sites/${slug}/`).then((r) => r.data),

  siteAnalysis: (slug: string, params: { start?: string; stop?: string; step?: string } = {}) =>
    http.get<AnalysisResult>(`/api/sites/${slug}/analysis/`, { params }).then((r) => r.data),

  validateCoordinate: (body: {
    latitude: number;
    longitude: number;
    altitude_km?: number;
    label?: string;
    enrich_terrain?: boolean;
    persist?: boolean;
  }) =>
    http
      .post<{
        input: Record<string, number>;
        normalised: {
          latitude_deg: number;
          longitude_deg: number;
          longitude_convention: string;
          east_positive_longitude: boolean;
        };
        terrain: TerrainContext | null;
        note: string;
        saved?: { id: number; label: string };
      }>("/api/coordinates/validate/", body)
      .then((r) => r.data),

  analyze: (body: AnalysisRequest) =>
    http.post<AnalysisResult>("/api/ephemeris/analyze/", body).then((r) => r.data),

  ephemerisTimeline: (params: {
    latitude?: number;
    longitude?: number;
    site_slug?: string;
    start?: string;
    stop?: string;
    step?: string;
  }) =>
    http
      .get<{
        site: { latitude_deg: number; longitude_deg: number; slug: string | null };
        window: AnalysisWindow;
        rows: TimelineRow[];
        meta: Record<string, unknown>;
      }>("/api/ephemeris/timeline/", { params })
      .then((r) => r.data),

  terrainElevation: (params: { latitude: number; longitude: number }) =>
    http
      .get<TerrainContext>("/api/terrain/elevation/", { params })
      .then((r) => r.data),

  terrainHorizon: (params: {
    latitude: number;
    longitude: number;
    azimuths?: number;
    observer_height_m?: number;
  }) => http.get<HorizonProfile>("/api/terrain/horizon/", { params }).then((r) => r.data),

  terrainMesh: (params: { latitude: number; longitude: number; size_km?: number; grid?: number }) =>
    http.get<TerrainMesh>("/api/terrain/mesh/", { params }).then((r) => r.data),

  terrainDataset: () => http.get<Record<string, unknown>>("/api/terrain/dataset/").then((r) => r.data),

  moonOrientation: (params: { time?: string } = {}) =>
    http.get<MoonOrientation>("/api/moon/orientation/", { params }).then((r) => r.data),

  subPoints: (params: { start?: string; stop?: string; step?: string } = {}) =>
    http.get<SubPoints>("/api/ephemeris/sub-points/", { params }).then((r) => r.data),

  moonRotation: (params: { start?: string; stop?: string; step?: string } = {}) =>
    http.get<MoonRotation>("/api/moon/rotation/", { params }).then((r) => r.data),

  illuminationAnalyze: (body: AnalysisRequest) =>
    http.post<AnalysisResult>("/api/illumination/analyze/", body).then((r) => r.data),

  solarEstimate: (body: AnalysisRequest) =>
    http.post<AnalysisResult>("/api/solar/estimate/", body).then((r) => r.data),

  communicationAnalyze: (body: AnalysisRequest) =>
    http.post<AnalysisResult>("/api/communication/analyze/", body).then((r) => r.data),

  suitabilityAssess: (body: AnalysisRequest) =>
    http.post<AnalysisResult>("/api/suitability/assess/", body).then((r) => r.data),

  suitabilityRank: (body: { site_slugs?: string[]; start?: string; stop?: string; step?: string }) =>
    http
      .post<{
        window: AnalysisWindow;
        weights: Record<string, number>;
        sites: RankedSite[];
        disclaimer: string;
      }>("/api/suitability/rank/", body)
      .then((r) => r.data),

  compareSites: (body: {
    sites: { slug?: string; latitude?: number; longitude?: number; label?: string }[];
    start?: string;
    stop?: string;
    step?: string;
  }) =>
    http
      .post<{
        window: AnalysisWindow;
        count: number;
        sites: ComparedSite[];
        ranking: string[];
        disclaimer: string;
      }>("/api/sites/compare/", body)
      .then((r) => r.data),

  listReports: () =>
    http.get<{ count: number; results: AnalysisReport[] }>("/api/reports/").then((r) => r.data),

  getReport: (id: number) => http.get<AnalysisReport>(`/api/reports/${id}/`).then((r) => r.data),

  generateReport: (body: {
    title: string;
    site_slug?: string;
    latitude?: number;
    longitude?: number;
    start?: string;
    stop?: string;
    step?: string;
    summary?: string;
  }) => http.post<AnalysisReport>("/api/reports/generate/", body).then((r) => r.data),
};

export interface RankedSite {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  composite_score: number | null;
  grade: string;
  sub_scores: SubScore[];
  terrain: TerrainContext;
  illumination_summary: IlluminationSummary;
  solar_summary: SolarSummary;
  communication_summary: CommunicationSummary;
}

export interface ComparedSite {
  slug: string | null;
  name: string;
  latitude: number;
  longitude: number;
  terrain: TerrainContext;
  illumination_summary: IlluminationSummary;
  solar_summary: SolarSummary;
  communication_summary: CommunicationSummary;
  suitability: SuitabilityResult;
  error?: string;
}

export interface AnalysisReport {
  id: number;
  title: string;
  site: number | null;
  site_slug: string | null;
  latitude: number | null;
  longitude: number | null;
  window_start_utc: string | null;
  window_stop_utc: string | null;
  step: string;
  summary: string;
  snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
