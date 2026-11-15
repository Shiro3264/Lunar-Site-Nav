"""
Tests for scientific_engine.coordinates

Verifies the documented frame chain:
  body-fixed (bf)  <->  ENU  <->  azimuth/elevation  <->  scene (Three.js)

Known lunar landmarks used as control points:
  - Mons Mouton region: lat=-85.4, lon=+31.7
  - Malapert Massif:    lat=-86.0, lon=-0.2
  - Lunar north pole:   lat=+90.0, lon=0.0  (Z-axis sanity check)
  - Prime meridian/equator intersection: lat=0.0, lon=0.0  (X-axis check)
"""
from __future__ import annotations

import math
import pytest

from scientific_engine import coordinates as coords
from scientific_engine.constants import MOON_MEAN_RADIUS_M


# ---------------------------------------------------------------------------
# geodetic_to_bodyfixed / bodyfixed_to_geodetic round-trip
# ---------------------------------------------------------------------------
CONTROL_POINTS = [
    ("mons_mouton", -85.4, 31.7),
    ("malapert_massif", -86.0, -0.2),
    ("north_pole", 90.0, 0.0),
    ("equator_prime_meridian", 0.0, 0.0),
    ("equator_90e", 0.0, 90.0),
    ("south_pole", -90.0, 0.0),
    ("nobile_rim_1", -85.4, 37.3),
    ("haworth", -86.8, -22.8),
]


@pytest.mark.parametrize("name,lat,lon", CONTROL_POINTS)
def test_geodetic_bodyfixed_roundtrip(name, lat, lon):
    """Converting lat/lon to body-fixed and back should recover the original."""
    bf = coords.geodetic_to_bodyfixed(lat, lon, alt_m=0.0)
    lat2, lon2, alt2 = coords.bodyfixed_to_geodetic(bf)

    assert abs(lat2 - lat) < 1e-9, f"{name}: latitude mismatch {lat2} vs {lat}"
    # Longitude is degenerate at the poles; skip it there.
    if abs(lat) < 89.9:
        # Wrap both to [-180, 180) for comparison.
        dl = (lon2 - lon + 180) % 360 - 180
        assert abs(dl) < 1e-9, f"{name}: longitude mismatch {lon2} vs {lon}"
    assert abs(alt2) < 1e-6, f"{name}: altitude should be ~0, got {alt2}"


def test_north_pole_bf_is_z_axis():
    """North pole body-fixed vector should be (0, 0, R)."""
    bf = coords.geodetic_to_bodyfixed(90.0, 0.0, alt_m=0.0)
    assert abs(bf[0]) < 1e-6
    assert abs(bf[1]) < 1e-6
    assert abs(bf[2] - MOON_MEAN_RADIUS_M) < 1.0


def test_equator_prime_meridian_bf_is_x_axis():
    """Equator / prime meridian intersection should be on the +X axis."""
    bf = coords.geodetic_to_bodyfixed(0.0, 0.0, alt_m=0.0)
    assert abs(bf[1]) < 1e-6
    assert abs(bf[2]) < 1e-6
    assert abs(bf[0] - MOON_MEAN_RADIUS_M) < 1.0


# ---------------------------------------------------------------------------
# bodyfixed_to_scene / scene_to_bodyfixed
# ---------------------------------------------------------------------------
def test_scene_bf_roundtrip():
    """bfToScene followed by sceneToBf should be the identity."""
    import numpy as np

    bf_in = coords.geodetic_to_bodyfixed(-85.4, 31.7)
    scene = coords.bodyfixed_to_scene(bf_in)
    bf_out = coords.scene_to_bodyfixed(scene)
    assert all(abs(a - b) < 1e-9 for a, b in zip(bf_in, bf_out))


def test_north_pole_scene_is_y_axis():
    """North pole should map to scene +Y (Y-up Three.js convention)."""
    bf = coords.geodetic_to_bodyfixed(90.0, 0.0)
    scene = coords.bodyfixed_to_scene(bf)
    # scene = (bf.y, bf.z, bf.x); north pole has bf=(0,0,R) -> scene=(0,R,0)
    assert abs(scene[0]) < 1e-6
    assert abs(scene[2]) < 1e-6
    assert scene[1] > 0


# ---------------------------------------------------------------------------
# ENU basis
# ---------------------------------------------------------------------------
def test_enu_basis_orthonormal():
    """East, North, Up vectors at any site must be mutually orthogonal unit vectors."""
    import numpy as np

    for _name, lat, lon in CONTROL_POINTS:
        if abs(lat) > 89.9:
            continue  # skip degenerate poles
        east, north, up = coords.enu_basis(lat, lon)
        assert abs(np.dot(east, north)) < 1e-10
        assert abs(np.dot(east, up)) < 1e-10
        assert abs(np.dot(north, up)) < 1e-10
        assert abs(np.linalg.norm(east) - 1.0) < 1e-10
        assert abs(np.linalg.norm(north) - 1.0) < 1e-10
        assert abs(np.linalg.norm(up) - 1.0) < 1e-10


# ---------------------------------------------------------------------------
# Azimuth / elevation <-> ENU
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("az,el", [
    (0.0, 90.0),    # zenith -> pure Up
    (90.0, 0.0),    # due East, horizon -> pure East
    (0.0, 0.0),     # due North, horizon -> pure North
    (180.0, 0.0),   # due South
    (45.0, 45.0),   # NE, 45° up
])
def test_az_el_to_enu_unit_vector(az, el):
    """az_el_to_enu should always produce a unit vector."""
    import numpy as np

    v = coords.az_el_to_enu(az, el)
    assert abs(np.linalg.norm(v) - 1.0) < 1e-10


def test_az_el_roundtrip():
    """az_el_to_enu followed by enu_to_az_el should recover original az/el."""
    for az in [0, 45, 90, 135, 180, 225, 270, 315]:
        for el in [-45, 0, 30, 60, 89]:
            v = coords.az_el_to_enu(float(az), float(el))
            az2, el2 = coords.enu_to_az_el(v)
            assert abs(az2 - az) < 1e-6 or abs(az2 - az - 360) < 1e-6
            assert abs(el2 - el) < 1e-6


# ---------------------------------------------------------------------------
# validate_lat_lon
# ---------------------------------------------------------------------------
def test_validate_lat_lon_accepts_valid():
    lat, lon = coords.validate_lat_lon(-85.4, 31.7)
    assert lat == -85.4
    assert abs(lon - 31.7) < 1e-9


def test_validate_lat_lon_wraps_longitude():
    _, lon = coords.validate_lat_lon(0.0, 190.0)
    assert abs(lon - (-170.0)) < 1e-9


def test_validate_lat_lon_rejects_bad_latitude():
    with pytest.raises(ValueError):
        coords.validate_lat_lon(91.0, 0.0)
    with pytest.raises(ValueError):
        coords.validate_lat_lon(-90.1, 0.0)


# ---------------------------------------------------------------------------
# South Pole coordinate consistency (multiple points)
# ---------------------------------------------------------------------------
SOUTH_POLE_CANDIDATES = [
    (-85.4, 31.7),
    (-86.0, -0.2),
    (-85.4, 37.3),
    (-86.8, -22.8),
]


@pytest.mark.parametrize("lat,lon", SOUTH_POLE_CANDIDATES)
def test_south_pole_candidate_bf_in_southern_hemisphere(lat, lon):
    """All south-pole candidates must have bf.z < 0 (southern hemisphere)."""
    bf = coords.geodetic_to_bodyfixed(lat, lon)
    assert bf[2] < 0, f"Expected bf.z < 0 for lat={lat}, got bf.z={bf[2]}"
