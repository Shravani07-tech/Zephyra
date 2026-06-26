"""
Zephyra — CLI Chatbot Layer
----------------------------
Local-first: runs on Ollama, no API key, no cost, no internet dependency.
Uses LangChain's ChatOllama + PromptTemplate, with persistent memory via memory.py.
"""

import os
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from langchain_core.prompts import PromptTemplate

from memory import load_memory, save_turn, history_to_text

load_dotenv()  # optional: lets you override ZEPHYRA_MODEL without touching code

# --- Config ---------------------------------------------------------------
MODEL_NAME = os.getenv("ZEPHYRA_MODEL", "llama3.2")  # must match a model you've already pulled via `ollama pull`
TEMPERATURE = 0.7

# --- LangChain setup --------------------------------------------------------
llm = ChatOllama(model=MODEL_NAME, temperature=TEMPERATURE)

prompt = PromptTemplate.from_template(
    "You are Zephyra, a sharp, no-fluff AI assistant built by Shravani. "
    "Be direct and useful, skip the filler.\n\n"
    "Conversation so far:\n{history}\n\n"
    "User: {input}\n"
    "Zephyra:"
)


def run_cli() -> None:
    history = load_memory()  # loads from disk now, not an empty list

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

        formatted_prompt = prompt.format(
            history=history_to_text(history),
            input=user_input,
        )

        response = llm.invoke(formatted_prompt)
        reply = response.content

        print(f"Zephyra: {reply}\n")

        save_turn(user_input, reply)
        history.append({"role": "user", "content": user_input})
        history.append({"role": "zephyra", "content": reply})


if __name__ == "__main__":
    run_cli()