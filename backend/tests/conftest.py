"""Shared test fixtures.

Chat tests patch the runner's LLM, but the router and the background memory
extractor call their own provider. Without these defaults the suite talks to a
real model. Tests that need specific routing patch the router themselves.
"""

import json
from collections.abc import AsyncIterator, Iterator
from unittest.mock import patch

import pytest


class ScriptedLLM:
    """Deterministic stand-in for an LLM provider."""

    provider_name = "scripted"
    model_name = "scripted"

    def __init__(self, reply: list[str]) -> None:
        self.reply = reply
        self.calls: list[list[dict[str, str]]] = []

    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        self.calls.append(messages)
        for part in self.reply:
            yield part


def router_llm(intent: str) -> ScriptedLLM:
    return ScriptedLLM([json.dumps({"intent": intent})])


@pytest.fixture(autouse=True)
def _hermetic_llm_side_calls() -> Iterator[None]:
    async def _no_extraction(*args: object, **kwargs: object) -> None:
        return None

    with (
        patch("app.agent.nodes.router.get_llm_provider", lambda *a, **k: router_llm("CHAT")),
        patch(
            "app.services.memory_service.MemoryService.extract_memory_candidates",
            _no_extraction,
        ),
    ):
        yield
