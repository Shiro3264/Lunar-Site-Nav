"""Root URL configuration for LunaNav."""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.landing_sites.urls")),
    path("api/", include("apps.ephemeris.urls")),
    path("api/", include("apps.lunar_terrain.urls")),
    path("api/", include("apps.illumination.urls")),
    path("api/", include("apps.solar_energy.urls")),
    path("api/", include("apps.communication.urls")),
    path("api/", include("apps.suitability.urls")),
    path("api/", include("apps.mission_reports.urls")),
    # OpenAPI / Swagger
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
