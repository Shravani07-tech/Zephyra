"""Zephyra Lite — application settings.

Values are read from the process environment, falling back to a local ``.env``
file. ``.env`` is never committed; ``.env.example`` documents its shape.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
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

    # Active Provider ("nvidia" | "ollama")
    llm_provider: str = Field("nvidia", validation_alias="LLM_PROVIDER")

    # NVIDIA Provider Configuration
    nvidia_api_key: str | None = Field(None, validation_alias="NVIDIA_API_KEY")
    nvidia_api_base: str = Field("https://integrate.api.nvidia.com/v1", validation_alias="NVIDIA_API_BASE")
    nvidia_model: str = Field("meta/llama-3.2-11b-vision-instruct", validation_alias="NVIDIA_MODEL")

    # Ollama Provider Configuration
    ollama_api_base: str = Field("http://localhost:11434/v1", validation_alias="OLLAMA_API_BASE")
    ollama_model: str = Field("llama3.2:latest", validation_alias="OLLAMA_MODEL")
    ollama_embedding_model: str = Field("nomic-embed-text", validation_alias="OLLAMA_EMBEDDING_MODEL")

    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    file_storage_path: Path = BACKEND_ROOT / "data" / "files"
    chroma_db_path: Path = BACKEND_ROOT / "data" / "chroma"

    # Explicit allowlist — never "*". The Vite dev server runs on 5173 or 5174.
    cors_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    )

    @property
    def zephyra_model(self) -> str:
        """Dynamic model property for backward compatibility."""
        return self.ollama_model if self.llm_provider.lower() == "ollama" else self.nvidia_model


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings, built once and cached."""
    return Settings()
