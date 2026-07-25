"""Evaluate one measured steady-state sample against experiment boundaries."""

from dataclasses import dataclass
from enum import Enum


class Direction(Enum):
    HIGHER_IS_HEALTHIER = "higher-is-healthier"
    LOWER_IS_HEALTHIER = "lower-is-healthier"


@dataclass(frozen=True)
class ExperimentBoundary:
    direction: Direction
    hypothesis_limit: float
    abort_limit: float

    def accepts(self, value: float, limit: float) -> bool:
        if self.direction is Direction.HIGHER_IS_HEALTHIER:
            return value >= limit
        return value <= limit

    def evaluate(self, observed: float) -> str:
        if not self.accepts(observed, self.abort_limit):
            return "ABORT: stop the fault, clean up, and verify recovery"
        if not self.accepts(observed, self.hypothesis_limit):
            return "FALSIFIED: record evidence and create remediation work"
        return "HOLDS: confidence increased only for this experiment scope"


if __name__ == "__main__":
    checkout_success = ExperimentBoundary(
        direction=Direction.HIGHER_IS_HEALTHIER,
        hypothesis_limit=99.0,
        abort_limit=98.0,
    )
    for sample in (99.4, 98.7, 97.6):
        print(f"{sample:.1f}% -> {checkout_success.evaluate(sample)}")
