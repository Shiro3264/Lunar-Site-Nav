"""Explainable suitability index API."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.params import default_window, resolve_site
from apps.ephemeris.serializers import AnalyzeRequestSerializer
from apps.landing_sites.models import LandingSite
from scientific_engine import services
from scientific_engine import suitability as suit_mod


class SuitabilityAssessView(APIView):
    throttle_scope = "horizons"

    @extend_schema(
        summary="Assess and explain a site's suitability index",
        description=(
            "Computes the weighted, explainable 0–100 suitability index. "
            "Decision-support heuristic — NOT a probability of landing success."
        ),
        request=AnalyzeRequestSerializer,
        responses={200: dict},
        tags=["suitability"],
    )
    def post(self, request):
        ser = AnalyzeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        lat, lon, slug = resolve_site(data)
        result = services.analyse_site(
            lat_deg=lat, lon_deg=lon, alt_km=data["altitude_km"],
            start=data["start"], stop=data["stop"], step=data["step"],
            allow_synthetic=data["allow_synthetic"],
        )
        return Response(
            {
                "site": {"latitude_deg": lat, "longitude_deg": lon, "slug": slug},
                "terrain": result["terrain"],
                "illumination_summary": result["illumination_summary"],
                "solar_summary": result["solar_summary"],
                "communication_summary": result["communication_summary"],
                "suitability": result["suitability"],
            }
        )


def _rank_sites(slugs, start, stop, step):
    """Shared ranking routine for GET (query params) and POST (JSON body)."""
    sites = LandingSite.objects.all()
    if slugs:
        sites = sites.filter(slug__in=slugs)
    sites = list(sites)
    if not sites:
        return Response({"sites": [], "note": "No sites to rank. Run `seed_sites` first."})

    ranked = []
    for site in sites:
        result = services.analyse_site(
            lat_deg=site.latitude, lon_deg=site.longitude,
            start=start, stop=stop, step=step,
        )
        ranked.append(
            {
                "slug": site.slug,
                "name": site.name,
                "latitude": site.latitude,
                "longitude": site.longitude,
                "composite_score": result["suitability"]["composite_score"],
                "grade": result["suitability"]["grade"],
                "sub_scores": result["suitability"]["sub_scores"],
                "terrain": result["terrain"],
                "illumination_summary": result["illumination_summary"],
                "solar_summary": result["solar_summary"],
                "communication_summary": result["communication_summary"],
            }
        )

    ranked.sort(key=lambda r: (r["composite_score"] is None, -(r["composite_score"] or 0)))
    return Response(
        {
            "window": {"start_utc": start, "stop_utc": stop, "step": step},
            "weights": suit_mod.DEFAULT_WEIGHTS,
            "sites": ranked,
            "disclaimer": (
                "Ranking is a decision-support heuristic with transparent weights, "
                "not a flight-readiness or landing-success assessment."
            ),
        }
    )


class SuitabilityRankView(APIView):
    throttle_scope = "horizons"

    @extend_schema(
        summary="Rank candidate landing sites by suitability",
        parameters=[
            OpenApiParameter("slugs", OpenApiTypes.STR, description="Comma-separated slugs; default = all sites"),
            OpenApiParameter("start", OpenApiTypes.STR),
            OpenApiParameter("stop", OpenApiTypes.STR),
            OpenApiParameter("step", OpenApiTypes.STR, default="1 h"),
        ],
        responses={200: dict},
        tags=["suitability"],
    )
    def get(self, request):
        p = request.query_params
        slugs = [s.strip() for s in (p.get("slugs") or "").split(",") if s.strip()]
        start, stop = default_window()
        start = p.get("start") or start
        stop = p.get("stop") or stop
        step = p.get("step", "1 h")
        return _rank_sites(slugs, start, stop, step)

    @extend_schema(
        summary="Rank candidate landing sites by suitability (JSON body)",
        request=dict,
        responses={200: dict},
        tags=["suitability"],
    )
    def post(self, request):
        body = request.data or {}
        raw = body.get("site_slugs") or body.get("slugs") or []
        if isinstance(raw, str):
            slugs = [s.strip() for s in raw.split(",") if s.strip()]
        else:
            slugs = [str(s).strip() for s in raw if str(s).strip()]
        start, stop = default_window()
        start = body.get("start") or start
        stop = body.get("stop") or stop
        step = body.get("step", "1 h")
        return _rank_sites(slugs, start, stop, step)
