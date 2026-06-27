import json
from pathlib import Path

MEMORY_FILE = Path("data/zephyra_memory.json")

def load_memory():
    if not MEMORY_FILE.exists():
        return []
    try:
        return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

def save_turn(user_input, reply):
    MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    history = load_memory()
    history.append({"role": "user", "content": user_input})
    history.append({"role": "zephyra", "content": reply})
    MEMORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")

def history_to_text(history):
    if not history:
        return "(no prior turns)"
    lines = []
    for turn in history:
        speaker = "User" if turn["role"] == "user" else "Zephyra"
        lines.append(f"{speaker}: {turn['content']}")
    return "\n".join(lines)

def recent_turns(history, max_exchanges=5):
    max_messages = max_exchanges * 2
    return history[-max_messages:] if len(history) > max_messages else history

def clear_memory():
    if MEMORY_FILE.exists():
        MEMORY_FILE.unlink()