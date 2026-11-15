"""Scientific constants, reference frames and the initial candidate site list.

Reference frames
----------------
* ``MEAN_ME``  — Lunar Mean-Earth / Mean-Pole body-fixed frame.  JPL Horizons
  reports the Moon centre pole/equatorial frame as *MEAN_ME (high precision)*
  for ``CENTER = 'coord@301'`` queries, and we therefore treat MEAN_ME as the
  canonical body-fixed frame for site coordinates.  We never silently mix it
  with MOON_PA or IAU_MOON; any conversion between frames must be explicit.
* ``IAU_MOON`` — Conventional IAU Moon body-fixed frame.  Used only by the
  analytic orientation fallback when no NAIF SPICE kernels are available.

Shape model
-----------
JPL Horizons treats the Moon as a sphere of radius 1737.4 km for centre-site
coordinates (``Center radii: 1737.4, 1737.4, 1737.4 km``).  We therefore use a
spherical mean radius for all geodetic<->Cartesian conversions and carry the
real surface relief through the (separate) DEM elevation value.  This is
documented as a known simplification: the true lunar shape is triaxial, but
Horizons' own site geometry is spherical, so using a sphere keeps our computed
observer geometry consistent with the ephemeris service.
"""

from __future__ import annotations

# --------------------------------------------------------------------------- #
# Geometry
# --------------------------------------------------------------------------- #
MOON_MEAN_RADIUS_KM = 1737.4
MOON_MEAN_RADIUS_M = MOON_MEAN_RADIUS_KM * 1000.0

# Apparent angular radii (radians) of the targets as seen from the Moon.
# Used to convert "centre above horizon" into "limb above horizon".
SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6378.137
SUN_MEAN_DISTANCE_KM = 149_597_870.7
EARTH_MEAN_DISTANCE_KM = 384_400.0

# --------------------------------------------------------------------------- #
# Time
# --------------------------------------------------------------------------- #
J2000_JD = 2451545.0
DAYS_PER_CENTURY = 36525.0
SIDEREAL_MONTH_DAYS = 27.321661
SYNODIC_MONTH_DAYS = 29.530589

# --------------------------------------------------------------------------- #
# Sun / Earth physical model (used by the solar + communication modules)
# --------------------------------------------------------------------------- #
SOLAR_CONSTANT_W_M2 = 1361.0  # total solar irradiance at 1 AU (W/m^2)
# Mean solar distance seen from the Moon is ~1 AU; the perturbation caused by
# the Moon's 384 400 km offset from Earth is < 0.3 % and is documented here
# rather than silently ignored.
EARTH_SHADOW_MAX_KM = 1_370_000.0  # Umbra length scale (approx.), informational

# --------------------------------------------------------------------------- #
# Candidate landing sites (initial inputs — NOT validated landing recommendations)
# Coordinates are selenographic (MEAN_ME), East-longitude positive, degrees.
# --------------------------------------------------------------------------- #
CANDIDATE_SITES = [
    {
        "slug": "mons-mouton",
        "name": "Mons Mouton",
        "latitude": -85.4,
        "longitude": 31.7,
        "region": "Lunar South Pole — Mons Mouton massif",
        "notes": (
            "Initial candidate coordinate input. NASA has identified the Mons "
            "Mouton region as a candidate Artemis landing region; the exact "
            "point here is an approximate regional centre, not a surveyed site."
        ),
    },
    {
        "slug": "malapert-massif",
        "name": "Malapert Massif",
        "latitude": -86.0,
        "longitude": -0.2,
        "region": "Lunar South Pole — Malapert massif",
        "notes": (
            "Initial candidate coordinate input; approximate regional centre."
        ),
    },
    {
        "slug": "nobile-rim-1",
        "name": "Nobile Rim 1",
        "latitude": -85.4,
        "longitude": 37.3,
        "region": "Lunar South Pole — Nobile crater rim",
        "notes": (
            "Initial candidate coordinate input; approximate regional centre."
        ),
    },
    {
        "slug": "haworth",
        "name": "Haworth",
        "latitude": -86.8,
        "longitude": -22.8,
        "region": "Lunar South Pole — Haworth crater",
        "notes": (
            "Initial candidate coordinate input; approximate regional centre."
        ),
    },
]

# Longitude convention string reused across serializers / docs.
LONGITUDE_CONVENTION = "Selenographic East-longitude positive (+90° E → 270° W)."
BODY_FIXED_FRAME = "MEAN_ME (Mean-Earth / Mean-Pole), as used by JPL Horizons coord@301."
SHAPE_MODEL = "Sphere, R = 1737.4 km (matches Horizons centre-site geometry)."
DATM_ALT = "Ellipsoid/altitude datum: spherical mean radius; DEM heights are relative to R=1737.4 km."


def angular_radius_rad(radius_km: float, distance_km: float) -> float:
    """Angular radius of a sphere seen from a given distance (radians)."""
    import math

    return math.asin(max(-1.0, min(1.0, radius_km / distance_km)))
