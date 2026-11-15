"""
Tests for scientific_engine.illumination

Verifies the four distinct visibility notions are kept separate and
that missing data produces None, never a fabricated result.
"""
from __future__ import annotations

import pytest

from scientific_engine import illumination as illum


# ---------------------------------------------------------------------------
# evaluate_sun — geometric-only (no terrain)
# ---------------------------------------------------------------------------
class TestEvaluateSunGeometric:
    def _eval(self, az, el, horizons_daylight=None, terrain=False):
        return illum.evaluate_sun(
            time_utc="2026-Nov-15 02:00",
            sun_azimuth_deg=az,
            sun_elevation_deg=el,
            horizons_daylight=horizons_daylight,
            lat_deg=-85.4,
            lon_deg=31.7,
            terrain_available=terrain,
        )

    def test_above_geometric_horizon(self):
        s = self._eval(187.0, 2.5)
        assert s.geometric_centre_above is True
        assert s.geometric_limb_above is True

    def test_below_geometric_horizon(self):
        s = self._eval(187.0, -5.0)
        assert s.geometric_centre_above is False

    def test_limb_above_when_centre_just_below(self):
        # Sun radius ≈ 0.267°; at el = -0.1° limb should still be above.
        s = self._eval(187.0, -0.1)
        assert s.geometric_centre_above is False
        assert s.geometric_limb_above is True

    def test_no_terrain_gives_none_for_terrain_fields(self):
        s = self._eval(187.0, 2.5, terrain=False)
        assert s.terrain_horizon_deg is None
        assert s.terrain_clear is None
        assert s.illuminated is None
        assert s.confidence == "low"

    def test_missing_azimuth_returns_none_illuminated(self):
        s = illum.evaluate_sun(
            time_utc="2026-Nov-15 02:00",
            sun_azimuth_deg=None,
            sun_elevation_deg=2.5,
            horizons_daylight=None,
            lat_deg=-85.4,
            lon_deg=31.7,
            terrain_available=False,
        )
        assert s.illuminated is None
        assert s.confidence == "unknown"

    def test_horizons_daylight_marker_preserved(self):
        s = self._eval(187.0, 2.5, horizons_daylight=True)
        assert s.horizons_daylight is True

        s2 = self._eval(187.0, -3.0, horizons_daylight=False)
        assert s2.horizons_daylight is False


# ---------------------------------------------------------------------------
# evaluate_sun — with terrain horizon function
# ---------------------------------------------------------------------------
class TestEvaluateSunTerrain:
    def _eval_with_horizon(self, el, horizon_at_az):
        """Inject a fixed terrain horizon for testing."""
        def _horizon_fn(az):
            return horizon_at_az

        return illum.evaluate_sun(
            time_utc="2026-Nov-15 02:00",
            sun_azimuth_deg=180.0,
            sun_elevation_deg=el,
            horizons_daylight=None,
            lat_deg=-85.4,
            lon_deg=31.7,
            terrain_available=True,
            horizon_fn=_horizon_fn,
        )

    def test_above_terrain_horizon_illuminated(self):
        s = self._eval_with_horizon(el=5.0, horizon_at_az=2.0)
        assert s.terrain_clear is True
        assert s.illuminated is True

    def test_below_terrain_horizon_not_illuminated(self):
        s = self._eval_with_horizon(el=1.0, horizon_at_az=5.0)
        assert s.terrain_clear is False
        assert s.illuminated is False

    def test_limb_above_terrain_even_when_centre_below(self):
        # centre at 4.9°, horizon at 5.0° — terrain_clear False, but limb (4.9+0.267 ≈ 5.17°) > 5.0
        s = self._eval_with_horizon(el=4.9, horizon_at_az=5.0)
        assert s.terrain_clear is False
        assert s.illuminated is True  # limb is above


# ---------------------------------------------------------------------------
# summarise_timeline
# ---------------------------------------------------------------------------
class TestSummariseTimeline:
    def _make_state(self, illuminated, el=5.0):
        s = illum.SunIllumination(
            time_utc="2026-Nov-15 02:00",
            sun_azimuth_deg=180.0,
            sun_elevation_deg=el,
            sun_angular_radius_deg=illum.SUN_ANGULAR_RADIUS_DEG,
            geometric_centre_above=True,
            geometric_limb_above=True,
            horizons_daylight=None,
            terrain_horizon_deg=0.0,
            terrain_clear=illuminated,
            illuminated=illuminated,
            incidence_angle_deg=85.0,
        )
        return s

    def test_all_illuminated(self):
        states = [self._make_state(True) for _ in range(10)]
        stats = illum.summarise_timeline(states, interval_h=1.0)
        assert stats.illuminated_fraction == pytest.approx(1.0)
        assert stats.longest_continuous_illumination_h == pytest.approx(10.0)
        assert stats.longest_continuous_darkness_h == pytest.approx(0.0)

    def test_all_dark(self):
        states = [self._make_state(False) for _ in range(10)]
        stats = illum.summarise_timeline(states, interval_h=1.0)
        assert stats.illuminated_fraction == pytest.approx(0.0)
        assert stats.longest_continuous_darkness_h == pytest.approx(10.0)

    def test_half_illuminated(self):
        states = [self._make_state(i % 2 == 0) for i in range(10)]
        stats = illum.summarise_timeline(states, interval_h=1.0)
        assert stats.illuminated_fraction == pytest.approx(0.5)

    def test_no_interval_no_duration_stats(self):
        states = [self._make_state(True) for _ in range(5)]
        stats = illum.summarise_timeline(states, interval_h=None)
        assert stats.longest_continuous_illumination_h is None

    def test_empty_series(self):
        stats = illum.summarise_timeline([], interval_h=1.0)
        assert stats.samples == 0
        assert stats.illuminated_fraction is None
