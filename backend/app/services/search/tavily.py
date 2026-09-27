"""Tavily Search API provider.

Calls Tavily's search endpoint and returns its result snippets. Nothing else:
no page fetching, no raw page content, and no Tavily-generated answer. The
research pipeline applies limits, normalisation, deduplication and citation
validation to whatever this returns.
"""

from typing import Any

import httpx

from app.config import Settings
from app.services.search.base import (
    BaseSearchProvider,
    SearchProviderError,
    SearchProviderNotConfiguredError,
)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
# Tavily's documented maximum for max_results.
TAVILY_MAX_RESULTS = 20


class TavilySearchProvider(BaseSearchProvider):
    """Search via Tavily. Error messages never include the API key."""

    name = "tavily"

    def __init__(
        self,
        settings: Settings,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        key = settings.tavily_api_key.get_secret_value().strip() if settings.tavily_api_key else ""
        if not key:
            raise SearchProviderNotConfiguredError("TAVILY_API_KEY is not set.")
        self._api_key = key
        self._max_results = settings.research_max_sources
        self._timeout = settings.search_timeout_seconds
        self._transport = transport  # injected in tests; None uses the network

    async def search(self, query: str, max_results: int) -> list[dict[str, Any]]:
        payload = {
            "query": query,
            "search_depth": "basic",
            "topic": "general",
            "max_results": max(1, min(max_results, self._max_results, TAVILY_MAX_RESULTS)),
            "include_answer": False,
            "include_raw_content": False,
            "include_images": False,
        }
        try:
            async with httpx.AsyncClient(
                transport=self._transport,
                timeout=self._timeout,
                follow_redirects=False,
            ) as client:
                response = await client.post(
                    TAVILY_SEARCH_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
        except httpx.TimeoutException:
            # The research node reports TimeoutError as a "timeout" failure.
            raise TimeoutError("Tavily search timed out.") from None
        except httpx.HTTPError as e:
            raise SearchProviderError(f"Could not reach Tavily ({type(e).__name__}).") from None

        status = response.status_code
        if status in (401, 403):
            raise SearchProviderError("Tavily rejected the API key.")
        if status == 429:
            raise SearchProviderError("Tavily rate limit reached.")
        if status >= 500:
            raise SearchProviderError(f"Tavily is unavailable (HTTP {status}).")
        if status != 200:
            raise SearchProviderError(f"Tavily rejected the request (HTTP {status}).")

        try:
            data = response.json()
        except ValueError:
            raise SearchProviderError("Tavily returned malformed JSON.") from None
        results = data.get("results") if isinstance(data, dict) else None
        if not isinstance(results, list):
            raise SearchProviderError("Tavily returned an unexpected response shape.")

        # Map to the provider contract. Invalid items are passed through as-is
        # only in the fields we read; the pipeline drops anything unusable.
        return [
            {"url": item.get("url"), "title": item.get("title"), "snippet": item.get("content")}
            for item in results
            if isinstance(item, dict)
        ]
