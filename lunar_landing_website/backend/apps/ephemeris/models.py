"""Persisted record of an ephemeris analysis run (provenance + summary)."""

from __future__ import annotations

from django.db import models


class AnalysisRun(models.Model):
    """An auditable record of one scientific analysis request."""

    created_at = models.DateTimeField(auto_now_add=True)
    site_slug = models.CharField(max_length=80, blank=True, default="")
    latitude = models.FloatField()
    longitude = models.FloatField()
    altitude_km = models.FloatField(default=0.0)
    start_utc = models.CharField(max_length=40)
    stop_utc = models.CharField(max_length=40)
    step = models.CharField(max_length=20)
    status = models.CharField(max_length=16, default="ok")
    summary = models.JSONField(default=dict, blank=True)
    provenance = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AnalysisRun({self.site_slug or 'adhoc'} @ {self.start_utc})"


class ObserverConfiguration(models.Model):
    """A reusable observer/lander configuration used for analyses."""

    name = models.CharField(max_length=160)
    latitude = models.FloatField()
    longitude = models.FloatField()
    altitude_km = models.FloatField(default=0.0)
    observer_height_m = models.FloatField(default=2.0)
    reference_frame = models.CharField(max_length=60, default="MEAN_ME")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class EphemerisRecord(models.Model):
    """A raw/cached JPL Horizons ephemeris payload with full provenance."""

    created_at = models.DateTimeField(auto_now_add=True)
    target = models.CharField(max_length=40, help_text="Horizons COMMAND, e.g. 10 (Sun) or 399 (Earth).")
    center = models.CharField(max_length=40, default="coord@301")
    site_latitude = models.FloatField()
    site_longitude = models.FloatField()
    site_altitude_km = models.FloatField(default=0.0)
    start_utc = models.CharField(max_length=40)
    stop_utc = models.CharField(max_length=40)
    step = models.CharField(max_length=20)
    quantities = models.CharField(max_length=20, default="4")
    time_type = models.CharField(max_length=8, default="UT")
    reference_frame = models.CharField(max_length=60, default="MEAN_ME")
    dataset_version = models.CharField(max_length=60, blank=True, default="")
    raw_text = models.TextField(blank=True, default="")
    request_params = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["target", "start_utc"])]

    def __str__(self) -> str:
        return f"EphemerisRecord({self.target} @ {self.start_utc})"
