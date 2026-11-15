"""Core API: health check and platform metadata."""

from __future__ import annotations

import platform
from datetime import datetime, timezone

from django.conf import settings
from django.db import connections
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations import lola, spice
from scientific_engine.constants import CANDIDATE_SITES, LONGITUDE_CONVENTION


def _db_ok() -> bool:
    try:
        connections["default"].cursor().execute("SELECT 1")
        return True
    except Exception:
        return False


def _opt_version(module_name: str) -> str | None:
    try:
        mod = __import__(module_name)
        return getattr(mod, "__version__", "installed")
    except Exception:
        return None


class HealthView(APIView):
    """Liveness/readiness probe with scientific-integration status."""

    @extend_schema(
        summary="Health check",
        description="Returns service status plus availability of SPICE, DEM and LOLA integrations.",
        responses={200: dict},
        tags=["core"],
    )
    def get(self, request):
        spice_available = spice.spice_available()
        return Response(
            {
                "status": "ok",
                "time_utc": datetime.now(timezone.utc).isoformat(),
                "database": {"connected": _db_ok(), "engine": connections["default"].settings_dict.get("ENGINE")},
                "integrations": {
                    "spice": {
                        "available": spice_available,
                        "kernels": spice.available_kernels(),
                    },
                    "lola_dem": lola.dataset_info(),
                },
                "version": "1.0.0",
            }
        )


class MetaView(APIView):
    """Static platform metadata: frames, conventions, data sources, candidates."""

    @extend_schema(
        summary="Platform metadata",
        description="Reference frames, coordinate conventions, data sources and the initial candidate site list.",
        responses={200: dict},
        tags=["core"],
    )
    def get(self, request):
        return Response(
            {
                "branding": {
                    "product": "LunaNav",
                    "tagline": "3D Lunar Landing Site Navigator & Mission Intelligence System",
                },
                "frames": {
                    "body_fixed": "MEAN_ME (Mean-Earth/Mean-Pole)",
                    "longitude_convention": LONGITUDE_CONVENTION,
                    "azimuth_convention": "Degrees clockwise from North (North=0, East=90).",
                    "shape_model": "Sphere R = 1737.4 km (matches Horizons coord@301 geometry).",
                    "terrain_datum": "Heights relative to R = 1737.4 km.",
                },
                "data_sources": [
                    {"name": "JPL Horizons", "url": "https://ssd.jpl.nasa.gov/horizons/", "use": "Sun/Earth ephemeris (OBSERVER, QUANTITIES=4) and ICRF vectors."},
                    {"name": "NASA LRO LOLA", "url": "https://pgda.gsfc.nasa.gov/projects/LOLA", "use": "Measured lunar terrain DEM (optional local tiles)."},
                    {"name": "NASA PDS", "url": "https://pds.nasa.gov/", "use": "Lunar data products."},
                    {"name": "NAIF SPICE", "url": "https://naif.jpl.nasa.gov/naif/", "use": "High-accuracy lunar body-fixed orientation (DE440 PCK)."},
                ],
                "scientific_libraries": {
                    name: _opt_version(name)
                    for name in ("numpy", "scipy", "astropy", "spiceypy", "pyproj", "rasterio", "shapely", "pydantic")
                },
                "runtime": {
                    "python": platform.python_version(),
                    "django": _opt_version("django"),
                    "drf": _opt_version("rest_framework"),
                    "platform": platform.platform(),
                },
                "candidate_sites": CANDIDATE_SITES,
                "disclaimers": [
                    "All values are traceable to a cited source or explicitly labelled as estimates.",
                    "Suitability scores are decision-support heuristics, not landing-success probabilities.",
                ],
            }
        )
