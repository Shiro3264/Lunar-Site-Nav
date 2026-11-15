"""Terrain: elevation lookup, slope, horizon profile and line-of-sight.

Priority order
--------------
1. **Measured** — NASA LOLA DEM via :mod:`integrations.lola` (high confidence).
2. **Synthetic (illustrative)** — deterministic, cratered procedural terrain used
   only to give the visualiser something to render.  Always labelled
   ``synthetic_illustrative`` and low confidence; never presented as measured.
3. **Spherical datum (no terrain)** — flat mean-radius reference used for
   geometric horizon maths when synthetic fallback is disabled.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np

from integrations import lola
from scientific_engine import coordinates as coords
from scientific_engine.constants import MOON_MEAN_RADIUS_M

# --------------------------------------------------------------------------- #
# Deterministic procedural terrain (illustrative fallback)
# --------------------------------------------------------------------------- #
_MASK = 0xFFFFFFFF


def _hash01(i: int, j: int, seed: int = 0) -> float:
    h = (i * 374761393 + j * 668265263 + seed * 1442695040888963407) & _MASK
    h = ((h ^ (h >> 13)) * 1274126177) & _MASK
    h = (h ^ (h >> 16)) & _MASK
    return h / float(_MASK)


def _value_noise(x: float, y: float, seed: int) -> float:
    xi, yi = math.floor(x), math.floor(y)
    xf, yf = x - xi, y - yi
    # smoothstep
    u = xf * xf * (3 - 2 * xf)
    v = yf * yf * (3 - 2 * yf)
    a = _hash01(xi, yi, seed)
    b = _hash01(xi + 1, yi, seed)
    c = _hash01(xi, yi + 1, seed)
    d = _hash01(xi + 1, yi + 1, seed)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v


def _fbm(x: float, y: float, seed: int, octaves: int = 5) -> float:
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for _ in range(octaves):
        total += amp * _value_noise(x * freq, y * freq, seed)
        norm += amp
        amp *= 0.5
        freq *= 2.0
    return total / norm


# A handful of deterministic craters that give the fallback relief character.
_CRATERS = [
    (120.0, 60.0, 2.4, 260.0),   # (east_km, north_km, radius_km, depth_m)
    (-70.0, -40.0, 1.6, 180.0),
    (30.0, -120.0, 3.2, 320.0),
    (-150.0, 130.0, 1.1, 120.0),
]


def synthetic_elevation_m(lat_deg: float, lon_deg: float) -> float:
    """Deterministic, illustrative terrain height (metres) relative to R=1737.4 km."""
    # Local tangent-plane coordinates (km) around the site for crater placement.
    east_km = math.radians(lon_deg) * (MOON_MEAN_RADIUS_M / 1000.0) * math.cos(math.radians(lat_deg))
    north_km = math.radians(lat_deg) * (MOON_MEAN_RADIUS_M / 1000.0)

    base = (_fbm(east_km / 18.0, north_km / 18.0, seed=17) - 0.5) * 900.0
    relief = 0.0
    for cx, cy, r, depth in _CRATERS:
        d = math.hypot(east_km - cx, north_km - cy)
        if d < r:
            t = d / r
            relief -= depth * (1.0 - t * t) ** 2
        elif d < r * 1.4:  # raised rim
            t = (d - r) / (r * 0.4)
            relief += depth * 0.18 * (1.0 - abs(t - 1.0) * 2.0) if t <= 1.0 else 0.0
    return float(base + relief)


# --------------------------------------------------------------------------- #
# Elevation provider
# --------------------------------------------------------------------------- #
@dataclass
class TerrainSample:
    latitude_deg: float
    longitude_deg: float
    elevation_m: float
    source: str
    dataset: str
    resolution_m: Optional[float]
    confidence: str
    available: bool
    note: str = ""


def get_elevation(
    lat_deg: float, lon_deg: float, *, allow_synthetic: bool = True
) -> TerrainSample:
    """Elevation at a coordinate, in order measured → synthetic → datum."""
    measured = lola.sample_elevation(lat_deg, lon_deg)
    if measured.available and measured.elevation_m is not None:
        return TerrainSample(
            latitude_deg=lat_deg,
            longitude_deg=lon_deg,
            elevation_m=measured.elevation_m,
            source=measured.source,
            dataset="NASA LRO LOLA DEM",
            resolution_m=measured.resolution_m,
            confidence="high",
            available=True,
        )

    if allow_synthetic:
        return TerrainSample(
            latitude_deg=lat_deg,
            longitude_deg=lon_deg,
            elevation_m=synthetic_elevation_m(lat_deg, lon_deg),
            source="synthetic_illustrative",
            dataset="Procedural placeholder (NOT measured)",
            resolution_m=None,
            confidence="low",
            available=False,
            note=(
                "No LOLA DEM available for this location; showing an explicitly "
                "labelled illustrative terrain, not a measured product."
            ),
        )

    return TerrainSample(
        latitude_deg=lat_deg,
        longitude_deg=lon_deg,
        elevation_m=0.0,
        source="spherical_datum",
        dataset="Mean-radius sphere R=1737.4 km (no terrain)",
        resolution_m=None,
        confidence="low",
        available=False,
        note="Flat mean-radius datum; terrain obstruction not modelled.",
    )


# Cache of per-site DEM samplers so that the many elevation function calls inside
# a single analysis (slope, roughness, relief, horizon, mesh) share one window.
_SAMPLER_CACHE: Dict[Tuple[float, float, float], object] = {}


def _site_sampler(lat_deg: float, lon_deg: float, half_extent_km: float):
    """Return a measured-DEM sampler for a site's neighbourhood, or None."""
    key = (round(lat_deg, 4), round(lon_deg, 4), round(half_extent_km, 2))
    if key in _SAMPLER_CACHE:
        return _SAMPLER_CACHE[key]
    sampler, region = lola.make_sampler(lat_deg, lon_deg, half_extent_km=half_extent_km)
    _SAMPLER_CACHE[key] = (sampler, region)
    return _SAMPLER_CACHE[key]


