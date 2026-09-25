import json
from app.agent.state import PlannerState
from app.services.llm import get_llm_provider
from app.services.memory_service import MemoryService
from app.db import get_db

async def handle_memory(state: PlannerState) -> dict:
    """Handle explicit memory operations."""
    user_text = state["user_text"]
    conversation_id = state["conversation_id"]
    
    llm = get_llm_provider()
    
    prompt = (
        "Extract the explicit memory instruction from the user's message.\n"
        "Determine the action: CREATE or DELETE.\n"
        "Determine the category: PREFERENCE, PROJECT, GOAL, ROUTINE, CONSTRAINT, PERSONAL_FACT, IMPORTANT_CONTEXT.\n"
        "Extract the content to remember or forget. The content MUST be just the factual statement from a third-person perspective (e.g. 'User likes red').\n"
        "Do NOT include conversational replies or acknowledgements in the content field.\n"
        "Respond ONLY with a JSON object in this format:\n"
        "{\"action\": \"CREATE|DELETE\", \"category\": \"CATEGORY\", \"content\": \"extracted fact\"}\n\n"
        f"User message: {user_text}"
    )

    messages = [{"role": "user", "content": prompt}]
    
    chunks = []
    async for chunk in llm.stream_chat(messages):
        chunks.append(chunk)
        
    response_text = "".join(chunks).strip()
    
    try:
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        data = json.loads(response_text.strip())
        action = data.get("action", "CREATE").upper()
        category = data.get("category", "PERSONAL_FACT")
        content = data.get("content", "")
        
        db_gen = get_db()
        db = next(db_gen)
        
        mem_service = MemoryService(db)
        
        if action == "CREATE":
            mem_service.create_memory(
                content=content,
                category=category,
                conversation_id=conversation_id,
                user_id="default"
            )
            return {"tool_results": [{"success": True, "action": "CREATE", "message": f"I'll remember that: {content}"}]}
            
        elif action == "DELETE":
            # Search for it and delete
            results = mem_service.search_memories(content, user_id="default", n_results=1)
            if results:
                mem_id = results[0]["metadata"]["memory_id"]
                mem_service.delete_memory(mem_id)
                return {"tool_results": [{"success": True, "action": "DELETE", "message": f"I've forgotten that: {content}"}]}
            else:
                return {"tool_results": [{"success": False, "action": "DELETE", "error": f"I couldn't find any memory matching: {content}"}]}
                
        else:
            return {"tool_results": [{"success": False, "error": "I'm not sure how to handle that memory instruction."}]}
            
    except Exception as e:
        return {"tool_results": [{"success": False, "error": f"Sorry, I had trouble processing that memory instruction: {e}"}]}
