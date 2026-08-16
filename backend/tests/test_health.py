"""Tests for ``GET /api/health`` and the CORS allowlist."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

FRONTEND_ORIGIN = "http://localhost:5173"


@pytest.fixture(scope="module")
def client() -> TestClient:
    """A test client bound to a freshly built app."""
    return TestClient(create_app())


def test_health_returns_200(client: TestClient) -> None:
    """The endpoint is reachable at the documented path."""
    assert client.get("/api/health").status_code == 200


def test_health_body_is_exactly_status_ok(client: TestClient) -> None:
    """The body is the exact contract — no extra keys."""
    assert client.get("/api/health").json() == {"status": "ok"}


def test_cors_allows_the_frontend_dev_origin(client: TestClient) -> None:
    """The Vite dev server origin is echoed back as allowed."""
    response = client.get("/api/health", headers={"Origin": FRONTEND_ORIGIN})
    assert response.headers["access-control-allow-origin"] == FRONTEND_ORIGIN


def test_cors_rejects_an_unlisted_origin(client: TestClient) -> None:
    """An unknown origin gets no allow header — the allowlist is not a wildcard."""
    response = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in response.headers
