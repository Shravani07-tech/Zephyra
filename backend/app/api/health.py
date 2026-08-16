"""Liveness route."""

from fastapi import APIRouter

from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report that the service is up. Returns exactly ``{"status": "ok"}``."""
    return HealthResponse(status="ok")
