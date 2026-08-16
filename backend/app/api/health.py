from fastapi import APIRouter

from app.config import get_settings
from app.schemas import HealthResponse, SystemStatusResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report that the service is up. Returns exactly ``{"status": "ok"}``."""
    return HealthResponse(status="ok")


@router.get("/system/status", response_model=SystemStatusResponse)
def system_status() -> SystemStatusResponse:
    """Return safe metadata about the configured system model/provider."""
    settings = get_settings()
    return SystemStatusResponse(
        provider="NVIDIA",
        model=settings.zephyra_model,
        status="standby",
    )
