"""
Pytest / pytest-django configuration for the LunaNav backend.

All tests use an isolated SQLite database (created fresh for the session)
and a mocked Horizons client so no live network calls are made during the
test suite.
"""
from __future__ import annotations

import pytest


# --------------------------------------------------------------------------- #
# Django settings
# --------------------------------------------------------------------------- #
def pytest_configure(config):
    import django
    from django.conf import settings

    if not settings.configured:
        settings.configure(
            SECRET_KEY="test-secret-key",
            DEBUG=True,
            DATABASES={
                "default": {
                    "ENGINE": "django.db.backends.sqlite3",
                    "NAME": ":memory:",
                }
            },
            INSTALLED_APPS=[
                "django.contrib.contenttypes",
                "django.contrib.auth",
                "rest_framework",
                "corsheaders",
                "django_filters",
                "drf_spectacular",
                "apps.core",
                "apps.landing_sites",
                "apps.ephemeris",
                "apps.lunar_terrain",
                "apps.illumination",
                "apps.solar_energy",
                "apps.communication",
                "apps.suitability",
                "apps.mission_reports",
            ],
            MIDDLEWARE=[
                "corsheaders.middleware.CorsMiddleware",
                "django.middleware.common.CommonMiddleware",
            ],
            ROOT_URLCONF="config.urls",
            TEMPLATES=[
                {
                    "BACKEND": "django.template.backends.django.DjangoTemplates",
                    "DIRS": [],
                    "APP_DIRS": True,
                    "OPTIONS": {
                        "context_processors": [
                            "django.template.context_processors.request",
                        ],
                    },
                }
            ],
            REST_FRAMEWORK={
                "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
                "DEFAULT_FILTER_BACKENDS": [
                    "django_filters.rest_framework.DjangoFilterBackend"
                ],
                "EXCEPTION_HANDLER": "apps.core.exceptions.lunanav_exception_handler",
            },
            SPECTACULAR_SETTINGS={
                "TITLE": "LunaNav API (test)",
                "VERSION": "1.0.0",
            },
            CACHES={
                "default": {
                    "BACKEND": "django.core.cache.backends.dummy.DummyCache",
                }
            },
            CORS_ALLOWED_ORIGINS=["http://localhost:5173"],
            CSRF_TRUSTED_ORIGINS=["http://localhost:5173"],
            DEFAULT_AUTO_FIELD="django.db.models.BigAutoField",
            TIME_ZONE="UTC",
            USE_TZ=True,
            LUNAV={
                "HORIZONS_API_URL": "https://ssd.jpl.nasa.gov/api/horizons.api",
                "HORIZONS_TIMEOUT": 30,
                "HORIZONS_MAX_RETRIES": 1,
                "HORIZONS_CACHE_TTL": 0,
                "HORIZONS_STORE_RAW": False,
                "LOLA_DEM_DIR": "",
                "SPICE_KERNEL_DIR": "",
                "MAX_TIMELINE_STEPS": 720,
            },
        )
        django.setup()
