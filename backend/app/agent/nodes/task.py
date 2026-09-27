"""Task node for Zephyra Lite planner."""

import json
import re
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.agent.state import PlannerState
from app.models import Task
from app.services import tasks
from app.services.llm import get_llm_provider

PRIORITIES = ("LOW", "MEDIUM", "HIGH", "URGENT")
STATUSES = ("PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED")

TASK_HELP = (
    "I couldn't work out that task request. Try something like "
    "\"Create a task to buy groceries tomorrow at 6pm with high priority\", "
    "\"List my tasks\", \"Mark the groceries task as done\", or "
    "\"Delete the groceries task\"."
)


# Words that describe the request rather than name the task.
_REFERENCE_STOPWORDS = frozenset(
    {"a", "an", "the", "my", "task", "tasks", "todo", "to-do", "reminder", "item", "one"}
)


# The model sometimes passes the whole request as the reference
# ("Mark the report task as completed"), so operation words are ignored too.
_OPERATION_WORDS = frozenset(
    {"mark", "as", "complete", "completed", "done", "finish", "finished", "delete",
     "remove", "cancel", "update", "change", "set", "please", "it", "priority",
     "low", "medium", "high", "urgent"}
)


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _REFERENCE_STOPWORDS}


def match_tasks(candidates: Sequence[Task], reference: str) -> list[Task]:
    """Tasks whose titles contain every meaningful word of the user's reference.

    Used when an exact substring lookup fails, e.g. "the quarterly report task"
    for a task titled "Submit the quarterly report". Deliberately strict: a
    reference that shares only some words with a title never matches it.
    """
    wanted = _words(reference) - _OPERATION_WORDS
    if not wanted:
        return []
    return [task for task in candidates if wanted <= _words(task.title)]


_EXPLICIT_PRIORITY = re.compile(
    r"\b(urgent|high|medium|low)(?:\s+priority)?\b|\bpriority\s+(?:to\s+|of\s+)?(urgent|high|medium|low)\b",
    re.IGNORECASE,
)


def explicit_priority(user_text: str) -> str | None:
    """A priority the user stated outright ("urgent", "low priority"), if any.

    It overrides the model's reading, which sometimes maps "urgent" to HIGH.
    """
    match = _EXPLICIT_PRIORITY.search(user_text)
    return (match.group(1) or match.group(2)).upper() if match else None


def date_context(now: datetime) -> str:
    """Today's date plus the next week's dates, so relative days map exactly."""
    days = [now + timedelta(days=offset) for offset in range(1, 8)]
    upcoming = ", ".join(f"{d.strftime('%A')} = {d.date().isoformat()}" for d in days)
    return (
        f"The current date and time is {now.isoformat()} ({now.strftime('%A')}).\n"
        f"Upcoming days: {upcoming}.\n"
    )


def _priority(value: object, default: str | None = "MEDIUM") -> str | None:
    text = str(value).strip().upper() if value else ""
    return text if text in PRIORITIES else default


def _status(value: object) -> str | None:
    text = str(value).strip().upper() if value else ""
    return text if text in STATUSES else None


