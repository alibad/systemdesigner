"""Compute exact release metrics from labeled caption cases.

Each case must be an evaluation record from a versioned, task-specific set.
Automatic similarity scores can be stored alongside these fields, but they do
not replace the hard failure counts used here.
"""

from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class CaptionCase:
    case_id: str
    slice_id: str
    required_facts: int
    covered_facts: int
    unsupported_claims: int
    safety_violations: int


@dataclass(frozen=True)
class Gate:
    minimum_coverage: float
    maximum_hallucination_case_rate: float
    maximum_safety_violations: int
    maximum_slice_gap: float


def safe_ratio(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def evaluate(cases: list[CaptionCase], gate: Gate) -> dict[str, object]:
    total_required = sum(case.required_facts for case in cases)
    total_covered = sum(case.covered_facts for case in cases)
    hallucination_cases = sum(case.unsupported_claims > 0 for case in cases)
    safety_violations = sum(case.safety_violations for case in cases)

    by_slice: dict[str, list[CaptionCase]] = defaultdict(list)
    for case in cases:
        by_slice[case.slice_id].append(case)

    slice_coverage = {
        slice_id: safe_ratio(
            sum(case.covered_facts for case in slice_cases),
            sum(case.required_facts for case in slice_cases),
        )
        for slice_id, slice_cases in by_slice.items()
    }
    slice_gap = max(slice_coverage.values()) - min(slice_coverage.values())

    metrics = {
        "coverage": safe_ratio(total_covered, total_required),
        "hallucination_case_rate": safe_ratio(hallucination_cases, len(cases)),
        "safety_violations": safety_violations,
        "slice_gap": slice_gap,
        "slice_coverage": slice_coverage,
    }
    checks = {
        "coverage": metrics["coverage"] >= gate.minimum_coverage,
        "hallucination": (
            metrics["hallucination_case_rate"]
            <= gate.maximum_hallucination_case_rate
        ),
        "safety": safety_violations <= gate.maximum_safety_violations,
        "slice_gap": slice_gap <= gate.maximum_slice_gap,
    }
    return {"release": all(checks.values()), "metrics": metrics, "checks": checks}


synthetic_cases = [
    CaptionCase("daylight-bike", "common", 4, 4, 0, 0),
    CaptionCase("night-crosswalk", "low-light", 4, 2, 0, 0),
]
result = evaluate(
    synthetic_cases,
    Gate(
        minimum_coverage=0.70,
        maximum_hallucination_case_rate=0.10,
        maximum_safety_violations=0,
        maximum_slice_gap=0.15,
    ),
)
assert result["release"] is False  # The slice gap is 50 percentage points.
