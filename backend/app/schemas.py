"""Zephyra Lite — API request and response schemas."""

import json
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


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
    # Server-built structured metadata (e.g. validated research citations).
    # Read from the ORM ``metadata_`` column and exposed as ``metadata``.
    message_metadata: dict[str, Any] | None = Field(
        None,
        validation_alias=AliasChoices("metadata_", "metadata"),
        serialization_alias="metadata",
    )

    @field_validator("message_metadata", mode="before")
    @classmethod
    def _parse_metadata(cls, value: object) -> object:
        if value is None or isinstance(value, dict):
            return value
        try:
            parsed = json.loads(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
        return parsed if isinstance(parsed, dict) else None


class ConversationResponse(BaseModel):
    """Represents a conversation session response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    title: str | None = None


class ConversationDetailResponse(ConversationResponse):
    """Represents a conversation session with its message history."""

    messages: list[MessageResponse]


class ChatRequest(BaseModel):
    """Payload of ``POST /api/chat``."""

    conversation_id: uuid.UUID | None = Field(
        None,
        description="Optional conversation UUID. If omitted, a new conversation is created.",
    )
    message: str | None = Field(
        None,
        max_length=2000,
        description="The chat message content (maximum 2000 characters). Required if retry_message_id is absent.",
    )
    retry_message_id: int | None = Field(
        None,
        description="Optional ID of an existing user message to retry/regenerate.",
    )
