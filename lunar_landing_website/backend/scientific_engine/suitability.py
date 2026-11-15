"""Explainable landing-site suitability index.

This is a **decision-support heuristic**, *not* a probability of landing
success.  It aggregates physically-motivated sub-scores — each with an explicit
formula and rationale — into a single 0–100 value so candidate sites can be
ranked transparently.

Sub-scores (higher is better, all normalised to 0–100):

``illumination``
    Fraction of the sampled window during which the site is (terrain-aware)
    illuminated, plus a bonus for long uninterrupted illumination.
``terrain``
    Penalises steep slopes and rough/rugged relief — the dominant physical
    landing hazards.
``communication``
    Fraction of the window with a terrain-clear line of sight to Earth.
``energy``
    Normalised solar energy harvest relative to a best-case panel.
``thermal``
    Rewards sites with a smaller day/night illumination swing (milder thermal
    cycling) — a documented proxy, not a thermal model.

Every component returns its inputs, formula, weight and rationale so the result
is fully auditable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class SubScore:
    key: str
    label: str
    score: Optional[float]          # 0-100, None when inputs are missing
    weight: float
    rationale: str
    inputs: Dict[str, object] = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "score": None if self.score is None else round(self.score, 2),
            "weight": self.weight,
            "rationale": self.rationale,
            "inputs": self.inputs,
        }


DEFAULT_WEIGHTS = {
    "illumination": 0.30,
    "terrain": 0.30,
    "communication": 0.20,
    "energy": 0.12,
    "thermal": 0.08,
}


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


# --------------------------------------------------------------------------- #
# Individual sub-scores
# --------------------------------------------------------------------------- #
def illumination_score(
    *, illuminated_fraction: Optional[float], longest_darkness_h: Optional[float]
) -> SubScore:
    if illuminated_fraction is None:
        score = None
    else:
        base = 100.0 * illuminated_fraction
        # Continuous darkness is the operational enemy; penalise it.
        penalty = 0.0
        if longest_darkness_h is not None:
            penalty = min(20.0, longest_darkness_h) * 1.5
        score = _clamp(base - penalty)
    return SubScore(
        key="illumination",
        label="Illumination",
        score=score,
        weight=DEFAULT_WEIGHTS["illumination"],
        rationale=(
            "score = 100·(illuminated fraction) − 1.5·min(longest darkness, 20 h). "
            "Directly reflects solar power availability and imaging/ops windows."
        ),
        inputs={
            "illuminated_fraction": illuminated_fraction,
            "longest_darkness_h": longest_darkness_h,
        },
    )


def terrain_score(
    *, slope_deg: Optional[float], roughness_m: Optional[float], slope_limit_deg: float = 10.0
) -> SubScore:
    if slope_deg is None:
        score = None
    else:
        # Slope: full marks at 0°, zero at 2× the engineering slope limit.
        slope_component = _clamp(100.0 * (1.0 - slope_deg / (2.0 * slope_limit_deg)))
        rough_component = 100.0
        if roughness_m is not None:
            rough_component = _clamp(100.0 * (1.0 - roughness_m / 30.0))
        score = _clamp(0.7 * slope_component + 0.3 * rough_component)
    return SubScore(
        key="terrain",
        label="Terrain / landing hazard",
        score=score,
        weight=DEFAULT_WEIGHTS["terrain"],
        rationale=(
            "0.7·slope_score + 0.3·roughness_score, where slope_score = "
            "100·(1 − slope/(2·limit)) and roughness_score = 100·(1 − RMS/30 m). "
            "Steep, rugged terrain is the primary physical landing hazard."
        ),
        inputs={
            "slope_deg": slope_deg,
            "roughness_m": roughness_m,
            "slope_limit_deg": slope_limit_deg,
        },
    )


def communication_score(*, terrain_access_fraction: Optional[float]) -> SubScore:
    score = None if terrain_access_fraction is None else _clamp(100.0 * terrain_access_fraction)
    return SubScore(
        key="communication",
        label="Earth communication",
        score=score,
        weight=DEFAULT_WEIGHTS["communication"],
        rationale=(
            "score = 100·(fraction of window with terrain-clear Earth line of sight). "
            "Reflects direct-to-Earth communication opportunity."
        ),
        inputs={"terrain_access_fraction": terrain_access_fraction},
    )


def energy_score(
    *, equivalent_sun_hours: Optional[float], window_hours: Optional[float]
) -> SubScore:
    if equivalent_sun_hours is None or not window_hours:
        score = None
    else:
        # Normalise to the theoretical max (Sun always normal to panel).
        score = _clamp(100.0 * (equivalent_sun_hours / window_hours))
    return SubScore(
        key="energy",
        label="Solar energy",
        score=score,
        weight=DEFAULT_WEIGHTS["energy"],
        rationale=(
            "score = 100·(equivalent sun-hours / window length); equivalent "
            "sun-hours = energy / peak power."
        ),
        inputs={
            "equivalent_sun_hours": equivalent_sun_hours,
            "window_hours": window_hours,
        },
    )


def thermal_score(
    *, illuminated_fraction: Optional[float]
) -> SubScore:
    if illuminated_fraction is None:
        score = None
    else:
        # Reward moderate illumination (steadier thermal environment); the
        # extreme is a full lunation of ~50% illumination.
        deviation = abs(illuminated_fraction - 0.5)
        score = _clamp(100.0 * (1.0 - deviation * 2.0))
    return SubScore(
        key="thermal",
        label="Thermal environment (proxy)",
        score=score,
        weight=DEFAULT_WEIGHTS["thermal"],
        rationale=(
            "score = 100·(1 − 2·|illuminated_fraction − 0.5|). A documented proxy: "
            "near-equal day/night gives less extreme thermal cycling. NOT a thermal model."
        ),
        inputs={"illuminated_fraction": illuminated_fraction},
    )


# --------------------------------------------------------------------------- #
# Aggregation
# --------------------------------------------------------------------------- #
@dataclass
class SuitabilityResult:
    composite_score: Optional[float]
    grade: str
    sub_scores: List[SubScore]
    weights: Dict[str, float]
    disclaimer: str
    missing: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "composite_score": None if self.composite_score is None else round(self.composite_score, 2),
            "grade": self.grade,
            "sub_scores": [s.as_dict() for s in self.sub_scores],
            "weights": self.weights,
            "missing_inputs": self.missing,
            "disclaimer": self.disclaimer,
        }


def _grade(score: Optional[float]) -> str:
    if score is None:
        return "insufficient_data"
    if score >= 80:
        return "excellent"
    if score >= 65:
        return "good"
    if score >= 50:
        return "moderate"
    if score >= 35:
        return "marginal"
    return "poor"


def assess(
    *,
    illuminated_fraction: Optional[float],
    longest_darkness_h: Optional[float],
    slope_deg: Optional[float],
    roughness_m: Optional[float],
    terrain_access_fraction: Optional[float],
    equivalent_sun_hours: Optional[float],
    window_hours: Optional[float],
    weights: Optional[Dict[str, float]] = None,
) -> SuitabilityResult:
    """Aggregate sub-scores into a weighted, explainable 0–100 index."""
    w = dict(DEFAULT_WEIGHTS)
    if weights:
        w.update({k: v for k, v in weights.items() if k in DEFAULT_WEIGHTS})

    subs = [
        illumination_score(illuminated_fraction=illuminated_fraction, longest_darkness_h=longest_darkness_h),
        terrain_score(slope_deg=slope_deg, roughness_m=roughness_m),
        communication_score(terrain_access_fraction=terrain_access_fraction),
        energy_score(equivalent_sun_hours=equivalent_sun_hours, window_hours=window_hours),
        thermal_score(illuminated_fraction=illuminated_fraction),
    ]

    present = [s for s in subs if s.score is not None]
    missing = [s.key for s in subs if s.score is None]

    if not present:
        composite = None
    else:
        # Renormalise the weights across the sub-scores we could actually
        # compute, so missing measurements reduce confidence rather than
        # silently scoring a site as zero.
        total_w = sum(w[s.key] for s in present)
        composite = (
            sum(s.score * w[s.key] for s in present) / total_w if total_w else None
        )

    return SuitabilityResult(
        composite_score=composite,
        grade=_grade(composite),
        sub_scores=subs,
        weights=w,
        missing=missing,
        disclaimer=(
            "Decision-support heuristic only. This is NOT a probability of landing "
            "success and NOT a NASA flight-readiness assessment. It ranks candidate "
            "sites by transparent, physically-motivated factors; every sub-score and "
            "weight is shown so the result can be audited or overridden."
        ),
    )
