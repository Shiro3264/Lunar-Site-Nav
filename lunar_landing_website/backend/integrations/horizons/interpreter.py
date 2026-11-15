"""Visibility interpreter for parsed Horizons rows.

This module deliberately separates four concepts that the original single-file
prototype conflated:

1. **Celestial geometric visibility** — is the target above the *smooth*
   geometric horizon of the local vertical?  Computed from the target centre
   elevation and the target's angular radius (centre vs. limb).
2. **Apparent-body visibility reported by Horizons** — the site daylight marker
   ``'*'`` (Sun upper limb on/above the apparent horizon) and the interfering
   body marker ``'i'`` (interferer upper limb on/above the apparent horizon).
3. **Terrain-obstructed visibility** — computed elsewhere (see
   :mod:`scientific_engine.illumination`) from the DEM horizon profile.  It is
   **never** implied by Horizons output.
4. **Actual solar illumination** at the lander/observer height — again a
   terrain-aware result, not a Horizons product.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional

from scientific_engine import coordinates as coords
from scientific_engine.constants import (
    EARTH_MEAN_DISTANCE_KM,
    EARTH_RADIUS_KM,
    SUN_MEAN_DISTANCE_KM,
    SUN_RADIUS_KM,
)

from .parser import HorizonsRow, ParsedEphemeris

SEMANTICS = {
    "quantity": "4 = airless apparent azimuth & elevation of the TARGET CENTRE",
    "solar_presence": "'*' in the time column = daylight at the observing SITE (Sun upper limb above apparent horizon)",
    "interferer_presence": "'i' = interfering body upper limb above the apparent horizon",
    "horizon": "Horizons elevation is relative to the smooth local-vertical horizon plane, NOT terrain.",
    "terrain": "Terrain obstruction and lander-level illumination are computed separately from DEM data.",
    "interferer_note": (
        "For a Moon-centred observer Horizons reports EARTH as the interfering "
        "body even when the target is Earth itself."
    ),
}

_SUN_ANGULAR_RADIUS_DEG = math.degrees(
    math.asin(SUN_RADIUS_KM / SUN_MEAN_DISTANCE_KM)
)  # ~0.2666 deg
_EARTH_ANGULAR_RADIUS_DEG = math.degrees(
    math.asin(EARTH_RADIUS_KM / EARTH_MEAN_DISTANCE_KM)
)  # ~0.95 deg


def target_angular_radius_deg(target: str) -> float:
    return _SUN_ANGULAR_RADIUS_DEG if target.upper() == "SUN" else _EARTH_ANGULAR_RADIUS_DEG


def interpret_row(
    row: HorizonsRow, *, target: str, lat_deg: float, lon_deg: float
) -> Dict[str, object]:
    """Convert one :class:`HorizonsRow` into a structured, self-describing dict."""
    ang_r = target_angular_radius_deg(target)
    az = row.azimuth_deg
    el = row.elevation_deg

    center_above = None if el is None else el > 0.0
    limb_above = None if el is None else (el + ang_r) > 0.0

    enu: Optional[List[float]] = None
    bf: Optional[List[float]] = None
    scene: Optional[List[float]] = None
    if az is not None and el is not None:
        enu_v = coords.az_el_to_enu(az, el)
        bf_v = coords.enu_to_bodyfixed(enu_v, lat_deg, lon_deg)
        enu = [float(x) for x in enu_v]
        bf = [float(x) for x in bf_v]
        scene = [float(x) for x in coords.bodyfixed_to_scene(bf_v)]

    return {
        "time_utc": row.time_utc,
        "azimuth_deg": az,
        "elevation_deg": el,
        "angular_radius_deg": round(ang_r, 4),
        "center_above_geometric_horizon": center_above,
        "limb_above_geometric_horizon": limb_above,
        "azimuth_compass": None if az is None else coords.compass_label(az),
        # Markers are properties of the observing site, not the target.
        "site_daylight": row.solar_presence,
        "interferer_above_horizon": row.interferer_presence,
        "direction_enu": enu,
        "direction_bodyfixed": bf,
        "direction_scene": scene,
    }


def interpret_target(
    parsed: ParsedEphemeris, *, target: str, lat_deg: float, lon_deg: float
) -> List[Dict[str, object]]:
    return [interpret_row(r, target=target, lat_deg=lat_deg, lon_deg=lon_deg) for r in parsed.rows]


def combine_sun_earth(
    parsed_sun: ParsedEphemeris,
    parsed_earth: ParsedEphemeris,
    *,
    lat_deg: float,
    lon_deg: float,
) -> List[Dict[str, object]]:
    """Merge Sun and Earth series on identical UTC timestamps.

    Rows present in only one series are still emitted, with the missing target
    left as ``None`` (never fabricated, never zeroed).
    """
    sun_rows = {r.time_utc: r for r in parsed_sun.rows}
    earth_rows = {r.time_utc: r for r in parsed_earth.rows}
    times = sorted(set(sun_rows) | set(earth_rows), key=_time_sort_key)

    out: List[Dict[str, object]] = []
    for t in times:
        s = sun_rows.get(t)
        e = earth_rows.get(t)
        s_interp = (
            interpret_row(s, target="SUN", lat_deg=lat_deg, lon_deg=lon_deg) if s else None
        )
        e_interp = (
            interpret_row(e, target="EARTH", lat_deg=lat_deg, lon_deg=lon_deg) if e else None
        )
        out.append(
            {
                "time": t,
                "sun": s_interp,
                "earth": e_interp,
                "timestamp_aligned": bool(s and e),
            }
        )
    return out


def _time_sort_key(time_utc: str):
    from datetime import datetime

    try:
        return datetime.strptime(time_utc, "%Y-%b-%d %H:%M")
    except ValueError:
        return datetime.max
