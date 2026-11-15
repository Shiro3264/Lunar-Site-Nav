"""Mission report API: CRUD plus live snapshot generation."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.params import resolve_site
from scientific_engine import services

from .models import AnalysisReport, MissionConfiguration
from .serializers import (
    AnalysisReportSerializer,
    GenerateReportSerializer,
    MissionConfigurationSerializer,
)


class AnalysisReportViewSet(viewsets.ModelViewSet):
    queryset = AnalysisReport.objects.all()
    serializer_class = AnalysisReportSerializer


class MissionConfigurationViewSet(viewsets.ModelViewSet):
    queryset = MissionConfiguration.objects.all()
    serializer_class = MissionConfigurationSerializer


class GenerateReportView(APIView):
    throttle_scope = "horizons"

    @extend_schema(
        summary="Generate and persist an analysis report from a live analysis",
        request=GenerateReportSerializer,
        responses={201: AnalysisReportSerializer},
        tags=["reports"],
    )
    def post(self, request):
        ser = GenerateReportSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        lat, lon, slug = resolve_site(
            {
                "site_slug": data.get("site_slug"),
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
            }
        )
        result = services.analyse_site(
            lat_deg=lat, lon_deg=lon,
            start=data.get("start") or "2026-11-15 00:00",
            stop=data.get("stop") or "2026-11-16 00:00",
            step=data.get("step", "1 h"),
        )

        report = AnalysisReport.objects.create(
            title=data["title"],
            site_slug=slug,
            latitude=lat,
            longitude=lon,
            window_start_utc=result["window"]["start_utc"],
            window_stop_utc=result["window"]["stop_utc"],
            step=data.get("step", "1 h"),
            summary=data.get("summary", ""),
            snapshot={
                "terrain": result["terrain"],
                "illumination_summary": result["illumination_summary"],
                "solar_summary": result["solar_summary"],
                "communication_summary": result["communication_summary"],
                "suitability": result["suitability"],
                "provenance": result["provenance"],
            },
        )
        return Response(AnalysisReportSerializer(report).data, status=201)
