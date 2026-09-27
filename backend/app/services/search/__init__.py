"""Search provider selection for Phase 5 research."""

from collections.abc import Callable

from app.config import Settings
from app.services.search.base import (
    BaseSearchProvider,
    SearchProviderError,
    SearchProviderNotConfiguredError,
    SearchResult,
)
from app.services.search.tavily import TavilySearchProvider

# Approved Search API providers, by SEARCH_PROVIDER name. Providers must call a
# Search API only: no page fetching, scraping, crawling or browser automation.
PROVIDERS: dict[str, Callable[[Settings], BaseSearchProvider]] = {
    "tavily": TavilySearchProvider,
}


def get_search_provider(settings: Settings) -> BaseSearchProvider:
    """Build the configured search provider or raise if none is available."""
    name = settings.search_provider.strip().lower()
    if name in ("", "none"):
        raise SearchProviderNotConfiguredError("No search provider is configured.")
    factory = PROVIDERS.get(name)
    if factory is None:
        raise SearchProviderNotConfiguredError(f"Unknown search provider: '{name}'.")
    return factory(settings)


__all__ = [
    "PROVIDERS",
    "BaseSearchProvider",
    "SearchProviderError",
    "SearchProviderNotConfiguredError",
    "SearchResult",
    "get_search_provider",
]