def elevation_function(
    lat_deg: float,
    lon_deg: float,
    allow_synthetic: bool = True,
    *,
    half_extent_km: float = 40.0,
) -> Callable[[float, float], float]:
    """Elevation function for a site, using the measured DEM window when present.

    All sampled points lie within ``half_extent_km`` of the site, so a single
    DEM window covers the whole computation.  Points the DEM does not cover fall
    back to the labelled synthetic/datum behaviour.
    """
    sampler, region = _site_sampler(lat_deg, lon_deg, half_extent_km)

    if sampler is None:
        if allow_synthetic:
            def _syn(la: float, lo: float) -> float:
                return synthetic_elevation_m(la, lo)

            return _syn

        def _datum(la: float, lo: float) -> float:
            return 0.0

        return _datum

    if allow_synthetic:
        def _measured_or_synth(la: float, lo: float) -> float:
            value = sampler(la, lo)
            return value if value is not None else synthetic_elevation_m(la, lo)

        return _measured_or_synth

    def _measured_or_datum(la: float, lo: float) -> float:
        value = sampler(la, lo)
        return value if value is not None else 0.0

    return _measured_or_datum


# --------------------------------------------------------------------------- #
# Local offsets & slope
# --------------------------------------------------------------------------- #
def offset_coordinate(lat_deg: float, lon_deg: float, east_km: float, north_km: float) -> Tuple[float, float]:
    """Offset a coordinate by local East/North distances (km, small-angle)."""
    dlat = math.degrees(north_km * 1000.0 / MOON_MEAN_RADIUS_M)
    coslat = math.cos(math.radians(lat_deg))
    dlon = math.degrees(east_km * 1000.0 / (MOON_MEAN_RADIUS_M * max(coslat, 1e-6)))
    return (lat_deg + dlat, coords.wrap_longitude_deg(lon_deg + dlon))


def slope_aspect(
    lat_deg: float, lon_deg: float, *, step_km: float = 1.0, allow_synthetic: bool = True
) -> Dict[str, Optional[float]]:
    """Slope (deg) and aspect (deg, down-slope azimuth) from a central difference."""
    fn = elevation_function(lat_deg, lon_deg, allow_synthetic)
    h0 = fn(lat_deg, lon_deg)
    lat_e, lon_e = offset_coordinate(lat_deg, lon_deg, step_km, 0.0)
    lat_w, lon_w = offset_coordinate(lat_deg, lon_deg, -step_km, 0.0)
    lat_n, lon_n = offset_coordinate(lat_deg, lon_deg, 0.0, step_km)
    lat_s, lon_s = offset_coordinate(lat_deg, lon_deg, 0.0, -step_km)

    dz_east = (fn(lat_e, lon_e) - fn(lat_w, lon_w)) / (2.0 * step_km * 1000.0)
    dz_north = (fn(lat_n, lon_n) - fn(lat_s, lon_s)) / (2.0 * step_km * 1000.0)
    slope = math.degrees(math.atan(math.hypot(dz_east, dz_north)))
    # Down-slope direction points opposite the gradient.
    aspect = math.degrees(math.atan2(-dz_east, -dz_north)) % 360.0
    return {
        "slope_deg": round(slope, 3),
        "aspect_deg": round(aspect, 3),
        "elevation_m": round(h0, 2),
        "gradient_east": dz_east,
        "gradient_north": dz_north,
    }


def local_relief_m(
    lat_deg: float, lon_deg: float, *, radius_km: float = 5.0, samples: int = 24,
    allow_synthetic: bool = True,
) -> float:
    """Peak-to-peak relief within ``radius_km`` of the site (m)."""
    fn = elevation_function(lat_deg, lon_deg, allow_synthetic)
    values = [fn(lat_deg, lon_deg)]
    for i in range(samples):
        az = 360.0 * i / samples
        east = radius_km * math.sin(math.radians(az))
        north = radius_km * math.cos(math.radians(az))
        la, lo = offset_coordinate(lat_deg, lon_deg, east, north)
        values.append(fn(la, lo))
    return float(max(values) - min(values))


