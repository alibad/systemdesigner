"""Evaluate whether a CrewAI orchestration shape satisfies a workload contract.

This model is dependency-free so architecture tests can run without invoking an LLM.
The same contract can later drive CrewAI crew and flow configuration.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Capability(str, Enum):
    COLLABORATION = "specialist-collaboration"
    ROUTING = "deterministic-routing"
    TYPED_STATE = "typed-state"
    RESUME = "durable-resume"
    HUMAN_RELEASE = "human-release"


@dataclass(frozen=True)
class OrchestrationShape:
    name: str
    capabilities: frozenset[Capability]
    estimated_model_calls: int


@dataclass(frozen=True)
class Workload:
    name: str
    required: frozenset[Capability]


CREW = OrchestrationShape(
    name="crew",
    capabilities=frozenset({Capability.COLLABORATION}),
    estimated_model_calls=4,
)

FLOW = OrchestrationShape(
    name="flow",
    capabilities=frozenset({Capability.ROUTING, Capability.TYPED_STATE}),
    estimated_model_calls=1,
)

FLOW_WITH_CREW = OrchestrationShape(
    name="flow-with-crew",
    capabilities=frozenset(
        {Capability.COLLABORATION, Capability.ROUTING, Capability.TYPED_STATE}
    ),
    estimated_model_calls=5,
)


def evaluate(
    workload: Workload,
    shape: OrchestrationShape,
    *,
    durable_state: bool = False,
    human_gate: bool = False,
) -> dict[str, object]:
    """Return a deterministic fit decision for one orchestration proposal."""

    enabled = set(shape.capabilities)
    if durable_state:
        enabled.add(Capability.RESUME)
    if human_gate:
        enabled.add(Capability.HUMAN_RELEASE)

    missing = sorted(item.value for item in workload.required - enabled)
    extra = sorted(item.value for item in enabled - workload.required)

    return {
        "workload": workload.name,
        "shape": shape.name,
        "accepted": not missing,
        "missing": missing,
        "extra": extra,
        "estimated_model_calls": shape.estimated_model_calls,
    }


if __name__ == "__main__":
    regulated_review = Workload(
        name="regulated-recommendation",
        required=frozenset(
            {
                Capability.COLLABORATION,
                Capability.ROUTING,
                Capability.TYPED_STATE,
                Capability.RESUME,
                Capability.HUMAN_RELEASE,
            }
        ),
    )

    decision = evaluate(
        regulated_review,
        FLOW_WITH_CREW,
        durable_state=True,
        human_gate=True,
    )
    assert decision["accepted"] is True
    assert decision["missing"] == []
    print(decision)
