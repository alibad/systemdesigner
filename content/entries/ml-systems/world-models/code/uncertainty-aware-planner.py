from dataclasses import dataclass


@dataclass(frozen=True)
class CandidatePlan:
    actions: tuple[str, ...]
    predicted_return: float
    disagreement: float
    constraint_risk: float


@dataclass(frozen=True)
class PlanningPolicy:
    uncertainty_penalty: float
    maximum_constraint_risk: float


def score(plan: CandidatePlan, policy: PlanningPolicy) -> float:
    return plan.predicted_return - policy.uncertainty_penalty * plan.disagreement


def select_first_action(
    candidates: list[CandidatePlan],
    policy: PlanningPolicy,
) -> tuple[str, str]:
    admissible = [
        plan for plan in candidates if plan.constraint_risk <= policy.maximum_constraint_risk
    ]
    if not admissible:
        return "safe-stop", "all imagined plans cross the hard risk boundary"

    selected = max(admissible, key=lambda plan: score(plan, policy))
    reason = (
        f"selected score={score(selected, policy):.2f}; execute one action, "
        "observe reality, then replan"
    )
    return selected.actions[0], reason


plans = [
    CandidatePlan(("fast-lane", "turn-left", "dock"), 18.0, 4.8, 0.24),
    CandidatePlan(("inspect", "slow-lane", "dock"), 15.0, 1.2, 0.06),
    CandidatePlan(("wait", "inspect", "dock"), 11.0, 0.5, 0.02),
]
policy = PlanningPolicy(uncertainty_penalty=1.5, maximum_constraint_risk=0.10)

action, explanation = select_first_action(plans, policy)
print(f"next action: {action}")
print(explanation)
