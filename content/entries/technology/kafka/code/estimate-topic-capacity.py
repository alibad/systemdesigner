"""Transparent Kafka topic sizing model used by the lesson.

The thresholds are planning assumptions, not Kafka product limits. Replace them with
benchmarks from the intended record shape, hardware, acknowledgement policy, and
failure-recovery target.
"""

from dataclasses import dataclass

MIB = 1024**2
TIB = 1024**4


@dataclass(frozen=True)
class TopicPlan:
    events_per_second: int
    average_event_bytes: int
    retention_hours: int
    replication_factor: int
    brokers: int
    partitions: int
    consumer_instances: int
    consumer_capacity_events_per_second: int
    reserve_percent: int = 25


def estimate(plan: TopicPlan) -> dict[str, float]:
    if plan.replication_factor > plan.brokers:
        raise ValueError("replication factor cannot exceed broker count")

    logical_bytes_per_second = plan.events_per_second * plan.average_event_bytes
    replica_bytes_per_second = logical_bytes_per_second * plan.replication_factor
    retained_replica_bytes = (
        replica_bytes_per_second * plan.retention_hours * 3600
    )
    provisioned_bytes = retained_replica_bytes / (1 - plan.reserve_percent / 100)
    active_consumers = min(plan.partitions, plan.consumer_instances)

    return {
        "logical_ingress_mib_per_second": logical_bytes_per_second / MIB,
        "replica_ingress_mib_per_broker": replica_bytes_per_second / MIB / plan.brokers,
        "provisioned_storage_tib": provisioned_bytes / TIB,
        "storage_tib_per_broker": provisioned_bytes / TIB / plan.brokers,
        "events_per_partition": plan.events_per_second / plan.partitions,
        "events_per_active_consumer": plan.events_per_second / active_consumers,
        "consumer_utilization_percent": (
            plan.events_per_second
            / (active_consumers * plan.consumer_capacity_events_per_second)
            * 100
        ),
    }


if __name__ == "__main__":
    checkout = TopicPlan(
        events_per_second=90_000,
        average_event_bytes=850,
        retention_hours=72,
        replication_factor=3,
        brokers=10,
        partitions=24,
        consumer_instances=12,
        consumer_capacity_events_per_second=10_000,
    )
    result = estimate(checkout)

    assert round(result["consumer_utilization_percent"], 1) == 75.0
    assert result["replica_ingress_mib_per_broker"] < 55
    assert result["storage_tib_per_broker"] < 8
    assert result["events_per_partition"] == 3_750

    for metric, value in result.items():
        print(f"{metric}: {value:,.2f}")
