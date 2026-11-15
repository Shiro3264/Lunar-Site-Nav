"""Coordinate systems and transformations for LunaNav.

All angles are degrees at the API boundary and radians internally, except where
a function name explicitly says ``_deg``.  Lengths are metres unless a name says
``_km``.

Frames used
-----------
``body-fixed (bf)``
    Right-handed lunar body-fixed frame (MEAN_ME): +X through the 0° meridian at
    the equator, +Y through 90°E, +Z through the north pole.
``ENU``
    Local East-North-Up frame attached to an observer on the surface.
``scene``
    Three.js/WebGL world frame.  Three.js is Y-up, so we map
    ``scene = (bf.y, bf.z, bf.x)`` (right-handed, north pole → +Y).  The inverse
    is ``bf = (scene.z, scene.x, scene.y)``.

Azimuth convention (matches JPL Horizons): measured clockwise from North,
North = 0°, East = 90°, South = 180°, West = 270°.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence, Tuple

import numpy as np

from .constants import MOON_MEAN_RADIUS_M

ArrayLike = Sequence[float]


# --------------------------------------------------------------------------- #
# Basic vector helpers
# --------------------------------------------------------------------------- #
def unit(vec: ArrayLike) -> np.ndarray:
    """Return the unit vector of ``vec`` (raises on a zero vector)."""
    v = np.asarray(vec, dtype=float)
    n = np.linalg.norm(v)
    if n == 0.0:
        raise ValueError("Cannot normalise a zero-length vector.")
    return v / n


def norm(vec: ArrayLike) -> float:
    return float(np.linalg.norm(np.asarray(vec, dtype=float)))


# --------------------------------------------------------------------------- #
# Body-fixed <-> geodetic (spherical)
# --------------------------------------------------------------------------- #
def geodetic_to_bodyfixed(
    lat_deg: float, lon_deg: float, alt_m: float = 0.0,
    radius_m: float = MOON_MEAN_RADIUS_M,
) -> np.ndarray:
    """Convert selenographic latitude/longitude (+ East) & altitude to bf (m)."""
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    r = radius_m + alt_m
    return np.array(
        [
            r * math.cos(lat) * math.cos(lon),
            r * math.cos(lat) * math.sin(lon),
            r * math.sin(lat),
        ],
        dtype=float,
    )


def bodyfixed_to_geodetic(
    vec_bf: ArrayLike, radius_m: float = MOON_MEAN_RADIUS_M
) -> Tuple[float, float, float]:
    """Convert a bf position (m) to (latitude_deg, longitude_deg, altitude_m).

    Because a spherical shape model is used, geodetic latitude equals
    planetocentric latitude here.
    """
    x, y, z = (float(c) for c in np.asarray(vec_bf, dtype=float)[:3])
    r = math.sqrt(x * x + y * y + z * z)
    if r == 0.0:
        return (0.0, 0.0, -radius_m)
    lat = math.degrees(math.asin(z / r))
    lon = math.degrees(math.atan2(y, x))
    return (lat, lon, r - radius_m)


# --------------------------------------------------------------------------- #
# ENU basis
# --------------------------------------------------------------------------- #
def enu_basis(lat_deg: float, lon_deg: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return the (east, north, up) unit vectors expressed in the bf frame."""
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    up = np.array(
        [math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)]
    )
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    north = np.array(
        [
            -math.sin(lat) * math.cos(lon),
            -math.sin(lat) * math.sin(lon),
            math.cos(lat),
        ]
    )
    return (east, north, up)


def enu_to_bodyfixed(vec_enu: ArrayLike, lat_deg: float, lon_deg: float) -> np.ndarray:
    """Express an ENU vector in the body-fixed frame."""
    east, north, up = enu_basis(lat_deg, lon_deg)
    e, n, u = (float(c) for c in np.asarray(vec_enu, dtype=float)[:3])
    return e * east + n * north + u * up


def bodyfixed_to_enu(vec_bf: ArrayLike, lat_deg: float, lon_deg: float) -> np.ndarray:
    """Express a body-fixed vector in the observer's local ENU frame."""
    east, north, up = enu_basis(lat_deg, lon_deg)
    v = np.asarray(vec_bf, dtype=float)[:3]
    return np.array([float(np.dot(v, east)), float(np.dot(v, north)), float(np.dot(v, up))])


