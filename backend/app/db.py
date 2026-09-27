"""Zephyra Lite — database engine and session wiring.

SQLite through SQLAlchemy 2.0. This module owns the connection lifecycle only;
table definitions live in ``models.py`` and arrive with Milestone 1.
"""

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import Engine, create_engine, inspect, text
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


# Columns added to existing tables after their first release. ``create_all``
# never alters an existing table, so databases created earlier get these added
# on startup. Each entry is (table, column, SQL type).
_ADDED_COLUMNS: tuple[tuple[str, str, str], ...] = (
    ("messages", "metadata", "TEXT"),  # Phase 5 research citation metadata
)


def ensure_added_columns(bind: Engine) -> None:
    """Idempotently add columns missing from tables that already exist."""
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())
    with bind.begin() as conn:
        for table, column, sql_type in _ADDED_COLUMNS:
            if table not in existing_tables:
                continue
            columns = {c["name"] for c in inspect(conn).get_columns(table)}
            if column not in columns:
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {sql_type}'))


def init_db(bind: Engine | None = None) -> None:
    """Create every table registered on :class:`Base` and add late columns."""
    target = bind or engine
    url = get_settings().database_url
    if bind is None and url.startswith(_SQLITE_PREFIX):
        Path(url[len(_SQLITE_PREFIX) :]).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=target)
    ensure_added_columns(target)
