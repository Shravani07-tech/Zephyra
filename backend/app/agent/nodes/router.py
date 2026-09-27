"""Router node for Zephyra Lite planner."""

import json
import re

from app.agent.state import PlannerState
from app.services.llm import get_llm_provider

_RESEARCH_CLAUSE = (
    r"\b(?:research|look\s+up|search\s+(?:the\s+web\s+|online\s+)?for|"
    r"find\s+(?:out|info(?:rmation)?)\s+(?:about|on))\b"
)
_TASK_CLAUSE = (
    r"\b(?:remind\s+me|set\s+(?:a\s+)?reminder|"
    r"(?:create|add|make)\s+(?:a\s+|an\s+)?(?:task|reminder|to-?do|goal)|"
    r"add\s+(?:it|this|that|them|[^.?!]{0,60}?)\s+(?:to|as)\s+(?:my\s+|a\s+)?"
    r"(?:tasks?|to-?dos?|to-?do\s+list|goals?|list|reminders?))\b"
)
_JOIN = r"\b(?:and|then|also)\b|[,;&]"
_COMPOUND_RESEARCH_TASK = re.compile(
    rf"{_RESEARCH_CLAUSE}.*?(?:{_JOIN}).*?{_TASK_CLAUSE}"
    rf"|{_TASK_CLAUSE}.*?(?:{_JOIN}).*?{_RESEARCH_CLAUSE}",
    re.IGNORECASE | re.DOTALL,
)


# Unambiguous research requests: an explicit web search, or a message that opens
# with a research verb. Anything subtler is left to the LLM classifier.
_EXPLICIT_RESEARCH = re.compile(
    r"\b(?:search|look\s+(?:it\s+|this\s+|that\s+)?up)\s+(?:on\s+)?(?:the\s+)?(?:web|online|internet)\b"
    r"|^\s*(?:please\s+)?(?:research|look\s+up|google)\b",
    re.IGNORECASE,
)


def is_explicit_research(text: str) -> bool:
    """Deterministically detect explicit web-research requests.

    These must never be misrouted to CHAT, which would answer from general
    model knowledge instead of searching.
    """
    return bool(_EXPLICIT_RESEARCH.search(text))


def is_compound_research_task(text: str) -> bool:
    """Deterministically detect 'research X and add/remind ...' style requests.

    Both clauses must be joined by a conjunction, so a single task such as
    "remind me to research Apple" is not treated as compound.
    """
    return bool(_COMPOUND_RESEARCH_TASK.search(text))


async def route_intent(state: PlannerState) -> dict:
    """Classify the user intent into one planner route."""
    user_text = state["user_text"]

    # Compound requests must never be split or partially executed, so they are
    # caught before the LLM classifier can reduce them to a single intent.
    if is_compound_research_task(user_text):
        return {"intent": "COMPOUND_RESEARCH_TASK"}
    if is_explicit_research(user_text):
        return {"intent": "RESEARCH"}

    # Simple rule-based pre-router
    lower_text = user_text.lower().strip()
    task_keywords = ["task", "remind me", "todo", "to-do"]
    file_keywords = ["file", "document", "pdf", "read", "summarize"]
    
    # Otherwise use LLM
    llm = get_llm_provider()
    
    prompt = (
        "Classify the following user message into exactly one of these intents: "
        "TASK, FILE, MEMORY, RESEARCH, COMPOUND_RESEARCH_TASK, or CHAT.\n\n"
        "TASK: The user wants to create, list, update, complete, or delete a task/reminder.\n"
        "FILE: The user is asking a question about a file, document, or uploaded content.\n"
        "MEMORY: The user explicitly tells you to remember something, or forget something about them (e.g. 'Remember I prefer Python', 'Forget my old project'). Do NOT classify retrieval or recall questions (e.g. 'What is my favorite color?', 'What is the project name?') as MEMORY; those must be CHAT.\n"
        "RESEARCH: The user explicitly asks to search the web / look something up online, "
        "or needs current, recent, or live information (news, prices, releases, events "
        "after your training data). Questions about history, science, definitions, "
        "explanations, summaries of well-known topics, and writing requests "
        "(essays, stories, poems) are CHAT, even if they mention a topic in depth.\n"
        "COMPOUND_RESEARCH_TASK: The user asks to BOTH research a topic AND create a "
        "task/reminder (e.g., 'Research X and remind me tomorrow').\n"
        "CHAT: The user is asking a general question, seeking explanation, or making conversation.\n\n"
        "Respond ONLY with a JSON object in this exact format: {\"intent\": \"INTENT_NAME\"}\n\n"
        f"User message: {user_text}"
    )

    messages = [{"role": "user", "content": prompt}]
    
    chunks = []
    async for chunk in llm.stream_chat(messages):
        chunks.append(chunk)
        
    response_text = "".join(chunks).strip()
    
    try:
        # Strip markdown code blocks if the model returned them
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        data = json.loads(response_text.strip())
        intent = data.get("intent", "CHAT").upper()
        if intent not in ["CHAT", "TASK", "FILE", "MEMORY", "RESEARCH", "COMPOUND_RESEARCH_TASK"]:
            intent = "CHAT"
    except Exception as e:
        print(f"Router parsing error: {e}, raw text: {response_text}")
        intent = "CHAT"
        
    print(f"Router classified intent: {intent} from text: {response_text}")
    return {"intent": intent}
