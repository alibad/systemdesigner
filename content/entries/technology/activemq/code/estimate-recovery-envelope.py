"""Dependency-free backlog and recovery arithmetic for a message consumer pool."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Workload:
    arrival_per_second: float
    consumer_count: int
    per_consumer_per_second: float
    interruption_minutes: float
    reserve_percent: float = 25.0


def estimate(workload: Workload) -> dict[str, float]:
    measured_capacity = workload.consumer_count * workload.per_consumer_per_second
    planned_capacity = measured_capacity * (1 - workload.reserve_percent / 100)
    recovery_headroom = planned_capacity - workload.arrival_per_second
    backlog = workload.arrival_per_second * workload.interruption_minutes * 60
    recovery_minutes = (
        backlog / recovery_headroom / 60
        if recovery_headroom > 0
        else float("inf")
    )
    return {
        "measured_capacity": measured_capacity,
        "planned_capacity": planned_capacity,
        "backlog": backlog,
        "recovery_minutes": recovery_minutes,
    }


if __name__ == "__main__":
    result = estimate(
        Workload(
            arrival_per_second=2_500,
            consumer_count=10,
            per_consumer_per_second=350,
            interruption_minutes=10,
        )
    )
    assert result["measured_capacity"] == 3_500
    assert result["planned_capacity"] == 2_625
    assert result["backlog"] == 1_500_000
    assert result["recovery_minutes"] == 200

    for name, value in result.items():
        print(f"{name}: {value:,.1f}")
