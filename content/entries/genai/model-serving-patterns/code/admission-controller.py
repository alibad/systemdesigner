"""A dependency-free, deadline-aware admission planning model."""

from dataclasses import dataclass
from math import log2


@dataclass(frozen=True)
class RequestClass:
    name: str
    arrival_rps: float
    deadline_ms: float
    base_service_ms: float
    base_capacity_rps_per_replica: float


@dataclass(frozen=True)
class AdmissionDecision:
    effective_batch: float
    capacity_rps: float
    predicted_latency_ms: float
    accepted_rps: float
    rejected_rps: float
    reason: str


def plan_admission(
    workload: RequestClass,
    replicas: int,
    max_batch_size: int,
    batch_window_ms: float,
) -> AdmissionDecision:
    """Estimate a capacity envelope, then shed work that would miss its deadline."""
    if replicas < 1 or max_batch_size < 1 or batch_window_ms < 0:
        raise ValueError("replicas and batch size must be positive; delay cannot be negative")

    expected_arrivals_in_window = workload.arrival_rps * batch_window_ms / 1000
    effective_batch = min(max_batch_size, max(1.0, 1.0 + expected_arrivals_in_window))

    # Replace this transparent planning curve with measured batch profiles.
    batch_gain = 1.0 + 0.32 * log2(effective_batch)
    capacity_rps = replicas * workload.base_capacity_rps_per_replica * batch_gain
    admitted_rps = min(workload.arrival_rps, capacity_rps * 0.92)
    utilization = admitted_rps / max(capacity_rps, 0.001)
    queue_ms = batch_window_ms / 2 + max(0.0, utilization - 0.70) * workload.deadline_ms
    execution_ms = workload.base_service_ms * (1.0 + 0.025 * (effective_batch - 1.0))
    predicted_latency_ms = queue_ms + execution_ms

    if predicted_latency_ms >= workload.deadline_ms:
        admitted_rps = min(admitted_rps, capacity_rps * 0.70)
        reason = "shed early: predicted completion crosses the deadline"
    elif workload.arrival_rps > admitted_rps:
        reason = "shed excess: preserve headroom for admitted requests"
    else:
        reason = "admit: modeled latency and capacity remain inside the contract"

    return AdmissionDecision(
        effective_batch=effective_batch,
        capacity_rps=capacity_rps,
        predicted_latency_ms=predicted_latency_ms,
        accepted_rps=admitted_rps,
        rejected_rps=max(0.0, workload.arrival_rps - admitted_rps),
        reason=reason,
    )


if __name__ == "__main__":
    profile = RequestClass(
        name="interactive-ranking",
        arrival_rps=104,
        deadline_ms=180,
        base_service_ms=34,
        base_capacity_rps_per_replica=22,
    )
    decision = plan_admission(profile, replicas=4, max_batch_size=8, batch_window_ms=8)
    print(f"workload={profile.name}")
    print(f"effective_batch={decision.effective_batch:.1f}")
    print(f"capacity_rps={decision.capacity_rps:.1f}")
    print(f"predicted_latency_ms={decision.predicted_latency_ms:.1f}")
    print(f"accepted_rps={decision.accepted_rps:.1f}")
    print(f"rejected_rps={decision.rejected_rps:.1f}")
    print(f"decision={decision.reason}")
