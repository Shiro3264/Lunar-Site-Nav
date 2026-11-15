"""Landing-site model.

Coordinates are stored as portable float degrees (selenographic, East-positive)
so the project runs on PostgreSQL **and** on the SQLite fallback without a
PostGIS dependency.  PostGIS/GeoDjango can be layered on later for spatial
indexing; the scientific computations themselves use ``scientific_engine`` and do
not require a spatial database.
"""

from __future__ import annotations

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class LandingSite(models.Model):
    """A candidate or user-defined lunar landing site."""

    slug = models.SlugField(unique=True, max_length=80)
    name = models.CharField(max_length=180)
    latitude = models.FloatField(
        validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)],
        help_text="Selenographic latitude in degrees (South negative).",
    )
    longitude = models.FloatField(
        help_text="Selenographic East-positive longitude in degrees.",
    )
    region = models.CharField(max_length=240, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    source = models.CharField(
        max_length=180,
        blank=True,
        default="Initial candidate coordinate input",
        help_text="Provenance of the coordinate; never implied to be a surveyed site.",
    )
    is_candidate = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["latitude", "longitude"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.latitude:.3f}, {self.longitude:.3f})"

    @property
    def lat_lon(self) -> tuple[float, float]:
        return (self.latitude, self.longitude)


class CustomCoordinates(models.Model):
    """A user-supplied candidate coordinate (not necessarily a named site)."""

    label = models.CharField(max_length=160, blank=True, default="")
    latitude = models.FloatField(validators=[MinValueValidator(-90.0), MaxValueValidator(90.0)])
    longitude = models.FloatField(help_text="East-positive longitude in degrees.")
    altitude_km = models.FloatField(default=0.0)
    reference_frame = models.CharField(max_length=60, default="MEAN_ME")
    source = models.CharField(max_length=120, default="user")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Custom coordinates"

    def __str__(self) -> str:
        return f"{self.label or 'coord'} ({self.latitude:.3f}, {self.longitude:.3f})"

