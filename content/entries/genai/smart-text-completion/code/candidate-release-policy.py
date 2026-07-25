"""A small, executable model of ranking plus independent release gates."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Candidate:
    text: str
    relevance: float
    style: float
    utility: float
    repetition: float
    safety: float
    draft_version: int


@dataclass(frozen=True)
class ReleaseContext:
    current_draft_version: int
    elapsed_ms: int
    deadline_ms: int
    release_threshold: float
    minimum_safety: float


def ranking_score(candidate: Candidate) -> float:
    """Order candidates with soft evidence; safety is not averaged into this score."""
    return round(
        0.45 * candidate.relevance
        + 0.20 * candidate.style
        + 0.20 * candidate.utility
        + 0.15 * candidate.repetition,
        1,
    )


def release_decision(candidate: Candidate, context: ReleaseContext) -> tuple[bool, str]:
    """Return the first explainable reason for showing or suppressing a candidate."""
    if candidate.draft_version != context.current_draft_version:
        return False, "stale-draft"
    if context.elapsed_ms > context.deadline_ms:
        return False, "deadline-missed"
    if candidate.safety < context.minimum_safety:
        return False, "safety-gate"
    if ranking_score(candidate) < context.release_threshold:
        return False, "below-release-threshold"
    return True, "render-proposal"


if __name__ == "__main__":
    useful = Candidate(
        text="review them this afternoon and follow up.",
        relevance=90,
        style=84,
        utility=92,
        repetition=98,
        safety=99,
        draft_version=42,
    )
    stale = Candidate(**{**useful.__dict__, "draft_version": 41})
    unsafe = Candidate(**{**useful.__dict__, "safety": 20})
    request = ReleaseContext(
        current_draft_version=42,
        elapsed_ms=61,
        deadline_ms=82,
        release_threshold=76,
        minimum_safety=90,
    )

    assert release_decision(useful, request) == (True, "render-proposal")
    assert release_decision(stale, request) == (False, "stale-draft")
    assert release_decision(unsafe, request) == (False, "safety-gate")
    print({"score": ranking_score(useful), "decision": release_decision(useful, request)})