def _due(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None


def _summary(task: Task) -> dict[str, Any]:
    return {
        "id": task.id,
        "title": task.title,
        "priority": task.priority,
        "status": task.status,
        "due_at": task.due_at.isoformat() if task.due_at else None,
    }


def _fmt_due(due_at: str | None) -> str:
    """Wall-clock due time, as the user expressed it (SQLite keeps no offset)."""
    if not due_at:
        return ""
    return f", due {datetime.fromisoformat(due_at).strftime('%a %d %b %Y, %H:%M')}"


def format_task_reply(result: dict[str, Any]) -> str:
    """Deterministic, human-readable reply for a task operation.

    The task result is never handed to the model as JSON, so internal data
    cannot leak into the answer and the reply always matches what happened.
    """
    if not result.get("success"):
        return str(result.get("error") or TASK_HELP)

    op = result.get("operation")
    task = result.get("task") or {}
    title = task.get("title", "")
    if op == "CREATE":
        return (
            f"Created task “{title}” — priority {task['priority'].lower()}"
            f"{_fmt_due(task.get('due_at'))}."
        )
    if op == "COMPLETE":
        return f"Marked “{title}” as completed."
    if op == "DELETE":
        return f"Deleted task “{result.get('deleted', title)}”."
    if op == "UPDATE":
        return (
            f"Updated “{title}” — priority {task['priority'].lower()}"
            f"{_fmt_due(task.get('due_at'))}."
        )
    if op == "LIST":
        found = result.get("tasks") or []
        status = result.get("status_filter")
        qualifier = f"{status.lower().replace('_', ' ')} " if status else ""
        if not found:
            return f"You have no {qualifier}tasks."
        lines = [f"You have {len(found)} {qualifier}task{'s' if len(found) != 1 else ''}:"]
        for t in found:
            lines.append(
                f"- {t['title']} ({t['status'].lower().replace('_', ' ')}, "
                f"{t['priority'].lower()} priority{_fmt_due(t.get('due_at'))})"
            )
        return "\n".join(lines)
    return TASK_HELP


async def handle_task(state: PlannerState, db: Session) -> dict:
    """Process a task operation.

    Tasks are user-level: they are recorded with the conversation they were
    created in, but listed and looked up across all conversations.
    """
    user_text = state["user_text"]
    conversation_id = state["conversation_id"]

    llm = get_llm_provider()

    prompt = (
        "Extract the task operation from the user's message.\n"
        f"{date_context(datetime.now(UTC))}\n"
        "Operations: CREATE, LIST, UPDATE, COMPLETE, DELETE\n"
        "Status values: PENDING, IN_PROGRESS, COMPLETED, CANCELLED\n"
        "Priority values: LOW, MEDIUM, HIGH, URGENT\n\n"
        "For CREATE, the title is a short task name WITHOUT dates, times, or priority "
        "(put those in due_at and priority), e.g. \"Submit the quarterly report\".\n"
        "For UPDATE, COMPLETE, or DELETE, the title is the name of the existing task as the "
        "user refers to it, without the word \"task\".\n\n"
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
        if not isinstance(data, dict):
            raise ValueError("not an object")
    except Exception:
        return {"tool_results": [{"success": False, "error": TASK_HELP}]}

    op = str(data.get("operation", "")).upper()
    title = data.get("title")
    title = str(title).strip()[:255] if title else None

    result: dict[str, Any] = {"success": False, "operation": op}

    try:
        if op == "CREATE":
            if not title:
                result["error"] = "What should the task be called? Please include a title."
            else:
                task = tasks.create_task(
                    db,
                    conversation_id=conversation_id,
                    title=title,
                    description=data.get("description"),
                    priority=explicit_priority(user_text)
                    or _priority(data.get("priority"))
                    or "MEDIUM",
                    due_at=_due(data.get("due_at")),
                )
                result["success"] = True
                result["task"] = _summary(task)

        elif op == "LIST":
            status_filter = _status(data.get("status"))
            found = tasks.list_tasks(db, status=status_filter)
            result["success"] = True
            result["status_filter"] = status_filter
            result["tasks"] = [_summary(t) for t in found]

        elif op in ["UPDATE", "COMPLETE", "DELETE"]:
            if not title:
                result["error"] = "Which task do you mean? Please include its title."
            else:
                found = tasks.find_tasks_by_title(db, title) or match_tasks(
                    tasks.list_tasks(db), title
                )
                if not found:
                    result["error"] = f"I couldn't find a task matching “{title}”."
                elif len(found) > 1:
                    names = ", ".join(f"“{t.title}”" for t in found[:5])
                    result["error"] = (
                        f"Several tasks match “{title}” ({names}). "
                        "Please use the full title."
                    )
                else:
                    task = found[0]
                    if op == "COMPLETE":
                        updated = tasks.complete_task(db, task.id)
                        result["success"] = True
                        result["task"] = _summary(updated)
                    elif op == "DELETE":
                        tasks.delete_task(db, task.id)
                        result["success"] = True
                        result["deleted"] = task.title
                    elif op == "UPDATE":
                        updated = tasks.update_task(
                            db,
                            task.id,
                            priority=explicit_priority(user_text)
                            or _priority(data.get("priority"), default=None),
                            due_at=_due(data.get("due_at")),
                        )
                        result["success"] = True
                        result["task"] = _summary(updated)
        else:
            result["error"] = TASK_HELP

    except Exception:
        result["error"] = "Something went wrong while updating your tasks. Please try again."

    return {"tool_results": [result]}
