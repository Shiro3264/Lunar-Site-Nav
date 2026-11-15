"""
Django REST Framework API tests for the landing-sites endpoints.

Uses pytest-django with an in-memory SQLite database.
All Horizons network calls are mocked so the test suite runs offline.
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import patch, MagicMock

from django.test import TestCase
from rest_framework.test import APIClient

from apps.landing_sites.models import LandingSite
from scientific_engine.constants import CANDIDATE_SITES


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture(autouse=True)
def seed_sites(db):
    """Populate the four candidate sites before each test."""
    for spec in CANDIDATE_SITES:
        LandingSite.objects.get_or_create(
            slug=spec["slug"],
            defaults={
                "name": spec["name"],
                "latitude": spec["latitude"],
                "longitude": spec["longitude"],
                "region": spec.get("region", ""),
                "source": "test",
                "is_candidate": True,
            },
        )


# ---------------------------------------------------------------------------
# GET /api/sites/
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_list_sites_returns_four_candidates(client):
    resp = client.get("/api/sites/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 4


@pytest.mark.django_db
def test_list_sites_contains_mons_mouton(client):
    resp = client.get("/api/sites/")
    slugs = [s["slug"] for s in resp.json()["results"]]
    assert "mons-mouton" in slugs


@pytest.mark.django_db
def test_list_sites_no_enrich_no_terrain(client):
    resp = client.get("/api/sites/")
    for site in resp.json()["results"]:
        assert site["terrain"] is None


# ---------------------------------------------------------------------------
# GET /api/sites/{slug}/
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_retrieve_mons_mouton(client):
    resp = client.get("/api/sites/mons-mouton/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "mons-mouton"
    assert data["latitude"] == pytest.approx(-85.4)
    assert data["longitude"] == pytest.approx(31.7)


@pytest.mark.django_db
def test_retrieve_malapert(client):
    resp = client.get("/api/sites/malapert-massif/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["latitude"] == pytest.approx(-86.0)
    assert abs(data["longitude"] - (-0.2)) < 0.001


@pytest.mark.django_db
def test_retrieve_nonexistent_returns_404(client):
    resp = client.get("/api/sites/nonexistent-slug/")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/sites/  (create custom site)
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_create_custom_site(client):
    payload = {
        "slug": "test-custom-site",
        "name": "Test Custom Site",
        "latitude": -80.0,
        "longitude": 45.0,
        "region": "Test region",
        "source": "user",
        "is_candidate": False,
    }
    resp = client.post("/api/sites/", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == "test-custom-site"
    assert data["latitude"] == -80.0


@pytest.mark.django_db
def test_create_site_invalid_latitude(client):
    payload = {
        "slug": "bad-lat",
        "name": "Bad Latitude",
        "latitude": -95.0,  # out of range
        "longitude": 0.0,
    }
    resp = client.post("/api/sites/", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/coordinates/validate/
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_validate_coordinate_accepted(client):
    payload = {"latitude": -85.4, "longitude": 31.7, "enrich_terrain": False}
    resp = client.post(
        "/api/coordinates/validate/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["normalised"]["latitude_deg"] == pytest.approx(-85.4)
    assert data["normalised"]["east_positive_longitude"] is True


@pytest.mark.django_db
def test_validate_coordinate_longitude_wrapped(client):
    payload = {"latitude": 0.0, "longitude": 190.0, "enrich_terrain": False}
    resp = client.post(
        "/api/coordinates/validate/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["normalised"]["longitude_deg"] == pytest.approx(-170.0)


@pytest.mark.django_db
def test_validate_coordinate_bad_latitude(client):
    payload = {"latitude": 95.0, "longitude": 0.0, "enrich_terrain": False}
    resp = client.post(
        "/api/coordinates/validate/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/health/
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_health_returns_ok(client):
    resp = client.get("/api/health/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "database" in data
    assert "integrations" in data


# ---------------------------------------------------------------------------
# GET /api/meta/
# ---------------------------------------------------------------------------
@pytest.mark.django_db
def test_meta_contains_candidate_sites(client):
    resp = client.get("/api/meta/")
    assert resp.status_code == 200
    data = resp.json()
    slugs = [s["slug"] for s in data["candidate_sites"]]
    assert "mons-mouton" in slugs
    assert "malapert-massif" in slugs
    assert "nobile-rim-1" in slugs
    assert "haworth" in slugs


@pytest.mark.django_db
def test_meta_longitude_convention_east_positive(client):
    resp = client.get("/api/meta/")
    frames = resp.json()["frames"]
    assert "East" in frames["longitude_convention"] or "east" in frames["longitude_convention"].lower()
