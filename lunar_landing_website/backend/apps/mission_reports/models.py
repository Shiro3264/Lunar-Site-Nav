"""Mission configuration and analysis report models."""

from __future__ import annotations

from django.db import models


class MissionConfiguration(models.Model):
    """Named parameters for a mission-planning scenario."""

    name = models.CharField(max_length=160)
    description = models.TextField(blank=True, default="")
    default_start_utc = models.CharField(max_length=40, blank=True, default="")
    default_stop_utc = models.CharField(max_length=40, blank=True, default="")
    default_step = models.CharField(max_length=20, default="1 h")
    panel_area_m2 = models.FloatField(default=1.0)
    panel_efficiency = models.FloatField(default=0.28)
    observer_height_m = models.FloatField(default=2.0)
    weights = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class AnalysisReport(models.Model):
    """A saved, auditable mission-intelligence report for a candidate site."""

    title = models.CharField(max_length=240)
    site = models.ForeignKey(
        "landing_sites.LandingSite",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
    )
    site_slug = models.CharField(max_length=80, blank=True, default="")
    latitude = models.FloatField()
    longitude = models.FloatField()
    window_start_utc = models.CharField(max_length=40, blank=True, default="")
    window_stop_utc = models.CharField(max_length=40, blank=True, default="")
    step = models.CharField(max_length=20, blank=True, default="1 h")
    summary = models.TextField(blank=True, default="")
    snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full analysis payload captured when the report was generated.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title
