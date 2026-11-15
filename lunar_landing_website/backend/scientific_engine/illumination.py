"""Illumination & shadow analysis for an observer/lander on the lunar surface.

Four *distinct* notions of "visibility" are kept separate on purpose (the
original single-file prototype conflated them):

``geometric``
    Is the Sun's **centre** above the smooth local-vertical horizon plane?
    (Purely from the Horizons elevation; terrain ignored.)
``limb_geometric``
    Is the Sun's **upper limb** above the smooth horizon? (elevation + angular
    radius.)
``horizons_daylight``
    The ``'*'`` solar-presence marker reported by JPL Horizons for the site.
``terrain_visible`` / ``illuminated``
    Is the ray to the Sun's centre clear of the **measured/estimated terrain
    horizon** at that azimuth?  ``illuminated`` additionally requires the Sun
    limb to clear the terrain horizon, i.e. it is a terrain-aware,
    lander-height illumination flag.

Nothing here fabricates a measurement: when a quantity cannot be computed it is
returned as ``None`` with an explanatory ``note``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence

from scientific_engine import terrain as terrain_mod
from scientific_engine.constants import SUN_RADIUS_KM, SUN_MEAN_DISTANCE_KM

SUN_ANGULAR_RADIUS_DEG = math.degrees(math.asin(SUN_RADIUS_KM / SUN_MEAN_DISTANCE_KM))
# Solar irradiance scales with the inverse square of the Sun-Moon distance; the
# mean Sun-Moon distance is ~1 AU (the 384400 km terrestrial offset is < 0.3 %).


@dataclass
class SunIllumination:
    """Terrain-aware illumination state for one instant."""

    time_utc: Optional[str]
    sun_azimuth_deg: Optional[float]
    sun_elevation_deg: Optional[float]
    sun_angular_radius_deg: float
    geometric_centre_above: Optional[bool]
    geometric_limb_above: Optional[bool]
    horizons_daylight: Optional[bool]
    terrain_horizon_deg: Optional[float]
    terrain_clear: Optional[bool]
    illuminated: Optional[bool]
    incidence_angle_deg: Optional[float]
    reason: str = ""
    confidence: str = "high"
    note: str = ""

    def as_dict(self) -> Dict[str, object]:
        return {
            "time_utc": self.time_utc,
            "sun_azimuth_deg": self.sun_azimuth_deg,
            "sun_elevation_deg": self.sun_elevation_deg,
            "sun_angular_radius_deg": round(self.sun_angular_radius_deg, 4),
            "geometric_centre_above": self.geometric_centre_above,
            "geometric_limb_above": self.geometric_limb_above,
            "horizons_daylight": self.horizons_daylight,
            "terrain_horizon_deg": self.terrain_horizon_deg,
            "terrain_clear": self.terrain_clear,
            "illuminated": self.illuminated,
            "incidence_angle_deg": self.incidence_angle_deg,
            "reason": self.reason,
            "confidence": self.confidence,
            "note": self.note,
        }


def evaluate_sun(
    *,
    time_utc: Optional[str],
    sun_azimuth_deg: Optional[float],
    sun_elevation_deg: Optional[float],
    horizons_daylight: Optional[bool],
    lat_deg: float,
    lon_deg: float,
    terrain_available: bool,
    horizon_fn: Optional[Callable[[float], float]] = None,
) -> SunIllumination:
    """Build a :class:`SunIllumination` from a single Sun sample.

    ``horizon_fn(azimuth_deg) -> horizon_elevation_deg`` supplies the terrain
    skyline.  When ``terrain_available`` is False the terrain-aware fields are
    left ``None`` and clearly annotated rather than guessed.
    """
    geom_centre = None if sun_elevation_deg is None else bool(sun_elevation_deg > 0.0)
    geom_limb = (
        None
        if sun_elevation_deg is None
        else bool(sun_elevation_deg + SUN_ANGULAR_RADIUS_DEG > 0.0)
    )

    incidence = None
    if sun_elevation_deg is not None:
        # Incidence angle at a flat facet = 90° - elevation.
        incidence = round(max(0.0, 90.0 - sun_elevation_deg), 4)

    if sun_azimuth_deg is None or sun_elevation_deg is None:
        return SunIllumination(
            time_utc=time_utc,
            sun_azimuth_deg=sun_azimuth_deg,
            sun_elevation_deg=sun_elevation_deg,
            sun_angular_radius_deg=SUN_ANGULAR_RADIUS_DEG,
            geometric_centre_above=geom_centre,
            geometric_limb_above=geom_limb,
            horizons_daylight=horizons_daylight,
            terrain_horizon_deg=None,
            terrain_clear=None,
            illuminated=None,
            incidence_angle_deg=incidence,
            reason="Sun azimuth/elevation unavailable from ephemeris.",
            confidence="unknown",
        )

    if not terrain_available or horizon_fn is None:
        return SunIllumination(
            time_utc=time_utc,
            sun_azimuth_deg=sun_azimuth_deg,
            sun_elevation_deg=sun_elevation_deg,
            sun_angular_radius_deg=SUN_ANGULAR_RADIUS_DEG,
            geometric_centre_above=geom_centre,
            geometric_limb_above=geom_limb,
            horizons_daylight=horizons_daylight,
            terrain_horizon_deg=None,
            terrain_clear=None,
            illuminated=None,
            incidence_angle_deg=incidence,
            reason="No measured DEM: terrain obstruction not evaluated.",
            confidence="low",
            note=(
                "Terrain-aware illumination requires a measured/estimated DEM. "
                "Only geometric visibility is reported."
            ),
        )

    horizon = horizon_fn(sun_azimuth_deg)
    terrain_clear = sun_elevation_deg > horizon
    illuminated = (sun_elevation_deg + SUN_ANGULAR_RADIUS_DEG) > horizon

    reason = _reason(geom_limb, terrain_clear)
    return SunIllumination(
        time_utc=time_utc,
        sun_azimuth_deg=sun_azimuth_deg,
        sun_elevation_deg=sun_elevation_deg,
        sun_angular_radius_deg=SUN_ANGULAR_RADIUS_DEG,
        geometric_centre_above=geom_centre,
        geometric_limb_above=geom_limb,
        horizons_daylight=horizons_daylight,
        terrain_horizon_deg=round(horizon, 4),
        terrain_clear=terrain_clear,
        illuminated=illuminated,
        incidence_angle_deg=incidence,
        reason=reason,
        confidence="high" if terrain_available else "low",
    )


def _reason(geom_limb: Optional[bool], terrain_clear: Optional[bool]) -> str:
    if geom_limb is False:
        return "Sun below the geometric horizon (lunar night at this site)."
    if terrain_clear is False:
        return "Sun above the geometric horizon but blocked by terrain relief."
    if terrain_clear is True:
        return "Sun above the local terrain horizon — site illuminated."
    return "Indeterminate."


# --------------------------------------------------------------------------- #
# Timeline statistics
# --------------------------------------------------------------------------- #
@dataclass
class IlluminationStats:
    samples: int
    illuminated_samples: int
    illuminated_fraction: Optional[float]
    geometric_daylight_fraction: Optional[float]
    longest_continuous_illumination_h: Optional[float]
    longest_continuous_darkness_h: Optional[float]
    mean_sun_elevation_when_up_deg: Optional[float]
    sample_interval_h: Optional[float]
    note: str = ""
    extra: Dict[str, object] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, object]:
        return {
            "samples": self.samples,
            "illuminated_samples": self.illuminated_samples,
            "illuminated_fraction": self.illuminated_fraction,
            "geometric_daylight_fraction": self.geometric_daylight_fraction,
            "longest_continuous_illumination_h": self.longest_continuous_illumination_h,
            "longest_continuous_darkness_h": self.longest_continuous_darkness_h,
            "mean_sun_elevation_when_up_deg": self.mean_sun_elevation_when_up_deg,
            "sample_interval_h": self.sample_interval_h,
            "note": self.note,
            **self.extra,
        }


def _longest_run(flags: Sequence[Optional[bool]], target: bool, interval_h: Optional[float]) -> Optional[float]:
    if interval_h is None:
        return None
    best = cur = 0
    for f in flags:
        if f is target:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return round(best * interval_h, 3)


def summarise_timeline(
    illuminations: Sequence[SunIllumination], *, interval_h: Optional[float]
) -> IlluminationStats:
    """Statistical summary of an illumination series."""
    n = len(illuminations)
    if n == 0:
        return IlluminationStats(0, 0, None, None, None, None, None, interval_h, "Empty series.")

    illum_flags = [i.illuminated for i in illuminations]
    geom_flags = [i.geometric_limb_above for i in illuminations]

    illum_true = sum(1 for f in illum_flags if f is True)
    illum_known = sum(1 for f in illum_flags if f is not None)
    geom_true = sum(1 for f in geom_flags if f is True)
    geom_known = sum(1 for f in geom_flags if f is not None)

    elevs = [i.sun_elevation_deg for i in illuminations if i.illuminated and i.sun_elevation_deg is not None]

    return IlluminationStats(
        samples=n,
        illuminated_samples=illum_true,
        illuminated_fraction=(round(illum_true / illum_known, 4) if illum_known else None),
        geometric_daylight_fraction=(round(geom_true / geom_known, 4) if geom_known else None),
        longest_continuous_illumination_h=_longest_run(illum_flags, True, interval_h),
        longest_continuous_darkness_h=_longest_run(illum_flags, False, interval_h),
        mean_sun_elevation_when_up_deg=(round(sum(elevs) / len(elevs), 3) if elevs else None),
        sample_interval_h=interval_h,
        note=(
            "Terrain-aware fractions require a measured/estimated DEM; without one "
            "they are None and only the geometric fraction is meaningful."
            if illum_known == 0
            else ""
        ),
    )


def horizon_function(
    lat_deg: float, lon_deg: float, *, allow_synthetic: bool = True,
    azimuths: Optional[List[float]] = None,
) -> Callable[[float], float]:
    """Return a fast azimuth->terrain-horizon interpolator for a site.

    Computing the full skyline is expensive, so we sample a fixed azimuth grid
    once and linearly interpolate.  Falls back to the smooth 0° horizon when no
    DEM is available.
    """
    grid = azimuths or [float(a) for a in range(0, 360, 5)]
    cache: Dict[float, float] = {}

    def _one(az: float) -> float:
        key = round(az % 360.0, 3)
        if key not in cache:
            cache[key] = terrain_mod.local_horizon_at(
                lat_deg, lon_deg, key, allow_synthetic=allow_synthetic
            )
        return cache[key]

    def _fn(az: float) -> float:
        a = az % 360.0
        lo = (a // 5) * 5
        hi = (lo + 5) % 360
        v_lo = _one(lo)
        v_hi = _one(hi)
        frac = (a - lo) / 5.0
        return v_lo + (v_hi - v_lo) * frac

    return _fn
