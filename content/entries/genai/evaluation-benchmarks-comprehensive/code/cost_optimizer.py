"""Allocate an evaluation budget without removing release-critical evidence."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Suite:
    name: str
    cases: int
    cost_per_case: float
    cadence: str
    critical: bool = False

    @property
    def estimated_cost(self) -> float:
        return self.cases * self.cost_per_case


def plan_budget(suites: list[Suite], budget: float) -> list[Suite]:
    critical = [suite for suite in suites if suite.critical]
    optional = sorted((suite for suite in suites if not suite.critical), key=lambda suite: suite.estimated_cost)
    selected = list(critical)
    remaining = budget - sum(suite.estimated_cost for suite in selected)
    if remaining < 0:
        raise ValueError("Budget cannot fund the declared critical evidence.")

    for suite in optional:
        if suite.estimated_cost <= remaining:
            selected.append(suite)
            remaining -= suite.estimated_cost
    return selected


if __name__ == "__main__":
    suites = [
        Suite("CI executable checks", 200, 0.001, "per change", True),
        Suite("Critical-slice review", 600, 0.12, "pre-release", True),
        Suite("Preference calibration", 150, 0.35, "pre-release"),
        Suite("Broad capability comparison", 1_000, 0.02, "weekly"),
    ]
    for suite in plan_budget(suites, budget=150):
        print(f"{suite.name}: ${suite.estimated_cost:.2f} ({suite.cadence})")
