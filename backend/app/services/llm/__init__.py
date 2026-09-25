"""LLM service provider abstraction package for Zephyra Lite."""

from app.config import get_settings
from app.services.llm.base import (
    BaseLLMProvider,
    LLMAuthenticationError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.services.llm.nvidia import NvidiaProvider
from app.services.llm.ollama import OllamaProvider

# Backward-compatibility alias for legacy code/tests
LLMService = NvidiaProvider


def get_llm_provider(
    provider_name: str | None = None,
    model_name: str | None = None,
) -> BaseLLMProvider:
    """Factory creating configured LLM provider instance."""
    settings = get_settings()
    target_provider = (provider_name or settings.llm_provider).strip().lower()

    if target_provider == "nvidia":
        return NvidiaProvider(model=model_name)
    if target_provider == "ollama":
        return OllamaProvider(model=model_name)

    raise ValueError(f"Unsupported LLM provider: '{target_provider}'")


__all__ = [
    "BaseLLMProvider",
    "NvidiaProvider",
    "OllamaProvider",
    "get_llm_provider",
    "LLMService",
    "LLMError",
    "LLMAuthenticationError",
    "LLMRateLimitError",
    "LLMUnavailableError",
    "LLMTimeoutError",
]
