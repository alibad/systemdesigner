#!/usr/bin/env python3
"""Estimate edge bandwidth, segment requests, and origin miss traffic."""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class DeliveryEstimate:
    edge_tbps: float
    segment_requests_per_second: int
    origin_tbps: float
    origin_headroom_percent: float


def estimate(
    viewers: int,
    bitrate_mbps: float,
    segment_seconds: float,
    byte_hit_percent: float,
    origin_safe_tbps: float,
) -> DeliveryEstimate:
    if viewers <= 0 or bitrate_mbps <= 0 or segment_seconds <= 0:
        raise ValueError("viewer, bitrate, and segment inputs must be positive")
    if not 0 <= byte_hit_percent <= 100:
        raise ValueError("byte hit percent must be between 0 and 100")

    edge_tbps = viewers * bitrate_mbps / 1_000_000
    origin_tbps = edge_tbps * (1 - byte_hit_percent / 100)
    headroom = max(0.0, (origin_safe_tbps - origin_tbps) / origin_safe_tbps * 100)
    return DeliveryEstimate(
        edge_tbps=round(edge_tbps, 3),
        segment_requests_per_second=round(viewers / segment_seconds),
        origin_tbps=round(origin_tbps, 3),
        origin_headroom_percent=round(headroom, 1),
    )


if __name__ == "__main__":
    result = estimate(2_000_000, 3.5, 6, 92, 1.2)
    assert result.edge_tbps == 7.0
    assert result.origin_tbps == 0.56
    print(asdict(result))
