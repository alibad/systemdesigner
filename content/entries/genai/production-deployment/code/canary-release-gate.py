from dataclasses import dataclass


@dataclass(frozen=True)
class Evidence:
    task_successes: int
    evaluated_requests: int
    policy_failures: int
    p95_latency_ms: int
    compute_units_per_1000_requests: float


@dataclass(frozen=True)
class Gates:
    maximum_task_success_regression_points: float = 2.0
    maximum_policy_failure_rate_percent: float = 0.5
    maximum_p95_latency_increase_percent: float = 20.0
    maximum_compute_per_success_increase_percent: float = 15.0


def percent_change(candidate: float, baseline: float) -> float:
    if baseline <= 0:
        raise ValueError("baseline must be positive")
    return ((candidate - baseline) / baseline) * 100


def evaluate_candidate(
    baseline: Evidence,
    candidate: Evidence,
    gates: Gates = Gates(),
) -> dict[str, object]:
    baseline_success_rate = baseline.task_successes / baseline.evaluated_requests
    candidate_success_rate = candidate.task_successes / candidate.evaluated_requests
    success_delta_points = (candidate_success_rate - baseline_success_rate) * 100
    policy_failure_percent = (
        candidate.policy_failures / candidate.evaluated_requests
    ) * 100
    latency_change_percent = percent_change(
        candidate.p95_latency_ms,
        baseline.p95_latency_ms,
    )

    baseline_compute_per_success = (
        baseline.compute_units_per_1000_requests
        / (baseline_success_rate * 1000)
    )
    candidate_compute_per_success = (
        candidate.compute_units_per_1000_requests
        / (candidate_success_rate * 1000)
    )
    compute_change_percent = percent_change(
        candidate_compute_per_success,
        baseline_compute_per_success,
    )

    blockers = []
    warnings = []
    if success_delta_points < -gates.maximum_task_success_regression_points:
        blockers.append("task-success regression")
    if policy_failure_percent > gates.maximum_policy_failure_rate_percent:
        blockers.append("policy-failure boundary")
    if latency_change_percent > gates.maximum_p95_latency_increase_percent:
        warnings.append("P95 latency budget")
    if (
        compute_change_percent
        > gates.maximum_compute_per_success_increase_percent
    ):
        warnings.append("compute-per-success budget")

    decision = "rollback" if blockers else "hold" if warnings else "expand"
    return {
        "decision": decision,
        "blockers": blockers,
        "warnings": warnings,
        "task_success_delta_points": round(success_delta_points, 2),
        "policy_failure_percent": round(policy_failure_percent, 2),
        "p95_latency_change_percent": round(latency_change_percent, 2),
        "compute_per_success_change_percent": round(compute_change_percent, 2),
    }


if __name__ == "__main__":
    stable = Evidence(892, 1000, 2, 1800, 100)
    candidate = Evidence(906, 1000, 2, 1940, 104)
    print(evaluate_candidate(stable, candidate))
