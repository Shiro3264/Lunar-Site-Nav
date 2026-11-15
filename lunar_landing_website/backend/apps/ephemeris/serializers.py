"""Ephemeris request validation serializers."""

from __future__ import annotations

from rest_framework import serializers


class SolarPanelSerializer(serializers.Serializer):
    area_m2 = serializers.FloatField(min_value=0.01, max_value=1000.0, default=1.0)
    efficiency = serializers.FloatField(min_value=0.01, max_value=1.0, default=0.28)
    tilt_from_horizontal_deg = serializers.FloatField(min_value=0.0, max_value=180.0, default=90.0)
    azimuth_deg = serializers.FloatField(min_value=0.0, max_value=360.0, default=0.0)
    system_derate = serializers.FloatField(min_value=0.01, max_value=1.0, default=0.85)


class AnalyzeRequestSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90.0, max_value=90.0, required=False)
    longitude = serializers.FloatField(required=False)
    altitude_km = serializers.FloatField(min_value=-20.0, max_value=20.0, default=0.0)
    site_slug = serializers.CharField(required=False, allow_blank=True)
    start = serializers.CharField(required=False)
    stop = serializers.CharField(required=False)
    step = serializers.CharField(required=False, default="1 h")
    allow_synthetic = serializers.BooleanField(required=False, default=True)
    observer_height_m = serializers.FloatField(min_value=0.0, max_value=100.0, default=2.0)
    panel = SolarPanelSerializer(required=False)
    persist = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not attrs.get("site_slug") and (attrs.get("latitude") is None or attrs.get("longitude") is None):
            raise serializers.ValidationError(
                "Provide either 'site_slug' or both 'latitude' and 'longitude'."
            )
        if not attrs.get("start") or not attrs.get("stop"):
            from datetime import datetime, timedelta, timezone

            now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
            attrs.setdefault("start", now.strftime("%Y-%m-%d %H:%M"))
            attrs.setdefault("stop", (now + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M"))
        return attrs
