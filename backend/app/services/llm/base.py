"""Base abstractions and domain exception hierarchy for LLM providers."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMError(Exception):
    """Base exception for LLM service errors."""


class LLMAuthenticationError(LLMError):
    """Raised when authentication with the provider fails."""


class LLMRateLimitError(LLMError):
    """Raised when the provider's rate limit is exceeded."""


class LLMUnavailableError(LLMError):
    """Raised when the provider service is unavailable."""


class LLMTimeoutError(LLMError):
    """Raised when requests to the provider time out."""


class BaseLLMProvider(ABC):
    """Abstract base contract for all Zephyra Lite LLM providers."""

    @abstractmethod
    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Stream completion text chunks from the provider."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider name (e.g. 'NVIDIA', 'Ollama')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Active model identifier."""
        pass
