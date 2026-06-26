"""
Zephyra — CLI Interface
-------------------------
Thin I/O loop only. All thinking lives in brain.py, all persistence in memory.py.
This file should never grow a single line of LangChain-specific code again.
"""

from brain import think
from memory import load_memory, save_turn


def run_cli() -> None:
    history = load_memory()

    print("Zephyra CLI — type 'quit' or 'exit' to stop.\n")
    if history:
        print(f"(Loaded {len(history) // 2} past exchange(s) from memory.)\n")

    while True:
        user_input = input("You: ").strip()

        if user_input.lower() in {"quit", "exit"}:
            print("Zephyra: Shutting down. Go build something.")
            break
        if not user_input:
            continue

        reply = think(user_input, history)

        print(f"Zephyra: {reply}\n")

        save_turn(user_input, reply)
        history.append({"role": "user", "content": user_input})
        history.append({"role": "zephyra", "content": reply})


if __name__ == "__main__":
    run_cli()