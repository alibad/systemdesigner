from dataclasses import dataclass
from math import inf


@dataclass(frozen=True)
class QueuePlan:
    arrival_rate: float
    worker_count: int
    messages_per_worker_second: float
    outage_seconds: int


def evaluate(plan: QueuePlan) -> dict[str, float]:
    capacity = plan.worker_count * plan.messages_per_worker_second
    backlog = plan.arrival_rate * plan.outage_seconds
    recovery_rate = capacity - plan.arrival_rate
    recovery_seconds = backlog / recovery_rate if recovery_rate > 0 else inf

    return {
        "capacity_per_second": capacity,
        "steady_utilization": plan.arrival_rate / capacity,
        "outage_backlog": backlog,
        "recovery_seconds": recovery_seconds,
    }


if __name__ == "__main__":
    plan = QueuePlan(
        arrival_rate=900,
        worker_count=24,
        messages_per_worker_second=48,
        outage_seconds=10 * 60,
    )
    result = evaluate(plan)

    assert result["capacity_per_second"] == 1152
    assert result["outage_backlog"] == 540_000
    assert result["recovery_seconds"] < 40 * 60

    print(f"steady utilization: {result['steady_utilization']:.1%}")
    print(f"backlog after outage: {result['outage_backlog']:,.0f} messages")
    print(f"catch-up time: {result['recovery_seconds'] / 60:.1f} minutes")
