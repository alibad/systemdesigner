"""Estimate concentrated shard load and physical write pressure."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ScalingEnvelope:
    peak_writes_per_second: int
    shard_count: int
    hottest_share: float
    replication_factor: int
    logical_payload_kb: float

    def calculate(self) -> dict[str, float]:
        balanced_writes = self.peak_writes_per_second / self.shard_count
        hottest_writes = self.peak_writes_per_second * self.hottest_share
        replica_network_mb = (
            self.peak_writes_per_second
            * self.logical_payload_kb
            * (self.replication_factor - 1)
            / 1024
        )
        physical_write_mb = (
            self.peak_writes_per_second
            * self.logical_payload_kb
            * self.replication_factor
            / 1024
        )
        return {
            "balanced_writes_per_shard": balanced_writes,
            "hottest_writes_per_shard": hottest_writes,
            "imbalance_ratio": hottest_writes / balanced_writes,
            "replica_network_mb_per_second": replica_network_mb,
            "physical_write_mb_per_second_floor": physical_write_mb,
        }


if __name__ == "__main__":
    envelope = ScalingEnvelope(
        peak_writes_per_second=120_000,
        shard_count=4,
        hottest_share=0.48,
        replication_factor=3,
        logical_payload_kb=1.5,
    )
    for metric, value in envelope.calculate().items():
        print(f"{metric}: {value:,.2f}")
