"""Illumination API: terrain-aware sunlight timeline and statistics."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.params import resolve_site
from apps.ephemeris.serializers import AnalyzeRequestSerializer
from scientific_engine import illumination as illum_mod
from scientific_engine import services


class IlluminationTimelineView(APIView):
    throttle_scope = "horizons"

    @extend_schema(
        summary="Terrain-aware illumination timeline",
        description=(
            "Returns, for each step, the Sun direction plus the four distinct "
            "visibility notions (geometric centre/limb, Horizons daylight marker, "
            "terrain-clear) and the resulting illumination flag."
        ),
        request=AnalyzeRequestSerializer,
        responses={200: dict},
        tags=["illumination"],
    )
    def post(self, request):
        ser = AnalyzeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        lat, lon, slug = resolve_site(data)

        terrain_ctx = services.terrain_context(lat, lon, allow_synthetic=data["allow_synthetic"])
        horizon_fn = illum_mod.horizon_function(lat, lon, allow_synthetic=data["allow_synthetic"])
        combined, meta, _raw = services.fetch_sun_earth(
            lat_deg=lat, lon_deg=lon, alt_km=data["altitude_km"],
            start_utc=services.normalise_time(data["start"]),
            stop_utc=services.normalise_time(data["stop"]),
            step=data["step"],
        )

        series = []
        states = []
        for entry in combined:
            sun = entry.get("sun") or {}
            state = illum_mod.evaluate_sun(
                time_utc=entry["time"],
                sun_azimuth_deg=sun.get("azimuth_deg"),
                sun_elevation_deg=sun.get("elevation_deg"),
                horizons_daylight=sun.get("site_daylight"),
                lat_deg=lat, lon_deg=lon,
                terrain_available=terrain_ctx["available"],
                horizon_fn=horizon_fn,
            )
            states.append(state)
            series.append({**state.as_dict(), "sun_direction_scene": sun.get("direction_scene")})

        stats = illum_mod.summarise_timeline(states, interval_h=services.step_to_hours(data["step"]))
        return Response(
            {
                "site": {"latitude_deg": lat, "longitude_deg": lon, "slug": slug},
                "terrain": terrain_ctx,
                "window": {
                    "start_utc": services.normalise_time(data["start"]),
                    "stop_utc": services.normalise_time(data["stop"]),
                    "step": data["step"],
                    "samples": len(series),
                },
                "series": series,
                "summary": stats.as_dict(),
                "semantics": {
                    "geometric": "Sun centre above the smooth local-vertical horizon.",
                    "limb_geometric": "Sun upper limb above the smooth horizon.",
                    "horizons_daylight": "Horizons '*' solar-presence marker for the site.",
                    "terrain_visible": "Sun ray clear of the terrain skyline (requires DEM).",
                    "illuminated": "Terrain-aware lander-level illumination.",
                },
            }
        )
