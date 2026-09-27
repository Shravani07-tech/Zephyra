"""Per-run server-side source registry.

Every research run gets its own registry with server-generated source IDs.
The registry is the only authority for citation metadata; model output can
reference an ID but never supply the metadata behind it.
"""

import re
import secrets
import uuid
from dataclasses import dataclass, field

from app.services.search.base import SearchResult

SOURCE_ID_PATTERN = re.compile(r"^src-[0-9a-f]{8}$")


@dataclass(frozen=True)
class ResearchSource:
    source_id: str
    url: str
    title: str
    snippet: str
    retrieved_at: str

    def citation(self) -> dict[str, str]:
        """Structured citation metadata. Snippets are not persisted."""
        return {
            "source_id": self.source_id,
            "title": self.title,
            "url": self.url,
            "retrieved_at": self.retrieved_at,
        }


@dataclass
class SourceRegistry:
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    sources: dict[str, ResearchSource] = field(default_factory=dict)

    @classmethod
    def from_results(cls, results: list[SearchResult]) -> "SourceRegistry":
        registry = cls()
        for result in results:
            source_id = registry._new_id()
            registry.sources[source_id] = ResearchSource(
                source_id=source_id,
                url=result["url"],
                title=result["title"],
                snippet=result["snippet"],
                retrieved_at=result["retrieved_at"],
            )
        return registry

    def _new_id(self) -> str:
        while True:
            source_id = f"src-{secrets.token_hex(4)}"
            if source_id not in self.sources:
                return source_id

    def get(self, source_id: str) -> ResearchSource | None:
        return self.sources.get(source_id)

    def __len__(self) -> int:
        return len(self.sources)
