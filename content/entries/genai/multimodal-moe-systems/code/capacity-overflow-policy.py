"""Conserve multimodal expert assignments across capacity and fallback states."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Demand:
    expert: str
    assignments: int
    evidence_weight: float


DEMAND = (
    Demand("language", 18, 0.7),
    Demand("vision", 52, 1.0),
    Demand("layout", 34, 1.2),
    Demand("cross-modal", 20, 1.1),
)
FALLBACK = {
    "language": "cross-modal",
    "vision": "cross-modal",
    "layout": "vision",
    "cross-modal": "language",
}


def simulate(policy: str, capacity: int) -> dict[str, float]:
    direct = {item.expert: min(item.assignments, capacity) for item in DEMAND}
    spare = {expert: capacity - accepted for expert, accepted in direct.items()}
    rerouted = shared = dropped = 0
    weighted_loss = 0.0

    for item in DEMAND:
        overflow = item.assignments - direct[item.expert]
        if policy == "drop":
            dropped += overflow
            weighted_loss += overflow * item.evidence_weight
        elif policy == "second-choice":
            target = FALLBACK[item.expert]
            accepted = min(overflow, spare[target])
            spare[target] -= accepted
            rerouted += accepted
            dropped += overflow - accepted
            weighted_loss += accepted * item.evidence_weight * 0.30
            weighted_loss += (overflow - accepted) * item.evidence_weight
        elif policy == "shared-fallback":
            shared += overflow
            weighted_loss += overflow * item.evidence_weight * 0.12
        else:
            raise ValueError(f"unknown overflow policy: {policy}")

    total = sum(item.assignments for item in DEMAND)
    processed = sum(direct.values()) + rerouted + shared
    assert processed + dropped == total, "assignment conservation failed"
    return {
        "total": total,
        "direct": sum(direct.values()),
        "rerouted": rerouted,
        "shared": shared,
        "dropped": dropped,
        "evidence_loss": round(weighted_loss / total * 100, 1),
    }


for overflow_policy in ("drop", "second-choice", "shared-fallback"):
    print(overflow_policy, simulate(overflow_policy, capacity=28))
