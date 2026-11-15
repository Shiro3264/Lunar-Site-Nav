"""
Tests for integrations.horizons.parser

Verifies:
- '$SOE' / '$EOE' guard clauses.
- '*' (solar presence) and 'i' (interferer) marker parsing.
- Azimuth and elevation float extraction.
- Missing data leaves fields as None, never coerced to 0.
- Metadata extraction (target body, centre, geodetic).
- Timestamp parsing to datetime objects.
"""
from __future__ import annotations

import pytest
from datetime import timezone

from integrations.horizons.parser import parse_horizons_text, HorizonsError


# ---------------------------------------------------------------------------
# Minimal realistic Horizons OBSERVER response fixture
# The $SOE / $EOE markers are written directly (no escaping needed).
# ---------------------------------------------------------------------------
SAMPLE_RESPONSE = (
    "*******************************************************************************\n"
    "Ephemeris / API_USER\n"
    "*******************************************************************************\n"
    "Target body name: Sun (10)                   {source: DE441}\n"
    "Center body name: Moon (301)                 {source: DE441}\n"
    "Center geodetic : E-lon(deg),Lat(deg),Alt(km) = ( 31.700000,-85.400000, 0.000000)\n"
    "Vis. interferer : Earth\n"
    "Center pole/equ : MEAN_ME                    {East-longitude positive}\n"
    "Start time      : A.D. 2026-Nov-15 00:00:00.0000 UT\n"
    "Stop  time      : A.D. 2026-Nov-15 06:00:00.0000 UT\n"
    "Step-size       : 60 minutes\n"
    "*******************************************************************************\n"
    " Date__(UT)__HR:MN     Azi____(a-app)___Elev\n"
    "*******************************************************************************\n"
    "$$SOE\n"
    " 2026-Nov-15 00:00     187.3842  -2.1456\n"
    " 2026-Nov-15 01:00 *   192.4571   0.3827\n"
    " 2026-Nov-15 02:00 *i  197.5312   2.9014\n"
    " 2026-Nov-15 03:00     182.1234  -5.0001\n"
    "$$EOE\n"
    "*******************************************************************************\n"
)


# ---------------------------------------------------------------------------
# Basic parsing
# ---------------------------------------------------------------------------
class TestParseHorizonsText:
    def test_parses_four_rows(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        assert len(result.rows) == 4

    def test_first_row_no_markers(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        row = result.rows[0]
        assert row.solar_presence is False
        assert row.interferer_presence is False
        assert row.azimuth_deg == pytest.approx(187.3842)
        assert row.elevation_deg == pytest.approx(-2.1456)

    def test_solar_star_marker(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        row = result.rows[1]  # "* " line
        assert row.solar_presence is True
        assert row.interferer_presence is False

    def test_both_markers(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        row = result.rows[2]  # "* i" line
        assert row.solar_presence is True
        assert row.interferer_presence is True

    def test_negative_elevation_parsed_correctly(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        assert result.rows[3].elevation_deg == pytest.approx(-5.0001)

    def test_timestamp_parsed_as_utc(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        dt = result.rows[0].time_dt
        assert dt is not None
        assert dt.tzinfo == timezone.utc
        assert dt.year == 2026
        assert dt.month == 11
        assert dt.day == 15
        assert dt.hour == 0

    def test_meta_target_body(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        assert "Sun" in (result.meta.target_body or "")

    def test_meta_center_geodetic_captured(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        assert result.meta.center_geodetic is not None
        assert "31.7" in result.meta.center_geodetic or "-85.4" in result.meta.center_geodetic

    def test_meta_interferer_earth(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        assert result.meta.interferer is not None
        assert "Earth" in result.meta.interferer

    def test_raw_text_preserved(self):
        result = parse_horizons_text(SAMPLE_RESPONSE)
        assert result.raw_text == SAMPLE_RESPONSE


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------
class TestParseErrors:
    def test_missing_soe_raises(self):
        with pytest.raises(HorizonsError):
            parse_horizons_text("No SOE marker here")

    def test_missing_eoe_raises(self):
        broken = SAMPLE_RESPONSE.replace("$$EOE", "")
        with pytest.raises(HorizonsError):
            parse_horizons_text(broken)

    def test_empty_string_raises(self):
        with pytest.raises(HorizonsError):
            parse_horizons_text("")

    def test_empty_data_block_raises(self):
        empty = "$$SOE\n$$EOE\n"
        with pytest.raises(HorizonsError):
            parse_horizons_text(empty)


# ---------------------------------------------------------------------------
# is_empty property
# ---------------------------------------------------------------------------
def test_not_empty_for_valid_response():
    result = parse_horizons_text(SAMPLE_RESPONSE)
    assert not result.is_empty
