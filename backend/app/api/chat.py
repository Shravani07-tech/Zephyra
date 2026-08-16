"""Chat streaming API endpoint."""

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agent.runner import run_turn
from app.db import get_db
from app.schemas import ChatRequest
from app.services import conversation as conv_service
from app.services.llm import (
    LLMAuthenticationError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMUnavailableError,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


def _format_sse(event: str, **kwargs: str) -> bytes:
    """Format event and data dict as an SSE data payload."""
    payload = {"event": event, **kwargs}
    return f"data: {json.dumps(payload)}\n\n".encode()


@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Stream conversation reply using Server-Sent Events (SSE)."""
    # Resolve or create conversation
    if request.conversation_id is not None:
        conv_id = str(request.conversation_id)
        conv = conv_service.get_conversation(db, conv_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
    else:
        new_conv = conv_service.create_conversation(db)
        conv_id = new_conv.id

    async def event_generator() -> AsyncIterator[bytes]:
        try:
            # Yield the conversation ID at the start of the stream
            yield _format_sse("conversation", conversation_id=conv_id)

            # Stream turns from the orchestrator
            async for chunk in run_turn(db, conv_id, request.message):
                yield _format_sse("chunk", text=chunk)

            yield _format_sse("done")

        except LLMAuthenticationError as e:
            yield _format_sse("error", code="AUTHENTICATION_ERROR", detail=str(e))
        except LLMRateLimitError as e:
            yield _format_sse("error", code="RATE_LIMIT_ERROR", detail=str(e))
        except LLMTimeoutError as e:
            yield _format_sse("error", code="TIMEOUT_ERROR", detail=str(e))
        except LLMUnavailableError as e:
            yield _format_sse("error", code="UNAVAILABLE_ERROR", detail=str(e))
        except LLMError as e:
            yield _format_sse("error", code="PROVIDER_ERROR", detail=str(e))
        except Exception as e:
            logger.error("Internal error in chat generator: %s", str(e))
            yield _format_sse("error", code="INTERNAL_ERROR", detail="An internal error occurred")

    return StreamingResponse(event_generator(), media_type="text/event-stream")
