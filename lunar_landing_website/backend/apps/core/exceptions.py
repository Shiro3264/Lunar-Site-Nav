"""Uniform DRF exception handling for the LunaNav API.

Produces a consistent error envelope and converts our domain errors
(:class:`scientific_engine.services.AnalysisError`,
:class:`integrations.horizons.client.HorizonsError`) and validation errors into
appropriate HTTP responses instead of leaking 500s.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from integrations.horizons.client import HorizonsError
from scientific_engine.services import AnalysisError


def lunanav_exception_handler(exc, context):
    """DRF exception handler with a stable error envelope."""
    response = drf_exception_handler(exc, context)

    if response is not None:
        detail = response.data
        response.data = {
            "error": {
                "type": exc.__class__.__name__,
                "detail": detail,
            }
        }
        return response

    # Domain errors that DRF doesn't know about → 502 (upstream) or 400.
    if isinstance(exc, HorizonsError):
        return Response(
            {"error": {"type": "HorizonsError", "detail": str(exc), "upstream": "JPL Horizons"}},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    if isinstance(exc, AnalysisError):
        return Response(
            {"error": {"type": "AnalysisError", "detail": str(exc)}},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    if isinstance(exc, ValueError):
        return Response(
            {"error": {"type": "ValueError", "detail": str(exc)}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return response
