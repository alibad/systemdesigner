"""Estimate a transparent Azure workload planning envelope.

The rates below are illustrative teaching assumptions, not an Azure price quote.
Replace them with current regional prices and measured workload telemetry.
"""

from dataclasses import dataclass
from math import ceil


HOURS_PER_MONTH = 730


@dataclass(frozen=True)
class Workload:
    peak_rps: int
    average_to_peak_ratio: float
    response_kib: float
    public_egress_ratio: float
    data_gib: int
    zones: int


def estimate(workload: Workload) -> dict[str, float]:
    sustainable_rps_per_instance = 420
    target_utilization = 0.65
    instance_hourly_usd = 0.128
    storage_gib_month_usd = 0.021
    egress_gib_usd = 0.087

    required_instances = ceil(
        workload.peak_rps / (sustainable_rps_per_instance * target_utilization)
    )
    # Keep two instances in every selected zone so one instance can disappear safely.
    instances = max(required_instances, workload.zones * 2)
    average_rps = workload.peak_rps * workload.average_to_peak_ratio
    monthly_public_egress_gib = (
        average_rps
        * workload.response_kib
        * workload.public_egress_ratio
        * HOURS_PER_MONTH
        * 3600
        / (1024**2)
    )

    compute_usd = instances * instance_hourly_usd * HOURS_PER_MONTH
    storage_usd = workload.data_gib * storage_gib_month_usd
    egress_usd = monthly_public_egress_gib * egress_gib_usd
    return {
        "instances": float(instances),
        "steady_utilization_pct": average_rps
        / (instances * sustainable_rps_per_instance)
        * 100,
        "monthly_public_egress_gib": monthly_public_egress_gib,
        "illustrative_variable_usd": compute_usd + storage_usd + egress_usd,
    }


if __name__ == "__main__":
    result = estimate(
        Workload(
            peak_rps=4_200,
            average_to_peak_ratio=0.36,
            response_kib=7,
            public_egress_ratio=0.65,
            data_gib=750,
            zones=3,
        )
    )
    assert result["instances"] == 16
    assert result["steady_utilization_pct"] < 25
    print(f"instances: {result['instances']:.0f}")
    print(f"steady utilization: {result['steady_utilization_pct']:.1f}%")
    print(f"public egress: {result['monthly_public_egress_gib']:,.0f} GiB/month")
    print(f"illustrative variable cost: ${result['illustrative_variable_usd']:,.0f}/month")
