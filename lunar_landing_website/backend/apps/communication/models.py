"""Earth communication window model."""

from __future__ import annotations

from django.db import models


class CommunicationWindow(models.Model):
    """A persisted direct-to-Earth communication opportunity window.

    Geometry only: existence of a window does not imply a viable radio link.
    """

    created_at = models.DateTimeField(auto_now_add=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    start_utc = models.CharField(max_length=40)
    stop_utc = models.CharField(max_length=40)
    step = models.CharField(max_length=20)
    terrain_source = models.CharField(max_length=80, default="")
    observer_height_m = models.FloatField(default=2.0)
    terrain_access_fraction = models.FloatField(null=True, blank=True)
    max_required_mast_m = models.FloatField(null=True, blank=True)
    confidence = models.CharField(max_length=20, default="low")
    parameters = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CommunicationWindow({self.latitude:.3f},{self.longitude:.3f})"
