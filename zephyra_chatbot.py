"""
Zephyra — CLI Interface
-------------------------
Thin I/O loop + slash-command dispatch. All thinking lives in brain.py,
all persistence in memory.py. Failed LLM calls are NOT saved to memory.
"""

from brain import think, format_error
from memory import load_memory, save_turn, clear_memory
from tools import get_current_time, get_current_date, calculate, get_system_info

MAX_INPUT_LENGTH = 2000

HELP_TEXT = """
Available commands:
  /help          Show this list
  /quit          Exit Zephyra
  /clear         Wipe conversation memory (this session + saved file)
  /history       Show the full stored conversation
  /sessions      Not implemented in v0.1 — multi-session memory is Phase 2
  /time          Current time
  /date          Current date
  /calc <expr>   Basic arithmetic, e.g. /calc 12*4+1
  /sysinfo       CPU and RAM usage
Anything else is sent to Zephyra as a normal message.
""".strip()


def print_history(history: list[dict]) -> None:
    if not history:
        print("(no conversation history yet)")
        return
    for turn in history:
        speaker = "You" if turn["role"] == "user" else "Zephyra"
        print(f"{speaker}: {turn['content']}")


def run_cli() -> None:
    history = load_memory()

    print("Zephyra CLI — type /help for commands, /quit to exit.\n")
    if history:
        print(f"(Loaded {len(history) // 2} past exchange(s) from memory.)\n")

    while True:
        user_input = input("You: ").strip()

        if not user_input:
            continue

        if len(user_input) > MAX_INPUT_LENGTH:
            print(f"Zephyra: That's too long ({len(user_input)} chars) — keep it under {MAX_INPUT_LENGTH}.\n")
            continue

        lower = user_input.lower()

        if lower in {"/quit", "quit", "exit"}:
            print("Zephyra: Shutting down. Go build something.")
            break

        if lower == "/help":
            print(HELP_TEXT + "\n")
            continue

        if lower == "/clear":
            history.clear()
            clear_memory()
            print("Zephyra: Memory wiped — fresh start.\n")
            continue

        if lower == "/history":
            print_history(history)
            print()
            continue

        if lower == "/sessions":
            print("Zephyra: Multi-session support isn't built yet — that's Phase 2. Right now there's one continuous memory.\n")
            continue

        if lower == "/time":
            print(f"Zephyra: {get_current_time()}\n")
            continue

        if lower == "/date":
            print(f"Zephyra: {get_current_date()}\n")
            continue

        if lower.startswith("/calc "):
            print(f"Zephyra: {calculate(user_input[6:].strip())}\n")
            continue

        if lower == "/sysinfo":
            print(f"Zephyra: {get_system_info()}\n")
            continue

        if lower.startswith("/"):
            print(f"Zephyra: Unknown command '{user_input}'. Type /help to see what's available.\n")
            continue

        try:
            reply = think(user_input, history)
        except Exception as e:
            print(f"Zephyra: {format_error(e)}\n")
            continue  # don't save a failed call to memory

        print(f"Zephyra: {reply}\n")

        save_turn(user_input, reply)
        history.append({"role": "user", "content": user_input})
        history.append({"role": "zephyra", "content": reply})


if __name__ == "__main__":
    run_cli()