from django.urls import path

from .views import (
    DatasetInfoView,
    HorizonProfileView,
    SlopeView,
    TerrainMeshView,
    TerrainSampleView,
)

urlpatterns = [
    path("terrain/dataset/", DatasetInfoView.as_view(), name="terrain-dataset"),
    path("terrain/sample/", TerrainSampleView.as_view(), name="terrain-sample"),
    path("terrain/elevation/", TerrainSampleView.as_view(), name="terrain-elevation"),
    path("terrain/mesh/", TerrainMeshView.as_view(), name="terrain-mesh"),
    path("terrain/horizon/", HorizonProfileView.as_view(), name="terrain-horizon"),
    path("terrain/slope/", SlopeView.as_view(), name="terrain-slope"),
]
