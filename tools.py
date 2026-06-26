"""
Zephyra — Tools Layer (v0.1: plain callable functions)
----------------------------------------------------------
These are NOT LLM-driven agent tools. No function-calling, no LLM deciding
which tool to use — that's explicit Phase 2 scope (LangChain tool-calling/
agent logic, per your own roadmap). This is just plain Python functions,
routed by dumb keyword matching in try_handle_with_tool().

Known limitation, on purpose: keyword matching misses paraphrases. "what time
is it" matches; "what is today date" does NOT match get_current_date() with
the matcher below as written. That's not a bug to quietly patch — it's the
exact reason real agentic tool-calling exists. Keyword matching has a hard
ceiling; an LLM deciding intent doesn't. Feel that ceiling now, fix it properly
in Phase 2, not by adding fifty more if-statements today.
"""

import datetime


def get_current_time() -> str:
    """Return the current time as a readable string."""
    return datetime.datetime.now().strftime("%I:%M %p")


def get_current_date() -> str:
    """Return today's date as a readable string."""
    return datetime.datetime.now().strftime("%A, %B %d, %Y")


def calculate(expression: str) -> str:
    """
    Safely evaluate a basic arithmetic expression (+, -, *, /, parentheses).
    Returns a plain-text error instead of crashing on bad or unsafe input.
    """
    allowed_chars = set("0123456789+-*/(). ")
    if not expression or not set(expression) <= allowed_chars:
        return "I can only do basic arithmetic (+, -, *, /) — that input has something else in it."
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception:
        return "That expression didn't evaluate cleanly — check it and try again."


def try_handle_with_tool(user_input: str) -> str | None:
    """
    Dumb keyword router. Returns a tool's answer if the input matches a known
    command, otherwise None (meaning: let the LLM in brain.py handle it instead).
    """
    text = user_input.lower().strip()

    if "what time" in text or text in {"time", "current time"}:
        return get_current_time()

    if "what date" in text or "today's date" in text or text in {"date", "current date"}:
        return get_current_date()

    if text.startswith("calculate ") or text.startswith("calc "):
        expression = text.split(" ", 1)[1]
        return calculate(expression)

    return None