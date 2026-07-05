"""
Zephyra — Memory Layer (v0.1: per-session persistent log + sliding window)
---------------------------------------------------------------------------
Each conversation lives in its OWN file, keyed by session_id. This is the
fix for the multi-user privacy bug: previously all users on the deployed
app shared one data/zephyra_memory.json file and could see each other's
chats. Now every session (every browser tab on Streamlit, or the single
local CLI session) gets an isolated file under data/sessions/.

Still NOT the full four-layer memory system from the architecture doc —
that's Phase 2. This is: one file per session, plus recent_turns() to
window down to the last N exchanges before they're sent to the LLM.
"""

import json
from pathlib import Path

SESSIONS_DIR = Path("data/sessions")


def _session_file(session_id: str) -> Path:
    # session_id is always a generated uuid/string we control, never raw user
    # input, so this is safe from path traversal in practice — still worth
    # being defensive about it.
    safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
    return SESSIONS_DIR / f"{safe_id}.json"


def load_memory(session_id: str) -> list[dict]:
    """Load past conversation turns for THIS session only."""
    path = _session_file(session_id)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def save_turn(session_id: str, user_input: str, reply: str) -> None:
    """Append one user/Zephyra exchange to THIS session's file only."""
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    history = load_memory(session_id)
    history.append({"role": "user", "content": user_input})
    history.append({"role": "zephyra", "content": reply})
    _session_file(session_id).write_text(json.dumps(history, indent=2), encoding="utf-8")


def clear_memory(session_id: str) -> None:
    """Wipe THIS session's saved file (used by /clear and 'New chat')."""
    path = _session_file(session_id)
    if path.exists():
        path.unlink()


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
    """Return only the most recent N user/Zephyra exchanges — the sliding
    window that limits what actually gets sent to the LLM."""
    max_messages = max_exchanges * 2
    return history[-max_messages:] if len(history) > max_messages else history