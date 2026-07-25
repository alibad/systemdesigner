"""Estimate a Cosmos DB request envelope without external dependencies."""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class Workload:
    requests_per_second: int
    read_share: float
    write_share: float
    query_share: float
    provisioned_ru_per_second: int
    hottest_key_share: float
    strong_reads: bool = False


def estimate(workload: Workload) -> dict[str, float | int | bool]:
    read_multiplier = 2 if workload.strong_reads else 1
    ru_per_request = (
        workload.read_share * 1 * read_multiplier
        + workload.write_share * 5
        + workload.query_share * 12 * read_multiplier
    )
    required_ru = workload.requests_per_second * ru_per_request
    physical_partitions = max(1, ceil(workload.provisioned_ru_per_second / 10_000))
    per_partition_budget = workload.provisioned_ru_per_second / physical_partitions
    hottest_partition_ru = required_ru * workload.hottest_key_share
    pressure = max(
        required_ru / workload.provisioned_ru_per_second,
        hottest_partition_ru / per_partition_budget,
    )
    return {
        "ru_per_request": round(ru_per_request, 2),
        "required_ru_per_second": round(required_ru),
        "physical_partitions": physical_partitions,
        "hottest_partition_ru": round(hottest_partition_ru),
        "bottleneck_pressure_pct": round(pressure * 100, 1),
        "has_planning_headroom": pressure < 0.8,
    }


if __name__ == "__main__":
    result = estimate(
        Workload(
            requests_per_second=1_200,
            read_share=0.70,
            write_share=0.25,
            query_share=0.05,
            provisioned_ru_per_second=12_000,
            hottest_key_share=0.18,
        )
    )
    assert result["required_ru_per_second"] == 3_060
    assert result["has_planning_headroom"] is True
    print(result)
