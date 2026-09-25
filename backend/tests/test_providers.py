"""Tests for the new LLM provider abstraction and specific providers."""

import asyncio
from unittest.mock import AsyncMock, patch

import openai
import pytest

from app.config import get_settings
from app.services.llm import get_llm_provider
from app.services.llm.base import (
    LLMError,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.services.llm.nvidia import NvidiaProvider
from app.services.llm.ollama import OllamaProvider


def test_get_llm_provider_nvidia():
    """Verify factory returns NvidiaProvider when configured."""
    # Temporarily override settings
    settings = get_settings()
    original_provider = settings.llm_provider
    settings.llm_provider = "nvidia"
    try:
        provider = get_llm_provider()
        assert isinstance(provider, NvidiaProvider)
        assert provider.provider_name == "NVIDIA"
    finally:
        settings.llm_provider = original_provider


def test_get_llm_provider_ollama():
    """Verify factory returns OllamaProvider when configured."""
    settings = get_settings()
    original_provider = settings.llm_provider
    settings.llm_provider = "ollama"
    try:
        provider = get_llm_provider()
        assert isinstance(provider, OllamaProvider)
        assert provider.provider_name == "Ollama"
    finally:
        settings.llm_provider = original_provider


def test_get_llm_provider_invalid():
    """Verify factory raises error on invalid provider."""
    settings = get_settings()
    original_provider = settings.llm_provider
    settings.llm_provider = "invalid"
    try:
        with pytest.raises(ValueError, match="Unsupported LLM provider: 'invalid'"):
            get_llm_provider()
    finally:
        settings.llm_provider = original_provider


def test_ollama_unavailable_server():
    """Verify OllamaProvider maps APIConnectionError to LLMUnavailableError."""
    async def run_test():
        provider = OllamaProvider(base_url="http://localhost:99999/v1", model="test-model")
        
        # Mock to throw APIConnectionError
        async def mock_raise_conn_error(*args, **kwargs):
            raise openai.APIConnectionError(request=None)
            
        provider.client.chat.completions.create = AsyncMock(side_effect=mock_raise_conn_error)
        
        with pytest.raises(LLMUnavailableError, match="Ollama server is not running or unreachable"):
            async for _ in provider.stream_chat([{"role": "user", "content": "Hi"}]):
                pass
    asyncio.run(run_test())


def test_ollama_unavailable_model():
    """Verify OllamaProvider maps 404 to explicit model missing error."""
    async def run_test():
        provider = OllamaProvider(model="missing-model")
        
        # Mock to throw APIStatusError with 404
        async def mock_raise_404(*args, **kwargs):
            raise openai.APIStatusError(
                message="Model not found", response=patch('httpx.Response', status_code=404).start(), body=None
            )
            
        provider.client.chat.completions.create = AsyncMock(side_effect=mock_raise_404)
        
        with pytest.raises(LLMError, match="Ensure it is pulled using 'ollama run missing-model'"):
            async for _ in provider.stream_chat([{"role": "user", "content": "Hi"}]):
                pass
    asyncio.run(run_test())


def test_ollama_timeout():
    """Verify OllamaProvider maps APITimeoutError to LLMTimeoutError."""
    async def run_test():
        provider = OllamaProvider(model="test")
        
        async def mock_raise_timeout(*args, **kwargs):
            raise openai.APITimeoutError(request=None)
            
        provider.client.chat.completions.create = AsyncMock(side_effect=mock_raise_timeout)
        
        with pytest.raises(LLMTimeoutError, match="Ollama request timed out"):
            async for _ in provider.stream_chat([{"role": "user", "content": "Hi"}]):
                pass
    asyncio.run(run_test())
