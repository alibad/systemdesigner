"""Estimate an MoE expert-capacity envelope without framework dependencies."""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class CapacityPlan:
    tokens: int
    experts: int
    top_k: int
    capacity_factor: float
    hottest_expert_multiplier: float


def estimate_capacity(plan: CapacityPlan) -> dict[str, float]:
    if plan.tokens <= 0 or plan.experts <= 0:
        raise ValueError("tokens and experts must be positive")
    if not 1 <= plan.top_k <= plan.experts:
        raise ValueError("top_k must be between 1 and the expert count")
    if plan.capacity_factor < 1:
        raise ValueError("capacity_factor must reserve at least the balanced load")

    assignments = plan.tokens * plan.top_k
    balanced_load = assignments / plan.experts
    capacity_per_expert = ceil(balanced_load * plan.capacity_factor)
    hottest_load = balanced_load * plan.hottest_expert_multiplier
    overflow = max(0.0, hottest_load - capacity_per_expert)

    return {
        "assignments": assignments,
        "balanced_load": balanced_load,
        "capacity_per_expert": capacity_per_expert,
        "hottest_load": hottest_load,
        "overflow_assignments": overflow,
        "overflow_percent": 0.0 if hottest_load == 0 else 100 * overflow / hottest_load,
    }


def main() -> None:
    healthy = estimate_capacity(CapacityPlan(32_768, 32, 2, 1.25, 1.15))
    overloaded = estimate_capacity(CapacityPlan(32_768, 32, 2, 1.25, 1.80))

    assert healthy["capacity_per_expert"] == 2_560
    assert healthy["overflow_assignments"] == 0
    assert overloaded["overflow_assignments"] > 1_000
    assert overloaded["overflow_percent"] > 30

    print(f"healthy capacity: {healthy['capacity_per_expert']:.0f} assignments/expert")
    print(f"overloaded hot-expert overflow: {overloaded['overflow_percent']:.1f}%")


if __name__ == "__main__":
    main()
