"""Zephyra Lite — LangGraph state definitions."""

from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage


class PlannerState(TypedDict):
    """The graph state for the ZEphyra orchestration planner."""
    
    # Input
    conversation_id: str
    user_text: str
    recent_history: list[dict[str, str]]
    
    # Router decisions
    intent: str | None
    
    # Tool outcomes
    tool_results: list[dict[str, Any]]
    
    # The final streamed chunk generator
    response_generator: Any | None
