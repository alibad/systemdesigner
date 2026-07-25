"""A deterministic example of a planner separated from an execution runtime."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal
import json
from typing import Any


@dataclass(frozen=True)
class ActionProposal:
    tool: str
    arguments: dict[str, Any]
    expected_state_version: int
    idempotency_key: str
    completion_evidence: str


@dataclass(frozen=True)
class Capability:
    principal: str
    tool: str
    resource_prefix: str
    maximum_amount: Decimal
    expires_at_step: int


@dataclass
class TicketState:
    ticket_id: str
    status: str
    refundable_amount: Decimal
    version: int
    refund_reference: str | None = None


class PolicyDenied(Exception):
    """Raised when a proposed action does not satisfy runtime policy."""


class StalePlan(Exception):
    """Raised when a proposal was created from an old state version."""


class AgentRuntime:
    def __init__(self, state: TicketState, capabilities: list[Capability]) -> None:
        self.state = state
        self.capabilities = capabilities
        self.completed_keys: dict[str, dict[str, Any]] = {}
        self.events: list[dict[str, Any]] = []

    def execute(self, proposal: ActionProposal, step: int) -> dict[str, Any]:
        """Authorize one proposal against fresh state, then execute exactly once."""
        self._record("proposal_received", proposal=asdict(proposal), step=step)
        if proposal.expected_state_version != self.state.version:
            self._record("proposal_rejected", reason="stale_state", step=step)
            raise StalePlan(
                f"expected version {proposal.expected_state_version}, "
                f"observed {self.state.version}"
            )

        capability = self._authorize(proposal, step)
        self._record(
            "action_authorized",
            principal=capability.principal,
            tool=capability.tool,
            step=step,
        )

        if proposal.idempotency_key in self.completed_keys:
            self._record("duplicate_suppressed", step=step)
            return self.completed_keys[proposal.idempotency_key]

        result = self._call_tool(proposal)
        self.completed_keys[proposal.idempotency_key] = result
        self._record("authoritative_result", result=result, step=step)
        return result

    def _authorize(self, proposal: ActionProposal, step: int) -> Capability:
        ticket_id = str(proposal.arguments.get("ticket_id", ""))
        amount = Decimal(str(proposal.arguments.get("amount", "0")))
        matches = [
            capability
            for capability in self.capabilities
            if capability.tool == proposal.tool
            and ticket_id.startswith(capability.resource_prefix)
            and amount <= capability.maximum_amount
            and step <= capability.expires_at_step
        ]
        if not matches:
            self._record("policy_denied", tool=proposal.tool, step=step)
            raise PolicyDenied("no active capability covers this action")
        return matches[0]

    def _call_tool(self, proposal: ActionProposal) -> dict[str, Any]:
        if proposal.tool != "issue_refund":
            raise PolicyDenied(f"tool {proposal.tool!r} is not allowlisted")

        amount = Decimal(str(proposal.arguments["amount"]))
        if self.state.status != "approved" or amount > self.state.refundable_amount:
            raise PolicyDenied("authoritative ticket state does not permit this refund")

        self.state.refund_reference = f"refund-{self.state.version + 1}"
        self.state.status = "refunded"
        self.state.version += 1
        return {
            "ticket_id": self.state.ticket_id,
            "status": self.state.status,
            "refund_reference": self.state.refund_reference,
            "state_version": self.state.version,
        }

    def _record(self, event: str, **details: Any) -> None:
        self.events.append({"event": event, **details})


def plan_refund(state: TicketState, amount: Decimal) -> ActionProposal:
    """The planner produces data; it receives no capability or tool credential."""
    return ActionProposal(
        tool="issue_refund",
        arguments={"ticket_id": state.ticket_id, "amount": str(amount)},
        expected_state_version=state.version,
        idempotency_key=f"{state.ticket_id}:refund:{amount}",
        completion_evidence="authoritative ticket state is refunded",
    )


def demonstration() -> dict[str, Any]:
    state = TicketState("support-1042", "approved", Decimal("75.00"), version=7)
    runtime = AgentRuntime(
        state,
        [Capability("agent-17", "issue_refund", "support-", Decimal("50.00"), 3)],
    )

    too_large = plan_refund(state, Decimal("60.00"))
    try:
        runtime.execute(too_large, step=1)
    except PolicyDenied:
        pass

    approved = plan_refund(state, Decimal("40.00"))
    first = runtime.execute(approved, step=2)

    # A network retry returns the recorded result instead of issuing a second refund.
    duplicate = runtime.execute(
        ActionProposal(
            tool=approved.tool,
            arguments=approved.arguments,
            expected_state_version=state.version,
            idempotency_key=approved.idempotency_key,
            completion_evidence=approved.completion_evidence,
        ),
        step=3,
    )

    assert first == duplicate
    assert state.refund_reference == "refund-8"
    assert len([event for event in runtime.events if event["event"] == "policy_denied"]) == 1
    assert len([event for event in runtime.events if event["event"] == "duplicate_suppressed"]) == 1
    return {"state": asdict(state), "events": runtime.events}


if __name__ == "__main__":
    print(json.dumps(demonstration(), indent=2, default=str))
