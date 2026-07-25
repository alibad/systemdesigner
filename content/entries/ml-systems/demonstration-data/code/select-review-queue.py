"""Rank demonstration candidates for scarce expert review.

The score is deliberately transparent. In production, calibrate each term against
measured review outcomes and preserve every input with the selection decision.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Candidate:
    example_id: str
    uncertainty: float
    coverage_gap: float
    harm_severity: float
    source_novelty: float


def review_priority(candidate: Candidate) -> float:
    """Return a bounded priority score; higher values enter review first."""
    for value in (
        candidate.uncertainty,
        candidate.coverage_gap,
        candidate.harm_severity,
        candidate.source_novelty,
    ):
        if not 0 <= value <= 1:
            raise ValueError("Priority inputs must be between 0 and 1")

    return round(
        0.25 * candidate.uncertainty
        + 0.30 * candidate.coverage_gap
        + 0.35 * candidate.harm_severity
        + 0.10 * candidate.source_novelty,
        3,
    )


def select_for_review(candidates: list[Candidate], budget: int) -> list[Candidate]:
    """Select the highest-value candidates under a fixed review budget."""
    if budget < 0:
        raise ValueError("Review budget cannot be negative")
    ranked = sorted(
        candidates,
        key=lambda item: (-review_priority(item), item.example_id),
    )
    return ranked[:budget]


if __name__ == "__main__":
    pool = [
        Candidate("routine-001", 0.12, 0.08, 0.05, 0.20),
        Candidate("dialect-014", 0.66, 0.92, 0.30, 0.88),
        Candidate("unsafe-007", 0.55, 0.44, 1.00, 0.35),
        Candidate("refund-031", 0.78, 0.58, 0.45, 0.42),
    ]

    queue = select_for_review(pool, budget=2)
    print("expert review queue")
    for item in queue:
        print(f"- {item.example_id}: priority={review_priority(item):.3f}")

    assert [item.example_id for item in queue] == ["unsafe-007", "dialect-014"]
    assert all(item.example_id != "routine-001" for item in queue)
