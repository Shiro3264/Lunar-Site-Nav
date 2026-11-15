"""Terrain dataset & analysis models."""

from __future__ import annotations

from django.db import models


class LunarTerrainDataset(models.Model):
    """A registered lunar terrain product (e.g. a LOLA DEM tile or global model)."""

    name = models.CharField(max_length=200)
    product = models.CharField(max_length=200, default="NASA LRO LOLA DEM")
    source_url = models.CharField(max_length=400, blank=True, default="")
    file_path = models.CharField(max_length=400, blank=True, default="")
    resolution_m = models.FloatField(null=True, blank=True)
    datum_radius_m = models.FloatField(default=1_737_400.0)
    reference_frame = models.CharField(max_length=60, default="MEAN_ME")
    projection = models.CharField(max_length=120, blank=True, default="")
    dataset_version = models.CharField(max_length=80, blank=True, default="")
    uncertainty_m = models.FloatField(null=True, blank=True)
    coverage = models.JSONField(default=dict, blank=True)
    is_measured = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class TerrainAnalysis(models.Model):
    """A persisted terrain analysis result for a coordinate."""

    created_at = models.DateTimeField(auto_now_add=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    dataset = models.ForeignKey(
        LunarTerrainDataset, null=True, blank=True, on_delete=models.SET_NULL
    )
    elevation_m = models.FloatField(null=True, blank=True)
    slope_deg = models.FloatField(null=True, blank=True)
    aspect_deg = models.FloatField(null=True, blank=True)
    roughness_rms_m = models.FloatField(null=True, blank=True)
    local_relief_m = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=80, default="")
    confidence = models.CharField(max_length=20, default="low")
    parameters = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["latitude", "longitude"])]

    def __str__(self) -> str:
        return f"TerrainAnalysis({self.latitude:.3f},{self.longitude:.3f})"
