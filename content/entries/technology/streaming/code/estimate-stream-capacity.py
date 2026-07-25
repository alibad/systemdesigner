"""Estimate steady-state pressure and outage recovery for a keyed stream."""

from dataclasses import asdict, dataclass
from math import inf


@dataclass(frozen=True)
class StreamEnvelope:
    useful_consumers: int
    processing_capacity_eps: int
    utilization_pct: float
    lag_growth_eps: int
    outage_backlog_events: int
    recovery_seconds: float
    ingress_mb_per_second: float


def estimate_stream_envelope(
    *,
    input_eps: int,
    partitions: int,
    consumers: int,
    capacity_per_consumer_eps: int,
    outage_seconds: int,
    event_bytes: int,
) -> StreamEnvelope:
    useful_consumers = min(partitions, consumers)
    processing_capacity = useful_consumers * capacity_per_consumer_eps
    lag_growth = max(0, input_eps - processing_capacity)
    outage_backlog = input_eps * outage_seconds
    spare_capacity = max(0, processing_capacity - input_eps)
    recovery_seconds = outage_backlog / spare_capacity if spare_capacity else inf

    return StreamEnvelope(
        useful_consumers=useful_consumers,
        processing_capacity_eps=processing_capacity,
        utilization_pct=(input_eps / processing_capacity) * 100,
        lag_growth_eps=lag_growth,
        outage_backlog_events=outage_backlog,
        recovery_seconds=recovery_seconds,
        ingress_mb_per_second=(input_eps * event_bytes) / 1_000_000,
    )


fraud_stream = estimate_stream_envelope(
    input_eps=120_000,
    partitions=12,
    consumers=10,
    capacity_per_consumer_eps=15_000,
    outage_seconds=60,
    event_bytes=700,
)

assert fraud_stream.processing_capacity_eps == 150_000
assert fraud_stream.outage_backlog_events == 7_200_000
assert fraud_stream.recovery_seconds == 240
print(asdict(fraud_stream))
