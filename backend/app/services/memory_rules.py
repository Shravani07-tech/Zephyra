"""Deterministic rules for what Persistent Memory may store."""

import re

MEMORY_CATEGORIES = (
    "PREFERENCE",
    "PROJECT",
    "GOAL",
    "ROUTINE",
    "CONSTRAINT",
    "PERSONAL_FACT",
    "IMPORTANT_CONTEXT",
)

# Special-category data that implicit (automatic) extraction must never store:
# health, religion, politics, sexuality, criminal history, and finances or
# credentials. Explicit "remember that ..." requests use a separate path.
_SENSITIVE = re.compile(
    r"\b(?:"
    # health
    r"diagnos\w*|disease\w*|illness\w*|medicat\w*|prescri\w*|therap\w*|depress\w*|"
    r"anxiety|adhd|autis\w*|bipolar|schizo\w*|cancer|diabet\w*|hiv|aids|pregnan\w*|"
    r"disorder\w*|symptom\w*|surgery|hospital\w*|mental health|"
    # religion
    r"religio\w*|church|mosque|temple|synagogue|pray\w*|atheis\w*|christian\w*|"
    r"muslim\w*|hindu\w*|jewish|buddhis\w*|sikh\w*|"
    # politics
    r"politic\w*|vot(?:e|ed|ing)|democrat\w*|republican\w*|liberal|conservative|"
    r"socialis\w*|communis\w*|elections?|"
    # sexuality
    r"sexual\w*|gay|lesbian|bisexual|transgender|queer|sex life|"
    # criminal
    r"arrest\w*|convict\w*|criminal\w*|prison|jail\w*|felon\w*|probation|"
    # finance and credentials
    r"salary|income|debts?|loans?|mortgage|bank account|credit card|credit score|"
    r"net worth|ssn|social security|passwords?|pin code|account number"
    r")\b",
    re.IGNORECASE,
)


def is_sensitive(text: str) -> bool:
    """True when text touches a special category implicit memory must not store."""
    return bool(_SENSITIVE.search(text or ""))


def _category_key(value: str) -> str:
    """Letters only, without a leading "USER" or a plural "S"."""
    key = re.sub(r"[^A-Z]", "", value.upper())
    key = key.removeprefix("USER")
    return key[:-1] if key.endswith("S") else key


_CATEGORY_KEYS = {_category_key(c): c for c in MEMORY_CATEGORIES}


def normalize_category(value: object) -> str | None:
    """Map a model-supplied category onto the fixed set, or None if unknown.

    Models write categories loosely ("Personal Facts", "UserPreference"), so
    matching ignores case, spacing, punctuation, a "User" prefix and plurals.
    """
    if not value:
        return None
    return _CATEGORY_KEYS.get(_category_key(str(value)))
