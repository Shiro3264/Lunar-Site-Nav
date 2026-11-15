"""Serializers for landing sites."""

from __future__ import annotations

from rest_framework import serializers

from scientific_engine import services

from .models import LandingSite


class LandingSiteSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(min_value=-90.0, max_value=90.0)
    terrain = serializers.SerializerMethodField()

    class Meta:
        model = LandingSite
        fields = [
            "id", "slug", "name", "latitude", "longitude", "region",
            "notes", "source", "is_candidate", "terrain",
        ]

    def get_terrain(self, obj: LandingSite):
        if not self.context.get("enrich"):
            return None
        return services.terrain_context(obj.latitude, obj.longitude)
