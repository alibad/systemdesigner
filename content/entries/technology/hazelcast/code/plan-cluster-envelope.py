"""Estimate a protected Hazelcast map footprint without external packages."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ClusterPlan:
    members: int
    primary_data_gib: float
    backups: int
    usable_heap_gib_per_member: float
    object_overhead_ratio: float = 0.25
    recovery_reserve_ratio: float = 0.30

    def estimate(self) -> dict[str, float | bool]:
        stored_gib = self.primary_data_gib * (1 + self.backups)
        with_overhead_gib = stored_gib * (1 + self.object_overhead_ratio)
        protected_gib = with_overhead_gib / (1 - self.recovery_reserve_ratio)
        cluster_heap_gib = self.members * self.usable_heap_gib_per_member
        return {
            "stored_gib": stored_gib,
            "protected_gib": protected_gib,
            "cluster_heap_gib": cluster_heap_gib,
            "planned_utilization": protected_gib / cluster_heap_gib,
            "distinct_copy_placement": self.members > self.backups,
        }


if __name__ == "__main__":
    plan = ClusterPlan(
        members=4,
        primary_data_gib=64,
        backups=1,
        usable_heap_gib_per_member=64,
    )
    result = plan.estimate()
    assert result["distinct_copy_placement"] is True
    assert 0 < result["planned_utilization"] < 1
    print(f"stored copies: {result['stored_gib']:.0f} GiB")
    print(f"protected footprint: {result['protected_gib']:.0f} GiB")
    print(f"cluster heap: {result['cluster_heap_gib']:.0f} GiB")
    print(f"planned utilization: {result['planned_utilization']:.0%}")
