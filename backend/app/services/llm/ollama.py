"""Ollama LLM provider integration using local OpenAI-compatible /v1 endpoint."""

import logging
from collections.abc import AsyncIterator

import openai
from openai import AsyncOpenAI

from app.config import get_settings
from app.services.llm.base import (
    BaseLLMProvider,
    LLMError,
    LLMTimeoutError,
    LLMUnavailableError,
)

logger = logging.getLogger(__name__)


class OllamaProvider(BaseLLMProvider):
    """Provider implementation for local Ollama instances via /v1 interface."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        settings = get_settings()
        self.base_url = base_url or settings.ollama_api_base
        self.model = model or settings.ollama_model

        # Ollama does not require an API key; use dummy string for AsyncOpenAI client compatibility.
        self.client = AsyncOpenAI(
            api_key="ollama",
            base_url=self.base_url,
        )

    @property
    def provider_name(self) -> str:
        return "Ollama"

    @property
    def model_name(self) -> str:
        return self.model

    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Stream conversational turns from the local Ollama instance."""
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

        except openai.APITimeoutError as e:
            logger.error("Ollama Timeout: %s", str(e))
            raise LLMTimeoutError("Ollama request timed out.") from e

        except openai.APIConnectionError as e:
            logger.error("Ollama connection failed: %s", str(e))
            raise LLMUnavailableError(
                f"Ollama server is not running or unreachable at {self.base_url}."
            ) from e

        except openai.APIStatusError as e:
            logger.error("Ollama status error %d: %s", e.status_code, str(e))
            if e.status_code == 404:
                raise LLMError(
                    f"Ollama model '{self.model}' was not found. Ensure it is pulled using 'ollama run {self.model}'."
                ) from e
            if e.status_code >= 500:
                raise LLMUnavailableError("Ollama local service encountered an internal error.") from e
            raise LLMError(f"Ollama returned error status: {e.status_code}") from e

        except openai.APIError as e:
            logger.error("Ollama API error: %s", str(e))
            raise LLMError(f"Ollama API error: {str(e)}") from e

        except Exception as e:
            logger.error("Unexpected error in Ollama service: %s", str(e))
            raise LLMError(f"An unexpected error occurred in Ollama service: {str(e)}") from e
