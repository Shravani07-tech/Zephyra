"""Deterministic conversation titles derived from the first meaningful message.

No model call is involved, so a title never delays or competes with the reply
and can never fail. Messages without topical content (greetings, thanks) yield
no title, and the next meaningful message titles the conversation instead.
"""

import logging
import re

logger = logging.getLogger(__name__)

MAX_TITLE_WORDS = 6
MAX_TITLE_CHARS = 60

# Words with no topical meaning in a title: pronouns, auxiliaries, request
# phrasing, greetings, fillers and relative time words.
_STOPWORDS = frozenset(
    """
    a an the i me my mine myself you your yours we us our it its this that these those
    there here is are was were be been being am do does did done can could would should
    will shall may might must please pls plz tell help give show let lets want wanna need
    like know what whats how why when where which who whom whose some any just
    really very so also too hi hello hey hiya yo greetings thanks thank thx ok okay
    sure zephyra today tomorrow yesterday tonight now currently short brief briefly quick
    quickly simple simply little bit more details detail explain describe understand
    teach get got have has had im i'm ive i've id i'd ill i'll youre you're it's
    thing things something anything stuff kind sort way ways good great nice
    """.split()
)

# Joining words kept in lowercase, but only between two topical words.
_CONNECTORS = frozenset(
    "in of for on with vs versus and to from using between into at by about".split()
)

# A leading request verb becomes a trailing noun: "prepare DBMS exam" -> "DBMS
# Exam Preparation".
_VERB_NOUNS = {
    "prepare": "Preparation",
    "debug": "Debugging",
    "fix": "Fix",
    "plan": "Planning",
    "learn": "Learning",
    "study": "Study",
    "build": "Building",
    "create": "Creation",
    "design": "Design",
    "compare": "Comparison",
    "analyze": "Analysis",
    "analyse": "Analysis",
    "summarize": "Summary",
    "summarise": "Summary",
    "optimize": "Optimization",
    "optimise": "Optimization",
    "deploy": "Deployment",
    "install": "Installation",
    "implement": "Implementation",
    "test": "Testing",
    "refactor": "Refactoring",
    "review": "Review",
    "translate": "Translation",
    "improve": "Improvement",
    "configure": "Configuration",
    "research": "Research",
    "practice": "Practice",
    "draft": "Draft",
    "brainstorm": "Brainstorm",
}

# Request verbs that add nothing once removed.
_DROP_VERBS = frozenset(
    "find make list share walk go see check look search write remind add".split()
)

# A second request clause ("... and summarize it") is not part of the topic.
_CLAUSE_BREAKS = frozenset("and then also".split())

# Credential context: a title may name the topic but never carry the value.
_CREDENTIAL = re.compile(
    r"\b(?:passwords?|passcodes?|pin|api[\s_-]?keys?|secrets?|tokens?|otp|cvv)\b", re.IGNORECASE
)

_TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9+#'\-]*")


def _looks_secret(token: str) -> bool:
    """Tokens that could be an identifier, number or credential value."""
    has_digit = any(c.isdigit() for c in token)
    has_alpha = any(c.isalpha() for c in token)
    if has_digit and not has_alpha:
        return len(token) >= 5  # phone, card or account numbers
    if has_digit and has_alpha and len(token) >= 12:
        return True  # key-like strings
    return len(token) > 24


def _display(word: str) -> str:
    # Keep deliberate casing such as "FastAPI", "DBMS" or "iOS".
    if any(c.isupper() for c in word):
        return word
    return word[:1].upper() + word[1:]


def generate_title(text: str | None) -> str | None:
    """A concise title for a message, or None if it has no topical content."""
    if not text:
        return None
    # Drop URLs and e-mail addresses before tokenizing.
    cleaned = re.sub(r"\S+@\S+|https?://\S+|www\.\S+", " ", text[:500])
    credential = _CREDENTIAL.search(cleaned)
    if credential:
        # Keep only the words up to and including the credential keyword.
        cleaned = cleaned[: credential.end()]

    words: list[str] = []
    lead_noun: str | None = None
    tokens = [raw.strip("'-") for raw in _TOKEN.findall(cleaned)]
    for index, token in enumerate(tokens):
        lower = token.lower()
        if not token or _looks_secret(token):
            continue
        following = tokens[index + 1].lower() if index + 1 < len(tokens) else ""
        if words and lower in _CLAUSE_BREAKS and (
            following in _VERB_NOUNS or following in _DROP_VERBS or following in _STOPWORDS
        ):
            break
        if lower in _STOPWORDS:
            continue
        if not any(w for w in words if w.lower() not in _CONNECTORS):
            # Still before the first topical word: absorb request verbs.
            if lower in _VERB_NOUNS and lead_noun is None:
                lead_noun = _VERB_NOUNS[lower]
                continue
            if lower in _DROP_VERBS:
                continue
        if lower in _CONNECTORS:
            if words:
                words.append(lower)
            continue
        words.append(token)

    topical = [w for w in words if w.lower() not in _CONNECTORS]
    if not topical and lead_noun is None:
        return None

    budget = MAX_TITLE_WORDS - (1 if lead_noun else 0)
    picked: list[str] = []
    count = 0
    for word in words:
        if count >= budget:
            break
        picked.append(word)
        if word.lower() not in _CONNECTORS:
            count += 1
    while picked and picked[-1].lower() in _CONNECTORS:
        picked.pop()

    parts = [_display(w) if w.lower() not in _CONNECTORS else w.lower() for w in picked]
    if lead_noun:
        parts.append(lead_noun)
    if not parts:
        return None
    title = " ".join(parts)
    if len(title) > MAX_TITLE_CHARS:
        title = title[:MAX_TITLE_CHARS].rsplit(" ", 1)[0]
    return title


def fallback_title(text: str | None) -> str | None:
    """Plain first-words title, used only if :func:`generate_title` fails."""
    words = [w for w in (text or "").split() if not _looks_secret(w.strip(".,!?;:"))]
    if not words:
        return None
    title = " ".join(words[:MAX_TITLE_WORDS])
    return title[:MAX_TITLE_CHARS].rstrip(" .,!?;:") or None


def title_for(text: str | None) -> str | None:
    """Title for a message; never raises."""
    try:
        return generate_title(text)
    except Exception:
        logger.warning("Title generation failed; using first words instead.")
        return fallback_title(text)
