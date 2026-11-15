"""High-level orchestration for LunaNav scientific analyses.

This module is the single bridge between the (pure) scientific engine /
integrations and the Django API layer.  It fetches JPL Horizons ephemerides,
interprets them, and produces complete, self-describing analysis payloads with
explicit provenance and confidence labelling throughout.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np

from integrations.horizons import client as horizons_client
from integrations.horizons import interpreter as horizons_interp
from integrations.horizons import parser as horizons_parser
from integrations.horizons import vectors as horizons_vectors
from integrations import spice as spice_mod
from scientific_engine import communication as comm_mod
from scientific_engine import coordinates as coords
from scientific_engine import illumination as illum_mod
from scientific_engine import suitability as suit_mod
from scientific_engine import solar_energy as solar_mod
from scientific_engine import terrain as terrain_mod
from scientific_engine.constants import (
    BODY_FIXED_FRAME,
    DATM_ALT,
    LONGITUDE_CONVENTION,
    MOON_MEAN_RADIUS_KM,
    SHAPE_MODEL,
)

_STEP_RE = re.compile(r"^\s*(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>[smhd])\s*$", re.IGNORECASE)
_UNIT_HOURS = {"s": 1.0 / 3600.0, "m": 1.0 / 60.0, "h": 1.0, "d": 24.0}


class AnalysisError(RuntimeError):
    """Raised when an analysis cannot be completed (e.g. Horizons down)."""


@dataclass
class Provenance:
    horizons_url: str
    horizons_available: bool
    spice_available: bool
    terrain_source: str
    terrain_confidence: str
    terrain_available: bool
    notes: List[str]


def step_to_hours(step: str) -> Optional[float]:
    """Convert a Horizons step string ("1 h", "30 m", "1 d") to hours."""
    m = _STEP_RE.match(step or "")
    if not m:
        return None
    return float(m.group("value")) * _UNIT_HOURS[m.group("unit").lower()]


def normalise_time(value: str) -> str:
    """Accept ISO-8601 or 'YYYY-MM-DD[ HH:MM]' and return Horizons 'UT' text."""
    value = (value or "").strip().replace("T", " ")
    value = value.rstrip("Z")
    if not value:
        raise AnalysisError("Empty start/stop time.")
    parts = value.split()
    date_part = parts[0]
    time_part = parts[1] if len(parts) > 1 else "00:00"
    time_part = time_part[:5]
    datetime.strptime(f"{date_part} {time_part}", "%Y-%m-%d %H:%M")
    return f"{date_part} {time_part}"


def _parse_utc(text: str) -> datetime:
    return datetime.strptime(text, "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------------- #
# Horizons fetching
# --------------------------------------------------------------------------- #
def fetch_site_ephemeris(
    *,
    target: str,
    lat_deg: float,
    lon_deg: float,
    alt_km: float,
    start_utc: str,
    stop_utc: str,
    step: str,
    use_cache: bool = True,
) -> horizons_parser.ParsedEphemeris:
    """Fetch + parse a Moon-centre observer ephemeris for one target."""
    try:
        resp = horizons_client.fetch_target_ephemeris(
            target=target,
            site_lon_deg=lon_deg,
            site_lat_deg=lat_deg,
            site_alt_km=alt_km,
            start_utc=start_utc,
            stop_utc=stop_utc,
            step=step,
            quantities="4",
            use_cache=use_cache,
        )
    except horizons_client.HorizonsError as exc:
        raise AnalysisError(f"JPL Horizons request failed for target {target}: {exc}") from exc
    return horizons_parser.parse_horizons_text(resp.raw_text)


def fetch_sun_earth(
    *,
    lat_deg: float,
    lon_deg: float,
    alt_km: float,
    start_utc: str,
    stop_utc: str,
    step: str,
    use_cache: bool = True,
) -> Tuple[List[Dict[str, object]], Dict[str, object], Dict[str, str]]:
    """Return (combined rows, meta, raw payloads) for Sun + Earth."""
    sun = fetch_site_ephemeris(
        target=horizons_client.TARGET_SUN, lat_deg=lat_deg, lon_deg=lon_deg,
        alt_km=alt_km, start_utc=start_utc, stop_utc=stop_utc, step=step, use_cache=use_cache,
    )
    earth = fetch_site_ephemeris(
        target=horizons_client.TARGET_EARTH, lat_deg=lat_deg, lon_deg=lon_deg,
        alt_km=alt_km, start_utc=start_utc, stop_utc=stop_utc, step=step, use_cache=use_cache,
    )
    combined = horizons_interp.combine_sun_earth(
        sun, earth, lat_deg=lat_deg, lon_deg=lon_deg
    )
    meta = {
        "sun": sun.meta.__dict__,
        "earth": earth.meta.__dict__,
        "semantics": horizons_interp.SEMANTICS,
    }
    raw = {"sun": sun.raw_text, "earth": earth.raw_text}
    return combined, meta, raw


def fetch_sun_distance_km(
    *, start_utc: str, stop_utc: str, step: str, use_cache: bool = True
) -> Optional[float]:
    """Mean Sun-Moon distance (km) over the window from Horizons VECTORS."""
    try:
        vecs = horizons_vectors.fetch_target_vectors(
            target=horizons_client.TARGET_SUN, start_utc=start_utc,
            stop_utc=stop_utc, step=step, use_cache=use_cache,
        )
    except horizons_client.HorizonsError:
        return None
    if not vecs:
        return None
    dists = [float(np.linalg.norm(v.vector)) for v in vecs]
    return sum(dists) / len(dists)


# --------------------------------------------------------------------------- #
# Sub-points (globe markers)
# --------------------------------------------------------------------------- #
def subsolar_subearthen(
    *,
    start_utc: str,
    stop_utc: str,
    step: str,
    use_cache: bool = True,
) -> Dict[str, object]:
    """Sub-solar and sub-Earth points from Horizons ICRF vectors + SPICE."""
    out: Dict[str, object] = {"available": False, "note": ""}
    try:
        sun_vecs = horizons_vectors.fetch_target_vectors(
            target=horizons_client.TARGET_SUN, start_utc=start_utc,
            stop_utc=stop_utc, step=step, use_cache=use_cache,
        )
        earth_vecs = horizons_vectors.fetch_target_vectors(
            target=horizons_client.TARGET_EARTH, start_utc=start_utc,
            stop_utc=stop_utc, step=step, use_cache=use_cache,
        )
    except horizons_client.HorizonsError as exc:
        out["note"] = f"Vectors unavailable: {exc}"
        return out

    try:
        epoch = _parse_utc(normalise_time(start_utc))
    except Exception:
        epoch = datetime.now(timezone.utc)

    orientation = spice_mod.moon_orientation(epoch)

    def _sub(vector_icrf: np.ndarray) -> Optional[Tuple[float, float]]:
        bf = spice_mod.inertial_to_bodyfixed(vector_icrf, orientation)
        lat, lon = spice_mod.sub_point_lat_lon(bf)
        return (round(lat, 4), round(lon, 4))

    sun_latlon = _sub(sun_vecs[0].vector) if sun_vecs else None
    earth_latlon = _sub(earth_vecs[0].vector) if earth_vecs else None

    out.update(
        {
            "available": bool(sun_latlon or earth_latlon),
            "subsolar_lat_lon": sun_latlon,
            "subearth_lat_lon": earth_latlon,
            "orientation_frame": orientation.frame,
            "orientation_source": orientation.source,
            "orientation_confidence": orientation.confidence,
            "note": (
                "Sub-points obtained by rotating ICRF body-centre vectors into the "
                "lunar body-fixed frame using NAIF SPICE. Epoch scale is TDB (~69 s "
                "offset from UTC), negligible for globe display."
            ),
        }
    )
    return out


# --------------------------------------------------------------------------- #
# Full site analysis
# --------------------------------------------------------------------------- #
def terrain_context(lat_deg: float, lon_deg: float, *, allow_synthetic: bool = True) -> Dict[str, object]:
    """Terrain metrics for a site (elevation, slope, roughness, relief, dataset)."""
    sample = terrain_mod.get_elevation(lat_deg, lon_deg, allow_synthetic=allow_synthetic)
    slope = terrain_mod.slope_aspect(lat_deg, lon_deg, allow_synthetic=allow_synthetic)
    roughness = terrain_mod.roughness_index_m(lat_deg, lon_deg, allow_synthetic=allow_synthetic)
    relief = terrain_mod.local_relief_m(lat_deg, lon_deg, allow_synthetic=allow_synthetic)
    return {
        "elevation_m": round(sample.elevation_m, 2),
        "source": sample.source,
        "dataset": sample.dataset,
        "confidence": sample.confidence,
        "available": sample.available,
        "resolution_m": sample.resolution_m,
        "slope_deg": slope["slope_deg"],
        "aspect_deg": slope["aspect_deg"],
        "roughness_rms_m": round(roughness, 3),
        "local_relief_m": round(relief, 2),
        "note": sample.note,
    }


def analyse_site(
    *,
    lat_deg: float,
    lon_deg: float,
    alt_km: float = 0.0,
    start: str,
    stop: str,
    step: str = "1 h",
    allow_synthetic: bool = True,
    use_cache: bool = True,
    observer_height_m: float = 2.0,
    panel: Optional[solar_mod.SolarPanelConfig] = None,
) -> Dict[str, object]:
    """Run the full illumination / solar / communication / suitability analysis.

    Every numeric result carries its provenance; missing data is returned as
    ``None`` with an explanatory note, never as a fabricated value.
    """
    lat_deg, lon_deg = coords.validate_lat_lon(lat_deg, lon_deg)
    start_utc = normalise_time(start)
    stop_utc = normalise_time(stop)
    interval_h = step_to_hours(step)

    terrain_ctx = terrain_context(lat_deg, lon_deg, allow_synthetic=allow_synthetic)
    horizon_fn = illum_mod.horizon_function(
        lat_deg, lon_deg, allow_synthetic=allow_synthetic
    )

    combined, meta, _raw = fetch_sun_earth(
        lat_deg=lat_deg, lon_deg=lon_deg, alt_km=alt_km,
        start_utc=start_utc, stop_utc=stop_utc, step=step, use_cache=use_cache,
    )

    sun_distance_km = fetch_sun_distance_km(
        start_utc=start_utc, stop_utc=stop_utc, step=step, use_cache=use_cache
    )
    sun_distance_known = sun_distance_km is not None

    panel = panel or solar_mod.SolarPanelConfig()

    timeline: List[Dict[str, object]] = []
    illuminations: List[illum_mod.SunIllumination] = []
    earth_states: List[comm_mod.EarthLinkState] = []
    powers: List[Optional[float]] = []
    illum_flags: List[Optional[bool]] = []

    for entry in combined:
        sun = entry.get("sun") or {}
        earth = entry.get("earth") or {}
        illum = illum_mod.evaluate_sun(
            time_utc=entry["time"],
            sun_azimuth_deg=sun.get("azimuth_deg"),
            sun_elevation_deg=sun.get("elevation_deg"),
            horizons_daylight=sun.get("site_daylight"),
            lat_deg=lat_deg, lon_deg=lon_deg,
            terrain_available=terrain_ctx["available"],
            horizon_fn=horizon_fn,
        )
        link = comm_mod.evaluate_earth_link(
            time_utc=entry["time"],
            earth_azimuth_deg=earth.get("azimuth_deg"),
            earth_elevation_deg=earth.get("elevation_deg"),
            lat_deg=lat_deg, lon_deg=lon_deg,
            terrain_available=terrain_ctx["available"],
            observer_height_m=observer_height_m,
            allow_synthetic=allow_synthetic,
        )
        power = solar_mod.instantaneous_power_w(
            sun_az_deg=sun.get("azimuth_deg"),
            sun_el_deg=sun.get("elevation_deg"),
            sun_distance_km=sun_distance_km,
            illuminated=illum.illuminated,
            config=panel,
        )
        illuminations.append(illum)
        earth_states.append(link)
        powers.append(power)
        illum_flags.append(illum.illuminated)

        timeline.append(
            {
                "time": entry["time"],
                "timestamp_aligned": entry.get("timestamp_aligned"),
                "sun": sun or None,
                "earth": earth or None,
                "illumination": illum.as_dict(),
                "earth_link": link.as_dict(),
                "solar_power_w": power,
            }
        )

    illum_stats = illum_mod.summarise_timeline(illuminations, interval_h=interval_h)
    solar_summary = solar_mod.summarise_energy(
        powers, illum_flags, interval_h=interval_h, config=panel,
        sun_distance_known=sun_distance_known,
    )
    comm_summary = comm_mod.summarise_access(earth_states, interval_h=interval_h)

    window_hours = interval_h * len(combined) if interval_h else None
    suitability = suit_mod.assess(
        illuminated_fraction=illum_stats.illuminated_fraction,
        longest_darkness_h=illum_stats.longest_continuous_darkness_h,
        slope_deg=terrain_ctx["slope_deg"],
        roughness_m=terrain_ctx["roughness_rms_m"],
        terrain_access_fraction=comm_summary.get("terrain_fraction"),
        equivalent_sun_hours=solar_summary.equivalent_sun_hours,
        window_hours=window_hours,
    )

    return {
        "site": {
            "latitude_deg": lat_deg,
            "longitude_deg": lon_deg,
            "altitude_km": alt_km,
            "east_positive_longitude": True,
        },
        "window": {
            "start_utc": start_utc,
            "stop_utc": stop_utc,
            "step": step,
            "interval_h": interval_h,
            "samples": len(combined),
        },
        "frames": {
            "body_fixed": BODY_FIXED_FRAME,
            "longitude_convention": LONGITUDE_CONVENTION,
            "shape_model": SHAPE_MODEL,
            "altitude_datum": DATM_ALT,
            "mean_radius_km": MOON_MEAN_RADIUS_KM,
        },
        "terrain": terrain_ctx,
        "timeline": timeline,
        "illumination_summary": illum_stats.as_dict(),
        "solar_summary": solar_summary.as_dict(),
        "communication_summary": comm_summary,
        "suitability": suitability.as_dict(),
        "ephemeris_meta": meta,
        "provenance": {
            "horizons": {
                "available": True,
                "target": {"sun": horizons_client.TARGET_SUN, "earth": horizons_client.TARGET_EARTH},
                "centre": horizons_client.CENTER_MOON_COORD,
                "quantities": "4",
            },
            "terrain_source": terrain_ctx["source"],
            "terrain_confidence": terrain_ctx["confidence"],
            "sun_distance_km": sun_distance_km,
            "sun_distance_known": sun_distance_known,
            "notes": [
                "Azimuth is clockwise from North; longitude is East-positive.",
                "Terrain-aware fields require a measured DEM; without one they are None.",
                "Solar power is an estimate, not a flight power budget.",
            ],
        },
    }
