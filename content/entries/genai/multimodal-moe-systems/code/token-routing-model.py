"""Small, dependency-free report for multimodal token routing."""

from collections import Counter
from dataclasses import dataclass
from math import log


@dataclass(frozen=True)
class TokenGroup:
    label: str
    modality: str
    count: int
    primary_expert: str
    secondary_expert: str


GROUPS = (
    TokenGroup("question text", "text", 18, "language", "cross-modal"),
    TokenGroup("object patches", "vision", 48, "vision", "cross-modal"),
    TokenGroup("layout patches", "vision", 24, "layout", "vision"),
    TokenGroup("cross references", "joint", 12, "cross-modal", "language"),
)


def dispatch(groups: tuple[TokenGroup, ...], policy: str) -> Counter[str]:
    """Return assignment counts; shared-plus-routed deliberately emits two per token."""
    load: Counter[str] = Counter()

    for group in groups:
        if policy == "top-1":
            load[group.primary_expert] += group.count
        elif policy == "shared-plus-routed":
            load["shared"] += group.count
            load[group.primary_expert] += group.count
        elif policy == "modality-aware":
            primary = round(group.count * 0.75)
            load[group.primary_expert] += primary
            load[group.secondary_expert] += group.count - primary
        else:
            raise ValueError(f"unknown routing policy: {policy}")

    return load


def normalized_entropy(load: Counter[str]) -> float:
    """One means assignments are even across active experts; zero means collapse."""
    total = sum(load.values())
    active = [count for count in load.values() if count]
    if len(active) <= 1:
        return 0.0
    entropy = -sum((count / total) * log(count / total) for count in active)
    return entropy / log(len(active))


for routing_policy in ("top-1", "shared-plus-routed", "modality-aware"):
    expert_load = dispatch(GROUPS, routing_policy)
    busiest_expert, busiest_count = expert_load.most_common(1)[0]
    print(
        f"{routing_policy:20} assignments={sum(expert_load.values()):3} "
        f"busiest={busiest_expert}:{busiest_count} "
        f"balance={normalized_entropy(expert_load):.2f} load={dict(expert_load)}"
    )
