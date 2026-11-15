"""
Tests for scientific_engine.suitability

Covers:
- Sub-score formulas match documented rationale.
- Missing data returns None composite, never treats missing as 0.
- Weights are renormalised correctly when sub-scores are absent.
- Disclaimer text is present and correct.
- Grade thresholds are consistent.
- Realistic fixture comparison between two candidate sites.
"""
from __future__ import annotations

import pytest

from scientific_engine import suitability as suit


# ---------------------------------------------------------------------------
# Individual sub-score helpers
# ---------------------------------------------------------------------------
class TestIlluminationScore:
    def test_full_illumination_no_darkness(self):
        s = suit.illumination_score(illuminated_fraction=1.0, longest_darkness_h=0.0)
        assert s.score == pytest.approx(100.0)

    def test_zero_illumination(self):
        s = suit.illumination_score(illuminated_fraction=0.0, longest_darkness_h=0.0)
        assert s.score == pytest.approx(0.0)

    def test_darkness_penalty_capped_at_20h(self):
        s_uncapped = suit.illumination_score(illuminated_fraction=1.0, longest_darkness_h=20.0)
        s_capped = suit.illumination_score(illuminated_fraction=1.0, longest_darkness_h=100.0)
        assert s_capped.score == pytest.approx(s_uncapped.score)

    def test_missing_fraction_returns_none(self):
        s = suit.illumination_score(illuminated_fraction=None, longest_darkness_h=0.0)
        assert s.score is None

    def test_score_clamped_to_zero(self):
        # Very long darkness should clamp to 0, not go negative.
        s = suit.illumination_score(illuminated_fraction=0.1, longest_darkness_h=100.0)
        assert s.score >= 0.0


class TestTerrainScore:
    def test_flat_smooth_terrain_gives_100(self):
        s = suit.terrain_score(slope_deg=0.0, roughness_m=0.0)
        assert s.score == pytest.approx(100.0)

    def test_slope_at_twice_limit_gives_zero_slope_component(self):
        limit = 10.0
        s = suit.terrain_score(slope_deg=limit * 2, roughness_m=0.0)
        # slope_component = 0, rough_component = 100 → 0.7*0 + 0.3*100 = 30
        assert s.score == pytest.approx(30.0)

    def test_missing_slope_returns_none(self):
        s = suit.terrain_score(slope_deg=None, roughness_m=5.0)
        assert s.score is None

    def test_score_never_negative(self):
        s = suit.terrain_score(slope_deg=50.0, roughness_m=200.0)
        assert s.score >= 0.0

    def test_missing_roughness_uses_100_for_rough_component(self):
        s_no_rough = suit.terrain_score(slope_deg=5.0, roughness_m=None)
        s_smooth = suit.terrain_score(slope_deg=5.0, roughness_m=0.0)
        assert s_no_rough.score == pytest.approx(s_smooth.score)


class TestCommunicationScore:
    def test_full_access(self):
        s = suit.communication_score(terrain_access_fraction=1.0)
        assert s.score == pytest.approx(100.0)

    def test_no_access(self):
        s = suit.communication_score(terrain_access_fraction=0.0)
        assert s.score == pytest.approx(0.0)

    def test_missing_returns_none(self):
        s = suit.communication_score(terrain_access_fraction=None)
        assert s.score is None


class TestEnergyScore:
    def test_full_equivalent_sun_hours(self):
        s = suit.energy_score(equivalent_sun_hours=24.0, window_hours=24.0)
        assert s.score == pytest.approx(100.0)

    def test_zero_sun_hours(self):
        s = suit.energy_score(equivalent_sun_hours=0.0, window_hours=24.0)
        assert s.score == pytest.approx(0.0)

    def test_missing_hours_returns_none(self):
        s = suit.energy_score(equivalent_sun_hours=None, window_hours=24.0)
        assert s.score is None

    def test_zero_window_returns_none(self):
        s = suit.energy_score(equivalent_sun_hours=10.0, window_hours=0.0)
        assert s.score is None


class TestThermalScore:
    def test_50_percent_illumination_gives_100(self):
        s = suit.thermal_score(illuminated_fraction=0.5)
        assert s.score == pytest.approx(100.0)

    def test_always_illuminated_or_dark_gives_0(self):
        s1 = suit.thermal_score(illuminated_fraction=0.0)
        s2 = suit.thermal_score(illuminated_fraction=1.0)
        assert s1.score == pytest.approx(0.0)
        assert s2.score == pytest.approx(0.0)

    def test_missing_returns_none(self):
        s = suit.thermal_score(illuminated_fraction=None)
        assert s.score is None


