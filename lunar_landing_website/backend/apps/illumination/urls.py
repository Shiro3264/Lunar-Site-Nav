from django.urls import path

from .views import IlluminationTimelineView

urlpatterns = [
    path("illumination/timeline/", IlluminationTimelineView.as_view(), name="illumination-timeline"),
    path("illumination/analyze/", IlluminationTimelineView.as_view(), name="illumination-analyze"),
]
