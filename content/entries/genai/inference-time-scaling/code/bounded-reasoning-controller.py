"""A deterministic controller for bounded inference-time scaling.

Run with: python bounded-reasoning-controller.py
"""

from dataclasses import dataclass, field
from enum import Enum


class Action(str, Enum):
    GENERATE = "generate"
    VERIFY = "verify"
    ACCEPT = "accept"
    ESCALATE = "escalate"
    STOP = "stop"


@dataclass(frozen=True)
class RequestSignals:
    difficulty: float
    impact: float
    recoverable: bool
    objective_checker: bool
    human_review_required: bool = False


@dataclass(frozen=True)
class Budget:
    deadline_ms: int
    max_cost_units: float
    max_attempts: int
    min_evidence: float


@dataclass
class State:
    elapsed_ms: int = 0
    cost_units: float = 0.0
    attempts: int = 0
    evidence: float = 0.0
    verified: bool = False
    history: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Charge:
    label: str
    latency_ms: int
    cost_units: float
    evidence_gain: float


def can_afford(state: State, budget: Budget, charge: Charge) -> bool:
    """Reserve against the parent request before starting downstream work."""
    return (
        state.elapsed_ms + charge.latency_ms <= budget.deadline_ms
        and state.cost_units + charge.cost_units <= budget.max_cost_units
    )


def apply_charge(state: State, charge: Charge) -> None:
    state.elapsed_ms += charge.latency_ms
    state.cost_units += charge.cost_units
    state.evidence = min(1.0, state.evidence + charge.evidence_gain)
    state.history.append(charge.label)


def terminal_fallback(signals: RequestSignals) -> Action:
    if signals.human_review_required or (signals.impact >= 0.7 and not signals.recoverable):
        return Action.ESCALATE
    return Action.STOP


def choose_next(signals: RequestSignals, budget: Budget, state: State) -> Action:
    """Return one typed action; never ask the model whether its budget is exhausted."""
    if state.elapsed_ms >= budget.deadline_ms or state.cost_units >= budget.max_cost_units:
        return terminal_fallback(signals)

    if signals.human_review_required:
        if state.verified and state.evidence >= budget.min_evidence:
            return Action.ESCALATE
    elif state.evidence >= budget.min_evidence:
        if not signals.objective_checker or state.verified:
            return Action.ACCEPT

    if state.attempts >= budget.max_attempts:
        return terminal_fallback(signals)

    if signals.objective_checker and state.attempts > 0 and not state.verified:
        return Action.VERIFY

    # Hard, non-verifiable tasks get a second independent attempt when budget permits.
    if not signals.objective_checker and signals.difficulty >= 0.65 and state.attempts < 2:
        return Action.GENERATE

    return Action.GENERATE


def run(signals: RequestSignals, budget: Budget) -> tuple[Action, State]:
    state = State()
    generation = Charge("candidate", latency_ms=1_200, cost_units=1.5, evidence_gain=0.2)
    verification = Charge("objective-check", latency_ms=700, cost_units=0.4, evidence_gain=0.55)

    while True:
        action = choose_next(signals, budget, state)

        if action == Action.GENERATE:
            if not can_afford(state, budget, generation):
                return (terminal_fallback(signals), state)
            apply_charge(state, generation)
            state.attempts += 1
            continue

        if action == Action.VERIFY:
            if not can_afford(state, budget, verification):
                return (terminal_fallback(signals), state)
            apply_charge(state, verification)
            state.verified = True
            continue

        return action, state


if __name__ == "__main__":
    result, final_state = run(
        RequestSignals(
            difficulty=0.7,
            impact=0.8,
            recoverable=False,
            objective_checker=True,
        ),
        Budget(
            deadline_ms=6_000,
            max_cost_units=8.0,
            max_attempts=3,
            min_evidence=0.7,
        ),
    )
    print(result.value)
    print(final_state)
    assert result == Action.ACCEPT
    assert final_state.verified
