"""Memory sliding window service to limit LLM context window size."""

from app.models import Message


def recent_turns(messages: list[Message], max_exchanges: int = 5) -> list[dict[str, str]]:
    """Return the most recent user/assistant exchanges.

    Each exchange is a pair of (user, assistant) messages, so 5 exchanges
    equals at most 10 messages.
    """
    max_messages = max_exchanges * 2
    recent = messages[-max_messages:] if len(messages) > max_messages else messages
    return [{"role": msg.role, "content": msg.content} for msg in recent]
