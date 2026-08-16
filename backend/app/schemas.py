"""Zephyra Lite — API request and response schemas."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Body of ``GET /api/health``."""

    status: Literal["ok"]


class SystemStatusResponse(BaseModel):
    """Safe system status metadata metadata response."""

    provider: str
    model: str
    status: str


class MessageResponse(BaseModel):
    """Represents a chat message response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: str
    role: str
    content: str
    created_at: datetime


class ConversationResponse(BaseModel):
    """Represents a conversation session response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class ConversationDetailResponse(ConversationResponse):
    """Represents a conversation session with its message history."""

    messages: list[MessageResponse]


class ChatRequest(BaseModel):
    """Payload of ``POST /api/chat``."""

    conversation_id: uuid.UUID | None = Field(
        None,
        description="Optional conversation UUID. If omitted, a new conversation is created.",
    )
    message: str = Field(
        ...,
        max_length=2000,
        description="The chat message content (maximum 2000 characters).",
    )
