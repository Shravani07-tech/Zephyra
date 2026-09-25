"""NVIDIA LLM provider integration using OpenAI-compatible API."""

import logging
from collections.abc import AsyncIterator

import openai
from openai import AsyncOpenAI

from app.config import get_settings
from app.services.llm.base import (
    BaseLLMProvider,
    LLMAuthenticationError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)

logger = logging.getLogger(__name__)


class NvidiaProvider(BaseLLMProvider):
    """Provider implementation for NVIDIA-hosted OpenAI-compatible models."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.nvidia_api_key
        self.base_url = base_url or settings.nvidia_api_base
        self.model = model or settings.nvidia_model

        # Initialize OpenAI client for NVIDIA base URL.
        # Fallback to dummy key to allow class instantiation in missing-auth tests.
        self.client = AsyncOpenAI(
            api_key=self.api_key or "missing_key",
            base_url=self.base_url,
        )

    @property
    def provider_name(self) -> str:
        return "NVIDIA"

    @property
    def model_name(self) -> str:
        return self.model

    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Stream conversational turns from the NVIDIA hosted API."""
        if not self.api_key or self.api_key == "missing_key":
            raise LLMAuthenticationError("NVIDIA_API_KEY is not configured on the server.")

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]
                stream=True,
            )
            async for chunk in response:  # type: ignore[union-attr]
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        yield delta.content

        except openai.AuthenticationError as e:
            logger.error("NVIDIA Authentication failure: %s", str(e))
            raise LLMAuthenticationError("NVIDIA API authentication failed.") from e

        except openai.RateLimitError as e:
            logger.error("NVIDIA Rate Limit exceeded: %s", str(e))
            raise LLMRateLimitError("NVIDIA API rate limit exceeded.") from e

        except openai.APITimeoutError as e:
            logger.error("NVIDIA Timeout: %s", str(e))
            raise LLMTimeoutError("NVIDIA API request timed out.") from e

        except openai.APIStatusError as e:
            logger.error("NVIDIA status error %d: %s", e.status_code, str(e))
            if e.status_code >= 500:
                raise LLMUnavailableError("NVIDIA hosted API is currently unavailable.") from e
            raise LLMError(f"NVIDIA API returned error status: {e.status_code}") from e

        except openai.APIError as e:
            logger.error("NVIDIA API error: %s", str(e))
            raise LLMError(f"NVIDIA API error: {str(e)}") from e

        except Exception as e:
            logger.error("Unexpected error in NVIDIA service: %s", str(e))
            raise LLMError(f"An unexpected error occurred: {str(e)}") from e
