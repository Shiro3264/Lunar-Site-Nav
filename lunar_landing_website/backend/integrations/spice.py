"""NAIF SPICE integration for scientific lunar orientation.

If ``spiceypy`` is importable **and** the required kernels are present in
``LUNAV["SPICE_KERNEL_DIR"]``, the Moon's body-fixed orientation is computed from
the NAIF binary PCK ``moon_pa_de440_200625.bpc`` (frame ``MOON_PA``, principal
axis) via :func:`spiceypy.pxform`.

Frames
------
* ``MOON_PA`` is the principal-axis lunar body-fixed frame.  It is the frame
  delivered by the NAIF binary PCK and is used for the **globe orientation**.
* Site coordinates are supplied to JPL Horizons in its ``MEAN_ME`` centre frame.
  MOON_PA and MEAN_ME differ by a small, fixed rotation.  Because Horizons'
  *observer* azimuth/elevation results are pure local-horizon geometry they are
  unaffected by which lunar body-fixed frame is used for the globe; only the
  absolute placement of the globe texture changes by that small fixed rotation.
  This distinction is surfaced in the API (``frames`` block) rather than hidden.

When SPICE is unavailable the module degrades, clearly labelled, to a linear
IAU_MOON model (mean pole + linear prime meridian).
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import numpy as np
from django.conf import settings

logger = logging.getLogger("lunanav.spice")

_BODY_MOON = 301
_INERTIAL_FRAME = "J2000"
_BODY_FIXED_FRAME = "MOON_PA"

_KERNEL_FILENAMES = (
    "naif0012.tls",
    "pck00010.tpc",
    "moon_de440_250416.tf",
    "moon_pa_de440_200625.bpc",
)


class SpiceUnavailable(RuntimeError):
    """Raised when SPICE kernels / spiceypy cannot be used."""


def kernel_dir() -> Path:
    return Path(settings.LUNAV.get("SPICE_KERNEL_DIR", ""))


def available_kernels() -> List[str]:
    d = kernel_dir()
    if not d.exists():
        return []
    return [name for name in _KERNEL_FILENAMES if (d / name).exists()]


def kernels_ready() -> bool:
    return len(available_kernels()) == len(_KERNEL_FILENAMES)


@dataclass
class MoonOrientation:
    """Moon body-fixed orientation at an epoch."""

    epoch_utc: str
    frame: str
    source: str
    pole_ra_deg: float
    pole_dec_deg: float
    prime_meridian_deg: float
    # 3x3 row-major matrix transforming body-fixed -> inertial (J2000/ICRF).
    bodyfixed_to_inertial: List[List[float]]
    confidence: str
    note: str = ""


_loaded = False


def _ensure_loaded() -> "object":
    """Load kernels once; return the spiceypy module."""
    global _loaded
    try:
        import spiceypy as spice  # noqa: WPS433 (lazy import)
    except Exception as exc:  # pragma: no cover - depends on optional dep
        raise SpiceUnavailable("spiceypy is not installed.") from exc

    if not kernels_ready():
        missing = sorted(set(_KERNEL_FILENAMES) - set(available_kernels()))
        raise SpiceUnavailable(f"Missing SPICE kernels: {', '.join(missing)}")

    if not _loaded:
        for name in available_kernels():
            spice.furnsh(str(kernel_dir() / name))
        _loaded = True
    return spice


def spice_available() -> bool:
    try:
        _ensure_loaded()
        return True
    except SpiceUnavailable:
        return False


def _utc_to_et(utc: datetime) -> float:
    spice = _ensure_loaded()
    if utc.tzinfo is None:
        utc = utc.replace(tzinfo=timezone.utc)
    stamp = utc.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    return float(spice.str2et(stamp))


def _orientation_from_matrix(epoch_utc: str, m: np.ndarray, source: str, confidence: str, note: str = "") -> MoonOrientation:
    """Build a :class:`MoonOrientation` from a body-fixed->inertial matrix."""
    # Body-fixed +Z (spin axis) expressed in the inertial frame -> pole RA/Dec.
    z_inertial = m @ np.array([0.0, 0.0, 1.0])
    pole_dec = math.degrees(math.asin(max(-1.0, min(1.0, z_inertial[2]))))
    pole_ra = math.degrees(math.atan2(z_inertial[1], z_inertial[0])) % 360.0

    # Prime meridian W: angle, about the pole, from the ascending node of the
    # body equator on the inertial equator to the body-fixed +X axis.
    x_inertial = m @ np.array([1.0, 0.0, 0.0])
    icrf_z = np.array([0.0, 0.0, 1.0])
    node = np.cross(icrf_z, z_inertial)
    n_norm = np.linalg.norm(node)
    if n_norm < 1e-12:
        node = np.array([1.0, 0.0, 0.0])
    else:
        node = node / n_norm
    pole_hat = z_inertial / (np.linalg.norm(z_inertial) or 1.0)
    x_perp = x_inertial - np.dot(x_inertial, pole_hat) * pole_hat
    x_perp_norm = np.linalg.norm(x_perp)
    if x_perp_norm < 1e-12:
        w = 0.0
    else:
        x_hat = x_perp / x_perp_norm
        w = math.degrees(math.atan2(float(np.dot(np.cross(node, x_hat), pole_hat)), float(np.dot(node, x_hat)))) % 360.0

    return MoonOrientation(
        epoch_utc=epoch_utc,
        frame=_BODY_FIXED_FRAME,
        source=source,
        pole_ra_deg=pole_ra,
        pole_dec_deg=pole_dec,
        prime_meridian_deg=w,
        bodyfixed_to_inertial=[[float(v) for v in row] for row in m],
        confidence=confidence,
        note=note,
    )


def moon_orientation(utc: datetime) -> MoonOrientation:
    """Moon body-fixed orientation at ``utc`` (SPICE, else labelled fallback)."""
    if utc.tzinfo is None:
        utc = utc.replace(tzinfo=timezone.utc)
    utc = utc.astimezone(timezone.utc)
    epoch_utc = utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        spice = _ensure_loaded()
        et = _utc_to_et(utc)
        m = np.array(spice.pxform(_BODY_FIXED_FRAME, _INERTIAL_FRAME, et), dtype=float)
        return _orientation_from_matrix(
            epoch_utc,
            m,
            source="NAIF SPICE pxform(MOON_PA -> J2000)",
            confidence="high",
            note=(
                "Body-fixed frame is MOON_PA (principal axis) from NAIF binary PCK "
                "moon_pa_de440_200625.bpc. Horizons site coordinates use MEAN_ME; "
                "the two frames differ by a small fixed rotation."
            ),
        )
    except SpiceUnavailable as exc:
        logger.info("SPICE unavailable (%s); using linear IAU_MOON fallback.", exc)
        return _linear_iau_moon(utc, epoch_utc, str(exc))


def _linear_iau_moon(utc: datetime, epoch_utc: str, reason: str) -> MoonOrientation:
    """Documented low-fidelity fallback: IAU_MOON mean pole + linear W.

    Periodic libration terms (up to a few degrees) are **omitted**; the result is
    explicitly labelled low confidence.  Installed NAIF kernels remove this
    limitation.
    """
    from scientific_engine.constants import J2000_JD

    jd = _utc_to_jd(utc)
    d = jd - J2000_JD
    alpha0 = 269.9949
    delta0 = 66.5392
    w = (38.3213 + 13.17635815 * d) % 360.0

    # Mean pole -> body-fixed->inertial matrix (standard IAU z-x-z construction).
    m = _iau_matrix(alpha0, 90.0 - delta0, w)
    return _orientation_from_matrix(
        epoch_utc,
        m,
        source="Analytic IAU_MOON mean-pole + linear W (fallback)",
        confidence="low",
        note=(
            "SPICE kernels unavailable: " + reason + ". Periodic libration terms "
            "are omitted (error up to a few degrees). Install the NAIF kernels to "
            "enable high-fidelity orientation."
        ),
    )


def _iau_matrix(alpha0_deg: float, delta0_deg: float, w_deg: float) -> np.ndarray:
    """IAU body-fixed -> inertial rotation matrix from pole RA/Dec and W."""
    a = math.radians(alpha0_deg)
    d = math.radians(delta0_deg)
    w = math.radians(w_deg)
    rz_w = np.array([[math.cos(w), -math.sin(w), 0.0], [math.sin(w), math.cos(w), 0.0], [0.0, 0.0, 1.0]])
    rx = np.array([[1.0, 0.0, 0.0], [0.0, math.cos(d), -math.sin(d)], [0.0, math.sin(d), math.cos(d)]])
    rz_a = np.array([[math.cos(a), -math.sin(a), 0.0], [math.sin(a), math.cos(a), 0.0], [0.0, 0.0, 1.0]])
    return rz_a @ rx @ rz_w


def _utc_to_jd(utc: datetime) -> float:
    """UTC -> Julian Date (sufficient accuracy for the linear fallback)."""
    from datetime import datetime as _dt

    epoch = _dt(1970, 1, 1, tzinfo=timezone.utc)
    seconds = (utc - epoch).total_seconds()
    return 2440587.5 + seconds / 86400.0


def inertial_to_bodyfixed(vector: np.ndarray, orientation: MoonOrientation) -> np.ndarray:
    """Rotate a vector from the inertial (J2000/ICRF) frame into body-fixed."""
    m = np.array(orientation.bodyfixed_to_inertial, dtype=float)
    return m.T @ (np.asarray(vector, dtype=float) / (np.linalg.norm(vector) or 1.0))


def sub_point_lat_lon(direction_bodyfixed: np.ndarray) -> tuple:
    """Latitude/longitude (deg) of the surface point a body-fixed direction hits."""
    from scientific_engine.coordinates import bodyfixed_to_geodetic

    lat, lon, _ = bodyfixed_to_geodetic(np.asarray(direction_bodyfixed, dtype=float))
    return (lat, lon)
