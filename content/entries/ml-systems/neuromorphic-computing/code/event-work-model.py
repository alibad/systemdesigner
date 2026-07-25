"""Compare dense sampling with a transparent event-driven work model."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Workload:
    sample_rate_hz: int
    channels: int
    fanout: int
    change_events_per_second: int
    burst_factor: float


def estimate_work(workload: Workload, router_capacity: int) -> dict[str, float]:
    dense_synaptic_opportunities = (
        workload.sample_rate_hz * workload.channels * workload.fanout
    )
    event_synaptic_additions = workload.change_events_per_second * workload.fanout
    peak_event_rate = workload.change_events_per_second * workload.burst_factor

    return {
        "dense_synaptic_opportunities_per_second": dense_synaptic_opportunities,
        "event_synaptic_additions_per_second": event_synaptic_additions,
        "event_work_share": event_synaptic_additions / dense_synaptic_opportunities,
        "peak_router_utilization": peak_event_rate / router_capacity,
    }


if __name__ == "__main__":
    case = Workload(
        sample_rate_hz=1_000,
        channels=128,
        fanout=24,
        change_events_per_second=22_000,
        burst_factor=2.4,
    )
    result = estimate_work(case, router_capacity=180_000)

    assert 0 < result["event_work_share"] < 1
    assert result["peak_router_utilization"] < 1

    for name, value in result.items():
        print(f"{name}: {value:.3f}")
