"""Solar-power estimation API (clearly labelled estimates)."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.params import resolve_site
from apps.ephemeris.serializers import AnalyzeRequestSerializer
from scientific_engine import illumination as illum_mod
from scientific_engine import services
from scientific_engine import solar_energy as solar_mod


class SolarEstimateView(APIView):
    throttle_scope = "horizons"

    @extend_schema(
        summary="Estimate solar energy harvest over a window",
        description=(
            "Airless-body direct-beam model: DNI = S0·(1AU/r)², panel power = "
            "DNI·A·η·cosθ·derate during terrain-clear illumination. Estimate only."
        ),
        request=AnalyzeRequestSerializer,
        responses={200: dict},
        tags=["solar"],
    )
    def post(self, request):
        ser = AnalyzeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        lat, lon, slug = resolve_site(data)

        panel_data = data.get("panel") or {}
        panel = solar_mod.SolarPanelConfig(
            area_m2=panel_data.get("area_m2", 1.0),
            efficiency=panel_data.get("efficiency", 0.28),
            tilt_from_horizontal_deg=panel_data.get("tilt_from_horizontal_deg", 90.0),
            azimuth_deg=panel_data.get("azimuth_deg", 0.0),
            system_derate=panel_data.get("system_derate", 0.85),
        )

        start = services.normalise_time(data["start"])
        stop = services.normalise_time(data["stop"])
        terrain_ctx = services.terrain_context(lat, lon, allow_synthetic=data["allow_synthetic"])
        horizon_fn = illum_mod.horizon_function(lat, lon, allow_synthetic=data["allow_synthetic"])
        combined, _meta, _raw = services.fetch_sun_earth(
            lat_deg=lat, lon_deg=lon, alt_km=data["altitude_km"],
            start_utc=start, stop_utc=stop, step=data["step"],
        )
        sun_distance = services.fetch_sun_distance_km(start_utc=start, stop_utc=stop, step=data["step"])

        series = []
        powers, flags = [], []
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
            power = solar_mod.instantaneous_power_w(
                sun_az_deg=sun.get("azimuth_deg"),
                sun_el_deg=sun.get("elevation_deg"),
                sun_distance_km=sun_distance,
                illuminated=state.illuminated,
                config=panel,
            )
            powers.append(power)
            flags.append(state.illuminated)
            series.append(
                {
                    "time": entry["time"],
                    "sun_elevation_deg": state.sun_elevation_deg,
                    "illuminated": state.illuminated,
                    "dni_w_m2": solar_mod.dni_w_m2(sun_distance_km=sun_distance, illuminated=state.illuminated),
                    "power_w": power,
                }
            )

        interval_h = services.step_to_hours(data["step"])
        summary = solar_mod.summarise_energy(
            powers, flags, interval_h=interval_h, config=panel,
            sun_distance_known=sun_distance is not None,
        )
        return Response(
            {
                "site": {"latitude_deg": lat, "longitude_deg": lon, "slug": slug},
                "terrain": terrain_ctx,
                "window": {"start_utc": start, "stop_utc": stop, "step": data["step"], "samples": len(series)},
                "sun_distance_km": sun_distance,
                "series": series,
                "summary": summary.as_dict(),
            }
        )
