"""Apply a bounded release gate to knowledge-evaluation evidence."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Thresholds:
    minimum_aggregate: float
    minimum_critical_lower: float
    maximum_prompt_swing: float
    minimum_rubric_agreement: float
    maximum_overlap: float


@dataclass(frozen=True)
class Evidence:
    aggregate: float
    critical_lower_bounds: dict[str, float]
    prompt_swing: float | None
    rubric_agreement: float | None
    suspected_overlap: float | None


@dataclass
class Decision:
    status: str
    failures: list[str] = field(default_factory=list)
    unknowns: list[str] = field(default_factory=list)


def evaluate(evidence: Evidence, thresholds: Thresholds) -> Decision:
    decision = Decision(status="supported")

    if evidence.aggregate < thresholds.minimum_aggregate:
        decision.failures.append("aggregate score is below the declared threshold")

    for name, lower_bound in evidence.critical_lower_bounds.items():
        if lower_bound < thresholds.minimum_critical_lower:
            decision.failures.append(f"{name} has insufficient lower-bound evidence")

    checks = [
        (
            evidence.prompt_swing,
            "prompt sensitivity is unknown",
            "prompt sensitivity exceeds the limit",
            lambda value: value <= thresholds.maximum_prompt_swing,
        ),
        (
            evidence.rubric_agreement,
            "rubric agreement is unknown",
            "rubric agreement is below the minimum",
            lambda value: value >= thresholds.minimum_rubric_agreement,
        ),
        (
            evidence.suspected_overlap,
            "contamination review is missing",
            "suspected overlap exceeds the limit",
            lambda value: value <= thresholds.maximum_overlap,
        ),
    ]

    for value, unknown_message, failure_message, passes in checks:
        if value is None:
            decision.unknowns.append(unknown_message)
        elif not passes(value):
            decision.failures.append(failure_message)

    if decision.failures:
        decision.status = "blocked"
    elif decision.unknowns:
        decision.status = "investigate"
    return decision
