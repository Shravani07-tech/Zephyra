"""Tests for Zephyra Lite Milestone 1 features."""

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Never
from unittest.mock import AsyncMock, MagicMock, patch

import openai
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db import Base, get_db
from app.main import create_app
from app.models import Message
from app.services import conversation as conv_service
from app.services.llm import (
    LLMAuthenticationError,
    LLMRateLimitError,
    LLMService,
    LLMTimeoutError,
    LLMUnavailableError,
)
from app.services.memory import window as memory_window


# Mock SQLite database fixture for isolated testing
@pytest.fixture(name="db_session")
def fixture_db_session() -> Session:
    """Provide an in-memory SQLite database session."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(name="client")
def fixture_client(db_session: Session) -> TestClient:
    """FastAPI TestClient with overridden get_db dependency."""
    settings = Settings(database_url="sqlite:///:memory:", nvidia_api_key="mock_key")
    app = create_app(settings)

    def override_get_db() -> Session:
        return db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client


# Mock async stream helper
async def mock_stream_success(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    """Simulate successful stream yielding chunks."""
    yield "Hello"
    yield " "
    yield "human"
    yield "!"


async def mock_stream_fail(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    """Simulate stream failure by raising LLMAuthenticationError."""
    if False:
        yield ""
    raise LLMAuthenticationError("Simulated authentication error")


def test_health_endpoint(client: TestClient) -> None:
    """Verify health endpoint still works and returns exact ok contract."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_delete_conversation(db_session: Session) -> None:
    """Verify conversation service creation, retrieval, and delete lifecycle."""
    # Create conversation
    conv = conv_service.create_conversation(db_session)
    assert conv.id is not None
    assert isinstance(conv.id, str)

    # Add messages
    msg1 = conv_service.append_message(db_session, conv.id, "user", "Hello")
    msg2 = conv_service.append_message(db_session, conv.id, "assistant", "Hi there")

    assert msg1.conversation_id == conv.id
    assert msg2.conversation_id == conv.id

    # Retrieve messages
    messages = conv_service.get_messages(db_session, conv.id)
    assert len(messages) == 2
    assert messages[0].content == "Hello"
    assert messages[1].content == "Hi there"

    # Delete conversation
    success = conv_service.delete_conversation(db_session, conv.id)
    assert success is True

    # Retrieve again (should be empty/deleted)
    conv_retrieved = conv_service.get_conversation(db_session, conv.id)
    assert conv_retrieved is None


def test_recent_turns_memory_window() -> None:
    """Verify memory window correctly trims history to maximum of 5 exchanges."""
    messages = [
        Message(role="user" if i % 2 == 0 else "assistant", content=f"Msg {i}")
        for i in range(15)
    ]
    # 5 exchanges = 10 messages max
    window = memory_window.recent_turns(messages, max_exchanges=5)
    assert len(window) == 10
    # verify it kept the last 10 messages (index 5 to 14)
    assert window[0]["content"] == "Msg 5"
    assert window[-1]["content"] == "Msg 14"

    # Less than 10 messages should return all of them
    small_messages = [Message(role="user", content="Hello")]
    small_window = memory_window.recent_turns(small_messages, max_exchanges=5)
    assert len(small_window) == 1
    assert small_window[0]["content"] == "Hello"


def test_malformed_uuid_rejection(client: TestClient) -> None:
    """Verify malformed conversation_id returns 422 validation error."""
    response = client.post("/api/chat", json={"conversation_id": "not-a-uuid", "message": "Hi"})
    assert response.status_code == 422


def test_max_character_message_rejection(client: TestClient) -> None:
    """Verify messages >2000 characters are rejected with a 422 validation error."""
    long_msg = "a" * 2001
    response = client.post("/api/chat", json={"message": long_msg})
    assert response.status_code == 422


@patch("app.agent.runner.LLMService")
def test_new_conversation_when_id_omitted(
    mock_llm_service_class: MagicMock, client: TestClient
) -> None:
    """Verify omitting conversation_id creates a new conversation and streams it."""
    # Mock LLM stream response
    mock_instance = mock_llm_service_class.return_value
    mock_instance.stream_chat = mock_stream_success

    response = client.post("/api/chat", json={"message": "Initialize chat"})
    assert response.status_code == 200

    # Read SSE lines
    lines = response.text.split("\n\n")
    events = [json.loads(line[6:]) for line in lines if line.startswith("data: ")]

    # Check first event is conversation creation
    assert events[0]["event"] == "conversation"
    new_conv_id = events[0]["conversation_id"]
    assert uuid.UUID(new_conv_id)  # Should be a valid UUID

    # Check content chunks and done event
    assert events[1]["event"] == "chunk"
    assert events[1]["text"] == "Hello"
    assert events[-1]["event"] == "done"


