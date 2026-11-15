"""Earth-communication geometry and optional link-budget API."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.params import resolve_site
from apps.ephemeris.serializers import AnalyzeRequestSerializer
from scientific_engine import communication as comm_mod
from scientific_engine import services


class CommunicationAnalysisView(APIView):
    throttle_scope = "horizons"

    @extend_schema(
        summary="Earth communication geometry timeline",
        description=(
            "Terrain-aware Earth line-of-sight over time, with the mast height "
            "required to clear the controlling obstruction, plus light-time."
        ),
        request=AnalyzeRequestSerializer,
        responses={200: dict},
        tags=["communication"],
    )
    def post(self, request):
        ser = AnalyzeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        lat, lon, slug = resolve_site(data)

        terrain_ctx = services.terrain_context(lat, lon, allow_synthetic=data["allow_synthetic"])
        start = services.normalise_time(data["start"])
        stop = services.normalise_time(data["stop"])
        combined, _meta, _raw = services.fetch_sun_earth(
            lat_deg=lat, lon_deg=lon, alt_km=data["altitude_km"],
            start_utc=start, stop_utc=stop, step=data["step"],
        )

        series = []
        states = []
        for entry in combined:
            earth = entry.get("earth") or {}
            state = comm_mod.evaluate_earth_link(
                time_utc=entry["time"],
                earth_azimuth_deg=earth.get("azimuth_deg"),
                earth_elevation_deg=earth.get("elevation_deg"),
                lat_deg=lat, lon_deg=lon,
                terrain_available=terrain_ctx["available"],
                observer_height_m=data["observer_height_m"],
                allow_synthetic=data["allow_synthetic"],
            )
            states.append(state)
            series.append({**state.as_dict(), "earth_direction_scene": earth.get("direction_scene")})

        summary = comm_mod.summarise_access(states, interval_h=services.step_to_hours(data["step"]))
        return Response(
            {
                "site": {"latitude_deg": lat, "longitude_deg": lon, "slug": slug},
                "terrain": terrain_ctx,
                "window": {"start_utc": start, "stop_utc": stop, "step": data["step"], "samples": len(series)},
                "series": series,
                "summary": summary,
                "disclaimer": (
                    "Geometry only unless full link parameters are supplied. This is not a "
                    "guarantee of communication success."
                ),
            }
        )


class LinkBudgetSerializer(serializers.Serializer):
    eirp_dbw = serializers.FloatField(help_text="Equivalent isotropic radiated power (dBW).")
    rx_antenna_gain_dbi = serializers.FloatField()
    frequency_mhz = serializers.FloatField(min_value=1.0)
    distance_km = serializers.FloatField(min_value=1.0)
    receiver_sensitivity_dbw = serializers.FloatField()


class LinkBudgetView(APIView):
    @extend_schema(
        summary="Free-space link margin (needs full parameters)",
        description=(
            "Standard FSPL-based link margin. Estimate only: pointing, polarisation "
            "and implementation losses must be supplied by the caller."
        ),
        request=LinkBudgetSerializer,
        responses={200: dict},
        tags=["communication"],
    )
    def post(self, request):
        ser = LinkBudgetSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        margin = comm_mod.link_margin_db(
            eirp_dbw=d["eirp_dbw"],
            rx_antenna_gain_dbi=d["rx_antenna_gain_dbi"],
            frequency_mhz=d["frequency_mhz"],
            distance_km=d["distance_km"],
            receiver_sensitivity_dbw=d["receiver_sensitivity_dbw"],
        )
        return Response({**margin, "disclaimer": "Estimate only; not a validated link design."})
