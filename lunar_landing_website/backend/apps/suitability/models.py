"""Suitability assessment model."""

from __future__ import annotations

from django.db import models


class SuitabilityAssessment(models.Model):
    """A persisted, explainable suitability assessment.

    The composite score is a relative multi-criteria index, **not** a
    landing-success probability.
    """

    created_at = models.DateTimeField(auto_now_add=True)
    site = models.ForeignKey(
        "landing_sites.LandingSite", null=True, blank=True, on_delete=models.SET_NULL
    )
    site_slug = models.CharField(max_length=80, blank=True, default="")
    latitude = models.FloatField()
    longitude = models.FloatField()
    start_utc = models.CharField(max_length=40, blank=True, default="")
    stop_utc = models.CharField(max_length=40, blank=True, default="")
    step = models.CharField(max_length=20, blank=True, default="1 h")
    composite_score = models.FloatField(null=True, blank=True)
    grade = models.CharField(max_length=24, default="insufficient_data")
    weights = models.JSONField(default=dict, blank=True)
    sub_scores = models.JSONField(default=list, blank=True)
    missing_inputs = models.JSONField(default=list, blank=True)
    disclaimer = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"SuitabilityAssessment({self.site_slug or 'adhoc'}={self.composite_score})"
