"""Vendor-neutral teaching fixture for policy-first tool dispatch."""

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Any


class Decision(str, Enum):
    ALLOW = "allow"
    REQUIRE_APPROVAL = "require_approval"
    DENY = "deny"


@dataclass(frozen=True)
class Principal:
    tenant_id: str
    user_id: str


@dataclass(frozen=True)
class ToolCall:
    name: str
    tenant_id: str
    arguments: dict[str, Any]
    mutates_state: bool


@dataclass(frozen=True)
class PolicyResult:
    decision: Decision
    reason: str
    approval_key: str | None = None


def evaluate_tool_call(principal: Principal, call: ToolCall) -> PolicyResult:
    """Evaluate authority before dispatching a tool."""
    if call.tenant_id != principal.tenant_id:
        return PolicyResult(Decision.DENY, "tenant boundary mismatch")

    if call.name == "policy.search":
        return PolicyResult(Decision.ALLOW, "read-only approved corpus")

    if call.name == "account.lookup":
        requested_user = str(call.arguments.get("user_id", ""))
        if requested_user != principal.user_id:
            return PolicyResult(Decision.DENY, "account scope mismatch")
        return PolicyResult(Decision.ALLOW, "authenticated self-service read")

    if call.name == "refund.create":
        amount = Decimal(str(call.arguments.get("amount", "0")))
        if amount <= 0 or amount > Decimal("200"):
            return PolicyResult(Decision.DENY, "refund exceeds declared scope")
        approval_key = f"{call.tenant_id}:{call.arguments.get('order_id')}:{amount}"
        return PolicyResult(
            Decision.REQUIRE_APPROVAL,
            "financial write requires exact-argument approval",
            approval_key,
        )

    if call.name == "case.create":
        return PolicyResult(
            Decision.REQUIRE_APPROVAL,
            "handoff publishes customer evidence",
        )

    return PolicyResult(Decision.DENY, "tool is not in the allowlist")


def dispatch(principal: Principal, call: ToolCall) -> dict[str, Any]:
    """Return a control decision; a separate adapter performs allowed actions."""
    policy = evaluate_tool_call(principal, call)
    return {
        "tool": call.name,
        "decision": policy.decision.value,
        "reason": policy.reason,
        "approval_key": policy.approval_key,
        "arguments_hash_required": call.mutates_state,
    }
