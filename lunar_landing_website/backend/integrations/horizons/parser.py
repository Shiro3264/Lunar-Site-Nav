"""Parser for JPL Horizons ``OBSERVER`` / ``QUANTITIES='4'`` text output.

Verified against the live API.  For ``QUANTITIES='4'`` the data columns are::

    Date__(UT)__HR:MN     Azi____(a-app)___Elev

i.e. the **airless apparent azimuth and elevation of the target centre**
(topocentric), with azimuth measured clockwise from North.

Each data line has the layout (documented by Horizons, "SOLAR PRESENCE" /
"INTERFERING BODY PRESENCE")::

    <date> <time> <blank> <solar-sym> <interferer-sym>  <Azi>  <Elev>

* ``solar-sym``      ``'*'`` = daylight (Sun upper limb on/above the apparent
  horizon at the *observing site*), ``' '`` = night.
* ``interferer-sym`` ``'i'`` = the interfering body's upper limb is on/above the
  apparent horizon, ``' '`` = below.

The parser never coerces a missing value to zero — unavailable quantities become
``None``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional

from .client import HorizonsError

_SOE = "$$SOE"
_EOE = "$$EOE"

#  Date (UT) HH:MN  capture, then the remainder of the line verbatim.
_ROW_RE = re.compile(
    r"^\s*(?P<date>\d{4}-[A-Za-z]{3}-\d{2})\s+(?P<time>\d{2}:\d{2})(?P<rest>.*)$"
)
_NUM_RE = re.compile(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")
_TIME_FMT = "%Y-%b-%d %H:%M"


@dataclass
class HorizonsRow:
    time_utc: str
    time_dt: Optional[datetime]
    solar_presence: bool          # '*' daylight at the observing site
    interferer_presence: bool     # 'i' interferer upper-limb above horizon
    azimuth_deg: Optional[float]
    elevation_deg: Optional[float]
    extras: Dict[str, float] = field(default_factory=dict)


@dataclass
class HorizonsMeta:
    target_body: Optional[str] = None
    center_body: Optional[str] = None
    interferer: Optional[str] = None
    center_geodetic: Optional[str] = None      # raw "E-lon, lat, alt" string
    center_pole_frame: Optional[str] = None
    start_utc: Optional[str] = None
    stop_utc: Optional[str] = None
    step: Optional[str] = None
    column_headers: List[str] = field(default_factory=list)


@dataclass
class ParsedEphemeris:
    meta: HorizonsMeta
    rows: List[HorizonsRow]
    raw_text: str

    @property
    def is_empty(self) -> bool:
        return not self.rows


def _extract(block: str, label: str) -> Optional[str]:
    for line in block.splitlines():
        if line.strip().startswith(label):
            _, _, rhs = line.partition(":")
            value = rhs.split("{")[0].strip()
            return value or None
    return None


def parse_horizons_text(raw_text: str) -> ParsedEphemeris:
    """Parse a Horizons ``OBSERVER`` text payload into structured rows."""
    if not raw_text or _SOE not in raw_text:
        raise HorizonsError(
            "Horizons response contains no ephemeris data block (missing $$SOE).",
            raw=raw_text[:2000],
        )
    if _EOE not in raw_text:
        raise HorizonsError("Horizons response is truncated (missing $$EOE).", raw=raw_text[:2000])

    header_block = raw_text.split(_SOE, 1)[0]
    data_block = raw_text.split(_SOE, 1)[1].split(_EOE, 1)[0]

    meta = HorizonsMeta(
        target_body=_extract(header_block, "Target body name"),
        center_body=_extract(header_block, "Center body name"),
        interferer=_extract(header_block, "Vis. interferer"),
        center_geodetic=_extract(header_block, "Center geodetic"),
        center_pole_frame=_extract(header_block, "Center pole/equ"),
        start_utc=_extract(header_block, "Start time"),
        stop_utc=_extract(header_block, "Stop  time") or _extract(header_block, "Stop time"),
        step=_extract(header_block, "Step-size"),
    )
    # Column headers: the line immediately preceding the '****' separator.
    for line in header_block.splitlines():
        if "Azi" in line or "Elev" in line:
            meta.column_headers = line.split()
            break

    rows: List[HorizonsRow] = []
    for line in data_block.splitlines():
        if not line.strip():
            continue
        row = _parse_row(line)
        if row is not None:
            rows.append(row)

    if not rows:
        raise HorizonsError("Horizons returned an empty ephemeris table.", raw=raw_text[:2000])

    return ParsedEphemeris(meta=meta, rows=rows, raw_text=raw_text)


def _parse_row(line: str) -> Optional[HorizonsRow]:
    m = _ROW_RE.match(line)
    if not m:
        return None

    date_s = m.group("date")
    time_s = m.group("time")
    rest = m.group("rest")  # starts immediately after HH:MM

    # rest[0] is the single separator blank, rest[1] the solar symbol,
    # rest[2] the interfering-body symbol.
    solar = rest[1:2] == "*"
    interferer = rest[2:3] == "i"
    numeric_region = rest[3:] if len(rest) >= 3 else ""

    values = [float(x) for x in _NUM_RE.findall(numeric_region)]
    azimuth = values[0] if len(values) > 0 else None
    elevation = values[1] if len(values) > 1 else None
    extras = {f"col_{i + 3}": v for i, v in enumerate(values[2:])}

    try:
        dt = datetime.strptime(f"{date_s} {time_s}", _TIME_FMT).replace(tzinfo=timezone.utc)
    except ValueError:
        dt = None

    return HorizonsRow(
        time_utc=f"{date_s} {time_s}",
        time_dt=dt,
        solar_presence=solar,
        interferer_presence=interferer,
        azimuth_deg=azimuth,
        elevation_deg=elevation,
        extras=extras,
    )
