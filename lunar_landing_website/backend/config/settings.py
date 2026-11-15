"""
LunaNav — Django settings.

Environment driven. See ../../.env.example for all supported variables.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from backend/ (and the repo root, if present).
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --------------------------------------------------------------------------- #
# Core
# --------------------------------------------------------------------------- #
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,testserver")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # local
    "apps.core",
    "apps.landing_sites",
    "apps.ephemeris",
    "apps.lunar_terrain",
    "apps.illumination",
    "apps.solar_energy",
    "apps.communication",
    "apps.suitability",
    "apps.mission_reports",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --------------------------------------------------------------------------- #
# Database — PostgreSQL (preferred) with a documented SQLite fallback so the
# project always runs locally even when PostgreSQL/PostGIS is unavailable.
# --------------------------------------------------------------------------- #
if os.getenv("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB"),
            "USER": os.getenv("POSTGRES_USER", "postgres"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --------------------------------------------------------------------------- #
# i18n / tz — always store UTC
# --------------------------------------------------------------------------- #
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --------------------------------------------------------------------------- #
# DRF
# --------------------------------------------------------------------------- #
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "apps.core.exceptions.lunanav_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("API_THROTTLE_ANON", "240/min"),
        "horizons": os.getenv("API_THROTTLE_HORIZONS", "60/min"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "LunaNav API",
    "DESCRIPTION": (
        "Lunar landing-site navigator & mission intelligence API. "
        "All scientific values are traceable to JPL Horizons and NASA terrain "
        "products, or are explicitly labelled as lower-confidence estimates."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)

# --------------------------------------------------------------------------- #
# Caching (used by the Horizons client + terrain lookups)
# --------------------------------------------------------------------------- #
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "lunanav",
        "TIMEOUT": int(os.getenv("CACHE_TIMEOUT", "3600")),
        "OPTIONS": {"MAX_ENTRIES": 2000},
    }
}

# --------------------------------------------------------------------------- #
# LunaNav scientific integration settings
# --------------------------------------------------------------------------- #
LUNAV = {
    "HORIZONS_API_URL": os.getenv(
        "HORIZONS_API_URL", "https://ssd.jpl.nasa.gov/api/horizons.api"
    ),
    "HORIZONS_TIMEOUT": float(os.getenv("HORIZONS_TIMEOUT", "30")),
    "HORIZONS_MAX_RETRIES": int(os.getenv("HORIZONS_MAX_RETRIES", "3")),
    "HORIZONS_CACHE_TTL": int(os.getenv("HORIZONS_CACHE_TTL", "3600")),
    # Preserve raw Horizons payloads for scientific debugging.
    "HORIZONS_STORE_RAW": env_bool("HORIZONS_STORE_RAW", True),
    # Directory with VA/LOLA DEM GeoTIFF tiles (optional).
    "LOLA_DEM_DIR": os.getenv("LOLA_DEM_DIR", str(BASE_DIR / "scientific_data" / "lola")),
    # Directory with NAIF SPICE kernels (optional).
    "SPICE_KERNEL_DIR": os.getenv(
        "SPICE_KERNEL_DIR", str(BASE_DIR / "scientific_data" / "spice")
    ),
    "MAX_TIMELINE_STEPS": int(os.getenv("MAX_TIMELINE_STEPS", "720")),
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
    },
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
    "loggers": {
        "lunanav": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
