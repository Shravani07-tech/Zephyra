"""Provider routing (NVIDIA primary, Ollama fallback) and conversation titles."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Iterator
from unittest.mock import AsyncMock, patch

import httpx
import openai
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.db import Base, ensure_added_columns, get_db
from app.main import create_app
from app.models import Conversation, Message
from app.services import conversation as conv_service
from app.services.llm import (
    LLMAuthenticationError,
    LLMConnectionError,
    LLMUnavailableError,
    NvidiaProvider,
    OllamaProvider,
    RoutedLLMProvider,
    get_llm_provider,
    routing,
)
from app.services.titles import generate_title, title_for

FAKE_KEY = "nvapi-test-not-a-real-key-000000"


class FakeProvider:
    """Scripted provider: yields ``reply`` then optionally raises ``error``."""

    def __init__(self, name: str, reply: list[str], error: Exception | None = None) -> None:
        self.provider_name = name
        self.model_name = f"{name.lower()}-model"
        self.reply = reply
        self.error = error
        self.calls = 0

    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        self.calls += 1
        for part in self.reply:
            yield part
        if self.error is not None:
            raise self.error


def collect(provider: RoutedLLMProvider) -> list[str]:
    async def run() -> list[str]:
        return [c async for c in provider.stream_chat([{"role": "user", "content": "hi"}])]

    return asyncio.run(run())


@pytest.fixture(autouse=True)
def _routing_state(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    routing.reset_health()
    monkeypatch.setattr(get_settings(), "nvidia_api_key", FAKE_KEY)
    yield
    routing.reset_health()


# --- provider routing -------------------------------------------------------


def test_nvidia_selected_when_configured_and_available() -> None:
    nvidia = FakeProvider("NVIDIA", ["Hi", " there"])
    ollama = FakeProvider("Ollama", ["local"])
    router = RoutedLLMProvider(primary=nvidia, fallback=ollama)  # type: ignore[arg-type]
    assert router.provider_name == "NVIDIA"
    assert collect(router) == ["Hi", " there"]
    assert router.reason == routing.NVIDIA_PRIMARY
    assert ollama.calls == 0


def test_ollama_selected_when_nvidia_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "nvidia_api_key", None)
    nvidia = FakeProvider("NVIDIA", ["cloud"])
    ollama = FakeProvider("Ollama", ["local"])
    router = RoutedLLMProvider(primary=nvidia, fallback=ollama)  # type: ignore[arg-type]
    assert router.provider_name == "Ollama"
    assert collect(router) == ["local"]
    assert router.reason == routing.OLLAMA_UNCONFIGURED
    assert nvidia.calls == 0


def test_offline_falls_back_to_ollama_and_is_cached() -> None:
    nvidia = FakeProvider("NVIDIA", [], LLMConnectionError("unreachable"))
    ollama = FakeProvider("Ollama", ["local reply"])
    router = RoutedLLMProvider(primary=nvidia, fallback=ollama)  # type: ignore[arg-type]
    assert collect(router) == ["local reply"]
    assert router.reason == routing.OLLAMA_OFFLINE
    assert router.provider_name == "Ollama"

    # The next turn goes straight to Ollama: no repeated wait on NVIDIA.
    second = RoutedLLMProvider(primary=nvidia, fallback=ollama)  # type: ignore[arg-type]
    assert second.provider_name == "Ollama"
    assert collect(second) == ["local reply"]
    assert nvidia.calls == 1


def test_nvidia_is_retried_after_the_health_ttl(monkeypatch: pytest.MonkeyPatch) -> None:
    clock = [1000.0]
    monkeypatch.setattr(routing.time, "monotonic", lambda: clock[0])
    failing = FakeProvider("NVIDIA", [], LLMUnavailableError("503"))
    ollama = FakeProvider("Ollama", ["local"])
    collect(RoutedLLMProvider(primary=failing, fallback=ollama))  # type: ignore[arg-type]
    assert routing.select_reason() == routing.OLLAMA_FALLBACK

    clock[0] += get_settings().provider_health_ttl_seconds + 1
    healthy = FakeProvider("NVIDIA", ["back"])
    router = RoutedLLMProvider(primary=healthy, fallback=ollama)  # type: ignore[arg-type]
    assert collect(router) == ["back"]
    assert router.reason == routing.NVIDIA_PRIMARY


@pytest.mark.parametrize(
    "error", [LLMAuthenticationError("401"), LLMUnavailableError("503")]
)
def test_provider_failure_falls_back_to_ollama(error: Exception) -> None:
    nvidia = FakeProvider("NVIDIA", [], error)
    ollama = FakeProvider("Ollama", ["local"])
    router = RoutedLLMProvider(primary=nvidia, fallback=ollama)  # type: ignore[arg-type]
    assert collect(router) == ["local"]
    assert router.reason == routing.OLLAMA_FALLBACK


def test_failure_after_partial_output_is_not_spliced_with_a_second_reply() -> None:
    nvidia = FakeProvider("NVIDIA", ["Half a "], LLMUnavailableError("dropped"))
    ollama = FakeProvider("Ollama", ["whole other reply"])
    router = RoutedLLMProvider(primary=nvidia, fallback=ollama)  # type: ignore[arg-type]
    with pytest.raises(LLMUnavailableError):
        collect(router)
    assert ollama.calls == 0


def test_factory_modes() -> None:
    settings = get_settings()
    original = settings.llm_provider
    try:
        settings.llm_provider = "auto"
        assert isinstance(get_llm_provider(), RoutedLLMProvider)
        settings.llm_provider = "nvidia"
        assert isinstance(get_llm_provider(), NvidiaProvider)
        settings.llm_provider = "ollama"
        assert isinstance(get_llm_provider(), OllamaProvider)
    finally:
        settings.llm_provider = original
    assert Settings.model_fields["llm_provider"].default == "auto"


def test_tavily_is_not_an_llm_provider() -> None:
    with pytest.raises(ValueError):
        get_llm_provider("tavily")


def test_nvidia_connection_error_maps_to_offline() -> None:
    provider = NvidiaProvider(api_key=FAKE_KEY)

    async def run() -> None:
        async for _ in provider.stream_chat([{"role": "user", "content": "hi"}]):
            pass

    provider.client.chat.completions.create = AsyncMock(  # type: ignore[method-assign]
        side_effect=openai.APIConnectionError(request=httpx.Request("POST", "https://x"))
    )
    with pytest.raises(LLMConnectionError):
        asyncio.run(run())


def test_providers_have_bounded_timeouts() -> None:
    read = get_settings().llm_read_timeout_seconds
    for provider in (NvidiaProvider(api_key=FAKE_KEY), OllamaProvider()):
        # The timeout must reach the HTTP client the SDK really uses.
        for timeout in (provider.client.timeout, provider.client._client.timeout):
            assert isinstance(timeout, openai.Timeout)
            assert timeout.connect == 5.0
            assert timeout.read == read


def test_probe_marks_offline_and_never_logs_the_key(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.DEBUG)

    async def refuse(self: httpx.AsyncClient, url: str, **kwargs: object) -> httpx.Response:
        raise httpx.ConnectError("no network")

    with patch.object(httpx.AsyncClient, "get", refuse):
        asyncio.run(routing.probe_nvidia())
    assert routing.select_reason() == routing.OLLAMA_OFFLINE
    assert FAKE_KEY not in caplog.text


def test_probe_success_selects_nvidia() -> None:
    async def ok(self: httpx.AsyncClient, url: str, **kwargs: object) -> httpx.Response:
        return httpx.Response(200, json={"data": []})

    with patch.object(httpx.AsyncClient, "get", ok):
        asyncio.run(routing.probe_nvidia())
    assert routing.select_reason() == routing.NVIDIA_PRIMARY


def test_probe_success_does_not_clear_a_real_chat_failure() -> None:
    # e.g. an invalid key: /models still answers 200 but chat requests get 401.
    nvidia = FakeProvider("NVIDIA", [], LLMAuthenticationError("401"))
    ollama = FakeProvider("Ollama", ["local"])
    collect(RoutedLLMProvider(primary=nvidia, fallback=ollama))  # type: ignore[arg-type]

    async def ok(self: httpx.AsyncClient, url: str, **kwargs: object) -> httpx.Response:
        return httpx.Response(200, json={"data": []})

    with patch.object(httpx.AsyncClient, "get", ok):
        asyncio.run(routing.probe_nvidia())
    assert routing.select_reason() == routing.OLLAMA_FALLBACK


# --- chat through the router + titles ----------------------------------------


@pytest.fixture(name="db_session")
def fixture_db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(autoflush=False, bind=engine)()
    yield session
    session.close()


@pytest.fixture(name="client")
def fixture_client(db_session: Session) -> Iterator[TestClient]:
    app = create_app(Settings(database_url="sqlite:///:memory:"))
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as test_client:
        yield test_client


def sse_events(body: str) -> list[dict[str, object]]:
    return [json.loads(line[6:]) for line in body.split("\n\n") if line.startswith("data: ")]


def test_fallback_turn_streams_and_persists_exactly_one_reply(
    client: TestClient, db_session: Session
) -> None:
    nvidia = FakeProvider("NVIDIA", [], LLMConnectionError("offline"))
    ollama = FakeProvider("Ollama", ["Hello", " from Ollama"])
    routed = RoutedLLMProvider(primary=nvidia, fallback=ollama)  # type: ignore[arg-type]
    with patch("app.agent.runner.get_llm_provider", lambda *a, **k: routed):
        response = client.post("/api/chat", json={"message": "hello Zephyra"})
    events = sse_events(response.text)
    assert [e["event"] for e in events] == ["conversation", "chunk", "chunk", "done"]
    conv_id = str(events[0]["conversation_id"])
    messages = conv_service.get_messages(db_session, conv_id)
    assert [(m.role, m.content) for m in messages] == [
        ("user", "hello Zephyra"),
        ("assistant", "Hello from Ollama"),
    ]


def test_status_reports_routed_provider_without_secrets(client: TestClient) -> None:
    settings = get_settings()
    original = settings.llm_provider
    settings.llm_provider = "auto"
    try:
        with patch("app.services.llm.routing.probe_nvidia", AsyncMock()):
            healthy = client.get("/api/system/status").json()
            routing._mark_failed(routing.OLLAMA_OFFLINE)
            offline = client.get("/api/system/status").json()
    finally:
        settings.llm_provider = original
    assert healthy["provider"] == "NVIDIA"
    assert healthy["model"] == settings.nvidia_model
    assert offline["provider"] == "Ollama"
    assert offline["model"] == settings.ollama_model
    for body in (healthy, offline):
        assert FAKE_KEY not in json.dumps(body)
        assert "api_key" not in json.dumps(body).lower()


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("Tell me how to prepare for my DBMS exam tomorrow.", "DBMS Exam Preparation"),
        ("What are the latest developments in AI?", "Latest Developments in AI"),
        ("Help me debug my FastAPI authentication.", "FastAPI Authentication Debugging"),
        (
            "Help me understand binary search for my C programming project.",
            "Binary Search for C Programming Project",
        ),
    ],
)
def test_semantic_titles(message: str, expected: str) -> None:
    assert generate_title(message) == expected


@pytest.mark.parametrize("message", ["hello Zephyra", "thanks!", "Tell me about.", "hi"])
def test_small_talk_does_not_title_a_conversation(message: str) -> None:
    assert generate_title(message) is None


def test_titles_are_concise_and_never_carry_secrets() -> None:
    long = generate_title(" ".join(f"topic{i}word" for i in range(40)))
    assert long is not None and len(long) <= 60 and len(long.split()) <= 6
    assert generate_title("my password is hunter2") == "Password"
    title = generate_title("reset my Gmail password, it is Sup3rS3cretValue99 ok")
    assert title == "Reset Gmail Password"
    assert "4111111111111111" not in (generate_title("charge card 4111111111111111") or "")


def test_title_generation_failure_uses_deterministic_fallback() -> None:
    with patch("app.services.titles.generate_title", side_effect=RuntimeError("boom")):
        assert title_for("Plan my Goa trip next month") == "Plan my Goa trip next month"


def test_first_meaningful_message_titles_the_conversation_once(
    client: TestClient, db_session: Session
) -> None:
    llm = FakeProvider("Ollama", ["Sure."])
    with patch("app.agent.runner.get_llm_provider", lambda *a, **k: llm):
        first = sse_events(client.post("/api/chat", json={"message": "hello Zephyra"}).text)
        conv_id = str(first[0]["conversation_id"])
        listed = client.get("/api/conversations").json()
        assert listed[0]["id"] == conv_id and listed[0]["title"] is None

        client.post(
            "/api/chat",
            json={
                "conversation_id": conv_id,
                "message": "Help me debug my FastAPI authentication.",
            },
        )
        client.post(
            "/api/chat",
            json={"conversation_id": conv_id, "message": "Now write a poem about the ocean"},
        )
    listed = client.get("/api/conversations").json()
    assert listed[0] == {
        "id": conv_id,
        "created_at": listed[0]["created_at"],
        "title": "FastAPI Authentication Debugging",
    }
    assert "session_" not in listed[0]["title"]


def test_existing_conversations_are_backfilled_without_changing_ids(
    client: TestClient, db_session: Session
) -> None:
    untitled = Conversation(id="0d7af4ab-aaea-42ef-ac2f-4f077aa5a7d9")
    named = Conversation(id="361b0c4a-de17-4378-963d-e4fecae61b18", title="My Own Title")
    db_session.add_all([untitled, named])
    db_session.flush()
    db_session.add_all(
        [
            Message(conversation_id=untitled.id, role="user", content="hello zephyra"),
            Message(conversation_id=untitled.id, role="assistant", content="Hi!"),
            Message(
                conversation_id=untitled.id,
                role="user",
                content="Tell me about.ML Systems.In short.",
            ),
            Message(
                conversation_id=named.id,
                role="user",
                content="What are the latest developments in AI?",
            ),
        ]
    )
    db_session.commit()

    titles = {c["id"]: c["title"] for c in client.get("/api/conversations").json()}
    assert titles == {untitled.id: "ML Systems", named.id: "My Own Title"}
    assert len(conv_service.get_messages(db_session, untitled.id)) == 3


def test_title_column_is_added_to_an_existing_database() -> None:
    engine = create_engine("sqlite://", poolclass=StaticPool)
    with engine.begin() as conn:
        conn.execute(
            text("CREATE TABLE conversations (id VARCHAR(36) PRIMARY KEY, created_at DATETIME)")
        )
        conn.execute(text("INSERT INTO conversations (id) VALUES ('keep-me')"))
    ensure_added_columns(engine)
    ensure_added_columns(engine)  # idempotent
    assert "title" in {c["name"] for c in inspect(engine).get_columns("conversations")}
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, title FROM conversations")).all()
    assert rows == [("keep-me", None)]
