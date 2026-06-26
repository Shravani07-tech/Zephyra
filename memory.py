"""
Zephyra — Memory Layer (v0.1: persistent episodic log)
---------------------------------------------------------
This is NOT the full four-layer memory system from the Zephyra architecture doc
(working / episodic / semantic / procedural). This is step one: a flat,
persistent conversation log so Zephyra remembers past sessions, not just the
current run. Summarization, semantic search, and procedural memory are Phase 2.

Known limitation (be aware, don't "fix" it yet): this loads the FULL history
into every prompt with no truncation. Fine for now, will choke once the log
gets long — that's exactly the problem semantic memory is meant to solve later.
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