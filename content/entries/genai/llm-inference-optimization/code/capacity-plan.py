"""Estimate HBM packing and decode capacity for a serving plan.

The speed factors are planning assumptions, not vendor benchmark claims. Replace them
with matched-quality measurements from the intended kernel and hardware.
"""

from dataclasses import dataclass
from math import ceil, floor


@dataclass(frozen=True)
class Precision:
    name: str
    bits_per_weight: int
    packing_overhead: float
    measured_speed_factor: float
    requires_quality_recheck: bool


@dataclass(frozen=True)
class Decoder:
    name: str
    draft_tokens: int
    draft_memory_gb: float
    draft_cost_ratio: float


def target_passes_per_100_tokens(decoder: Decoder, acceptance: float) -> int:
    accepted_per_pass = 1 + decoder.draft_tokens * acceptance
    return ceil(100 / accepted_per_pass)


def plan_capacity(
    parameters_billions: float,
    precision: Precision,
    decoder: Decoder,
    hbm_pool_gb: float,
    kv_reserve_gb: float,
    engine_workspace_gb: float,
    baseline_tokens_per_second: float,
    acceptance: float,
) -> dict[str, float | int | bool]:
    raw_weights_gb = parameters_billions * precision.bits_per_weight / 8
    packed_weights_gb = raw_weights_gb * precision.packing_overhead
    replica_gb = (
        packed_weights_gb
        + kv_reserve_gb
        + engine_workspace_gb
        + decoder.draft_memory_gb
    )
    replicas = floor(hbm_pool_gb / replica_gb)

    accepted_per_pass = 1 + decoder.draft_tokens * acceptance
    speculative_factor = accepted_per_pass / (1 + decoder.draft_cost_ratio)
    speculative_factor = max(1.0, min(speculative_factor, 2.4))
    pool_tokens_per_second = (
        replicas
        * baseline_tokens_per_second
        * precision.measured_speed_factor
        * speculative_factor
    )

    return {
        "raw_weights_gb": round(raw_weights_gb, 1),
        "replica_gb": round(replica_gb, 1),
        "replicas": replicas,
        "target_passes_per_100_tokens": target_passes_per_100_tokens(
            decoder, acceptance
        ),
        "pool_tokens_per_second": round(pool_tokens_per_second),
        "requires_quality_recheck": precision.requires_quality_recheck,
    }


if __name__ == "__main__":
    int4 = Precision("W4A16", 4, 1.12, 1.35, True)
    draft = Decoder("small draft model", 4, 6, 0.35)
    result = plan_capacity(
        parameters_billions=70,
        precision=int4,
        decoder=draft,
        hbm_pool_gb=320,
        kv_reserve_gb=12,
        engine_workspace_gb=4,
        baseline_tokens_per_second=42,
        acceptance=0.60,
    )
    assert result["replicas"] >= 1
    assert result["target_passes_per_100_tokens"] < 100
    assert result["requires_quality_recheck"] is True
    print(result)
