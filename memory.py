"""
Zephyra — Memory Layer (v0.1: persistent episodic log + sliding window)
---------------------------------------------------------------------------
NOT the full four-layer memory system from the architecture doc — that's
Phase 2. This is: a flat persistent log on disk, plus recent_turns() to
window down to the last N exchanges before they're sent to the LLM.

This is the modern, current equivalent of what older LangChain tutorials
called ConversationBufferMemory / ConversationBufferWindowMemory — those
classes were removed in LangChain's 1.0 rewrite. Plain Python is the
current way to do this, not a missing feature.
"""

import json
from pathlib import Path

MEMORY_FILE = Path("data/zephyra_memory.json")


def load_memory() -> list[dict]:
    """Load past conversation turns from disk. Returns [] if no history exists yet."""
    if not MEMORY_FILE.exists():
        return []
    try:
        return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []  # corrupted file shouldn't crash the bot


def save_turn(user_input: str, reply: str) -> None:
    """Append one user/Zephyra exchange to the persistent log on disk."""
    MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    history = load_memory()
    history.append({"role": "user", "content": user_input})
    history.append({"role": "zephyra", "content": reply})
    MEMORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")


def history_to_text(history: list[dict]) -> str:
    """Convert stored history into the plain-text block PromptTemplate expects."""
    if not history:
        return "(no prior turns)"
    lines = []
    for turn in history:
        speaker = "User" if turn["role"] == "user" else "Zephyra"
        lines.append(f"{speaker}: {turn['content']}")
    return "\n".join(lines)


def recent_turns(history: list[dict], max_exchanges: int = 5) -> list[dict]:
    """Return only the most recent N user/Zephyra exchanges — the sliding window
    that limits what actually gets sent to the LLM, regardless of how much
    is stored on disk."""
    max_messages = max_exchanges * 2
    return history[-max_messages:] if len(history) > max_messages else history