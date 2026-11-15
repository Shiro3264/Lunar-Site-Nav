"""Shared request-parameter helpers used across API apps."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Tuple

from rest_framework.exceptions import NotFound


def default_window(hours: int = 24) -> Tuple[str, str]:
    """A sensible default UTC analysis window aligned to the hour."""
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return (
        now.strftime("%Y-%m-%d %H:%M"),
        (now + timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M"),
    )


def resolve_site(data: dict) -> Tuple[float, float, str]:
    """Return (lat, lon, slug) from a ``site_slug`` or explicit coordinates."""
    slug = (data.get("site_slug") or "").strip()
    if slug:
        from apps.landing_sites.models import LandingSite

        site = LandingSite.objects.filter(slug=slug).first()
        if site is None:
            raise NotFound(f"Site '{slug}' not found.")
        return site.latitude, site.longitude, site.slug
    return float(data["latitude"]), float(data["longitude"]), ""
