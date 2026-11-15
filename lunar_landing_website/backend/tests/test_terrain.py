"""
Tests for scientific_engine.terrain

Covers:
- synthetic_elevation_m is deterministic and finite.
- get_elevation falls back gracefully when LOLA is unavailable.
- slope_aspect returns expected structure and plausible values.
- roughness and relief return non-negative floats.
- terrain_mesh returns a correctly-shaped height grid.
- horizon_profile returns one entry per azimuth with valid angles.
- ray_clear distinguishes blocked vs. clear rays.
- offset_coordinate is consistent with great-circle geometry.
"""
from __future__ import annotations

import math
import pytest

from scientific_engine import terrain as t


# ---------------------------------------------------------------------------
# synthetic_elevation_m
# ---------------------------------------------------------------------------
class TestSyntheticElevation:
    def test_deterministic(self):
        a = t.synthetic_elevation_m(-85.4, 31.7)
        b = t.synthetic_elevation_m(-85.4, 31.7)
        assert a == b

    def test_finite(self):
        for lat, lon in [(-85.4, 31.7), (-86.0, -0.2), (0.0, 0.0), (90.0, 0.0)]:
            assert math.isfinite(t.synthetic_elevation_m(lat, lon))

    def test_reasonable_range(self):
        # Synthetic terrain should be within ±5 km of datum.
        for lat in range(-85, -75):
            for lon in range(-30, 30, 5):
                h = t.synthetic_elevation_m(float(lat), float(lon))
                assert -5000 < h < 5000, f"Extreme synthetic elevation at ({lat},{lon}): {h}"


# ---------------------------------------------------------------------------
# get_elevation (no DEM available in CI)
# ---------------------------------------------------------------------------
class TestGetElevation:
    def test_fallback_to_synthetic(self):
        s = t.get_elevation(-85.4, 31.7, allow_synthetic=True)
        assert s.elevation_m is not None
        assert math.isfinite(s.elevation_m)
        # Without a real DEM the source should not claim 'LOLA'.
        assert "LOLA" not in s.source or s.available

    def test_no_synthetic_gives_datum_or_measured(self):
        """With allow_synthetic=False the result is either measured (LOLA tile present)
        or the spherical datum (elevation=0.0, available=False).
        It must never be a synthetic procedural value."""
        s = t.get_elevation(-85.4, 31.7, allow_synthetic=False)
        # If a real LOLA tile covers this point it returns measured data.
        # If not, it falls back to the spherical datum (0.0).
        assert s.source != "synthetic_illustrative", (
            "allow_synthetic=False must never return synthetic_illustrative data"
        )
        if not s.available:
            assert s.elevation_m == 0.0
            assert s.confidence == "low"

    def test_confidence_low_without_dem(self):
        s = t.get_elevation(-85.4, 31.7, allow_synthetic=True)
        if not s.available:
            assert s.confidence == "low"


# ---------------------------------------------------------------------------
# slope_aspect
# ---------------------------------------------------------------------------
class TestSlopeAspect:
    def test_returns_expected_keys(self):
        result = t.slope_aspect(-85.4, 31.7)
        for key in ("slope_deg", "aspect_deg", "elevation_m", "gradient_east", "gradient_north"):
            assert key in result

    def test_slope_non_negative(self):
        result = t.slope_aspect(-85.4, 31.7)
        assert result["slope_deg"] >= 0.0

    def test_slope_finite(self):
        result = t.slope_aspect(-85.4, 31.7)
        assert math.isfinite(result["slope_deg"])
        assert math.isfinite(result["aspect_deg"])

    def test_aspect_in_range(self):
        result = t.slope_aspect(-85.4, 31.7)
        assert 0.0 <= result["aspect_deg"] < 360.0


# ---------------------------------------------------------------------------
# roughness_index_m / local_relief_m
# ---------------------------------------------------------------------------
def test_roughness_non_negative():
    r = t.roughness_index_m(-85.4, 31.7)
    assert r >= 0.0


