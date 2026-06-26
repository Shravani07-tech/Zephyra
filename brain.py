"""
Zephyra — Brain Layer (v0.1)
-----------------------------
The "thinking" core: wraps the LLM + prompt logic so any interface (CLI now,
Streamlit/voice later) can call think() without touching LangChain internals.
This is also the seam where tools.py plugs in later — think() is where
tool-calling decisions will eventually live.
"""

import os
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from langchain_core.prompts import PromptTemplate

from memory import history_to_text

load_dotenv()

MODEL_NAME = os.getenv("ZEPHYRA_MODEL", "llama3.2")  # must match a model you've pulled via `ollama pull`
TEMPERATURE = 0.7

_llm = ChatOllama(model=MODEL_NAME, temperature=TEMPERATURE)

_prompt = PromptTemplate.from_template(
    "You are Zephyra, a sharp, no-fluff AI assistant built by Shravani. "
    "Be direct and useful, skip the filler.\n\n"
    "Conversation so far:\n{history}\n\n"
    "User: {input}\n"
    "Zephyra:"
)


def think(user_input: str, history: list[dict]) -> str:
    """
    Take the user's message + conversation history, return Zephyra's reply.
    Everything that touches the LLM directly lives here and only here.
    """
    formatted_prompt = _prompt.format(
        history=history_to_text(history),
        input=user_input,
    )
    response = _llm.invoke(formatted_prompt)
    return response.content