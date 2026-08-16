"""Conversation history and management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import ConversationResponse, MessageResponse
from app.services import conversation as conv_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationResponse])
def get_conversations(db: Session = Depends(get_db)) -> list[ConversationResponse]:
    """List all conversations ordered by creation date."""
    convs = conv_service.list_conversations(db)
    return [ConversationResponse.model_validate(c) for c in convs]


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def get_conversation_messages(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[MessageResponse]:
    """Retrieve all messages for a specific conversation session."""
    conv_id = str(conversation_id)
    conv = conv_service.get_conversation(db, conv_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    messages = conv_service.get_messages(db, conv_id)
    return [MessageResponse.model_validate(m) for m in messages]


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    """Delete a conversation thread and all its messages."""
    conv_id = str(conversation_id)
    deleted = conv_service.delete_conversation(db, conv_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return None
