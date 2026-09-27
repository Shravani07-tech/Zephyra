"""Zephyra Lite — application settings.

Values are read from the process environment, falling back to a local ``.env``
file. ``.env`` is never committed; ``.env.example`` documents its shape.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
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

    # LLM provider: "auto" routes to NVIDIA when it is configured and reachable,
    # falling back to local Ollama. "nvidia" or "ollama" pins a single provider.
    llm_provider: str = Field("auto", validation_alias="LLM_PROVIDER")
    # Per-read timeout for LLM streams (covers a cold local model load).
    llm_read_timeout_seconds: float = Field(
        180.0, gt=0, validation_alias="LLM_READ_TIMEOUT_SECONDS"
    )
    # How long a failed NVIDIA check keeps routing on Ollama before retrying NVIDIA.
    provider_health_ttl_seconds: float = Field(
        60.0, gt=0, validation_alias="PROVIDER_HEALTH_TTL_SECONDS"
    )

    # NVIDIA Provider Configuration
    nvidia_api_key: str | None = Field(None, validation_alias="NVIDIA_API_KEY")
    nvidia_api_base: str = Field("https://integrate.api.nvidia.com/v1", validation_alias="NVIDIA_API_BASE")
    nvidia_model: str = Field("meta/llama-3.2-11b-vision-instruct", validation_alias="NVIDIA_MODEL")

    # Ollama Provider Configuration
    ollama_api_base: str = Field("http://localhost:11434/v1", validation_alias="OLLAMA_API_BASE")
    ollama_model: str = Field("llama3.2:latest", validation_alias="OLLAMA_MODEL")
    ollama_embedding_model: str = Field("nomic-embed-text", validation_alias="OLLAMA_EMBEDDING_MODEL")

    # Research (Phase 5). No search provider is selected by default: research
    # requests fail explicitly until an approved Search API provider is set.
    search_provider: str = Field("none", validation_alias="SEARCH_PROVIDER")
    search_timeout_seconds: float = Field(8.0, gt=0, validation_alias="SEARCH_TIMEOUT_SECONDS")
    research_budget_seconds: float = Field(
        15.0, gt=0, validation_alias="RESEARCH_BUDGET_SECONDS"
    )
    research_max_sources: int = Field(5, ge=1, le=10, validation_alias="RESEARCH_MAX_SOURCES")
    research_snippet_max_chars: int = Field(
        500, ge=50, le=2000, validation_alias="RESEARCH_SNIPPET_MAX_CHARS"
    )
    # Used when SEARCH_PROVIDER=tavily. SecretStr keeps it out of reprs and logs.
    tavily_api_key: SecretStr | None = Field(None, validation_alias="TAVILY_API_KEY")

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
