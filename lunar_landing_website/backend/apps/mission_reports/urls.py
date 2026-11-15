from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import AnalysisReportViewSet, GenerateReportView, MissionConfigurationViewSet

router = DefaultRouter()
router.register("reports", AnalysisReportViewSet, basename="report")
router.register("mission-configurations", MissionConfigurationViewSet, basename="mission-configuration")

urlpatterns = [
    path("reports/generate/", GenerateReportView.as_view(), name="report-generate"),
] + router.urls