# --------------------------------------------------------------------------- #
# Azimuth / elevation <-> ENU
# --------------------------------------------------------------------------- #
def az_el_to_enu(az_deg: float, el_deg: float) -> np.ndarray:
    """Unit vector in ENU from azimuth (cw from North) and elevation."""
    az = math.radians(az_deg)
    el = math.radians(el_deg)
    east = math.cos(el) * math.sin(az)
    north = math.cos(el) * math.cos(az)
    up = math.sin(el)
    return np.array([east, north, up], dtype=float)


def enu_to_az_el(vec_enu: ArrayLike) -> Tuple[float, float]:
    """Return (azimuth_deg in [0,360), elevation_deg in [-90,90])."""
    e, n, u = (float(c) for c in np.asarray(vec_enu, dtype=float)[:3])
    horizontal = math.hypot(e, n)
    el = math.degrees(math.atan2(u, horizontal))
    az = math.degrees(math.atan2(e, n)) % 360.0
    return (az, el)


def az_el_to_bodyfixed(
    az_deg: float, el_deg: float, lat_deg: float, lon_deg: float
) -> np.ndarray:
    """Celestial azimuth/elevation -> unit vector in the body-fixed frame."""
    return unit(enu_to_bodyfixed(az_el_to_enu(az_deg, el_deg), lat_deg, lon_deg))


# --------------------------------------------------------------------------- #
# Scene (Three.js, Y-up) mapping
# --------------------------------------------------------------------------- #
def bodyfixed_to_scene(vec_bf: ArrayLike) -> np.ndarray:
    """bf(m) -> Three.js scene coordinates: scene = (bf.y, bf.z, bf.x)."""
    x, y, z = (float(c) for c in np.asarray(vec_bf, dtype=float)[:3])
    return np.array([y, z, x], dtype=float)


def scene_to_bodyfixed(vec_scene: ArrayLike) -> np.ndarray:
    """Inverse of :func:`bodyfixed_to_scene`: bf = (scene.z, scene.x, scene.y)."""
    sx, sy, sz = (float(c) for c in np.asarray(vec_scene, dtype=float)[:3])
    return np.array([sz, sx, sy], dtype=float)


# --------------------------------------------------------------------------- #
# Angles & geometry
# --------------------------------------------------------------------------- #
def angular_separation_deg(v1: ArrayLike, v2: ArrayLike) -> float:
    """Angle between two vectors, in degrees."""
    a, b = unit(v1), unit(v2)
    return math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(a, b))))))


def great_circle_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Spherical (great-circle) distance on the mean Moon radius, in km."""
    p1, l1 = math.radians(lat1), math.radians(lon1)
    p2, l2 = math.radians(lat2), math.radians(lon2)
    d = math.acos(
        max(
            -1.0,
            min(
                1.0,
                math.sin(p1) * math.sin(p2)
                + math.cos(p1) * math.cos(p2) * math.cos(l2 - l1),
            ),
        )
    )
    return d * (MOON_MEAN_RADIUS_M / 1000.0)


def slope_from_normal_deg(normal: Iterable[float], up: Iterable[float] | None = None) -> float:
    """Terrain slope = angle between the surface normal and the local vertical."""
    n = unit(normal)
    u = unit(up) if up is not None else np.array([0.0, 0.0, 1.0])
    return math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(n, u))))))


def surface_normal_from_gradient(dz_dx: float, dz_dy: float) -> np.ndarray:
    """Surface normal (unnormalised) from an elevation gradient in a local plane.

    The plane is assumed to be a local tangent plane whose axes are the East and
    North directions; +Up = normal of the flat plane.
    """
    return unit(np.array([-dz_dx, -dz_dy, 1.0], dtype=float))


def wrap_longitude_deg(lon_deg: float) -> float:
    """Wrap any longitude into [-180, 180)."""
    return ((lon_deg + 180.0) % 360.0) - 180.0


def normalize_longitude_360(lon_deg: float) -> float:
    """Wrap any longitude into [0, 360)."""
    return lon_deg % 360.0


def compass_label(az_deg: float) -> str:
    """16-point compass label for an azimuth in degrees."""
    points = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ]
    idx = int((az_deg % 360.0) / 22.5 + 0.5) % 16
    return points[idx]


def validate_lat_lon(lat_deg: float, lon_deg: float) -> Tuple[float, float]:
    """Validate & normalise a selenographic coordinate.

    Raises ``ValueError`` for out-of-range latitude.  Longitude is wrapped into
    [-180, 180) using the East-positive convention.
    """
    if not (-90.0 <= lat_deg <= 90.0):
        raise ValueError(f"Latitude {lat_deg} out of range [-90, 90].")
    if not math.isfinite(lon_deg):
        raise ValueError("Longitude must be a finite number.")
    return (float(lat_deg), wrap_longitude_deg(lon_deg))
