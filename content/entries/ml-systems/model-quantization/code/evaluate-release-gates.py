from dataclasses import dataclass


@dataclass(frozen=True)
class Evidence:
    p95_ms: float
    peak_memory_mb: int
    operator_coverage_percent: float
    aggregate_score: float
    slice_scores: dict[str, float]
    rollback_ready: bool


def release_failures(
    baseline: Evidence,
    candidate: Evidence,
    *,
    max_p95_ms: float,
    max_memory_mb: int,
    max_aggregate_drop: float,
    max_slice_drop: float,
) -> list[str]:
    failures: list[str] = []

    if candidate.p95_ms > max_p95_ms:
        failures.append("p95 latency exceeds the target-device budget")
    if candidate.peak_memory_mb > max_memory_mb:
        failures.append("peak memory exceeds the service envelope")
    if candidate.operator_coverage_percent < 100:
        failures.append("the target graph contains an unplanned fallback")
    if baseline.aggregate_score - candidate.aggregate_score > max_aggregate_drop:
        failures.append("aggregate quality regression exceeds its budget")

    for name, baseline_score in baseline.slice_scores.items():
        candidate_score = candidate.slice_scores.get(name)
        if candidate_score is None:
            failures.append(f"required slice is missing: {name}")
        elif baseline_score - candidate_score > max_slice_drop:
            failures.append(f"slice regression exceeds its budget: {name}")

    if not candidate.rollback_ready:
        failures.append("compatible rollback artifact is not ready")

    return failures
