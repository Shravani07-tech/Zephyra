"""Router node for Zephyra Lite planner."""

import json

from app.agent.state import PlannerState
from app.services.llm import get_llm_provider


async def route_intent(state: PlannerState) -> dict:
    """Classify the user intent as CHAT or TASK."""
    user_text = state["user_text"]
    
    # Simple rule-based pre-router
    lower_text = user_text.lower().strip()
    task_keywords = ["task", "remind me", "todo", "to-do"]
    file_keywords = ["file", "document", "pdf", "read", "summarize"]
    
    # Otherwise use LLM
    llm = get_llm_provider()
    
    prompt = (
        "Classify the following user message into exactly one of these intents: "
        "TASK, FILE, MEMORY, or CHAT.\n\n"
        "TASK: The user wants to create, list, update, complete, or delete a task/reminder.\n"
        "FILE: The user is asking a question about a file, document, or uploaded content.\n"
        "MEMORY: The user explicitly tells you to remember something, or forget something about them (e.g. 'Remember I prefer Python', 'Forget my old project'). Do NOT classify retrieval or recall questions (e.g. 'What is my favorite color?', 'What is the project name?') as MEMORY; those must be CHAT.\n"
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
        if intent not in ["CHAT", "TASK", "FILE", "MEMORY"]:
            intent = "CHAT"
    except Exception as e:
        print(f"Router parsing error: {e}, raw text: {response_text}")
        intent = "CHAT"
        
    print(f"Router classified intent: {intent} from text: {response_text}")
    return {"intent": intent}
