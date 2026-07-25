"""Compute a LoRA parameter budget from the targeted matrix shapes."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProjectionGroup:
    name: str
    count_per_layer: int
    in_features: int
    out_features: int


def lora_parameter_count(
    *,
    rank: int,
    layers: int,
    groups: tuple[ProjectionGroup, ...],
) -> int:
    if rank <= 0 or layers <= 0:
        raise ValueError("rank and layers must be positive")

    return layers * sum(
        group.count_per_layer
        * rank
        * (group.in_features + group.out_features)
        for group in groups
    )


hidden = 4096
intermediate = 14336
all_linear = (
    ProjectionGroup("attention", 4, hidden, hidden),
    ProjectionGroup("gate_up", 2, hidden, intermediate),
    ProjectionGroup("down", 1, intermediate, hidden),
)

trainable = lora_parameter_count(rank=16, layers=32, groups=all_linear)
adapter_mib_bf16 = trainable * 2 / 1024**2

print(f"trainable parameters: {trainable:,}")
print(f"BF16 adapter weights: {adapter_mib_bf16:,.1f} MiB")
