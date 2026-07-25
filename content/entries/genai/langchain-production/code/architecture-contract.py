"""Select the smallest orchestration boundary that satisfies a workload contract."""

from dataclasses import dataclass
from enum import Enum


class Architecture(str, Enum):
    PIPELINE = "deterministic-pipeline"
    AGENT = "bounded-agent"
    GRAPH = "durable-state-graph"


@dataclass(frozen=True)
class Workload:
    name: str
    dynamic_tool_choice: bool = False
    durable_resume: bool = False
    approval_pause: bool = False
    explicit_branching: bool = False


def choose_architecture(workload: Workload) -> Architecture:
    """Escalate orchestration only when the workload requires it."""
    if workload.durable_resume or workload.approval_pause or workload.explicit_branching:
        return Architecture.GRAPH
    if workload.dynamic_tool_choice:
        return Architecture.AGENT
    return Architecture.PIPELINE


def production_contract(workload: Workload) -> dict[str, object]:
    architecture = choose_architecture(workload)
    return {
        "workload": workload.name,
        "architecture": architecture.value,
        "required_controls": [
            "run_id",
            "absolute_deadline",
            "trace_context",
            "validated_output",
            *( ["tool_allowlist", "iteration_limit"] if architecture == Architecture.AGENT else [] ),
            *( ["thread_id", "durable_checkpointer"] if architecture == Architecture.GRAPH else [] ),
        ],
    }


if __name__ == "__main__":
    examples = [
        Workload("extract an invoice into a fixed schema"),
        Workload("answer support questions with approved tools", dynamic_tool_choice=True),
        Workload(
            "pause a refund for review and resume after deployment",
            durable_resume=True,
            approval_pause=True,
            explicit_branching=True,
        ),
    ]
    for example in examples:
        print(production_contract(example))
