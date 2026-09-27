from fastapi import APIRouter

from app.config import get_settings
from app.schemas import HealthResponse, SystemStatusResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Report that the service is up. Returns exactly ``{"status": "ok"}``."""
    return HealthResponse(status="ok")


@router.get("/system/status", response_model=SystemStatusResponse)
async def system_status() -> SystemStatusResponse:
    """Return safe metadata about the provider chat turns currently route to."""
    from app.services.llm import get_llm_provider
    from app.services.llm.routing import probe_nvidia

    if get_settings().llm_provider.strip().lower() == "auto":
        # Cached for the health TTL, so this rarely costs a request.
        await probe_nvidia()
    provider = get_llm_provider()
    return SystemStatusResponse(
        provider=provider.provider_name,
        model=provider.model_name,
        status="standby",
    )
