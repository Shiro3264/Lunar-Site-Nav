"""Landing-site API.

* ``GET /api/sites/`` — list sites (``?enrich=true`` adds terrain metrics).
* ``GET /api/sites/{slug}/`` — retrieve one site (terrain always included).
* ``POST /api/sites/`` — create a user-defined site.
* ``POST /api/coordinates/validate/`` — validate/normalise an arbitrary coordinate.
* ``POST /api/sites/compare/`` — side-by-side comparison of several sites.
"""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import mixins, serializers, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from scientific_engine import coordinates as coords
from scientific_engine import services
from scientific_engine.constants import LONGITUDE_CONVENTION

from .models import CustomCoordinates, LandingSite
from .serializers import LandingSiteSerializer


class LandingSiteViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = LandingSite.objects.all()
    serializer_class = LandingSiteSerializer
    lookup_field = "slug"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["enrich"] = self.request.query_params.get("enrich", "").lower() in {"1", "true", "yes"}
        return ctx

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, context={"enrich": True})
        return Response(serializer.data)


class SiteAnalysisView(APIView):
    """Full scientific analysis for a stored site."""

    @extend_schema(
        summary="Analyze a stored landing site",
        parameters=[
            OpenApiParameter("slug", OpenApiTypes.STR, OpenApiParameter.PATH),
            OpenApiParameter("start", OpenApiTypes.STR, description="Start (UT), e.g. 2026-11-15 00:00"),
            OpenApiParameter("stop", OpenApiTypes.STR, description="Stop (UT)"),
            OpenApiParameter("step", OpenApiTypes.STR, description="Horizons step, e.g. '1 h'"),
        ],
        tags=["landing-sites"],
    )
    def get(self, request, slug: str):
        site = LandingSite.objects.filter(slug=slug).first()
        if site is None:
            return Response({"error": {"type": "NotFound", "detail": f"Site '{slug}' not found."}}, status=404)

        params = request.query_params
        start = params.get("start") or _default_window()[0]
        stop = params.get("stop") or _default_window()[1]
        step = params.get("step", "1 h")
        result = services.analyse_site(
            lat_deg=site.latitude, lon_deg=site.longitude, start=start, stop=stop, step=step
        )
        result["site"]["slug"] = site.slug
        result["site"]["name"] = site.name
        result["site"]["longitude_convention"] = LONGITUDE_CONVENTION
        return Response(result)


def _default_window():
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return (
        now.strftime("%Y-%m-%d %H:%M"),
        (now + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M"),
    )


class CoordinateValidateSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90.0, max_value=90.0)
    longitude = serializers.FloatField(
        help_text="East-positive longitude in degrees (wrapped to [-180, 180))."
    )
    altitude_km = serializers.FloatField(required=False, default=0.0)
    label = serializers.CharField(required=False, allow_blank=True, default="")
    enrich_terrain = serializers.BooleanField(required=False, default=True)
    persist = serializers.BooleanField(
        required=False, default=False, help_text="Save to CustomCoordinates."
    )


class CoordinateValidateView(APIView):
    """Validate & normalise a selenographic coordinate (POST /api/coordinates/validate/)."""

    @extend_schema(
        summary="Validate and normalise a selenographic coordinate",
        request=CoordinateValidateSerializer,
        responses={200: dict},
        tags=["coordinates"],
    )
    def post(self, request):
        ser = CoordinateValidateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        lat, lon = coords.validate_lat_lon(float(d["latitude"]), float(d["longitude"]))
        terrain = services.terrain_context(lat, lon) if d["enrich_terrain"] else None

        result = {
            "input": {
                "latitude": d["latitude"],
                "longitude": d["longitude"],
                "altitude_km": d["altitude_km"],
            },
            "normalised": {
                "latitude_deg": lat,
                "longitude_deg": lon,
                "longitude_convention": LONGITUDE_CONVENTION,
                "east_positive_longitude": True,
            },
            "terrain": terrain,
            "note": (
                "Latitude must lie in [-90, 90]; longitude is wrapped into [-180, 180) "
                "using the East-positive selenographic convention."
            ),
        }

        if d["persist"]:
            record = CustomCoordinates.objects.create(
                label=d["label"],
                latitude=lat,
                longitude=lon,
                altitude_km=d["altitude_km"],
                source="api",
            )
            result["saved"] = {"id": record.id, "label": record.label}

        return Response(result)


class CompareSiteItemSerializer(serializers.Serializer):
    slug = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.FloatField(required=False, min_value=-90.0, max_value=90.0)
    longitude = serializers.FloatField(required=False)
    label = serializers.CharField(required=False, allow_blank=True, default="")


class SiteCompareSerializer(serializers.Serializer):
    sites = CompareSiteItemSerializer(many=True, allow_empty=False)
    start = serializers.CharField(required=False)
    stop = serializers.CharField(required=False)
    step = serializers.CharField(required=False, default="1 h")
    allow_synthetic = serializers.BooleanField(required=False, default=True)

    def validate(self, attrs):
        for item in attrs["sites"]:
            if not item.get("slug") and (
                item.get("latitude") is None or item.get("longitude") is None
            ):
                raise serializers.ValidationError(
                    "Each comparison entry needs a 'slug' or both latitude and longitude."
                )
        return attrs


class SiteCompareView(APIView):
    """Compare several landing sites (POST /api/sites/compare/)."""

    throttle_scope = "horizons"

    @extend_schema(
        summary="Compare multiple landing sites side by side",
        request=SiteCompareSerializer,
        responses={200: dict},
        tags=["landing-sites"],
    )
    def post(self, request):
        ser = SiteCompareSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        default_start, default_stop = _default_window()
        start = d.get("start") or default_start
        stop = d.get("stop") or default_stop
        step = d.get("step") or "1 h"

        rows = []
        for item in d["sites"]:
            slug = (item.get("slug") or "").strip()
            if slug:
                site = LandingSite.objects.filter(slug=slug).first()
                if site is None:
                    rows.append({"slug": slug, "error": f"Site '{slug}' not found."})
                    continue
                lat, lon, name = site.latitude, site.longitude, site.name
            else:
                lat = float(item["latitude"])
                lon = float(item["longitude"])
                name = item.get("label") or f"{lat:.3f}, {lon:.3f}"

            result = services.analyse_site(
                lat_deg=lat, lon_deg=lon,
                start=start, stop=stop, step=step,
                allow_synthetic=d["allow_synthetic"],
            )
            rows.append(
                {
                    "slug": slug or None,
                    "name": name,
                    "latitude": lat,
                    "longitude": lon,
                    "terrain": result["terrain"],
                    "illumination_summary": result["illumination_summary"],
                    "solar_summary": result["solar_summary"],
                    "communication_summary": result["communication_summary"],
                    "suitability": result["suitability"],
                }
            )

        comparable = [r for r in rows if "error" not in r]
        comparable.sort(
            key=lambda r: (
                r["suitability"]["composite_score"] is None,
                -(r["suitability"]["composite_score"] or 0),
            )
        )
        return Response(
            {
                "window": {"start_utc": start, "stop_utc": stop, "step": step},
                "count": len(comparable),
                "sites": rows,
                "ranking": [r["name"] for r in comparable],
                "disclaimer": (
                    "Comparison uses the explainable suitability heuristic; it is not a "
                    "flight-readiness or landing-success assessment."
                ),
            }
        )
