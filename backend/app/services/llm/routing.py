"""Cloud-first LLM routing: NVIDIA when usable, local Ollama otherwise.

The router wraps the existing providers; it does not reimplement either one.
Selection never waits on a health probe before a chat turn. NVIDIA is tried
unless a recent failure marked it unusable, and a failure that happens before
any text was produced falls back to Ollama within the same turn, so the turn
still yields exactly one reply. The failure is cached for
``provider_health_ttl_seconds`` so later turns skip NVIDIA until it is retried.

Selection reasons:
- ``nvidia_primary``: NVIDIA is configured and not known to be failing.
- ``ollama_offline``: NVIDIA could not be reached at all (no network).
- ``ollama_fallback``: NVIDIA was reachable but failed (auth, 5xx, timeout, ...).
- ``ollama_unconfigured``: no NVIDIA key is configured.
"""

import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import cast

import httpx

from app.config import get_settings
from app.services.llm.base import (
    BaseLLMProvider,
    LLMConnectionError,
    LLMError,
)
from app.services.llm.nvidia import NvidiaProvider
from app.services.llm.ollama import OllamaProvider

logger = logging.getLogger(__name__)

NVIDIA_PRIMARY = "nvidia_primary"
OLLAMA_OFFLINE = "ollama_offline"
OLLAMA_FALLBACK = "ollama_fallback"
OLLAMA_UNCONFIGURED = "ollama_unconfigured"


@dataclass
class _CloudHealth:
    """Process-wide NVIDIA availability, shared by every routed provider."""

    failed_at: float | None = None
    failure_reason: str = OLLAMA_FALLBACK
    probed_at: float | None = None


_health = _CloudHealth()


def reset_health() -> None:
    """Forget cached NVIDIA availability (used by tests)."""
    global _health
    _health = _CloudHealth()


def _nvidia_configured() -> bool:
    key = get_settings().nvidia_api_key
    return bool(key and key.strip() and key != "missing_key")


def _mark_failed(reason: str) -> None:
    _health.failed_at = time.monotonic()
    _health.failure_reason = reason


def _mark_ok() -> None:
    _health.failed_at = None


def select_reason() -> str:
    """Current routing decision, from configuration and cached health only."""
    if not _nvidia_configured():
        return OLLAMA_UNCONFIGURED
    if _health.failed_at is not None:
        ttl = get_settings().provider_health_ttl_seconds
        if time.monotonic() - _health.failed_at < ttl:
            return _health.failure_reason
    return NVIDIA_PRIMARY


async def probe_nvidia(timeout: float = 3.0) -> None:
    """Cheap NVIDIA availability check (GET /models) used by the status endpoint.

    Refreshes the shared health at most once per TTL, so the status shows Ollama
    when the machine is offline before any chat has tried NVIDIA. Never raises
    and never logs the key; only failures are recorded.
    """
    settings = get_settings()
    if not _nvidia_configured():
        return
    now = time.monotonic()
    ttl = settings.provider_health_ttl_seconds
    if _health.probed_at is not None and now - _health.probed_at < ttl:
        return
    _health.probed_at = now
    url = settings.nvidia_api_base.rstrip("/") + "/models"
    try:
        client_timeout = httpx.Timeout(timeout)
        async with httpx.AsyncClient(timeout=client_timeout, follow_redirects=False) as client:
            response = await client.get(
                url, headers={"Authorization": f"Bearer {settings.nvidia_api_key}"}
            )
    except (httpx.ConnectError, httpx.ConnectTimeout):
        _mark_failed(OLLAMA_OFFLINE)
        return
    except httpx.HTTPError:
        _mark_failed(OLLAMA_FALLBACK)
        return
    # /models answers without checking the key, so a 200 proves reachability
    # only; it must not clear a failure a real chat request recorded.
    if response.status_code != 200:
        _mark_failed(OLLAMA_FALLBACK)


def _stream(provider: BaseLLMProvider, messages: list[dict[str, str]]) -> AsyncIterator[str]:
    # Providers implement stream_chat as async generators; the abstract
    # signature declares a coroutine, so narrow it for the type checker.
    return cast(AsyncIterator[str], provider.stream_chat(messages))


class RoutedLLMProvider(BaseLLMProvider):
    """NVIDIA primary with Ollama fallback, behind the normal provider contract."""

    def __init__(
        self,
        primary: BaseLLMProvider | None = None,
        fallback: BaseLLMProvider | None = None,
    ) -> None:
        # No client retries on the primary: a failure falls back instead.
        self.primary = primary or NvidiaProvider(max_retries=0)
        self.fallback = fallback or OllamaProvider()
        self.reason = select_reason()

    @property
    def active(self) -> BaseLLMProvider:
        return self.primary if self.reason == NVIDIA_PRIMARY else self.fallback

    @property
    def provider_name(self) -> str:
        return self.active.provider_name

    @property
    def model_name(self) -> str:
        return self.active.model_name

    async def stream_chat(  # type: ignore[override,misc]
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        self.reason = select_reason()
        if self.reason == NVIDIA_PRIMARY:
            produced = False
            try:
                async for chunk in _stream(self.primary, messages):
                    produced = True
                    yield chunk
            except LLMError as exc:
                # Text already reached the user: switching providers now would
                # splice two different replies together, so surface the error.
                if produced:
                    raise
                reason = OLLAMA_OFFLINE if isinstance(exc, LLMConnectionError) else OLLAMA_FALLBACK
                _mark_failed(reason)
                self.reason = reason
                logger.warning(
                    "NVIDIA unavailable (%s); falling back to Ollama for this turn.",
                    type(exc).__name__,
                )
            else:
                _mark_ok()
                return

        async for chunk in _stream(self.fallback, messages):
            yield chunk
