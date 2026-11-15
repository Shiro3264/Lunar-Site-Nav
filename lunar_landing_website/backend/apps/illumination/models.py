"""Illumination analysis model."""

from __future__ import annotations

from django.db import models


class IlluminationAnalysis(models.Model):
    """A persisted illumination analysis for a site and window."""

    created_at = models.DateTimeField(auto_now_add=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    start_utc = models.CharField(max_length=40)
    stop_utc = models.CharField(max_length=40)
    step = models.CharField(max_length=20)
    reference_frame = models.CharField(max_length=60, default="MEAN_ME")
    terrain_source = models.CharField(max_length=80, default="")
    illuminated_fraction = models.FloatField(null=True, blank=True)
    longest_darkness_h = models.FloatField(null=True, blank=True)
    confidence = models.CharField(max_length=20, default="low")
    parameters = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"IlluminationAnalysis({self.latitude:.3f},{self.longitude:.3f})"
