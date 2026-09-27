"""Agent execution turn runner implementing the linear orchestration seam."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.orm import Session

from app.agent.nodes.research import COMPOUND_CLARIFICATION
from app.agent.nodes.task import format_task_reply
from app.agent.planner import build_planner
from app.config import get_settings
from app.db import SessionLocal
from app.files.prompt import build_file_messages
from app.services import conversation as conv_service
from app.services.llm import BaseLLMProvider, get_llm_provider
from app.services.memory import window as memory_window
from app.services.research import ResearchUnavailableError
from app.services.research.citations import validate_citations
from app.services.research.evidence import build_research_messages
from app.services.research.registry import SourceRegistry

logger = logging.getLogger(__name__)


async def run_turn(
    db: Session,
    conversation_id: str,
    user_text: str | None = None,
    llm_service: BaseLLMProvider | None = None,
    skip_user_append: bool = False,
) -> AsyncIterator[dict[str, Any] | str]:
    """Execute a single conversation turn.

    Orchestrates the sequence:
    1. Persist user message in SQLite if skip_user_append is False.
    2. Extract the last 5 exchanges as the context window.
    3. Run Planner orchestration to detect intent and execute tools (e.g. TASK).
    4. Inject tool results (if any) into the context window.
    5. Stream response chunks from the LLM provider.
    6. Persist the final compiled assistant message in SQLite upon success.

    Research and compound turns take dedicated paths: research never falls back
    to a general answer, and compound requests get a fixed clarification.
    """
    # 1. Append user message if not retrying an existing message
    if not skip_user_append:
        if user_text is None:
            raise ValueError("user_text is required when skip_user_append is False")
        conv_service.append_message(db, conversation_id, "user", user_text)
    else:
        # If retrying, we need the last user message to feed the planner
        if user_text is None:
            history = conv_service.get_messages(db, conversation_id)
            user_msgs = [m for m in history if m.role == "user"]
            if not user_msgs:
                raise ValueError("Cannot retry empty conversation.")
            user_text = user_msgs[-1].content

    # 2. Retrieve history and build recent memory window
    history = conv_service.get_messages(db, conversation_id)
    recent_payload = memory_window.recent_turns(history, max_exchanges=5)

    # 3. Run Planner
    planner_graph = build_planner(db)
    planner_state = {
        "conversation_id": conversation_id,
        "user_text": user_text,
        "recent_history": recent_payload,
        "intent": None,
        "tool_results": [],
        "response_generator": None
    }

    try:
        final_state = await planner_graph.ainvoke(planner_state)
        tool_results = final_state.get("tool_results", [])
    except Exception as e:
        # Planner failure should not crash chat: answer as plain chat instead.
        final_state = planner_state
        tool_results = [{"success": False, "error": f"Planner error: {str(e)}"}]

    intent = final_state.get("intent")
    service = llm_service or get_llm_provider()

    if intent == "COMPOUND_RESEARCH_TASK":
        # Deterministic: nothing is executed and no model writes this reply.
        yield COMPOUND_CLARIFICATION
        conv_service.append_message(db, conversation_id, "assistant", COMPOUND_CLARIFICATION)
        return

    if intent == "RESEARCH":
        async for event in _run_research(db, conversation_id, user_text, recent_payload,
                                         tool_results, service):
            yield event
        return

    result = tool_results[0] if tool_results else {}

    # 4. Task and memory operations answer deterministically from their result,
    # so internal data never reaches the reply and the reply matches what happened.
    if intent in ("TASK", "MEMORY"):
        if intent == "TASK":
            reply = format_task_reply(result)
        else:
            reply = str(result.get("message") or result.get("error") or "Done.")
        yield reply
        conv_service.append_message(db, conversation_id, "assistant", reply)
        return

    if intent == "FILE":
        if not result.get("success"):
            reply = str(result.get("error") or "I couldn't search your files.")
            yield reply
            conv_service.append_message(db, conversation_id, "assistant", reply)
            return
        # Grounded in the retrieved excerpts only; memory is not mixed in.
        payload = build_file_messages(recent_payload, user_text, result["retrieved_chunks"])
    else:
        payload = recent_payload
        if intent is None and tool_results:
            logger.warning("Planner failed; answering as plain chat: %s", result.get("error"))

        # 4b. Inject persistent memory context
        from app.services.memory_service import MemoryService
        mem_service = MemoryService(db)
        memories = mem_service.search_memories(user_text, user_id="default", n_results=3, threshold=1.0)

        if memories:
            memory_texts = [m["text"] for m in memories]
            mem_msg = (
                "<zephyra_memory>\n"
                "Remembered user context (newest first). It ranks below the user's current "
                "message, uploaded files, and task data: if it conflicts with them, follow "
                "them instead.\n"
                "- " + "\n- ".join(memory_texts) + "\n"
                "</zephyra_memory>"
            )
            payload[-1]["content"] = f"{mem_msg}\n\n{user_text}"

    full_reply_chunks = []
    # 5–6. Stream response and accumulate
    async for chunk in service.stream_chat(payload):
        full_reply_chunks.append(chunk)
        yield chunk

    # 7. Persist assistant reply only if the stream successfully completes
    full_reply = "".join(full_reply_chunks).strip()
    if full_reply:
        conv_service.append_message(db, conversation_id, "assistant", full_reply)

        # 8. Background memory extraction, for ordinary chat only
        if intent == "CHAT":
            _spawn_memory_extraction(user_text, conversation_id)


# Strong references keep background extraction tasks alive until they finish.
_background_tasks: set[asyncio.Task[None]] = set()


def _spawn_memory_extraction(user_text: str, conversation_id: str) -> None:
    """Extract implicit memories after the reply, in a session of its own.

    The request's session is closed once the response ends, so the background
    task must not share it.
    """
    from app.services.memory_service import MemoryService

    async def extract() -> None:
        with SessionLocal() as session:
            await MemoryService(session).extract_memory_candidates(
                text=user_text, conversation_id=conversation_id, user_id="default"
            )

    task = asyncio.create_task(extract())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

async def _run_research(
    db: Session,
    conversation_id: str,
    user_text: str,
    recent_payload: list[dict[str, str]],
    tool_results: list[dict[str, Any]],
    service: BaseLLMProvider,
) -> AsyncIterator[dict[str, Any] | str]:
    """Grounded synthesis over this run's registry, then citation validation.

    Without usable evidence no synthesis call is made. Persistent memory is not
    injected so the answer stays grounded in the retrieved evidence, and
    research output never feeds memory extraction.
    """
    result = tool_results[0] if tool_results else {}
    registry = result.get("registry")
    if result.get("status") != "success" or not isinstance(registry, SourceRegistry):
        raise ResearchUnavailableError(
            result.get("reason", "unavailable"),
            result.get("message", "Research failed: no evidence could be retrieved."),
        )

    settings = get_settings()
    messages = build_research_messages(
        recent_payload, user_text, registry, settings.research_snippet_max_chars
    )

    chunks: list[str] = []
    async for chunk in service.stream_chat(messages):
        chunks.append(chunk)
        yield chunk

    validated = validate_citations("".join(chunks), registry)
    research_meta = {
        "run_id": registry.run_id,
        "citations": validated.citations,
        "rejected_markers": validated.rejected_markers,
    }
    yield {"type": "citations", "data": research_meta}

    if validated.content:
        conv_service.append_message(
            db,
            conversation_id,
            "assistant",
            validated.content,
            metadata=json.dumps({"research": research_meta}),
        )
