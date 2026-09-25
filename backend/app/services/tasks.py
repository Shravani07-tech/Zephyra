"""Zephyra Lite — Task service."""

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task


def create_task(
    db: Session,
    conversation_id: str | None,
    title: str,
    description: str | None = None,
    priority: str = "MEDIUM",
    due_at: datetime | None = None,
) -> Task:
    """Create a new task."""
    task = Task(
        conversation_id=conversation_id,
        title=title,
        description=description,
        priority=priority,
        due_at=due_at,
        status="PENDING",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_task(db: Session, task_id: str) -> Task | None:
    """Get a task by ID."""
    return db.execute(select(Task).where(Task.id == task_id)).scalar_one_or_none()


def list_tasks(db: Session, conversation_id: str | None = None, status: str | None = None) -> Sequence[Task]:
    """List tasks, optionally filtered by conversation_id or status."""
    stmt = select(Task)
    # Even without auth, tasks could be globally isolated or conversation-tied.
    # We will let the planner query all if needed, or filter if provided.
    if conversation_id is not None:
        stmt = stmt.where(Task.conversation_id == conversation_id)
    if status is not None:
        stmt = stmt.where(Task.status == status)
    
    stmt = stmt.order_by(Task.created_at.desc())
    return db.execute(stmt).scalars().all()


def update_task(
    db: Session,
    task_id: str,
    title: str | None = None,
    description: str | None = None,
    priority: str | None = None,
    due_at: datetime | None = None,
) -> Task | None:
    """Update a task's properties."""
    task = get_task(db, task_id)
    if not task:
        return None
    
    if title is not None:
        task.title = title
    if description is not None:
        task.description = description
    if priority is not None:
        task.priority = priority
    if due_at is not None:
        task.due_at = due_at

    db.commit()
    db.refresh(task)
    return task


def complete_task(db: Session, task_id: str) -> Task | None:
    """Mark a task as COMPLETED."""
    task = get_task(db, task_id)
    if not task:
        return None
    task.status = "COMPLETED"
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: str) -> bool:
    """Delete a task."""
    task = get_task(db, task_id)
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def find_tasks_by_title(db: Session, title: str, conversation_id: str | None = None) -> Sequence[Task]:
    """Find tasks by a case-insensitive exact or partial title match."""
    stmt = select(Task).where(Task.title.ilike(f"%{title}%"))
    if conversation_id:
        stmt = stmt.where(Task.conversation_id == conversation_id)
    return db.execute(stmt).scalars().all()
