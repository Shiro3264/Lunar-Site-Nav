"""JPL Horizons HTTP client.

Wraps ``https://ssd.jpl.nasa.gov/api/horizons.api`` with:

* request construction that matches the documented parameter contract,
* timeouts, bounded retries with exponential backoff,
* Django-cache based memoisation of identical requests,
* retention of the raw response text for scientific debugging.

The client performs **no** interpretation; see :mod:`parser` and
:mod:`interpreter`.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger("lunanav.horizons")

# Horizons target identifiers.
TARGET_SUN = "10"
TARGET_EARTH = "399"

# Horizons centre: the Moon, with a user-supplied surface site coordinate.
CENTER_MOON_COORD = "coord@301"


class HorizonsError(RuntimeError):
    """Raised when Horizons cannot return a usable ephemeris."""

    def __init__(self, message: str, *, raw: str = "", status: Optional[int] = None):
        super().__init__(message)
        self.raw = raw
        self.status = status


@dataclass
class HorizonsResponse:
    """A single raw Horizons response plus its request provenance."""

    raw_text: str
    request_params: Dict[str, Any]
    url: str
    from_cache: bool = False


def _cfg(key: str, default: Any) -> Any:
    return settings.LUNAV.get(key, default)


def build_observer_params(
    *,
    target: str,
    site_lon_deg: float,
    site_lat_deg: float,
    site_alt_km: float,
    start_utc: str,
    stop_utc: str,
    step: str,
    quantities: str = "4",
) -> Dict[str, str]:
    """Build the Horizons ``OBSERVER`` request parameters.

    ``SITE_COORD`` ordering is **longitude, latitude, altitude** with
    East-positive longitude in degrees and altitude in km, matching the
    documented Horizons ``coord@301`` contract (verified against the live API,
    whose header echoes ``Center geodetic : E-lon(deg),Lat(deg),Alt(km)``).
    """
    return {
        "format": "text",
        "COMMAND": f"'{target}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": f"'{CENTER_MOON_COORD}'",
        "SITE_COORD": f"'{site_lon_deg:.6f},{site_lat_deg:.6f},{site_alt_km:.6f}'",
        "START_TIME": f"'{start_utc}'",
        "STOP_TIME": f"'{stop_utc}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": f"'{quantities}'",
        "TIME_TYPE": "'UT'",
        "ANG_FORMAT": "'DEG'",
        "CAL_FORMAT": "'CAL'",
        "EXTRA_PREC": "'YES'",
    }


def _cache_key(params: Dict[str, str]) -> str:
    digest = hashlib.sha256(
        "&".join(f"{k}={params[k]}" for k in sorted(params)).encode()
    ).hexdigest()
    return f"lunanav:horizons:{digest}"


def query_horizons(
    params: Dict[str, str], *, use_cache: bool = True
) -> HorizonsResponse:
    """Execute a Horizons request, returning the raw text payload."""
    url = _cfg("HORIZONS_API_URL", "https://ssd.jpl.nasa.gov/api/horizons.api")
    key = _cache_key(params)
    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            return HorizonsResponse(
                raw_text=cached, request_params=params, url=url, from_cache=True
            )

    timeout = float(_cfg("HORIZONS_TIMEOUT", 30))
    retries = int(_cfg("HORIZONS_MAX_RETRIES", 3))
    last_exc: Optional[Exception] = None

    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            text = resp.text
            if use_cache:
                cache.set(key, text, _cfg("HORIZONS_CACHE_TTL", 3600))
            return HorizonsResponse(raw_text=text, request_params=params, url=url)
        except requests.Timeout as exc:  # network level
            last_exc = exc
            logger.warning("Horizons timeout (attempt %s/%s)", attempt + 1, retries)
        except requests.HTTPError as exc:
            last_exc = exc
            status = exc.response.status_code if exc.response is not None else None
            # 4xx other than 429 will not improve on retry.
            if status and 400 <= status < 500 and status != 429:
                raise HorizonsError(
                    f"Horizons HTTP {status}", raw=getattr(exc.response, "text", ""),
                    status=status,
                ) from exc
            logger.warning("Horizons HTTP error %s (attempt %s/%s)", status, attempt + 1, retries)
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning("Horizons request failed: %s (attempt %s/%s)", exc, attempt + 1, retries)

        if attempt < retries - 1:
            time.sleep(0.6 * (2 ** attempt))

    raise HorizonsError(f"Horizons unavailable after {retries} attempts: {last_exc}")


def fetch_target_ephemeris(
    *,
    target: str,
    site_lon_deg: float,
    site_lat_deg: float,
    site_alt_km: float,
    start_utc: str,
    stop_utc: str,
    step: str,
    quantities: str = "4",
    use_cache: bool = True,
) -> HorizonsResponse:
    """Convenience wrapper building observer params for a single target."""
    params = build_observer_params(
        target=target,
        site_lon_deg=site_lon_deg,
        site_lat_deg=site_lat_deg,
        site_alt_km=site_alt_km,
        start_utc=start_utc,
        stop_utc=stop_utc,
        step=step,
        quantities=quantities,
    )
    return query_horizons(params, use_cache=use_cache)
