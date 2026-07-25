"""Transparent streaming-capacity arithmetic for planning and alerts.

The per-worker rate must come from a representative load test. This model does not
predict Dataflow's autoscaling decisions or the time required to add workers.
"""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class CapacityInputs:
    incoming_records_per_second: int
    observed_records_per_worker_second: int
    active_workers: int
    max_workers: int
    usable_parallel_slots: int
    observation_seconds: int = 60


def capacity_envelope(inputs: CapacityInputs) -> dict[str, int | str]:
    if min(
        inputs.incoming_records_per_second,
        inputs.observed_records_per_worker_second,
        inputs.active_workers,
        inputs.max_workers,
        inputs.usable_parallel_slots,
        inputs.observation_seconds,
    ) <= 0:
        raise ValueError("capacity inputs must be positive")

    current_workers = min(
        inputs.active_workers,
        inputs.max_workers,
        inputs.usable_parallel_slots,
    )
    ceiling_workers = min(inputs.max_workers, inputs.usable_parallel_slots)
    current_rate = current_workers * inputs.observed_records_per_worker_second
    ceiling_rate = ceiling_workers * inputs.observed_records_per_worker_second
    required_workers = ceil(
        inputs.incoming_records_per_second
        / inputs.observed_records_per_worker_second
    )

    if current_rate >= inputs.incoming_records_per_second:
        verdict = "stable"
    elif ceiling_rate >= inputs.incoming_records_per_second:
        verdict = "autoscaling-headroom"
    else:
        verdict = "constrained"

    return {
        "verdict": verdict,
        "current_capacity_per_second": current_rate,
        "ceiling_capacity_per_second": ceiling_rate,
        "required_workers": required_workers,
        "current_backlog_change": (
            inputs.incoming_records_per_second - current_rate
        )
        * inputs.observation_seconds,
        "ceiling_backlog_change": (
            inputs.incoming_records_per_second - ceiling_rate
        )
        * inputs.observation_seconds,
    }


if __name__ == "__main__":
    sample = CapacityInputs(
        incoming_records_per_second=18_000,
        observed_records_per_worker_second=1_500,
        active_workers=6,
        max_workers=16,
        usable_parallel_slots=24,
    )
    result = capacity_envelope(sample)
    assert result["verdict"] == "autoscaling-headroom"
    assert result["required_workers"] == 12
    print(result)
