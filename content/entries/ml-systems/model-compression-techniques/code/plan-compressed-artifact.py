from dataclasses import dataclass


@dataclass(frozen=True)
class ArtifactPlan:
    parameters: int
    weight_bits: int
    retained_fraction: float
    runtime_overhead_gib: float
    batch_memory_gib: float
    device_memory_gib: float


def memory_envelope(plan: ArtifactPlan) -> dict[str, float | bool]:
    weight_gib = (
        plan.parameters * plan.retained_fraction * plan.weight_bits / 8 / 1024**3
    )
    total_gib = weight_gib + plan.runtime_overhead_gib + plan.batch_memory_gib
    return {
        "weight_gib": round(weight_gib, 2),
        "total_gib": round(total_gib, 2),
        "pressure": round(total_gib / plan.device_memory_gib, 3),
        "fits_with_reserve": total_gib <= plan.device_memory_gib * 0.85,
    }


if __name__ == "__main__":
    candidate = ArtifactPlan(7_000_000_000, 8, 1.0, 4, 8, 24)
    print(memory_envelope(candidate))
