"""Terrain API: DEM sampling, local mesh, skyline and slope metrics."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations import lola
from scientific_engine import services
from scientific_engine import terrain as terrain_mod


def _coords(request) -> tuple[float, float, bool]:
    p = request.query_params
    lat = float(p.get("latitude", "-85.4"))
    lon = float(p.get("longitude", "31.7"))
    allow_synthetic = p.get("allow_synthetic", "true").lower() in {"1", "true", "yes"}
    return lat, lon, allow_synthetic


class DatasetInfoView(APIView):
    @extend_schema(summary="LOLA DEM dataset status", responses={200: dict}, tags=["terrain"])
    def get(self, request):
        return Response(lola.dataset_info())


class TerrainSampleView(APIView):
    @extend_schema(
        summary="Terrain metrics at a coordinate",
        parameters=[
            OpenApiParameter("latitude", OpenApiTypes.FLOAT),
            OpenApiParameter("longitude", OpenApiTypes.FLOAT),
            OpenApiParameter("allow_synthetic", OpenApiTypes.BOOL),
        ],
        tags=["terrain"],
    )
    def get(self, request):
        lat, lon, allow_synthetic = _coords(request)
        return Response(services.terrain_context(lat, lon, allow_synthetic=allow_synthetic))


class TerrainMeshView(APIView):
    @extend_schema(
        summary="Local terrain elevation grid for the 3D view",
        parameters=[
            OpenApiParameter("latitude", OpenApiTypes.FLOAT),
            OpenApiParameter("longitude", OpenApiTypes.FLOAT),
            OpenApiParameter("size_km", OpenApiTypes.FLOAT),
            OpenApiParameter("grid", OpenApiTypes.INT),
            OpenApiParameter("allow_synthetic", OpenApiTypes.BOOL),
        ],
        tags=["terrain"],
    )
    def get(self, request):
        lat, lon, allow_synthetic = _coords(request)
        size_km = float(request.query_params.get("size_km", "8.0"))
        grid = max(8, min(128, int(request.query_params.get("grid", "48"))))
        return Response(
            terrain_mod.terrain_mesh(
                lat, lon, size_km=size_km, grid=grid, allow_synthetic=allow_synthetic
            )
        )


class HorizonProfileView(APIView):
    @extend_schema(
        summary="Terrain skyline profile around a site",
        parameters=[
            OpenApiParameter("latitude", OpenApiTypes.FLOAT),
            OpenApiParameter("longitude", OpenApiTypes.FLOAT),
            OpenApiParameter("observer_height_m", OpenApiTypes.FLOAT),
            OpenApiParameter("max_range_km", OpenApiTypes.FLOAT),
            OpenApiParameter("step_deg", OpenApiTypes.FLOAT),
            OpenApiParameter("allow_synthetic", OpenApiTypes.BOOL),
        ],
        tags=["terrain"],
    )
    def get(self, request):
        lat, lon, allow_synthetic = _coords(request)
        height = float(request.query_params.get("observer_height_m", "2.0"))
        max_range = float(request.query_params.get("max_range_km", "30.0"))
        step = max(1.0, float(request.query_params.get("step_deg", "5")))
        azimuths = [float(a) for a in range(0, 360, int(step))]
        profile = terrain_mod.horizon_profile(
            lat, lon, azimuths_deg=azimuths, observer_height_m=height,
            max_range_km=max_range, allow_synthetic=allow_synthetic,
        )
        sample = terrain_mod.get_elevation(lat, lon, allow_synthetic=allow_synthetic)
        return Response(
            {
                "latitude": lat,
                "longitude": lon,
                "observer_height_m": height,
                "terrain_available": sample.available,
                "terrain_source": sample.source,
                "confidence": sample.confidence,
                "profile": profile,
                "note": sample.note,
            }
        )


class SlopeView(APIView):
    @extend_schema(
        summary="Slope, aspect, roughness and relief at a coordinate",
        parameters=[
            OpenApiParameter("latitude", OpenApiTypes.FLOAT),
            OpenApiParameter("longitude", OpenApiTypes.FLOAT),
            OpenApiParameter("allow_synthetic", OpenApiTypes.BOOL),
        ],
        tags=["terrain"],
    )
    def get(self, request):
        lat, lon, allow_synthetic = _coords(request)
        ctx = services.terrain_context(lat, lon, allow_synthetic=allow_synthetic)
        return Response(ctx)
