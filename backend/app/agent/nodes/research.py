"""Research and compound-intent nodes for the Zephyra Lite planner."""

import asyncio
import logging
from typing import Any

from app.agent.state import PlannerState
from app.config import get_settings
from app.services.research.registry import SourceRegistry
from app.services.search import (
    SearchProviderError,
    SearchProviderNotConfiguredError,
    get_search_provider,
)
from app.services.search.normalize import normalize_results

logger = logging.getLogger(__name__)

MAX_QUERY_CHARS = 400

COMPOUND_CLARIFICATION = (
    "This message asks for two things: web research and a task or goal change. "
    "I can only carry out one action per message right now, so I haven't done either yet. "
    "Please send them as separate messages — for example, ask me to research first, "
    "then ask me to add the task."
)

FAILURE_MESSAGES = {
    "not_configured": "Research is unavailable: no search provider is configured.",
    "timeout": "Research failed: the search provider did not respond in time.",
    "cancelled": "Research failed: the search was cancelled before returning results.",
    "provider_error": "Research failed: the search provider returned an error.",
    "malformed": "Research failed: the search provider returned an unusable response.",
    "empty": "Research found no usable search results for this request.",
}


def _failed(reason: str) -> dict[str, Any]:
    return {
        "tool_results": [
            {
                "type": "research",
                "status": "failed",
                "reason": reason,
                "message": FAILURE_MESSAGES[reason],
            }
        ]
    }


async def handle_research(state: PlannerState) -> dict[str, Any]:
    """Run one search and build this run's source registry.

    Never raises for provider problems: every failure becomes an explicit
    ``failed`` result so the runner can refuse to synthesise. Cancellation is
    propagated untouched.
    """
    settings = get_settings()
    try:
        provider = get_search_provider(settings)
    except SearchProviderNotConfiguredError as e:
        logger.warning("Research requested but unavailable: %s", e)
        return _failed("not_configured")

    query = state["user_text"].strip()[:MAX_QUERY_CHARS]
    timeout = min(settings.search_timeout_seconds, settings.research_budget_seconds)
    try:
        async with asyncio.timeout(timeout):
            raw_results = await provider.search(query, max_results=settings.research_max_sources)
    except TimeoutError:
        logger.warning("Search provider '%s' timed out after %.1fs", provider.name, timeout)
        return _failed("timeout")
    except asyncio.CancelledError:
        task = asyncio.current_task()
        if task is not None and task.cancelling():
            raise  # the request itself was cancelled (e.g. client Stop): propagate
        logger.warning("Search provider '%s' cancelled its own search", provider.name)
        return _failed("cancelled")
    except SearchProviderError as e:
        logger.warning("Search provider '%s' failed: %s", provider.name, e)
        return _failed("provider_error")
    except Exception:
        logger.exception("Unexpected search provider failure")
        return _failed("provider_error")

    if not isinstance(raw_results, list):
        return _failed("malformed")
    if not raw_results:
        return _failed("empty")

    results = normalize_results(
        raw_results,
        max_sources=settings.research_max_sources,
        snippet_max_chars=settings.research_snippet_max_chars,
    )
    if not results:
        return _failed("malformed")

    return {
        "tool_results": [
            {
                "type": "research",
                "status": "success",
                "registry": SourceRegistry.from_results(results),
            }
        ]
    }


async def handle_compound(state: PlannerState) -> dict[str, Any]:
    """Compound Research + Task requests only ever get a clarification."""
    return {
        "tool_results": [
            {"type": "compound", "status": "clarification", "message": COMPOUND_CLARIFICATION}
        ]
    }