@patch("app.agent.runner.LLMService")
def test_stream_success_persists_assistant_message(
    mock_llm_service_class: MagicMock, client: TestClient, db_session: Session
) -> None:
    """Verify successful streaming persists the complete assistant response in DB."""
    mock_instance = mock_llm_service_class.return_value
    mock_instance.stream_chat = mock_stream_success

    conv = conv_service.create_conversation(db_session)

    response = client.post(
        "/api/chat", json={"conversation_id": conv.id, "message": "Test persistence"}
    )
    assert response.status_code == 200

    # Ensure response streamed completely
    assert "done" in response.text

    # Verify messages in DB
    messages = conv_service.get_messages(db_session, conv.id)
    assert len(messages) == 2
    assert messages[0].role == "user"
    assert messages[0].content == "Test persistence"
    assert messages[1].role == "assistant"
    assert messages[1].content == "Hello human!"


@patch("app.agent.runner.LLMService")
def test_stream_failure_does_not_persist_assistant_message(
    mock_llm_service_class: MagicMock, client: TestClient, db_session: Session
) -> None:
    """Verify failing provider calls do not persist assistant messages in DB."""
    mock_instance = mock_llm_service_class.return_value
    mock_instance.stream_chat = mock_stream_fail

    conv = conv_service.create_conversation(db_session)

    response = client.post(
        "/api/chat", json={"conversation_id": conv.id, "message": "Trigger error"}
    )
    assert response.status_code == 200

    # The stream should contain the error event
    assert "AUTHENTICATION_ERROR" in response.text

    # Verify user message was saved, but NO assistant message was saved
    messages = conv_service.get_messages(db_session, conv.id)
    assert len(messages) == 1
    assert messages[0].role == "user"
    assert messages[0].content == "Trigger error"


def test_conversations_api_endpoints(client: TestClient, db_session: Session) -> None:
    """Verify conversations listing, messages fetching, and deletion API routes."""
    # Seed DB
    conv1 = conv_service.create_conversation(db_session)
    conv2 = conv_service.create_conversation(db_session)
    conv_service.append_message(db_session, conv1.id, "user", "Message for first conv")

    # 1. GET /api/conversations
    response = client.get("/api/conversations")
    assert response.status_code == 200
    conv_list = response.json()
    assert len(conv_list) == 2
    ids = [c["id"] for c in conv_list]
    assert conv1.id in ids
    assert conv2.id in ids

    # 2. GET /api/conversations/{id}/messages
    response = client.get(f"/api/conversations/{conv1.id}/messages")
    assert response.status_code == 200
    msg_list = response.json()
    assert len(msg_list) == 1
    assert msg_list[0]["content"] == "Message for first conv"

    # GET messages of missing conversation
    random_uuid = str(uuid.uuid4())
    response = client.get(f"/api/conversations/{random_uuid}/messages")
    assert response.status_code == 404

    # 3. DELETE /api/conversations/{id}
    response = client.delete(f"/api/conversations/{conv1.id}")
    assert response.status_code == 204

    # Confirm deleted
    response = client.get(f"/api/conversations/{conv1.id}/messages")
    assert response.status_code == 404


def test_llm_service_error_mapping() -> None:
    """Verify LLMService correctly maps openai exceptions to custom app exceptions."""
    async def run_test() -> None:
        service = LLMService(api_key="mock_key")

        # Helper function to mock openai raise
        async def mock_raise_auth(*args, **kwargs) -> Never:  # type: ignore[no-untyped-def]
            raise openai.AuthenticationError(
                message="Auth failed", response=MagicMock(status_code=401), body=None
            )

        async def mock_raise_rate(*args, **kwargs) -> Never:  # type: ignore[no-untyped-def]
            raise openai.RateLimitError(
                message="Rate limit exceeded", response=MagicMock(status_code=429), body=None
            )

        async def mock_raise_timeout(*args, **kwargs) -> Never:  # type: ignore[no-untyped-def]
            raise openai.APITimeoutError(request=MagicMock())

        async def mock_raise_status_503(*args, **kwargs) -> Never:  # type: ignore[no-untyped-def]
            raise openai.APIStatusError(
                message="Unavailable", response=MagicMock(status_code=503), body=None
            )

        # Mock chat.completions.create
        service.client.chat.completions.create = AsyncMock()

        # Verify AuthenticationError mapping
        service.client.chat.completions.create.side_effect = mock_raise_auth
        with pytest.raises(LLMAuthenticationError):
            async for _ in service.stream_chat([{"role": "user", "content": "Hi"}]):
                pass

        # Verify RateLimitError mapping
        service.client.chat.completions.create.side_effect = mock_raise_rate
        with pytest.raises(LLMRateLimitError):
            async for _ in service.stream_chat([{"role": "user", "content": "Hi"}]):
                pass

        # Verify APITimeoutError mapping
        service.client.chat.completions.create.side_effect = mock_raise_timeout
        with pytest.raises(LLMTimeoutError):
            async for _ in service.stream_chat([{"role": "user", "content": "Hi"}]):
                pass

        # Verify APIStatusError (503) mapping
        service.client.chat.completions.create.side_effect = mock_raise_status_503
        with pytest.raises(LLMUnavailableError):
            async for _ in service.stream_chat([{"role": "user", "content": "Hi"}]):
                pass

    asyncio.run(run_test())
