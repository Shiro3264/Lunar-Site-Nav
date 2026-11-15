"""Solar energy estimate model."""

from __future__ import annotations

from django.db import models


class SolarEnergyEstimate(models.Model):
    """A persisted solar-energy estimate (an estimate, never a flight budget)."""

    created_at = models.DateTimeField(auto_now_add=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    start_utc = models.CharField(max_length=40)
    stop_utc = models.CharField(max_length=40)
    step = models.CharField(max_length=20)
    panel_area_m2 = models.FloatField()
    panel_efficiency = models.FloatField()
    panel_tilt_deg = models.FloatField()
    panel_azimuth_deg = models.FloatField()
    system_derate = models.FloatField()
    peak_power_w = models.FloatField(null=True, blank=True)
    energy_wh = models.FloatField(null=True, blank=True)
    equivalent_sun_hours = models.FloatField(null=True, blank=True)
    uncertainty_note = models.CharField(max_length=300, blank=True, default="")
    parameters = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"SolarEnergyEstimate({self.latitude:.3f},{self.longitude:.3f})"
