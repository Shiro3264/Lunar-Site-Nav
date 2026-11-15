"""Mission report serializers."""

from __future__ import annotations

from rest_framework import serializers

from .models import AnalysisReport, MissionConfiguration


class AnalysisReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisReport
        fields = [
            "id", "title", "site", "site_slug", "latitude", "longitude",
            "window_start_utc", "window_stop_utc", "step", "summary", "snapshot",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MissionConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MissionConfiguration
        fields = "__all__"


class GenerateReportSerializer(serializers.Serializer):
    """Generate a report snapshot from a live analysis."""

    title = serializers.CharField(max_length=240)
    site_slug = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField(required=False, min_value=-90.0, max_value=90.0)
    longitude = serializers.FloatField(required=False)
    start = serializers.CharField(required=False)
    stop = serializers.CharField(required=False)
    step = serializers.CharField(required=False, default="1 h")
    summary = serializers.CharField(required=False, allow_blank=True, default="")
