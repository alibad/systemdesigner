"""Evaluate serving capacity and recovery objectives for an Azure topology."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FailurePlan:
    topology: str
    normal_capacity_pct: float
    zones_per_region: int
    secondary_capacity_pct: float
    region_recovery_minutes: int
    region_rpo_minutes: int


def evaluate(plan: FailurePlan, failure: str) -> dict[str, float | str]:
    if failure == "zone":
        surviving_capacity = plan.normal_capacity_pct * (
            1 - 1 / plan.zones_per_region
        )
        rto_minutes = 5 if plan.zones_per_region > 1 else 45
        rpo_minutes = 0
    elif failure == "region":
        surviving_capacity = plan.secondary_capacity_pct
        rto_minutes = plan.region_recovery_minutes
        rpo_minutes = plan.region_rpo_minutes
    else:
        raise ValueError(f"unsupported failure: {failure}")

    if surviving_capacity >= 100:
        verdict = "traffic can remain inside the modeled capacity envelope"
    elif surviving_capacity > 0:
        verdict = "failover needs load shedding or rapid scale-out"
    else:
        verdict = "service waits for restore or replacement capacity"

    return {
        "surviving_capacity_pct": surviving_capacity,
        "rto_minutes": float(rto_minutes),
        "rpo_minutes": float(rpo_minutes),
        "verdict": verdict,
    }


if __name__ == "__main__":
    plan = FailurePlan(
        topology="warm-secondary",
        normal_capacity_pct=165,
        zones_per_region=3,
        secondary_capacity_pct=75,
        region_recovery_minutes=35,
        region_rpo_minutes=5,
    )
    zone_result = evaluate(plan, "zone")
    region_result = evaluate(plan, "region")
    assert zone_result["surviving_capacity_pct"] >= 100
    assert region_result["surviving_capacity_pct"] < 100
    print(f"zone loss: {zone_result}")
    print(f"region loss: {region_result}")
