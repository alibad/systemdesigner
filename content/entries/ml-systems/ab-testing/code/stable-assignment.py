"""Deterministic experiment assignment with an explicit identity boundary."""

from dataclasses import dataclass
from hashlib import sha256


@dataclass(frozen=True)
class Experiment:
    experiment_id: str
    salt: str
    treatment_allocation: float

    def __post_init__(self) -> None:
        if not 0.0 < self.treatment_allocation < 1.0:
            raise ValueError("treatment_allocation must be between 0 and 1")


def assign_variant(experiment: Experiment, assignment_unit: str) -> str:
    """Return a stable variant for one user, account, or other chosen unit."""
    identity = f"{experiment.experiment_id}:{experiment.salt}:{assignment_unit}"
    digest = sha256(identity.encode("utf-8")).digest()
    bucket = int.from_bytes(digest[:8], "big") / 2**64
    return "treatment" if bucket < experiment.treatment_allocation else "control"


checkout_ranker = Experiment(
    experiment_id="checkout-ranker-v3",
    salt="2026-07-launch",
    treatment_allocation=0.25,
)

user_id = "user-1842"
first_visit = assign_variant(checkout_ranker, user_id)
later_visit = assign_variant(checkout_ranker, user_id)

assert first_visit == later_visit
print({"assignment_unit": user_id, "variant": first_visit})
