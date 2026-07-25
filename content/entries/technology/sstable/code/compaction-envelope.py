"""Check whether compaction throughput and disk headroom are sustainable."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CompactionEnvelope:
    required_compaction_mbps: float
    backlog_growth_gib_per_hour: float
    free_disk_gib: float
    temporary_disk_gib: float

    @property
    def sustainable(self) -> bool:
        return (
            self.backlog_growth_gib_per_hour == 0
            and self.free_disk_gib >= self.temporary_disk_gib
        )


def evaluate(
    *,
    live_data_gib: float,
    active_compaction_gib: float,
    logical_write_mbps: float,
    write_amplification: float,
    compaction_capacity_mbps: float,
    free_disk_percent: float,
    temporary_input_multiplier: float,
) -> CompactionEnvelope:
    if write_amplification < 1:
        raise ValueError("write amplification cannot be below one")
    if not 0 < free_disk_percent < 100:
        raise ValueError("free_disk_percent must be between zero and 100")

    required = logical_write_mbps * (write_amplification - 1)
    deficit = max(0.0, required - compaction_capacity_mbps)
    backlog_gib_per_hour = deficit * 3600 / 1024

    total_disk_gib = live_data_gib / (1 - free_disk_percent / 100)
    free_disk_gib = total_disk_gib - live_data_gib
    temporary_disk_gib = active_compaction_gib * temporary_input_multiplier

    return CompactionEnvelope(
        required_compaction_mbps=required,
        backlog_growth_gib_per_hour=backlog_gib_per_hour,
        free_disk_gib=free_disk_gib,
        temporary_disk_gib=temporary_disk_gib,
    )


if __name__ == "__main__":
    plan = evaluate(
        live_data_gib=600,
        active_compaction_gib=72,
        logical_write_mbps=80,
        write_amplification=7.2,
        compaction_capacity_mbps=520,
        free_disk_percent=28,
        temporary_input_multiplier=1.12,
    )

    assert plan.required_compaction_mbps == 496
    assert plan.backlog_growth_gib_per_hour == 0
    assert plan.sustainable
    print(plan)
