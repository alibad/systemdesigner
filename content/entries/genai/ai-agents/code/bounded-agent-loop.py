from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class Effect(str, Enum):
    READ = "read"
    WRITE = "write"
    PRIVILEGED = "privileged"


@dataclass(frozen=True)
class Tool:
    name: str
    required_scope: str
    effect: Effect
    timeout_ms: int
    handler: Callable[[dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True)
class Proposal:
    tool: str
    arguments: dict[str, Any]
    evidence_ids: tuple[str, ...]
    idempotency_key: str | None = None


@dataclass
class RunContract:
    run_id: str
    scopes: set[str]
    max_iterations: int
    max_tool_calls: int
    approved_effects: set[Effect] = field(default_factory=set)


@dataclass(frozen=True)
class Observation:
    status: str
    tool: str
    result: dict[str, Any]
    side_effect_id: str | None = None


class AgentRuntime:
    def __init__(self, tools: list[Tool], contract: RunContract) -> None:
        self.tools = {tool.name: tool for tool in tools}
        self.contract = contract
        self.iteration = 0
        self.tool_calls = 0
        self.completed_keys: dict[str, Observation] = {}
        self.audit: list[dict[str, Any]] = []

    def execute(self, proposal: Proposal) -> Observation:
        self.iteration += 1
        if self.iteration > self.contract.max_iterations:
            return self._deny(proposal, "iteration_budget_exhausted")

        tool = self.tools.get(proposal.tool)
        if tool is None:
            return self._deny(proposal, "unknown_tool")
        if tool.required_scope not in self.contract.scopes:
            return self._deny(proposal, "missing_scope")
        if tool.effect is not Effect.READ and tool.effect not in self.contract.approved_effects:
            return self._deny(proposal, "approval_required")
        if self.tool_calls >= self.contract.max_tool_calls:
            return self._deny(proposal, "tool_budget_exhausted")

        if tool.effect is not Effect.READ and not proposal.idempotency_key:
            return self._deny(proposal, "idempotency_key_required")
        if proposal.idempotency_key in self.completed_keys:
            return self.completed_keys[proposal.idempotency_key]

        self.tool_calls += 1
        raw_result = tool.handler(dict(proposal.arguments))
        if not isinstance(raw_result, dict) or "status" not in raw_result:
            return self._deny(proposal, "invalid_tool_result")

        observation = Observation(
            status="completed",
            tool=tool.name,
            result=raw_result,
            side_effect_id=raw_result.get("side_effect_id"),
        )
        if proposal.idempotency_key:
            self.completed_keys[proposal.idempotency_key] = observation

        self.audit.append(
            {
                "run_id": self.contract.run_id,
                "event": "tool_completed",
                "tool": tool.name,
                "effect": tool.effect.value,
                "evidence_ids": list(proposal.evidence_ids),
                "side_effect_id": observation.side_effect_id,
            }
        )
        return observation

    def _deny(self, proposal: Proposal, reason: str) -> Observation:
        self.audit.append(
            {
                "run_id": self.contract.run_id,
                "event": "proposal_denied",
                "tool": proposal.tool,
                "reason": reason,
            }
        )
        return Observation(status="blocked", tool=proposal.tool, result={"reason": reason})


def read_order(arguments: dict[str, Any]) -> dict[str, Any]:
    return {"status": "found", "order_id": arguments["order_id"], "total": 80.0}


runtime = AgentRuntime(
    tools=[Tool("read_order", "orders:read", Effect.READ, 800, read_order)],
    contract=RunContract(
        run_id="run-1042",
        scopes={"orders:read"},
        max_iterations=4,
        max_tool_calls=2,
    ),
)

result = runtime.execute(
    Proposal(
        tool="read_order",
        arguments={"order_id": "order-417"},
        evidence_ids=("user-request-9",),
    )
)
print(result)
