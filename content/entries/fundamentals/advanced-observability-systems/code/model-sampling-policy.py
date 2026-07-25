from dataclasses import dataclass
from enum import Enum


class Outcome(str, Enum):
    NORMAL = "normal"
    SLOW = "slow"
    FAILED = "failed"


@dataclass(frozen=True)
class RequestClass:
    outcome: Outcome
    produced: int


def expected_retained(
    request_class: RequestClass,
    policy: str,
    baseline_probability: float,
) -> float:
    """Return an expectation, not a guarantee for one observation window."""
    if not 0.0 <= baseline_probability <= 1.0:
        raise ValueError("baseline_probability must be between 0 and 1")

    if policy == "always-on":
        probability = 1.0
    elif policy == "head-probability":
        probability = baseline_probability
    elif policy == "tail-priority":
        probability = (
            1.0
            if request_class.outcome in {Outcome.SLOW, Outcome.FAILED}
            else baseline_probability
        )
    else:
        raise ValueError(f"unknown policy: {policy}")

    return request_class.produced * probability


window = [
    RequestClass(Outcome.NORMAL, 9_700),
    RequestClass(Outcome.SLOW, 200),
    RequestClass(Outcome.FAILED, 100),
]

for policy_name in ("always-on", "head-probability", "tail-priority"):
    retained = {
        item.outcome.value: expected_retained(item, policy_name, 0.10)
        for item in window
    }
    print(policy_name, retained, "total=", sum(retained.values()))

assert expected_retained(window[2], "head-probability", 0.10) == 10
assert expected_retained(window[2], "tail-priority", 0.10) == 100
