"""Evaluate a bounded financial ML release package."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ReleaseCandidate:
    name: str
    required_controls: frozenset[str]
    completed_controls: frozenset[str]
    independent_reviews: int
    minimum_reviews: int


@dataclass(frozen=True)
class GateResult:
    posture: str
    missing_controls: tuple[str, ...]
    missing_reviews: int


def evaluate(candidate: ReleaseCandidate) -> GateResult:
    missing = tuple(sorted(candidate.required_controls - candidate.completed_controls))
    missing_reviews = max(0, candidate.minimum_reviews - candidate.independent_reviews)

    if not missing and missing_reviews == 0:
        posture = "bounded-release-candidate"
    elif len(missing) <= 2 and missing_reviews <= 1:
        posture = "shadow-only"
    else:
        posture = "hold-and-contain"

    return GateResult(posture, missing, missing_reviews)


if __name__ == "__main__":
    required = frozenset(
        {
            "lineage",
            "independent-validation",
            "decision-reasons",
            "limits",
            "rollback",
            "monitoring",
        }
    )
    candidate = ReleaseCandidate(
        name="credit-threshold-v4",
        required_controls=required,
        completed_controls=required - {"rollback"},
        independent_reviews=1,
        minimum_reviews=2,
    )

    result = evaluate(candidate)
    assert result.posture == "shadow-only"
    assert result.missing_controls == ("rollback",)
    assert result.missing_reviews == 1
    print(result)
