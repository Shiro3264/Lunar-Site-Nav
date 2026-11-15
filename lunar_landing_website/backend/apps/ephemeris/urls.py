from django.urls import path

from .views import (
    AnalyzeView,
    EphemerisTimelineView,
    MoonOrientationView,
    MoonRotationView,
    SubPointsView,
    SunEarthView,
    VectorsView,
)

urlpatterns = [
    path("ephemeris/analyze/", AnalyzeView.as_view(), name="ephemeris-analyze"),
    path("ephemeris/timeline/", EphemerisTimelineView.as_view(), name="ephemeris-timeline"),
    path("ephemeris/sun-earth/", SunEarthView.as_view(), name="ephemeris-sun-earth"),
    path("ephemeris/vectors/", VectorsView.as_view(), name="ephemeris-vectors"),
    path("ephemeris/moon-orientation/", MoonOrientationView.as_view(), name="ephemeris-moon-orientation"),
    path("ephemeris/sub-points/", SubPointsView.as_view(), name="ephemeris-sub-points"),
    # Canonical /api/moon/* paths required by the specification.
    path("moon/orientation/", MoonOrientationView.as_view(), name="moon-orientation"),
    path("moon/rotation/", MoonRotationView.as_view(), name="moon-rotation"),
]
