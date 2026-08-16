"""Zephyra Lite — application settings.

Values are read from the process environment, falling back to a local ``.env``
file. ``.env`` is never committed; ``.env.example`` documents its shape.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_ROOT / "data" / "zephyra.db"


class Settings(BaseSettings):
    """Runtime configuration for the backend service."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server-side only. Must never be exposed to the frontend bundle.
    nvidia_api_key: str | None = None
    zephyra_model: str = "meta/llama-3.1-8b-instruct"
    nvidia_api_base: str = "https://integrate.api.nvidia.com/v1"
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

    # Explicit allowlist — never "*". The Vite dev server runs on 5173 or 5174.
    cors_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    )


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings, built once and cached."""
    return Settings()
