"""
Zephyra — Brain Layer (v0.1)
-----------------------------
The "thinking" core. Supports two LLM backends via ZEPHYRA_LLM_PROVIDER:
  - "ollama" (default) — local-first, used by your CLI on your own machine.
  - "groq"             — cloud, used only by the deployed Streamlit demo,
                          since Streamlit Community Cloud has no access to
                          your local Ollama instance.
"""

import os
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate

from memory import history_to_text, recent_turns
from tools import try_handle_with_tool

load_dotenv()

LLM_PROVIDER = os.getenv("ZEPHYRA_LLM_PROVIDER", "ollama")
TEMPERATURE = 0.7
MEMORY_WINDOW = 5  # how many past exchanges get sent to the model each turn

if LLM_PROVIDER == "groq":
    from langchain_groq import ChatGroq
    MODEL_NAME = os.getenv("ZEPHYRA_MODEL", "openai/gpt-oss-20b")
    _llm = ChatGroq(model=MODEL_NAME, temperature=TEMPERATURE)
else:
    from langchain_ollama import ChatOllama
    MODEL_NAME = os.getenv("ZEPHYRA_MODEL", "llama3.2")
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
    Checks tools.py first, windows history to the last MEMORY_WINDOW
    exchanges, then falls back to the LLM.
    """
    tool_reply = try_handle_with_tool(user_input)
    if tool_reply is not None:
        return tool_reply

    windowed_history = recent_turns(history, max_exchanges=MEMORY_WINDOW)
    formatted_prompt = _prompt.format(
        history=history_to_text(windowed_history),
        input=user_input,
    )
    response = _llm.invoke(formatted_prompt)
    return response.content