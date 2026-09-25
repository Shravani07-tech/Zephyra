"""Zephyra Lite — File embeddings."""

from chromadb.api.types import EmbeddingFunction
from chromadb.utils.embedding_functions import OllamaEmbeddingFunction

from app.config import get_settings

class MockEmbeddingFunction(EmbeddingFunction):
    """A mock embedding function for testing without requiring a real model."""
    def __call__(self, input: list[str]) -> list[list[float]]:
        # Return a simple deterministic fake embedding
        return [[0.1] * 384 for _ in input]

def get_embedding_function(is_test: bool = False) -> EmbeddingFunction:
    """Return the configured embedding function."""
    import sys
    if is_test or "pytest" in sys.modules:
        return MockEmbeddingFunction()
        
    settings = get_settings()
    # The ChromaDB OllamaEmbeddingFunction works directly with Ollama.
    # Note: Ollama's URL is usually http://localhost:11434/api/embeddings
    url = settings.ollama_api_base.replace("/v1", "/api/embeddings")
    
    return OllamaEmbeddingFunction(
        model_name=settings.ollama_embedding_model,
        url=url,
    )
