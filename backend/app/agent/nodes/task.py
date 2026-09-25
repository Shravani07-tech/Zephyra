"""Task node for Zephyra Lite planner."""

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.agent.state import PlannerState
from app.services import tasks
from app.services.llm import get_llm_provider


async def handle_task(state: PlannerState, db: Session) -> dict:
    """Process a task operation."""
    user_text = state["user_text"]
    conversation_id = state["conversation_id"]
    
    llm = get_llm_provider()
    
    now_iso = datetime.now(UTC).isoformat()
    
    prompt = (
        "Extract the task operation from the user's message.\n"
        f"The current date and time is {now_iso}.\n\n"
        "Operations: CREATE, LIST, UPDATE, COMPLETE, DELETE\n"
        "Status values: PENDING, IN_PROGRESS, COMPLETED, CANCELLED\n"
        "Priority values: LOW, MEDIUM, HIGH, URGENT\n\n"
        "If deleting, updating, or completing a task, try to extract the exact title mentioned.\n\n"
        "Respond ONLY with a JSON object containing the operation and relevant fields.\n"
        "For CREATE: {\"operation\": \"CREATE\", \"title\": \"...\", \"priority\": \"MEDIUM\", \"due_at\": \"ISO8601 or null\"}\n"
        "For LIST: {\"operation\": \"LIST\", \"status\": \"PENDING\"}\n"
        "For UPDATE: {\"operation\": \"UPDATE\", \"title\": \"...\", \"priority\": \"HIGH\"}\n"
        "For COMPLETE: {\"operation\": \"COMPLETE\", \"title\": \"...\"}\n"
        "For DELETE: {\"operation\": \"DELETE\", \"title\": \"...\"}\n\n"
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
    except Exception:
        # Fallback if unparseable
        return {"tool_results": [{"success": False, "error": "Could not parse task operation."}]}
        
    op = data.get("operation", "").upper()
    title = data.get("title")
    
    result = {"success": False, "operation": op}
    
    try:
        if op == "CREATE":
            if not title:
                result["error"] = "Title is required for creation."
            else:
                due_at_str = data.get("due_at")
                due_at = None
                if due_at_str:
                    try:
                        due_at = datetime.fromisoformat(due_at_str.replace("Z", "+00:00"))
                    except Exception:
                        pass
                        
                task = tasks.create_task(
                    db,
                    conversation_id=conversation_id,
                    title=title,
                    description=data.get("description"),
                    priority=data.get("priority", "MEDIUM").upper(),
                    due_at=due_at
                )
                result["success"] = True
                result["task"] = {"id": task.id, "title": task.title, "priority": task.priority, "status": task.status}
                
        elif op == "LIST":
            status_filter = data.get("status")
            if status_filter:
                status_filter = status_filter.upper()
            found = tasks.list_tasks(db, conversation_id=conversation_id, status=status_filter)
            result["success"] = True
            result["tasks"] = [{"id": t.id, "title": t.title, "status": t.status, "priority": t.priority} for t in found]
            
        elif op in ["UPDATE", "COMPLETE", "DELETE"]:
            if not title:
                result["error"] = "Target task title not provided."
            else:
                found = tasks.find_tasks_by_title(db, title, conversation_id)
                if not found:
                    result["error"] = f"No task found matching '{title}'."
                elif len(found) > 1:
                    result["error"] = f"Multiple tasks found matching '{title}'. Please be more specific."
                else:
                    task = found[0]
                    if op == "COMPLETE":
                        updated = tasks.complete_task(db, task.id)
                        result["success"] = True
                        result["task"] = {"id": updated.id, "title": updated.title, "status": updated.status}
                    elif op == "DELETE":
                        tasks.delete_task(db, task.id)
                        result["success"] = True
                        result["deleted"] = title
                    elif op == "UPDATE":
                        priority = data.get("priority")
                        if priority:
                            priority = priority.upper()
                        
                        due_at_str = data.get("due_at")
                        due_at = None
                        if due_at_str:
                            try:
                                due_at = datetime.fromisoformat(due_at_str.replace("Z", "+00:00"))
                            except Exception:
                                pass
                                
                        updated = tasks.update_task(
                            db, 
                            task.id, 
                            priority=priority,
                            due_at=due_at
                        )
                        result["success"] = True
                        result["task"] = {"id": updated.id, "title": updated.title, "priority": updated.priority}
                        
    except Exception as e:
        result["error"] = str(e)

    return {"tool_results": [result]}
