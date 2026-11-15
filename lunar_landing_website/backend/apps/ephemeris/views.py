"""Ephemeris API endpoints (JPL Horizons + NAIF SPICE)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from integrations import spice
from integrations.horizons import client as horizons_client
from integrations.horizons import vectors as horizons_vectors
from scientific_engine import services
from scientific_engine import solar_energy as solar_mod
from scientific_engine.constants import MOON_MEAN_RADIUS_KM

from apps.core.params import default_window, resolve_site as _resolve_site

from .models import AnalysisRun
from .serializers import AnalyzeRequestSerializer


class HorizonsThrottleMixin:
    throttle_scope = "horizons"


class AnalyzeView(HorizonsThrottleMixin, APIView):
    """Full illumination / solar / communication / suitability analysis."""

    @extend_schema(
        summary="Analyze a site over a time window",
        description=(
            "Runs the complete LunaNav scientific pipeline for a site: illuminance, "
            "solar-power estimate, Earth-communication geometry and the explainable "
            "suitability index. All values carry provenance; unavailable values are null."
        ),
        request=AnalyzeRequestSerializer,
        responses={200: dict},
        tags=["ephemeris"],
    )
    def post(self, request):
        ser = AnalyzeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        lat, lon, slug = _resolve_site(data)
        panel_data = data.get("panel") or {}
        panel = solar_mod.SolarPanelConfig(
            area_m2=panel_data.get("area_m2", 1.0),
            efficiency=panel_data.get("efficiency", 0.28),
            tilt_from_horizontal_deg=panel_data.get("tilt_from_horizontal_deg", 90.0),
            azimuth_deg=panel_data.get("azimuth_deg", 0.0),
            system_derate=panel_data.get("system_derate", 0.85),
        )

        result = services.analyse_site(
            lat_deg=lat,
            lon_deg=lon,
            alt_km=data["altitude_km"],
            start=data["start"],
            stop=data["stop"],
            step=data["step"],
            allow_synthetic=data["allow_synthetic"],
            observer_height_m=data["observer_height_m"],
            panel=panel,
        )
        if slug:
            result["site"]["slug"] = slug

        if data.get("persist"):
            run = AnalysisRun.objects.create(
                site_slug=slug,
                latitude=lat,
                longitude=lon,
                altitude_km=data["altitude_km"],
                start_utc=result["window"]["start_utc"],
                stop_utc=result["window"]["stop_utc"],
                step=data["step"],
                status="ok",
                summary={
                    "suitability": result["suitability"],
                    "illumination": result["illumination_summary"],
                    "solar": result["solar_summary"],
                    "communication": result["communication_summary"],
                },
                provenance=result["provenance"],
            )
            result["analysis_run_id"] = run.id

        return Response(result)


class SunEarthView(HorizonsThrottleMixin, APIView):
    """Combined Sun+Earth observer ephemeris (lighter than the full analysis)."""

    @extend_schema(request=AnalyzeRequestSerializer, responses={200: dict}, tags=["ephemeris"])
    def post(self, request):
        ser = AnalyzeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        lat, lon, slug = _resolve_site(data)

        combined, meta, _raw = services.fetch_sun_earth(
            lat_deg=lat, lon_deg=lon, alt_km=data["altitude_km"],
            start_utc=services.normalise_time(data["start"]),
            stop_utc=services.normalise_time(data["stop"]),
            step=data["step"],
        )
        return Response(
            {
                "site": {"latitude_deg": lat, "longitude_deg": lon, "slug": slug},
                "window": {
                    "start_utc": services.normalise_time(data["start"]),
                    "stop_utc": services.normalise_time(data["stop"]),
                    "step": data["step"],
                    "samples": len(combined),
                },
                "rows": combined,
                "meta": meta,
            }
        )


class VectorsView(HorizonsThrottleMixin, APIView):
    """Moon-centred ICRF state vectors for the Sun or Earth."""

    @extend_schema(
        parameters=[
            OpenApiParameter("target", OpenApiTypes.STR, description="sun or earth"),
            OpenApiParameter("start", OpenApiTypes.STR),
            OpenApiParameter("stop", OpenApiTypes.STR),
            OpenApiParameter("step", OpenApiTypes.STR, description="e.g. '1 d'"),
        ],
        tags=["ephemeris"],
    )
    def get(self, request):
        target = (request.query_params.get("target") or "sun").lower()
        command = horizons_client.TARGET_SUN if target == "sun" else horizons_client.TARGET_EARTH
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        start = services.normalise_time(request.query_params.get("start") or now.strftime("%Y-%m-%d %H:%M"))
        stop = services.normalise_time(request.query_params.get("stop") or now.strftime("%Y-%m-%d %H:%M"))
        step = request.query_params.get("step", "1 h")

        vecs = horizons_vectors.fetch_target_vectors(
            target=command, start_utc=start, stop_utc=stop, step=step
        )
        return Response(
            {
                "target": target,
                "center": horizons_vectors.CENTER_MOON,
                "reference_system": "ICRF",
                "units": "km",
                "vectors": [
                    {"epoch": v.epoch_label, "time_scale": v.time_scale,
                     "x_km": v.x_km, "y_km": v.y_km, "z_km": v.z_km}
                    for v in vecs
                ],
            }
        )


class MoonOrientationView(APIView):
    """Lunar body-fixed orientation (NAIF SPICE, or labelled fallback)."""

    @extend_schema(
        parameters=[OpenApiParameter("time", OpenApiTypes.STR, description="UTC, default now")],
        tags=["ephemeris"],
    )
    def get(self, request):
        raw = request.query_params.get("time")
        if raw:
            epoch = datetime.strptime(services.normalise_time(raw), "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        else:
            epoch = datetime.now(timezone.utc)
        orientation = spice.moon_orientation(epoch)
        return Response(
            {
                "epoch_utc": orientation.epoch_utc,
                "frame": orientation.frame,
                "source": orientation.source,
                "confidence": orientation.confidence,
                "pole_ra_deg": round(orientation.pole_ra_deg, 6),
                "pole_dec_deg": round(orientation.pole_dec_deg, 6),
                "prime_meridian_deg": round(orientation.prime_meridian_deg, 6),
                "bodyfixed_to_inertial": [[round(v, 9) for v in row] for row in orientation.bodyfixed_to_inertial],
                "note": orientation.note,
            }
        )


class SubPointsView(HorizonsThrottleMixin, APIView):
    """Sub-solar and sub-Earth points on the lunar globe."""

    @extend_schema(
        parameters=[
            OpenApiParameter("start", OpenApiTypes.STR),
            OpenApiParameter("stop", OpenApiTypes.STR),
            OpenApiParameter("step", OpenApiTypes.STR),
        ],
        tags=["ephemeris"],
    )
    def get(self, request):
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        start = services.normalise_time(request.query_params.get("start") or now.strftime("%Y-%m-%d %H:%M"))
        stop = services.normalise_time(request.query_params.get("stop") or start)
        step = request.query_params.get("step", "1 h")
        return Response(services.subsolar_subearthen(start_utc=start, stop_utc=stop, step=step))


class EphemerisTimelineView(HorizonsThrottleMixin, APIView):
    """GET Sun + Earth observer ephemeris timeline for a site."""

    @extend_schema(
        summary="Sun + Earth observer ephemeris timeline (GET)",
        parameters=[
            OpenApiParameter("latitude", OpenApiTypes.FLOAT),
            OpenApiParameter("longitude", OpenApiTypes.FLOAT),
            OpenApiParameter("site_slug", OpenApiTypes.STR),
            OpenApiParameter("altitude_km", OpenApiTypes.FLOAT),
            OpenApiParameter("start", OpenApiTypes.STR),
            OpenApiParameter("stop", OpenApiTypes.STR),
            OpenApiParameter("step", OpenApiTypes.STR, default="1 h"),
        ],
        responses={200: dict},
        tags=["ephemeris"],
    )
    def get(self, request):
        p = request.query_params
        default_start, default_stop = default_window()
        start = services.normalise_time(p.get("start") or default_start)
        stop = services.normalise_time(p.get("stop") or default_stop)
        step = p.get("step", "1 h")
        alt_km = float(p.get("altitude_km", "0.0"))

        slug = (p.get("site_slug") or "").strip()
        if slug:
            lat, lon, slug = _resolve_site({"site_slug": slug})
        else:
            lat = float(p.get("latitude", "-85.4"))
            lon = float(p.get("longitude", "31.7"))

        combined, meta, _raw = services.fetch_sun_earth(
            lat_deg=lat, lon_deg=lon, alt_km=alt_km,
            start_utc=start, stop_utc=stop, step=step,
        )
        return Response(
            {
                "site": {"latitude_deg": lat, "longitude_deg": lon, "slug": slug or None},
                "window": {
                    "start_utc": start,
                    "stop_utc": stop,
                    "step": step,
                    "samples": len(combined),
                },
                "rows": combined,
                "meta": meta,
            }
        )


class MoonRotationView(APIView):
    """Epoch-dependent lunar rotation from NAIF SPICE (never a fixed increment).

    Returns, for each requested epoch, the body-fixed → inertial orientation in
    the form of the pole (RA/Dec) and prime-meridian angle plus the full rotation
    matrix.  This is genuine synchronous rotation with physical libration, not an
    arbitrary ``rotation.y += k`` animation.
    """

    @extend_schema(
        summary="Lunar rotation / orientation samples over time",
        parameters=[
            OpenApiParameter("start", OpenApiTypes.STR),
            OpenApiParameter("stop", OpenApiTypes.STR),
            OpenApiParameter("step", OpenApiTypes.STR, default="1 h"),
        ],
        responses={200: dict},
        tags=["moon"],
    )
    def get(self, request):
        p = request.query_params
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        start = services.normalise_time(p.get("start") or now.strftime("%Y-%m-%d %H:%M"))
        stop = services.normalise_time(p.get("stop") or (now + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M"))
        step = p.get("step", "1 h")

        t0 = datetime.strptime(start, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        t1 = datetime.strptime(stop, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        step_h = services.step_to_hours(step)
        if not step_h or step_h <= 0:
            return Response(
                {"error": {"type": "BadRequest", "detail": f"Invalid step '{step}'."}},
                status=400,
            )

        max_samples = 400
        epochs = []
        t = t0
        while t <= t1 and len(epochs) < max_samples:
            epochs.append(t)
            t = t + timedelta(hours=step_h)
        if not epochs:
            epochs = [t0]

        samples = []
        for epoch in epochs:
            o = spice.moon_orientation(epoch)
            samples.append(
                {
                    "epoch_utc": o.epoch_utc,
                    "pole_ra_deg": round(o.pole_ra_deg, 6),
                    "pole_dec_deg": round(o.pole_dec_deg, 6),
                    "prime_meridian_deg": round(o.prime_meridian_deg, 6),
                    "bodyfixed_to_inertial": [[round(v, 9) for v in row] for row in o.bodyfixed_to_inertial],
                }
            )

        first = spice.moon_orientation(epochs[0])
        return Response(
            {
                "frame": first.frame,
                "source": first.source,
                "confidence": first.confidence,
                "reference_frame": "J2000 (ICRF)",
                "mean_radius_km": MOON_MEAN_RADIUS_KM,
                "synchronous_rotation": True,
                "sidereal_period_days": 27.321661,
                "window": {"start_utc": start, "stop_utc": stop, "step": step, "samples": len(samples)},
                "samples": samples,
                "note": (
                    "Orientation is epoch-dependent and includes physical libration; it is "
                    "derived from NAIF SPICE (MOON_PA / DE440 binary PCK), not a constant "
                    "angular increment."
                ),
            }
        )
