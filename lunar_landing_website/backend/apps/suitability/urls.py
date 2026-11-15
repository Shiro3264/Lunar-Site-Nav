from django.urls import path

from .views import SuitabilityAssessView, SuitabilityRankView

urlpatterns = [
    path("suitability/assess/", SuitabilityAssessView.as_view(), name="suitability-assess"),
    path("suitability/rank/", SuitabilityRankView.as_view(), name="suitability-rank"),
]
