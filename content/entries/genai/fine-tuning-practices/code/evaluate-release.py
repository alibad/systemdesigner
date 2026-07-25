"""Apply independent release gates; do not hide failures in one average."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Policy:
    minimum_task: float
    minimum_rare_slice: float
    minimum_safety: float
    maximum_base_regression_pp: float


def evaluate(candidate: dict[str, float], policy: Policy) -> dict:
    checks = {
        "task": candidate["task"] >= policy.minimum_task,
        "rare_slice": candidate["rare_slice"] >= policy.minimum_rare_slice,
        "safety": candidate["safety"] >= policy.minimum_safety,
        "base_regression": (
            candidate["base_regression_pp"]
            <= policy.maximum_base_regression_pp
        ),
    }
    return {
        "decision": "release" if all(checks.values()) else "hold",
        "checks": checks,
        "failed": [name for name, passed in checks.items() if not passed],
    }
