"""Zephyra Lite — FastAPI application entry point.

Run locally with::

    python -m uvicorn app.main:app --port 8000
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import chat, conversations, health
from app.config import Settings, get_settings
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application startup and shutdown lifecycles."""
    init_db()
    yield


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application.

    Takes settings as an argument so tests can construct an app with an
    isolated configuration instead of mutating the process environment.
    """
    resolved = settings or get_settings()

    app = FastAPI(title="Zephyra Lite", version=__version__, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(conversations.router, prefix="/api")
    return app


app = create_app()