# ---------------------------------------------------------------------------
# Full assess() — missing data handling
# ---------------------------------------------------------------------------
class TestAssess:
    def _full_inputs(self):
        return dict(
            illuminated_fraction=0.9,
            longest_darkness_h=2.0,
            slope_deg=3.0,
            roughness_m=5.0,
            terrain_access_fraction=0.8,
            equivalent_sun_hours=18.0,
            window_hours=24.0,
        )

    def test_all_data_produces_non_none_score(self):
        result = suit.assess(**self._full_inputs())
        assert result.composite_score is not None
        assert 0 <= result.composite_score <= 100

    def test_disclaimer_present(self):
        result = suit.assess(**self._full_inputs())
        assert "NOT a probability" in result.disclaimer
        assert "landing" in result.disclaimer.lower()

    def test_missing_all_inputs_returns_none_composite(self):
        result = suit.assess(
            illuminated_fraction=None,
            longest_darkness_h=None,
            slope_deg=None,
            roughness_m=None,
            terrain_access_fraction=None,
            equivalent_sun_hours=None,
            window_hours=None,
        )
        assert result.composite_score is None
        assert result.grade == "insufficient_data"

    def test_missing_data_never_treated_as_zero(self):
        """Score with missing terrain must not equal score with slope=0."""
        with_missing = suit.assess(
            illuminated_fraction=0.9,
            longest_darkness_h=2.0,
            slope_deg=None,
            roughness_m=None,
            terrain_access_fraction=0.8,
            equivalent_sun_hours=18.0,
            window_hours=24.0,
        )
        with_zero = suit.assess(
            illuminated_fraction=0.9,
            longest_darkness_h=2.0,
            slope_deg=0.0,
            roughness_m=0.0,
            terrain_access_fraction=0.8,
            equivalent_sun_hours=18.0,
            window_hours=24.0,
        )
        # They should differ because weights are renormalised, not padded with 0.
        assert with_missing.composite_score != with_zero.composite_score

    def test_weights_renormalised_for_missing(self):
        """Partial data: composite should use remaining weights renormalised.

        illuminated_fraction=1.0 → illumination score = 100.
        thermal score with illuminated_fraction=1.0 → 0 (always lit = extreme cycling).
        Only those two sub-scores are present; renormalised composite =
          (100 * 0.30 + 0 * 0.08) / (0.30 + 0.08) = 30 / 0.38 ≈ 78.9
        The composite must be non-None and strictly between 0 and 100.
        """
        result = suit.assess(
            illuminated_fraction=1.0,
            longest_darkness_h=0.0,
            slope_deg=None,
            roughness_m=None,
            terrain_access_fraction=None,
            equivalent_sun_hours=None,
            window_hours=None,
        )
        assert result.composite_score is not None
        assert 0.0 < result.composite_score < 100.0
        # Three sub-scores must be missing
        assert len(result.missing) == 3

    def test_custom_weights_applied(self):
        base = suit.assess(**self._full_inputs())
        custom = suit.assess(
            **self._full_inputs(),
            weights={"illumination": 1.0, "terrain": 0.0, "communication": 0.0, "energy": 0.0, "thermal": 0.0},
        )
        # With all weight on illumination the scores will differ.
        assert base.composite_score != custom.composite_score

    def test_grade_boundaries(self):
        for score, expected_grade in [
            (95.0, "excellent"),
            (80.0, "excellent"),
            (70.0, "good"),
            (65.0, "good"),
            (55.0, "moderate"),
            (40.0, "marginal"),
            (20.0, "poor"),
        ]:
            assert suit._grade(score) == expected_grade

    def test_composite_between_0_and_100(self):
        result = suit.assess(**self._full_inputs())
        assert 0 <= result.composite_score <= 100


# ---------------------------------------------------------------------------
# Realistic comparative fixture: two south-pole candidate profiles
# ---------------------------------------------------------------------------
class TestRealisticComparison:
    """
    Simulated analysis outputs for two candidate sites.
    Mons Mouton has better illumination; Malapert has better comm access.
    The ranking should reflect the default weights.
    """

    MONS_MOUTON = dict(
        illuminated_fraction=0.87,
        longest_darkness_h=5.0,
        slope_deg=4.2,
        roughness_m=8.5,
        terrain_access_fraction=0.65,
        equivalent_sun_hours=19.0,
        window_hours=24.0,
    )

    MALAPERT = dict(
        illuminated_fraction=0.60,
        longest_darkness_h=12.0,
        slope_deg=6.8,
        roughness_m=14.0,
        terrain_access_fraction=0.90,
        equivalent_sun_hours=12.0,
        window_hours=24.0,
    )

    def test_mons_mouton_outranks_malapert_on_default_weights(self):
        mm = suit.assess(**self.MONS_MOUTON)
        mal = suit.assess(**self.MALAPERT)
        assert mm.composite_score > mal.composite_score, (
            f"Mons Mouton ({mm.composite_score:.1f}) should outrank "
            f"Malapert ({mal.composite_score:.1f}) on default weights."
        )

    def test_comm_focused_weights_flip_ranking(self):
        comm_weights = {
            "illumination": 0.10,
            "terrain": 0.10,
            "communication": 0.70,
            "energy": 0.05,
            "thermal": 0.05,
        }
        mm = suit.assess(**self.MONS_MOUTON, weights=comm_weights)
        mal = suit.assess(**self.MALAPERT, weights=comm_weights)
        assert mal.composite_score > mm.composite_score, (
            "Malapert's superior comm access should dominate when "
            "communication weight = 0.70."
        )

    def test_all_sub_scores_reported(self):
        result = suit.assess(**self.MONS_MOUTON)
        keys = {s.key for s in result.sub_scores}
        assert keys == {"illumination", "terrain", "communication", "energy", "thermal"}