def roughness_index_m(
    lat_deg: float, lon_deg: float, *, radius_km: float = 5.0, samples: int = 16,
    allow_synthetic: bool = True,
) -> float:
    """RMS deviation of elevation from the local mean (surface roughness proxy)."""
    fn = elevation_function(lat_deg, lon_deg, allow_synthetic)
    values = [fn(lat_deg, lon_deg)]
    for i in range(samples):
        az = 360.0 * i / samples
        la, lo = offset_coordinate(
            lat_deg, lon_deg, radius_km * math.sin(math.radians(az)), radius_km * math.cos(math.radians(az))
        )
        values.append(fn(la, lo))
    arr = np.array(values, dtype=float)
    return float(np.sqrt(np.mean((arr - arr.mean()) ** 2)))


# --------------------------------------------------------------------------- #
# Horizon profile & line of sight
# --------------------------------------------------------------------------- #
def horizon_profile(
    lat_deg: float,
    lon_deg: float,
    *,
    azimuths_deg: Optional[List[float]] = None,
    observer_height_m: float = 2.0,
    max_range_km: float = 30.0,
    steps: int = 200,
    allow_synthetic: bool = True,
) -> List[Dict[str, float]]:
    """Skyline elevation angle (deg) for each requested azimuth.

    For every azimuth we walk outward from the observer and record the maximum
    terrain elevation angle ``atan2(Δh, horizontal_distance)``.  This is the
    terrain horizon that a real lander would see, and it is what distinguishes
    *terrain-obstructed* visibility from the smooth geometric horizon used by
    Horizons.
    """
    fn = elevation_function(
        lat_deg, lon_deg, allow_synthetic, half_extent_km=max_range_km + 5.0
    )
    h_obs = fn(lat_deg, lon_deg) + observer_height_m
    if azimuths_deg is None:
        azimuths_deg = [float(a) for a in range(0, 360, 5)]

    profile: List[Dict[str, float]] = []
    for az in azimuths_deg:
        e_unit = math.sin(math.radians(az))
        n_unit = math.cos(math.radians(az))
        max_angle = 0.0  # smooth geometric horizon is 0 deg (flat mean radius)
        for k in range(1, steps + 1):
            r = max_range_km * k / steps
            la, lo = offset_coordinate(lat_deg, lon_deg, e_unit * r, n_unit * r)
            h = fn(la, lo)
            angle = math.degrees(math.atan2(h - h_obs, r * 1000.0))
            if angle > max_angle:
                max_angle = angle
        profile.append({"azimuth_deg": float(az), "horizon_elevation_deg": round(max_angle, 4)})
    return profile


def local_horizon_at(
    lat_deg: float, lon_deg: float, azimuth_deg: float, *,
    observer_height_m: float = 2.0, max_range_km: float = 30.0, steps: int = 200,
    allow_synthetic: bool = True,
) -> float:
    return horizon_profile(
        lat_deg, lon_deg, azimuths_deg=[azimuth_deg], observer_height_m=observer_height_m,
        max_range_km=max_range_km, steps=steps, allow_synthetic=allow_synthetic,
    )[0]["horizon_elevation_deg"]


def ray_clear(
    lat_deg: float, lon_deg: float, azimuth_deg: float, elevation_deg: float, *,
    observer_height_m: float = 2.0, max_range_km: float = 30.0, steps: int = 200,
    allow_synthetic: bool = True,
) -> Dict[str, object]:
    """Is a ray at (azimuth, elevation) clear of terrain?

    A ray is blocked when the terrain's horizon angle in that azimuth exceeds
    the ray's elevation.  Never implies anything about radio-link performance.
    """
    horizon = local_horizon_at(
        lat_deg, lon_deg, azimuth_deg, observer_height_m=observer_height_m,
        max_range_km=max_range_km, steps=steps, allow_synthetic=allow_synthetic,
    )
    return {
        "clear": elevation_deg > horizon,
        "horizon_elevation_deg": horizon,
        "margin_deg": round(elevation_deg - horizon, 4),
    }


def terrain_mesh(
    lat_deg: float, lon_deg: float, *, size_km: float = 8.0, grid: int = 48,
    allow_synthetic: bool = True,
) -> Dict[str, object]:
    """Small local elevation grid (metres) for the 3D local-terrain view."""
    fn = elevation_function(
        lat_deg, lon_deg, allow_synthetic, half_extent_km=size_km / 2.0 + 2.0
    )
    heights = np.zeros((grid, grid), dtype=float)
    for i in range(grid):
        for j in range(grid):
            north = (i / (grid - 1) - 0.5) * size_km
            east = (j / (grid - 1) - 0.5) * size_km
            la, lo = offset_coordinate(lat_deg, lon_deg, east, north)
            heights[i, j] = fn(la, lo)
    sample = get_elevation(lat_deg, lon_deg, allow_synthetic=allow_synthetic)
    return {
        "size_km": size_km,
        "grid": grid,
        "heights_m": heights.round(2).tolist(),
        "min_m": float(heights.min()),
        "max_m": float(heights.max()),
        "source": sample.source,
        "confidence": sample.confidence,
        "available": sample.available,
        "note": sample.note,
    }
