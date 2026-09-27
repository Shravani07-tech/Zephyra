"""Phase 5 research: source registry, evidence construction, citation validation."""


class ResearchUnavailableError(Exception):
    """Research was requested but could not produce evidence.

    Raised instead of falling back to a general-knowledge answer.
    """

    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason
        self.message = message
