"""Normalisation, validation and deduplication of raw search results."""

import unicodedata
from datetime import UTC, datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.services.search.base import SearchResult

ALLOWED_SCHEMES = frozenset({"http", "https"})
MAX_URL_LENGTH = 2048
MAX_TITLE_CHARS = 200
_DEFAULT_PORTS = {"http": 80, "https": 443}
_TRACKING_PARAMS = frozenset({"fbclid", "gclid", "msclkid", "mc_cid", "mc_eid"})


def normalize_url(raw: object) -> str | None:
    """Return a canonical http(s) URL, or ``None`` if the URL is not acceptable."""
    if not isinstance(raw, str):
        return None
    candidate = raw.strip()
    if not candidate or len(candidate) > MAX_URL_LENGTH:
        return None
    if any(ch.isspace() or unicodedata.category(ch) == "Cc" for ch in candidate):
        return None
    try:
        parts = urlsplit(candidate)
        port = parts.port
    except ValueError:
        return None

    scheme = parts.scheme.lower()
    host = parts.hostname
    if scheme not in ALLOWED_SCHEMES or not host or parts.username or parts.password:
        return None

    netloc = f"[{host}]" if ":" in host else host
    if port is not None and port != _DEFAULT_PORTS[scheme]:
        netloc = f"{netloc}:{port}"

    path = parts.path or "/"
    if len(path) > 1:
        path = path.rstrip("/") or "/"

    query_pairs = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in _TRACKING_PARAMS
    ]
    return urlunsplit((scheme, netloc, path, urlencode(query_pairs), ""))


def _dedup_key(url: str) -> str:
    """Identity used for deduplication: scheme- and ``www.``-insensitive."""
    parts = urlsplit(url)
    host = parts.netloc.removeprefix("www.")
    return f"{host}{parts.path}?{parts.query}"


def clean_text(value: object, max_chars: int) -> str:
    """Collapse whitespace, drop control characters and cap the length."""
    if not isinstance(value, str):
        return ""
    printable = "".join(
        " " if unicodedata.category(ch) in ("Cc", "Cf", "Zl", "Zp") else ch for ch in value
    )
    collapsed = " ".join(printable.split())
    if len(collapsed) > max_chars:
        collapsed = collapsed[: max_chars - 1].rstrip() + "…"
    return collapsed


def normalize_results(
    raw_results: object,
    max_sources: int,
    snippet_max_chars: int,
) -> list[SearchResult]:
    """Validate, normalise and deduplicate raw provider output.

    Items without an acceptable http(s) URL are dropped. Titles fall back to the
    host name. The result list is capped at ``max_sources``.
    """
    if not isinstance(raw_results, list):
        return []

    retrieved_at = datetime.now(UTC).isoformat()
    seen: set[str] = set()
    normalized: list[SearchResult] = []

    for item in raw_results:
        if len(normalized) >= max_sources:
            break
        if not isinstance(item, dict):
            continue
        url = normalize_url(item.get("url"))
        if url is None:
            continue
        key = _dedup_key(url)
        if key in seen:
            continue
        seen.add(key)

        title = clean_text(item.get("title"), MAX_TITLE_CHARS) or (urlsplit(url).hostname or url)
        normalized.append(
            SearchResult(
                url=url,
                title=title,
                snippet=clean_text(item.get("snippet"), snippet_max_chars),
                retrieved_at=retrieved_at,
            )
        )
    return normalized
