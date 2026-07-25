"""Estimate one transfer without hiding units or path assumptions."""

from dataclasses import asdict, dataclass
import json


BITS_PER_BYTE = 8
DECIMAL_MB = 1_000_000


@dataclass(frozen=True)
class TransferBudget:
    source_bytes: int
    representation_bytes: int
    wire_bytes: int
    serialization_ms: float
    path_delay_ms: float
    completion_ms: float
    bandwidth_delay_product_bytes: float


def estimate_transfer(
    *,
    source_bytes: int,
    body_ratio: float,
    wire_overhead_percent: float,
    bottleneck_bandwidth_mbps: float,
    measured_goodput_mbps: float,
    round_trip_ms: float,
    sequential_round_trips: int,
) -> TransferBudget:
    """Return a planning lower bound from explicit dimensional inputs."""
    if source_bytes <= 0 or body_ratio <= 0 or bottleneck_bandwidth_mbps <= 0 or measured_goodput_mbps <= 0:
        raise ValueError("size, representation ratio, bottleneck bandwidth, and goodput must be positive")
    if round_trip_ms < 0 or sequential_round_trips < 0:
        raise ValueError("delay inputs cannot be negative")

    representation_bytes = round(source_bytes * body_ratio)
    wire_bytes = round(representation_bytes * (1 + wire_overhead_percent / 100))
    serialization_ms = wire_bytes * BITS_PER_BYTE / (measured_goodput_mbps * 1_000_000) * 1_000
    path_delay_ms = round_trip_ms * sequential_round_trips
    bdp_bytes = bottleneck_bandwidth_mbps * 1_000_000 * (round_trip_ms / 1_000) / BITS_PER_BYTE

    return TransferBudget(
        source_bytes=source_bytes,
        representation_bytes=representation_bytes,
        wire_bytes=wire_bytes,
        serialization_ms=round(serialization_ms, 2),
        path_delay_ms=round(path_delay_ms, 2),
        completion_ms=round(path_delay_ms + serialization_ms, 2),
        bandwidth_delay_product_bytes=round(bdp_bytes, 2),
    )


if __name__ == "__main__":
    scenarios = {
        "warm_regional_compressed": estimate_transfer(
            source_bytes=DECIMAL_MB,
            body_ratio=0.38,
            wire_overhead_percent=4,
            bottleneck_bandwidth_mbps=100,
            measured_goodput_mbps=80,
            round_trip_ms=30,
            sequential_round_trips=1,
        ),
        "cold_mobile_uncompressed": estimate_transfer(
            source_bytes=DECIMAL_MB,
            body_ratio=1,
            wire_overhead_percent=8,
            bottleneck_bandwidth_mbps=10,
            measured_goodput_mbps=8,
            round_trip_ms=90,
            sequential_round_trips=3,
        ),
    }

    assert scenarios["warm_regional_compressed"].completion_ms < scenarios["cold_mobile_uncompressed"].completion_ms
    print(json.dumps({name: asdict(result) for name, result in scenarios.items()}, indent=2))
