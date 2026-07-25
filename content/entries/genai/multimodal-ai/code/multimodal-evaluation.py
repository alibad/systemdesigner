from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from statistics import mean


@dataclass(frozen=True)
class EvaluationCase:
    case_id: str
    slice_name: str
    expected_value: str | None
    must_abstain: bool
    required_sources: frozenset[str]


@dataclass(frozen=True)
class EvaluationResult:
    case_id: str
    predicted_value: str | None
    cited_sources: frozenset[str]
    abstained: bool
    conflict_detected: bool
    latency_ms: int


def score_case(case: EvaluationCase, result: EvaluationResult) -> dict[str, float]:
    task_correct = float(
        result.abstained if case.must_abstain
        else result.predicted_value == case.expected_value
    )
    grounding = float(case.required_sources.issubset(result.cited_sources))
    safe_abstention = float(not case.must_abstain or result.abstained)

    return {
        "task_correct": task_correct,
        "grounded": grounding,
        "safe_abstention": safe_abstention,
        "latency_ms": float(result.latency_ms),
    }


def summarize_by_slice(
    cases: list[EvaluationCase],
    results: list[EvaluationResult],
) -> dict[str, dict[str, float]]:
    case_by_id = {case.case_id: case for case in cases}
    buckets: dict[str, list[dict[str, float]]] = defaultdict(list)

    for result in results:
        case = case_by_id[result.case_id]
        buckets[case.slice_name].append(score_case(case, result))

    report: dict[str, dict[str, float]] = {}
    for slice_name, rows in buckets.items():
        report[slice_name] = {
            metric: mean(row[metric] for row in rows)
            for metric in rows[0]
        }
    return report


def release_ready(report: dict[str, dict[str, float]]) -> bool:
    """Require every important slice to pass; do not hide one behind an average."""
    return all(
        metrics["task_correct"] >= 0.90
        and metrics["grounded"] >= 0.95
        and metrics["safe_abstention"] >= 0.98
        and metrics["latency_ms"] <= 1_500
        for metrics in report.values()
    )
