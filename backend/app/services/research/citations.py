"""Server-side validation of model citation markers.

Model output is only a set of reference signals. A marker becomes a citation
only when it is a well-formed source ID that exists in *this run's* registry.
Everything else (unknown, fabricated, malformed, numbered or cross-run IDs) is
rejected and removed from the persisted answer.
"""

import re
from dataclasses import dataclass, field

from app.services.research.registry import SOURCE_ID_PATTERN, SourceRegistry

# Code spans and fenced blocks are left untouched.
_CODE = re.compile(r"(```[\s\S]*?```|`[^`\n]*`)")
# A source-ID-shaped marker written as a Markdown link, e.g. ``[src-…](url)``.
# The model-authored URL is always dropped; only the ID is validated.
_LINKED_ID = re.compile(r"([ \t]?)(?<![\w\]])\[(src-[^\[\]\s]{0,40})\]\([^)\n]*\)")
# Any other bracketed group not glued to a preceding word (so ``arr[0]`` is
# ignored) and not an ordinary Markdown link.
_MARKER = re.compile(r"([ \t]?)(?<![\w\]])\[([^\[\]\n]{1,120})\](?!\()")
# Source-ID tokens left in prose, e.g. "[src-1a2b3c4d, per the report]".
_BARE_ID = re.compile(r"([ \t]?)\bsrc-[0-9a-f]{8}\b")


@dataclass
class CitationResult:
    content: str
    citations: list[dict[str, str]] = field(default_factory=list)
    rejected_markers: int = 0


def _marker_parts(inner: str) -> list[str] | None:
    """Split ``a, b`` style markers. Returns None when the group is ordinary prose."""
    parts = [part.strip() for part in re.split(r"[,;]", inner)]
    if any(not part or any(ch.isspace() for ch in part) for part in parts):
        return None
    return parts


def validate_citations(content: str, registry: SourceRegistry) -> CitationResult:
    result = CitationResult(content="")
    cited: dict[str, dict[str, str]] = {}

    def replace(match: re.Match[str]) -> str:
        leading, inner = match.group(1), match.group(2)
        parts = _marker_parts(inner)
        if parts is None:
            return match.group(0)
        valid: list[str] = []
        for part in parts:
            source = registry.get(part) if SOURCE_ID_PATTERN.match(part) else None
            if source is None:
                result.rejected_markers += 1
                continue
            if part not in valid:
                valid.append(part)
            cited.setdefault(part, source.citation())
        if not valid:
            return ""
        return f"{leading}[{', '.join(valid)}]"

    def replace_bare(match: re.Match[str]) -> str:
        source_id = match.group(0).strip()
        source = registry.get(source_id)
        if source is None:
            result.rejected_markers += 1
            return ""
        cited.setdefault(source_id, source.citation())
        return match.group(0)

    segments = _CODE.split(content)
    for index, segment in enumerate(segments):
        # Odd indices are the captured code spans.
        if index % 2 == 0:
            segment = _LINKED_ID.sub(replace, segment)
            segment = _MARKER.sub(replace, segment)
            segment = _BARE_ID.sub(replace_bare, segment)
        segments[index] = segment

    result.content = "".join(segments).strip()
    result.citations = list(cited.values())
    return result
