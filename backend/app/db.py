"""Zephyra Lite — database engine and session wiring.

SQLite through SQLAlchemy 2.0. This module owns the connection lifecycle only;
table definitions live in ``models.py`` and arrive with Milestone 1.
"""

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

_SQLITE_PREFIX = "sqlite:///"


class Base(DeclarativeBase):
    """Declarative base that every Zephyra table inherits from."""


def _build_engine() -> Engine:
    url = get_settings().database_url
    if url.startswith("sqlite"):
        # SQLite guards against cross-thread reuse by default; FastAPI hands
        # requests to a threadpool, so each session needs its own connection.
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url)


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a session that closes after the request."""
    with SessionLocal() as session:
        yield session


def init_db() -> None:
    """Create every table registered on :class:`Base`.

    A no-op until Milestone 1 registers the conversation and message tables.
    Not wired into app startup yet, so no database file is created on boot.
    """
    url = get_settings().database_url
    if url.startswith(_SQLITE_PREFIX):
        Path(url[len(_SQLITE_PREFIX) :]).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
