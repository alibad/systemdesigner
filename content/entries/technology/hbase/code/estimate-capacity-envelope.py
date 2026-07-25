"""Estimate HBase regions, storage nodes, and compaction debt."""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class Envelope:
    regions: int
    required_region_servers: int
    physical_storage_tib: float
    splits_per_day: float
    compaction_demand_mibps: float
    backlog_gib_per_day: float


def estimate(
    logical_data_tib: float,
    daily_growth_gib: float,
    target_region_gib: float,
    replication_factor: int,
    write_amplification: float,
    compaction_capacity_mibps: float,
    usable_disk_tib_per_server: float = 6,
    safe_regions_per_server: int = 220,
) -> Envelope:
    regions = ceil(logical_data_tib * 1024 / target_region_gib)
    physical_storage_tib = logical_data_tib * replication_factor
    storage_servers = ceil(physical_storage_tib / usable_disk_tib_per_server)
    region_servers = ceil(regions / safe_regions_per_server)
    required_servers = max(3, storage_servers, region_servers)

    logical_ingest_mibps = daily_growth_gib * 1024 / 86_400
    compaction_demand = logical_ingest_mibps * (write_amplification - 1)
    deficit_mibps = max(0, compaction_demand - compaction_capacity_mibps)
    backlog_gib_per_day = deficit_mibps * 86_400 / 1024

    return Envelope(
        regions=regions,
        required_region_servers=required_servers,
        physical_storage_tib=physical_storage_tib,
        splits_per_day=daily_growth_gib / target_region_gib,
        compaction_demand_mibps=compaction_demand,
        backlog_gib_per_day=backlog_gib_per_day,
    )


if __name__ == "__main__":
    healthy = estimate(18, 850, 12, 3, 4.5, 60)
    pressured = estimate(18, 2_500, 8, 3, 8, 60)

    assert healthy.regions == 1536
    assert healthy.backlog_gib_per_day == 0
    assert pressured.backlog_gib_per_day > 0
    assert pressured.splits_per_day > healthy.splits_per_day

    print("healthy:", healthy)
    print("pressured:", pressured)
