"""Agent execution turn runner implementing the linear orchestration seam."""

from collections.abc import AsyncIterator

from sqlalchemy.orm import Session

from app.services import conversation as conv_service
from app.services.llm import LLMService
from app.services.memory import window as memory_window


async def run_turn(
    db: Session,
    conversation_id: str,
    user_text: str | None = None,
    llm_service: LLMService | None = None,
    skip_user_append: bool = False,
) -> AsyncIterator[str]:
    """Execute a single conversation turn.

    Orchestrates the sequence:
    1. Persist user message in SQLite if skip_user_append is False.
    2. Extract the last 5 exchanges as the context window.
    3. Stream response chunks from NVIDIA API.
    4. Persist the final compiled assistant message in SQLite upon success.
    """
    # 1. Append user message if not retrying an existing message
    if not skip_user_append:
        if user_text is None:
            raise ValueError("user_text is required when skip_user_append is False")
        conv_service.append_message(db, conversation_id, "user", user_text)

    # 2. Retrieve history and build recent memory window
    history = conv_service.get_messages(db, conversation_id)
    recent_payload = memory_window.recent_turns(history, max_exchanges=5)

    # 3. Call LLM Service (allowing injection for testing)
    service = llm_service or LLMService()

    full_reply_chunks = []
    # 4. Stream response and accumulate
    async for chunk in service.stream_chat(recent_payload):
        full_reply_chunks.append(chunk)
        yield chunk

    # 5. Persist assistant reply only if the stream successfully completes
    full_reply = "".join(full_reply_chunks).strip()
    if full_reply:
        conv_service.append_message(db, conversation_id, "assistant", full_reply)
