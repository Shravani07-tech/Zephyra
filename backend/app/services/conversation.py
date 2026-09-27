"""Service layer for conversation database persistence."""

from sqlalchemy.orm import Session

from app.models import Conversation, Message
from app.services.titles import title_for


def create_conversation(db: Session) -> Conversation:
    """Create a new conversation session."""
    conv = Conversation()
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, conversation_id: str) -> Conversation | None:
    """Retrieve a single conversation by its ID."""
    return db.query(Conversation).filter(Conversation.id == conversation_id).first()


def get_message(db: Session, message_id: int) -> Message | None:
    """Retrieve a single message by its ID."""
    return db.query(Message).filter(Message.id == message_id).first()


def list_conversations(db: Session) -> list[Conversation]:
    """Retrieve all conversations, ordered by created_at descending.

    Conversations created before titles existed are titled here once, from
    their first meaningful user message. Only a missing title is filled in.
    """
    convs = db.query(Conversation).order_by(Conversation.created_at.desc()).all()
    backfilled = False
    for conv in convs:
        if conv.title is None:
            for msg in conv.messages:
                title = title_for(msg.content) if msg.role == "user" else None
                if title:
                    conv.title = title
                    backfilled = True
                    break
    if backfilled:
        db.commit()
    return convs


def append_message(db: Session, conversation_id: str, role: str, content: str, metadata: str | None = None) -> Message:
    """Append a new user or assistant message to the database.

    The first meaningful user message also titles an untitled conversation;
    an existing title is never replaced.
    """
    message = Message(conversation_id=conversation_id, role=role, content=content, metadata_=metadata)
    db.add(message)
    if role == "user":
        conv = get_conversation(db, conversation_id)
        if conv is not None and conv.title is None:
            conv.title = title_for(content)
    db.commit()
    db.refresh(message)
    return message


def get_messages(db: Session, conversation_id: str) -> list[Message]:
    """Retrieve all messages for a specific conversation in chronological order."""
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.asc())
        .all()
    )


def delete_conversation(db: Session, conversation_id: str) -> bool:
    """Delete a conversation, its messages, and its attached files.

    Files are removed through the File Assistant so shared vectors and stored
    files are only deleted once no other conversation uses them. Tasks and
    memories are user-level and are kept.
    """
    conv = get_conversation(db, conversation_id)
    if not conv:
        return False
    from app.files.service import delete_file, list_files

    for doc in list_files(db, conversation_id):
        delete_file(db, doc.id)
    db.delete(conv)
    db.commit()
    return True
