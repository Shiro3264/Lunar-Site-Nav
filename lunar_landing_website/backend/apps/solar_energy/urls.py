from django.urls import path

from .views import SolarEstimateView

urlpatterns = [
    path("solar-energy/estimate/", SolarEstimateView.as_view(), name="solar-estimate"),
    path("solar/estimate/", SolarEstimateView.as_view(), name="solar-estimate-canonical"),
]
