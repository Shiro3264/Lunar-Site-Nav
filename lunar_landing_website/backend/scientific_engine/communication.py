"""Earth communication analysis for a lunar surface asset.

What is computed (and what is *not*):

* **Geometric visibility** — is Earth's centre above the smooth local-vertical
  horizon?  Taken directly from the Horizons elevation.
* **Terrain visibility** — is the ray to Earth clear of the terrain skyline at
  Earth's azimuth?  If not, we compute the **mast height** that would be needed
  to raise the observer above the controlling obstruction.
* **Accessibility** — a transparent, elevation-based indicator.  A genuine link
  budget additionally requires EIRP, antenna gains, frequency and receiver
  sensitivity; we only compute a numeric link margin when the caller supplies
  those parameters (then via the standard free-space-path-loss relation).

No claim of communication *success* is ever made from geometry alone.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from scientific_engine import terrain as terrain_mod
from scientific_engine.constants import EARTH_MEAN_DISTANCE_KM, EARTH_RADIUS_KM

EARTH_ANGULAR_RADIUS_DEG = math.degrees(math.asin(EARTH_RADIUS_KM / EARTH_MEAN_DISTANCE_KM))
SPEED_OF_LIGHT_KM_S = 299_792.458


@dataclass
class Obstruction:
    controlling_distance_km: Optional[float]
    obstruction_height_m: Optional[float]
    horizon_deg: Optional[float]
    required_mast_m: Optional[float]


def _find_controlling_obstruction(
    lat_deg: float,
    lon_deg: float,
    azimuth_deg: float,
    target_elevation_deg: float,
    *,
    observer_height_m: float = 2.0,
    max_range_km: float = 200.0,
    steps: int = 400,
    allow_synthetic: bool = True,
) -> Obstruction:
    """Find the terrain feature that limits visibility along ``azimuth_deg``.

    Walks outward, tracks the maximum elevation angle, and derives the mast
    height needed for ``target_elevation_deg`` to clear that obstruction.
    """
    fn = terrain_mod.elevation_function(
        lat_deg, lon_deg, allow_synthetic, half_extent_km=max_range_km + 10.0
    )
    h_base = fn(lat_deg, lon_deg)
    h_obs = h_base + observer_height_m

    e_unit = math.sin(math.radians(azimuth_deg))
    n_unit = math.cos(math.radians(azimuth_deg))

    best_angle = -90.0
    best_d = 0.0
    best_dh = 0.0
    for k in range(1, steps + 1):
        r = max_range_km * k / steps
        la, lo = terrain_mod.offset_coordinate(lat_deg, lon_deg, e_unit * r, n_unit * r)
        h = fn(la, lo)
        angle = math.degrees(math.atan2(h - h_obs, r * 1000.0))
        if angle > best_angle:
            best_angle = angle
            best_d = r
            best_dh = h - h_base

    need = best_dh - best_d * 1000.0 * math.tan(math.radians(target_elevation_deg))
    required_mast = max(0.0, need - observer_height_m)
    return Obstruction(
        controlling_distance_km=round(best_d, 3),
        obstruction_height_m=round(best_dh, 2),
        horizon_deg=round(best_angle, 4),
        required_mast_m=round(required_mast, 2),
    )


@dataclass
class EarthLinkState:
    time_utc: Optional[str]
    earth_azimuth_deg: Optional[float]
    earth_elevation_deg: Optional[float]
    earth_angular_radius_deg: float
    geometric_visible: Optional[bool]
    limb_geometric_visible: Optional[bool]
    terrain_visible: Optional[bool]
    terrain_horizon_deg: Optional[float]
    elevation_margin_deg: Optional[float]
    required_mast_m: Optional[float]
    one_way_light_time_s: Optional[float]
    accessibility: str
    confidence: str = "high"
    note: str = ""

    def as_dict(self) -> Dict[str, object]:
        return {
            "time_utc": self.time_utc,
            "earth_azimuth_deg": self.earth_azimuth_deg,
            "earth_elevation_deg": self.earth_elevation_deg,
            "earth_angular_radius_deg": round(self.earth_angular_radius_deg, 4),
            "geometric_visible": self.geometric_visible,
            "limb_geometric_visible": self.limb_geometric_visible,
            "terrain_visible": self.terrain_visible,
            "terrain_horizon_deg": self.terrain_horizon_deg,
            "elevation_margin_deg": self.elevation_margin_deg,
            "required_mast_m": self.required_mast_m,
            "one_way_light_time_s": self.one_way_light_time_s,
            "accessibility": self.accessibility,
            "confidence": self.confidence,
            "note": self.note,
        }


def _accessibility_label(elevation_deg: Optional[float], terrain_visible: Optional[bool]) -> str:
    if elevation_deg is None:
        return "unknown"
    if terrain_visible is False:
        return "blocked_by_terrain"
    if elevation_deg <= 0.0:
        return "below_horizon"
    if elevation_deg < 5.0:
        return "low_elevation"
    if elevation_deg < 15.0:
        return "good"
    return "excellent"


def evaluate_earth_link(
    *,
    time_utc: Optional[str],
    earth_azimuth_deg: Optional[float],
    earth_elevation_deg: Optional[float],
    lat_deg: float,
    lon_deg: float,
    terrain_available: bool,
    observer_height_m: float = 2.0,
    allow_synthetic: bool = True,
    earth_distance_km: Optional[float] = None,
) -> EarthLinkState:
    """Terrain-aware Earth communication geometry for one instant."""
    dist_km = earth_distance_km or EARTH_MEAN_DISTANCE_KM
    light_time = round(dist_km / SPEED_OF_LIGHT_KM_S, 4)
    geom = None if earth_elevation_deg is None else bool(earth_elevation_deg > 0.0)
    limb = (
        None
        if earth_elevation_deg is None
        else bool(earth_elevation_deg + EARTH_ANGULAR_RADIUS_DEG > 0.0)
    )

    if earth_azimuth_deg is None or earth_elevation_deg is None:
        return EarthLinkState(
            time_utc=time_utc,
            earth_azimuth_deg=earth_azimuth_deg,
            earth_elevation_deg=earth_elevation_deg,
            earth_angular_radius_deg=EARTH_ANGULAR_RADIUS_DEG,
            geometric_visible=geom,
            limb_geometric_visible=limb,
            terrain_visible=None,
            terrain_horizon_deg=None,
            elevation_margin_deg=None,
            required_mast_m=None,
            one_way_light_time_s=light_time,
            accessibility="unknown",
            confidence="unknown",
            note="Earth azimuth/elevation unavailable from ephemeris.",
        )

    if not terrain_available:
        return EarthLinkState(
            time_utc=time_utc,
            earth_azimuth_deg=earth_azimuth_deg,
            earth_elevation_deg=earth_elevation_deg,
            earth_angular_radius_deg=EARTH_ANGULAR_RADIUS_DEG,
            geometric_visible=geom,
            limb_geometric_visible=limb,
            terrain_visible=None,
            terrain_horizon_deg=None,
            elevation_margin_deg=None,
            required_mast_m=None,
            one_way_light_time_s=light_time,
            accessibility=_accessibility_label(earth_elevation_deg, None),
            confidence="low",
            note=(
                "No measured DEM: terrain blocking not evaluated. Accessibility "
                "reflects geometric elevation only."
            ),
        )

    horizon = terrain_mod.local_horizon_at(
        lat_deg, lon_deg, earth_azimuth_deg, observer_height_m=observer_height_m,
        allow_synthetic=allow_synthetic,
    )
    terrain_visible = earth_elevation_deg > horizon
    margin = round(earth_elevation_deg - horizon, 4)

    obstruction = _find_controlling_obstruction(
        lat_deg, lon_deg, earth_azimuth_deg, earth_elevation_deg,
        observer_height_m=observer_height_m, allow_synthetic=allow_synthetic,
    )
    required_mast = 0.0 if terrain_visible else obstruction.required_mast_m

    return EarthLinkState(
        time_utc=time_utc,
        earth_azimuth_deg=earth_azimuth_deg,
        earth_elevation_deg=earth_elevation_deg,
        earth_angular_radius_deg=EARTH_ANGULAR_RADIUS_DEG,
        geometric_visible=geom,
        limb_geometric_visible=limb,
        terrain_visible=terrain_visible,
        terrain_horizon_deg=round(horizon, 4),
        elevation_margin_deg=margin,
        required_mast_m=required_mast,
        one_way_light_time_s=light_time,
        accessibility=_accessibility_label(earth_elevation_deg, terrain_visible),
    )


# --------------------------------------------------------------------------- #
# Optional real link budget (only when parameters are supplied)
# --------------------------------------------------------------------------- #
def free_space_path_loss_db(distance_km: float, frequency_mhz: float) -> float:
    """Friis free-space path loss in dB (standard 32.45 + 20log10(d_km·f_MHz))."""
    if distance_km <= 0 or frequency_mhz <= 0:
        raise ValueError("distance and frequency must be positive.")
    return 32.44 + 20.0 * math.log10(distance_km) + 20.0 * math.log10(frequency_mhz)


def link_margin_db(
    *,
    eirp_dbw: float,
    rx_antenna_gain_dbi: float,
    frequency_mhz: float,
    distance_km: float,
    receiver_sensitivity_dbw: float,
) -> Dict[str, float]:
    """Compute a transmit/receive link margin when full parameters are given.

    Clearly labelled an estimate: atmospheric/ionospheric and pointing losses
    are **not** included (there is no atmosphere at the Moon, but pointing,
    polarisation and implementation losses are left to the caller).
    """
    fspl = free_space_path_loss_db(distance_km, frequency_mhz)
    # Received power (dBW) = EIRP + G_rx - FSPL
    rx_power_dbw = eirp_dbw + rx_antenna_gain_dbi - fspl
    margin = rx_power_dbw - receiver_sensitivity_dbw
    return {
        "free_space_path_loss_db": round(fspl, 2),
        "received_power_dbw": round(rx_power_dbw, 2),
        "link_margin_db": round(margin, 2),
    }


def summarise_access(
    states: List[EarthLinkState], *, interval_h: Optional[float]
) -> Dict[str, object]:
    """Aggregate Earth-access statistics over a series."""
    if not states:
        return {"samples": 0, "note": "Empty series."}

    geom = [s.geometric_visible for s in states if s.geometric_visible is not None]
    terr = [s.terrain_visible for s in states if s.terrain_visible is not None]
    max_mast = max((s.required_mast_m for s in states if s.required_mast_m is not None), default=None)
    elevs = [s.earth_elevation_deg for s in states if s.earth_elevation_deg is not None]

    return {
        "samples": len(states),
        "geometric_fraction": round(sum(1 for g in geom if g) / len(geom), 4) if geom else None,
        "terrain_fraction": round(sum(1 for t in terr if t) / len(terr), 4) if terr else None,
        "max_required_mast_m": (round(max_mast, 2) if max_mast is not None else None),
        "mean_elevation_deg": round(sum(elevs) / len(elevs), 3) if elevs else None,
        "peak_elevation_deg": round(max(elevs), 3) if elevs else None,
        "interval_h": interval_h,
    }
