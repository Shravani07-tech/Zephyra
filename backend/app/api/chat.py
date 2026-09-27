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
from app.services.research import ResearchUnavailableError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


def _format_sse(event: str, **kwargs: object) -> bytes:
    """Format event and data dict as an SSE data payload."""
    payload = {"event": event, **kwargs}
    return f"data: {json.dumps(payload)}\n\n".encode()


@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Stream conversation reply using Server-Sent Events (SSE)."""
    skip_user_append = False
    user_text: str | None = request.message

    if request.retry_message_id is not None:
        if request.conversation_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="conversation_id is required when retry_message_id is supplied",
            )
        conv_id = str(request.conversation_id)
        conv = conv_service.get_conversation(db, conv_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        target_msg = conv_service.get_message(db, request.retry_message_id)
        if not target_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target message for retry not found",
            )
        if target_msg.role != "user":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot retry non-user message",
            )
        if str(target_msg.conversation_id) != conv_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message does not belong to the specified conversation",
            )
        skip_user_append = True
        user_text = target_msg.content
    else:
        if not request.message or not request.message.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Message is required for a new turn",
            )
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
            async for chunk in run_turn(
                db,
                conv_id,
                user_text,
                skip_user_append=skip_user_append,
            ):
                if isinstance(chunk, dict):
                    if chunk.get("type") == "citations":
                        yield _format_sse("citations", research=chunk.get("data"))
                else:
                    yield _format_sse("chunk", text=chunk)

            yield _format_sse("done")

        except ResearchUnavailableError as e:
            yield _format_sse(
                "error", code="RESEARCH_UNAVAILABLE", reason=e.reason, detail=e.message
            )
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
