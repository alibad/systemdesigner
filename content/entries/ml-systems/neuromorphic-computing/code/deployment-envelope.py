"""Gate a neuromorphic deployment with matched quality and latency boundaries."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DeploymentCase:
    dense_ops_per_second: int
    activity_share: float
    disturbance_multiplier: float
    capacity_units_per_second: int
    base_latency_ms: float
    deadline_ms: float
    baseline_quality: float
    quality_penalty: float
    quality_floor: float


def evaluate(case: DeploymentCase) -> dict[str, float | bool]:
    routed_work = (
        case.dense_ops_per_second
        * case.activity_share
        * case.disturbance_multiplier
    )
    utilization = routed_work / case.capacity_units_per_second
    queue_latency_ms = max(0.0, utilization - 0.7) * 20
    overload_share = max(0.0, routed_work - case.capacity_units_per_second) / max(
        1.0, routed_work
    )
    quality = case.baseline_quality - case.quality_penalty - 30 * overload_share
    latency_ms = case.base_latency_ms + queue_latency_ms

    return {
        "utilization": utilization,
        "latency_ms": latency_ms,
        "quality": quality,
        "fits": (
            utilization <= 1
            and latency_ms <= case.deadline_ms
            and quality >= case.quality_floor
        ),
    }


if __name__ == "__main__":
    nominal = DeploymentCase(
        dense_ops_per_second=2_400_000,
        activity_share=0.18,
        disturbance_multiplier=1.0,
        capacity_units_per_second=760_000,
        base_latency_ms=3.0,
        deadline_ms=24,
        baseline_quality=96,
        quality_penalty=1.5,
        quality_floor=92,
    )
    stressed = DeploymentCase(**{**nominal.__dict__, "disturbance_multiplier": 3.2})

    nominal_result = evaluate(nominal)
    stressed_result = evaluate(stressed)

    assert nominal_result["fits"] is True
    assert stressed_result["fits"] is False
    print("nominal:", nominal_result)
    print("noise burst:", stressed_result)
