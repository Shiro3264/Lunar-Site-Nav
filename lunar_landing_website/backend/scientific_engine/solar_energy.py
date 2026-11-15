"""Solar-power estimation for a lunar surface asset.

Physics used (all first-principles, all explicitly an **estimate**):

* The Moon has no appreciable atmosphere, so the only flux reaching a panel is
  the direct beam.  Direct normal irradiance is
  ``DNI = S0 · (1 AU / r)²`` where ``r`` is the instantaneous Sun-Moon distance.
* A panel with area ``A`` and efficiency ``η``, whose normal makes angle ``θ``
  with the Sun direction, receives ``P = DNI · A · η · cos θ`` during direct
  illumination and ``0`` otherwise (no diffusion to model).
* Energy over an interval is the time-integral of ``P``.

We never claim a flight-qualified power figure: losses (temperature derating,
dust, wiring, MPPT, cosine losses at the cell level, battery round-trip) are
**not** modelled unless the caller supplies explicit efficiencies.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Optional, Sequence

from scientific_engine.constants import SOLAR_CONSTANT_W_M2

AU_KM = 149_597_870.7


@dataclass
class SolarPanelConfig:
    area_m2: float = 1.0
    efficiency: float = 0.28          # representative triple-junction value
    tilt_from_horizontal_deg: float = 90.0  # 90° = vertical (common lander mast)
    azimuth_deg: float = 0.0          # panel normal azimuth, cw from North
    system_derate: float = 0.85       # wiring/MPPT/temperature placeholder (documented)

    def as_dict(self) -> dict:
        return {
            "area_m2": self.area_m2,
            "efficiency": self.efficiency,
            "tilt_from_horizontal_deg": self.tilt_from_horizontal_deg,
            "azimuth_deg": self.azimuth_deg,
            "system_derate": self.system_derate,
        }


def dni_w_m2(*, sun_distance_km: Optional[float], illuminated: Optional[bool]) -> Optional[float]:
    """Direct normal irradiance (W/m²) for the Sun-Moon distance."""
    if illuminated is None:
        return None
    if not illuminated:
        return 0.0
    if sun_distance_km is None or sun_distance_km <= 0:
        # Documented fallback: mean Sun distance when the vector is unavailable.
        return SOLAR_CONSTANT_W_M2
    return SOLAR_CONSTANT_W_M2 * (AU_KM / sun_distance_km) ** 2


def _cos_incidence(
    sun_az_deg: float, sun_el_deg: float, tilt_deg: float, panel_az_deg: float
) -> float:
    """cos(angle) between the panel normal and the Sun direction.

    ``tilt_from_horizontal_deg`` is measured from the local horizontal plane:
    0° = panel faces straight up (zenith), 90° = panel faces the horizon.
    """
    # Panel normal in local ENU (azimuth cw from North, elevation = 90° - tilt).
    n_el = math.radians(90.0 - tilt_deg)
    n_az = math.radians(panel_az_deg)
    nx = math.cos(n_el) * math.sin(n_az)
    ny = math.cos(n_el) * math.cos(n_az)
    nz = math.sin(n_el)

    s_el = math.radians(sun_el_deg)
    s_az = math.radians(sun_az_deg)
    sx = math.cos(s_el) * math.sin(s_az)
    sy = math.cos(s_el) * math.cos(s_az)
    sz = math.sin(s_el)

    return max(0.0, nx * sx + ny * sy + nz * sz)


def instantaneous_power_w(
    *,
    sun_az_deg: Optional[float],
    sun_el_deg: Optional[float],
    sun_distance_km: Optional[float],
    illuminated: Optional[bool],
    config: SolarPanelConfig,
) -> Optional[float]:
    """Instantaneous panel electrical power (W).  ``None`` if undetermined."""
    if sun_az_deg is None or sun_el_deg is None or illuminated is None:
        return None
    dni = dni_w_m2(sun_distance_km=sun_distance_km, illuminated=illuminated)
    if dni is None:
        return None
    if dni == 0.0:
        return 0.0
    cos_i = _cos_incidence(sun_az_deg, sun_el_deg, config.tilt_from_horizontal_deg, config.azimuth_deg)
    p = dni * config.area_m2 * config.efficiency * config.system_derate * cos_i
    return round(p, 4)


@dataclass
class SolarSummary:
    samples: int
    interval_h: Optional[float]
    peak_power_w: Optional[float]
    mean_power_w: Optional[float]
    energy_wh: Optional[float]
    illuminated_fraction: Optional[float]
    equivalent_sun_hours: Optional[float]
    panel: dict
    note: str
    assumptions: List[str]

    def as_dict(self) -> dict:
        return {
            "samples": self.samples,
            "interval_h": self.interval_h,
            "peak_power_w": self.peak_power_w,
            "mean_power_w": self.mean_power_w,
            "energy_wh": self.energy_wh,
            "illuminated_fraction": self.illuminated_fraction,
            "equivalent_sun_hours": self.equivalent_sun_hours,
            "panel": self.panel,
            "note": self.note,
            "assumptions": self.assumptions,
        }


def summarise_energy(
    powers_w: Sequence[Optional[float]],
    illum_flags: Sequence[Optional[bool]],
    *,
    interval_h: Optional[float],
    config: SolarPanelConfig,
    sun_distance_known: bool,
) -> SolarSummary:
    """Integrate a power series into an energy summary."""
    known = [p for p in powers_w if p is not None]
    n = len(powers_w)
    assumptions = [
        "Estimates only — not a flight power budget.",
        "No atmospheric attenuation (airless body).",
        "Losses modelled solely by the user-supplied system derate.",
    ]
    if not sun_distance_known:
        assumptions.append(
            "Sun-Moon distance fell back to 1 AU because no ephemeris vector was available."
        )

    if not known or interval_h is None:
        return SolarSummary(
            samples=n,
            interval_h=interval_h,
            peak_power_w=(round(max(known), 4) if known else None),
            mean_power_w=None,
            energy_wh=None,
            illuminated_fraction=None,
            equivalent_sun_hours=None,
            panel=config.as_dict(),
            note="Insufficient data to integrate energy (no interval or no samples).",
            assumptions=assumptions,
        )

    energy_wh = sum(known) * interval_h
    illum_known = [f for f in illum_flags if f is not None]
    illum_frac = (
        round(sum(1 for f in illum_known if f) / len(illum_known), 4) if illum_known else None
    )
    return SolarSummary(
        samples=n,
        interval_h=interval_h,
        peak_power_w=round(max(known), 4),
        mean_power_w=round(sum(known) / len(known), 4),
        energy_wh=round(energy_wh, 4),
        illuminated_fraction=illum_frac,
        equivalent_sun_hours=round(energy_wh / max(known), 4) if max(known) > 0 else None,
        panel=config.as_dict(),
        note="Energy integrated over the supplied sampling interval.",
        assumptions=assumptions,
    )
