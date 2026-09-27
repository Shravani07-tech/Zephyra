"""Search provider contract for Phase 5 research.

Providers call a Search API and return raw result dicts. They never fetch or
scrape result pages. Normalisation, deduplication and limits are applied by
``app.services.search.normalize`` so every provider gets the same treatment.
"""

from abc import ABC, abstractmethod
from typing import Any, TypedDict


class SearchResult(TypedDict):
    """A normalised search result. Only ``normalize_results`` builds these."""

    url: str
    title: str
    snippet: str
    retrieved_at: str


class SearchProviderError(Exception):
    """The provider failed to return results."""


class SearchProviderNotConfiguredError(SearchProviderError):
    """No search provider is selected, or the selected one is unknown."""


class BaseSearchProvider(ABC):
    """Abstract Search API provider.

    ``search`` must be a coroutine that honours cancellation. A provider built
    on a blocking client must run it via ``asyncio.to_thread`` so the event loop
    is never blocked. Each returned item should be a dict with ``url``,
    ``title`` and ``snippet`` keys; anything malformed is dropped downstream.
    Failures should raise :class:`SearchProviderError`.
    """

    name: str = "base"

    @abstractmethod
    async def search(self, query: str, max_results: int) -> list[dict[str, Any]]:
        """Run one search query and return raw result items."""
