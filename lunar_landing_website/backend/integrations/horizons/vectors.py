"""JPL Horizons VECTORS support.

Used to obtain Moon-centred ICRF direction vectors of the Sun and Earth, which
are then rotated into the lunar body-fixed frame to derive the sub-solar and
sub-Earth points displayed on the 3D globe.

Verified live format (``VEC_TABLE='1'``, ``REF_SYSTEM='ICRF'``,
``REF_PLANE='FRAME'``, ``OUT_UNITS='KM-S'``)::

    $$SOE
    2461359.500000000 = A.D. 2026-Nov-15 00:00:00.0000 TDB
     X =-1.707836373659629E+05 Y = 3.292471285292985E+05 Z = 1.620249591822744E+05
    $$EOE

Note the epoch is **TDB**.  For globe orientation the ~69 s TDB-UTC offset is
negligible and is documented rather than silently applied.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List

import numpy as np

from .client import HorizonsError, query_horizons

_SOE, _EOE = "$$SOE", "$$EOE"
_EPOCH_RE = re.compile(r"^\s*[\d.]+\s*=\s*A\.D\.\s*(?P<label>.+?)\s*(?P<scale>TDB|UT)\s*$")
_XYZ_RE = re.compile(
    r"X\s*=\s*(?P<x>[-+0-9.eE]+)\s*Y\s*=\s*(?P<y>[-+0-9.eE]+)\s*Z\s*=\s*(?P<z>[-+0-9.eE]+)"
)

CENTER_MOON = "500@301"


@dataclass
class StateVector:
    epoch_label: str
    time_scale: str
    x_km: float
    y_km: float
    z_km: float

    @property
    def vector(self) -> np.ndarray:
        return np.array([self.x_km, self.y_km, self.z_km], dtype=float)


def build_vectors_params(
    *, target: str, start_utc: str, stop_utc: str, step: str
) -> Dict[str, str]:
    return {
        "format": "text",
        "COMMAND": f"'{target}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'VECTORS'",
        "CENTER": f"'{CENTER_MOON}'",
        "REF_PLANE": "'FRAME'",
        "REF_SYSTEM": "'ICRF'",
        "VEC_TABLE": "'1'",
        "OUT_UNITS": "'KM-S'",
        "VEC_CORR": "'NONE'",
        "START_TIME": f"'{start_utc}'",
        "STOP_TIME": f"'{stop_utc}'",
        "STEP_SIZE": f"'{step}'",
    }


def parse_vectors_text(raw_text: str) -> List[StateVector]:
    if _SOE not in raw_text or _EOE not in raw_text:
        raise HorizonsError("Horizons VECTORS response missing data block.", raw=raw_text[:2000])
    block = raw_text.split(_SOE, 1)[1].split(_EOE, 1)[0]

    out: List[StateVector] = []
    label: str = ""
    scale: str = "TDB"
    for line in block.splitlines():
        line = line.rstrip()
        if not line.strip():
            continue
        m_epoch = _EPOCH_RE.match(line)
        if m_epoch:
            label = m_epoch.group("label").strip()
            scale = m_epoch.group("scale")
            continue
        m_xyz = _XYZ_RE.search(line)
        if m_xyz:
            out.append(
                StateVector(
                    epoch_label=label,
                    time_scale=scale,
                    x_km=float(m_xyz.group("x")),
                    y_km=float(m_xyz.group("y")),
                    z_km=float(m_xyz.group("z")),
                )
            )
    if not out:
        raise HorizonsError("Horizons VECTORS response contained no state vectors.", raw=raw_text[:2000])
    return out


def fetch_target_vectors(
    *, target: str, start_utc: str, stop_utc: str, step: str, use_cache: bool = True
) -> List[StateVector]:
    params = build_vectors_params(
        target=target, start_utc=start_utc, stop_utc=stop_utc, step=step
    )
    resp = query_horizons(params, use_cache=use_cache)
    return parse_vectors_text(resp.raw_text)
