"""Estimate a Memcached memory and miss-load envelope without external packages."""

from dataclasses import dataclass


GIB = 1024**3
KIB = 1024


@dataclass(frozen=True)
class CachePlan:
    nodes: int
    memory_gib_per_node: float
    working_set_items: int
    average_value_kib: float
    requests_per_second: int
    target_hit_rate: float
    allocation_efficiency: float = 0.84
    key_and_metadata_bytes: int = 96

    def estimate(self) -> dict[str, float]:
        item_bytes = self.average_value_kib * KIB + self.key_and_metadata_bytes
        usable_bytes = self.nodes * self.memory_gib_per_node * GIB * self.allocation_efficiency
        working_set_bytes = self.working_set_items * item_bytes
        return {
            "resident_coverage": min(1.0, usable_bytes / working_set_bytes),
            "misses_per_second": self.requests_per_second * (1 - self.target_hit_rate),
            "operations_per_node": self.requests_per_second / self.nodes,
            "working_set_gib": working_set_bytes / GIB,
        }


if __name__ == "__main__":
    plan = CachePlan(
        nodes=4,
        memory_gib_per_node=16,
        working_set_items=4_000_000,
        average_value_kib=6,
        requests_per_second=90_000,
        target_hit_rate=0.92,
    )
    result = plan.estimate()
    assert 0 < result["resident_coverage"] <= 1
    assert abs(result["misses_per_second"] - 7_200) < 0.001
    print(f"working set: {result['working_set_gib']:.1f} GiB")
    print(f"resident coverage: {result['resident_coverage']:.0%}")
    print(f"backend misses: {result['misses_per_second']:,.0f} req/s")
    print(f"cache operations per node: {result['operations_per_node']:,.0f} req/s")
