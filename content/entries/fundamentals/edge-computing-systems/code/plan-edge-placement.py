"""Estimate whether an edge workload can meet latency and bandwidth constraints."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PlacementResult:
    raw_mbps: float
    upstream_mbps: float
    local_latency_ms: float
    cloud_latency_ms: float
    recommendation: str


def plan_placement(
    *,
    events_per_second: int,
    payload_kb: int,
    local_reduction_percent: float,
    wan_round_trip_ms: float,
    local_compute_ms: float,
    cloud_compute_ms: float,
    deadline_ms: float,
    uplink_mbps: float,
    must_operate_offline: bool,
) -> PlacementResult:
    raw_mbps = events_per_second * payload_kb * 8 / 1000
    upstream_mbps = raw_mbps * (1 - local_reduction_percent / 100)
    one_event_transfer_ms = payload_kb * 8 / uplink_mbps
    local_latency_ms = local_compute_ms + 4
    cloud_latency_ms = wan_round_trip_ms + cloud_compute_ms + one_event_transfer_ms

    local_meets_deadline = local_latency_ms <= deadline_ms
    cloud_meets_deadline = cloud_latency_ms <= deadline_ms

    if must_operate_offline and local_meets_deadline:
        recommendation = "edge-primary"
    elif local_meets_deadline and (not cloud_meets_deadline or upstream_mbps > uplink_mbps):
        recommendation = "hybrid"
    elif cloud_meets_deadline:
        recommendation = "cloud-primary"
    else:
        recommendation = "redesign-required"

    return PlacementResult(
        raw_mbps=raw_mbps,
        upstream_mbps=upstream_mbps,
        local_latency_ms=local_latency_ms,
        cloud_latency_ms=cloud_latency_ms,
        recommendation=recommendation,
    )


if __name__ == "__main__":
    camera = plan_placement(
        events_per_second=120,
        payload_kb=350,
        local_reduction_percent=96,
        wan_round_trip_ms=85,
        local_compute_ms=28,
        cloud_compute_ms=35,
        deadline_ms=150,
        uplink_mbps=50,
        must_operate_offline=True,
    )

    assert round(camera.raw_mbps, 2) == 336.00
    assert round(camera.upstream_mbps, 2) == 13.44
    assert camera.local_latency_ms < 150 < camera.cloud_latency_ms
    assert camera.recommendation == "edge-primary"

    print(camera)
