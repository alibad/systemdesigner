"""A small, auditable engineering gate for healthcare AI changes.

The result is a release posture for a teaching example, not regulatory approval.
"""

from dataclasses import asdict, dataclass
import json
import math


@dataclass(frozen=True)
class ChangeEvidence:
    impact: int
    boundary_coverage_percent: int
    independent_cases: int
    tested_fallback: bool


@dataclass(frozen=True)
class GateResult:
    evidence_score: int
    posture: str
    reason: str


def evaluate_change(evidence: ChangeEvidence) -> GateResult:
    if evidence.impact not in {1, 2, 3}:
        raise ValueError("impact must be 1, 2, or 3")
    if not 0 <= evidence.boundary_coverage_percent <= 100:
        raise ValueError("boundary coverage must be between 0 and 100")
    if evidence.independent_cases < 0:
        raise ValueError("independent_cases cannot be negative")

    sample_signal = min(30, math.log10(evidence.independent_cases + 1) * 10)
    score = round(
        evidence.boundary_coverage_percent * 0.55
        + sample_signal
        + (15 if evidence.tested_fallback else 0)
        - evidence.impact * 8
    )
    score = max(0, min(100, score))

    if not evidence.tested_fallback or score < 45:
        return GateResult(score, "hold", "Contain the change and close the evidence gap.")
    if score < 75 or evidence.impact == 3:
        return GateResult(score, "shadow_only", "Observe independently before user-visible use.")
    return GateResult(score, "bounded_candidate", "Consider a reversible, monitored release review.")


if __name__ == "__main__":
    result = evaluate_change(
        ChangeEvidence(
            impact=2,
            boundary_coverage_percent=82,
            independent_cases=600,
            tested_fallback=True,
        )
    )
    print(json.dumps(asdict(result), indent=2))