def test_local_relief_non_negative():
    r = t.local_relief_m(-85.4, 31.7)
    assert r >= 0.0


# ---------------------------------------------------------------------------
# terrain_mesh
# ---------------------------------------------------------------------------
class TestTerrainMesh:
    def test_grid_shape(self):
        grid = 24
        result = t.terrain_mesh(-85.4, 31.7, size_km=4.0, grid=grid)
        heights = result["heights_m"]
        assert len(heights) == grid
        assert all(len(row) == grid for row in heights)

    def test_min_max_consistent(self):
        result = t.terrain_mesh(-85.4, 31.7)
        all_vals = [v for row in result["heights_m"] for v in row]
        assert result["min_m"] == pytest.approx(min(all_vals), abs=0.1)
        assert result["max_m"] == pytest.approx(max(all_vals), abs=0.1)

    def test_has_provenance_fields(self):
        result = t.terrain_mesh(-85.4, 31.7)
        for key in ("source", "confidence", "available"):
            assert key in result


# ---------------------------------------------------------------------------
# horizon_profile
# ---------------------------------------------------------------------------
class TestHorizonProfile:
    def test_returns_one_entry_per_azimuth(self):
        azimuths = [0.0, 90.0, 180.0, 270.0]
        profile = t.horizon_profile(-85.4, 31.7, azimuths_deg=azimuths)
        assert len(profile) == len(azimuths)

    def test_azimuth_values_match(self):
        azimuths = [0.0, 45.0, 90.0]
        profile = t.horizon_profile(-85.4, 31.7, azimuths_deg=azimuths)
        for entry, az in zip(profile, azimuths):
            assert entry["azimuth_deg"] == az

    def test_horizon_angles_finite(self):
        azimuths = [float(a) for a in range(0, 360, 30)]
        profile = t.horizon_profile(-85.4, 31.7, azimuths_deg=azimuths)
        for entry in profile:
            assert math.isfinite(entry["horizon_elevation_deg"])

    def test_geometric_horizon_is_zero_on_flat_datum(self):
        """With allow_synthetic=False the terrain is flat, so horizon = 0."""
        profile = t.horizon_profile(
            0.0, 0.0,
            azimuths_deg=[0.0, 90.0, 180.0, 270.0],
            allow_synthetic=False,
        )
        for entry in profile:
            assert entry["horizon_elevation_deg"] == pytest.approx(0.0, abs=0.001)


# ---------------------------------------------------------------------------
# ray_clear
# ---------------------------------------------------------------------------
class TestRayClear:
    def test_high_elevation_clear(self):
        result = t.ray_clear(-85.4, 31.7, 0.0, 45.0, allow_synthetic=False)
        assert result["clear"] is True

    def test_negative_elevation_blocked(self):
        result = t.ray_clear(-85.4, 31.7, 0.0, -10.0, allow_synthetic=False)
        assert result["clear"] is False

    def test_has_margin_field(self):
        result = t.ray_clear(-85.4, 31.7, 90.0, 5.0, allow_synthetic=False)
        assert "margin_deg" in result
        assert math.isfinite(result["margin_deg"])


# ---------------------------------------------------------------------------
# offset_coordinate
# ---------------------------------------------------------------------------
class TestOffsetCoordinate:
    def test_zero_offset_returns_same_point(self):
        lat, lon = t.offset_coordinate(-85.4, 31.7, 0.0, 0.0)
        assert lat == pytest.approx(-85.4)
        assert lon == pytest.approx(31.7)

    def test_north_offset_increases_latitude(self):
        lat, _ = t.offset_coordinate(-85.4, 31.7, 0.0, 1.0)
        assert lat > -85.4

    def test_east_offset_increases_longitude(self):
        _, lon = t.offset_coordinate(-85.4, 31.7, 1.0, 0.0)
        assert lon > 31.7
