from django.urls import path

from .views import CommunicationAnalysisView, LinkBudgetView

urlpatterns = [
    path("communication/analysis/", CommunicationAnalysisView.as_view(), name="communication-analysis"),
    path("communication/analyze/", CommunicationAnalysisView.as_view(), name="communication-analyze"),
    path("communication/link-budget/", LinkBudgetView.as_view(), name="communication-link-budget"),
]
