"""A deterministic rollout gate for a smart-completion bundle."""

from dataclasses import dataclass
from math import sqrt


@dataclass(frozen=True)
class Evidence:
    sample_size: int
    accepted_character_lift_percent: float
    p95_latency_delta_ms: float
    stale_discard_percent: float
    unsafe_suggestions_per_million: float
    complaint_delta_per_100k: float
    worst_slice_lift_percent: float


@dataclass(frozen=True)
class Guardrails:
    minimum_sample: int = 30_000
    minimum_lift_percent: float = 2.0
    maximum_latency_delta_ms: float = 10.0
    maximum_stale_discard_percent: float = 3.0
    maximum_unsafe_per_million: float = 2.0
    maximum_complaint_delta_per_100k: float = 1.0
    minimum_worst_slice_lift_percent: float = 0.0


def lift_lower_bound(evidence: Evidence) -> float:
    """Teaching approximation: uncertainty shrinks as observed events accumulate."""
    margin = 120 / sqrt(max(evidence.sample_size, 1))
    return evidence.accepted_character_lift_percent - margin


def rollout_action(evidence: Evidence, limits: Guardrails) -> tuple[str, list[str]]:
    failures: list[str] = []

    if evidence.sample_size < limits.minimum_sample:
        failures.append("insufficient-evidence")
    if lift_lower_bound(evidence) < limits.minimum_lift_percent:
        failures.append("usefulness-floor")
    if evidence.p95_latency_delta_ms > limits.maximum_latency_delta_ms:
        failures.append("latency-guardrail")
    if evidence.stale_discard_percent > limits.maximum_stale_discard_percent:
        failures.append("freshness-guardrail")
    if evidence.unsafe_suggestions_per_million > limits.maximum_unsafe_per_million:
        failures.append("safety-guardrail")
    if evidence.complaint_delta_per_100k > limits.maximum_complaint_delta_per_100k:
        failures.append("complaint-guardrail")
    if evidence.worst_slice_lift_percent < limits.minimum_worst_slice_lift_percent:
        failures.append("slice-guardrail")

    severe = {"safety-guardrail", "complaint-guardrail"}
    if severe.intersection(failures):
        return "rollback", failures
    if failures:
        return "hold", failures
    return "expand", []


if __name__ == "__main__":
    healthy = Evidence(40_000, 5.2, 4, 1.2, 0.4, 0.1, 1.5)
    unsafe = Evidence(44_000, 6.1, 6, 1.4, 5.6, 2.4, 0.8)
    limits = Guardrails()

    assert rollout_action(healthy, limits) == ("expand", [])
    action, reasons = rollout_action(unsafe, limits)
    assert action == "rollback"
    assert "safety-guardrail" in reasons
    print({"healthy": rollout_action(healthy, limits), "unsafe": (action, reasons)})
