from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    CoordinateValidateView,
    LandingSiteViewSet,
    SiteAnalysisView,
    SiteCompareView,
)

router = DefaultRouter()
router.register("sites", LandingSiteViewSet, basename="site")

urlpatterns = [
    path("sites/compare/", SiteCompareView.as_view(), name="site-compare"),
    path("sites/<slug:slug>/analysis/", SiteAnalysisView.as_view(), name="site-analysis"),
    path(
        "coordinates/validate/",
        CoordinateValidateView.as_view(),
        name="coordinates-validate",
    ),
] + router.urls
