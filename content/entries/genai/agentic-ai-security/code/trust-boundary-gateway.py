"""Fail-closed authorization for model-proposed tool calls.

The model can propose an action, but only authenticated application context can
grant authority. Run with: python3 trust-boundary-gateway.py
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any


class PolicyDenied(Exception):
    """Raised when a proposal crosses the caller's intent or authority boundary."""


@dataclass(frozen=True)
class IntentEnvelope:
    principal_id: str
    tenant_id: str
    permissions: frozenset[str]
    allowed_tools: frozenset[str]
    allowed_resources: frozenset[str]
    maximum_amount: Decimal
    approval_id: str | None


@dataclass(frozen=True)
class ToolProposal:
    tool: str
    arguments: dict[str, Any]
    tenant_id: str
    resource_id: str


TOOL_PERMISSIONS = {
    "create_payment_review": "payments:review",
    "submit_wire_transfer": "payments:send",
}
HIGH_CONSEQUENCE_TOOLS = {"submit_wire_transfer"}


def require_decimal(value: Any, field: str) -> Decimal:
    if not isinstance(value, (int, float, str, Decimal)):
        raise PolicyDenied(f"{field} must be numeric")
    try:
        amount = Decimal(str(value))
    except Exception as error:
        raise PolicyDenied(f"{field} is not a valid decimal") from error
    if amount <= 0:
        raise PolicyDenied(f"{field} must be positive")
    return amount


def authorize(envelope: IntentEnvelope, proposal: ToolProposal) -> None:
    """Validate syntax, intent, identity, resource scope, limits, and approval."""

    permission = TOOL_PERMISSIONS.get(proposal.tool)
    if permission is None:
        raise PolicyDenied("unknown tool")
    if proposal.tool not in envelope.allowed_tools:
        raise PolicyDenied("tool is outside the approved task")
    if proposal.tenant_id != envelope.tenant_id:
        raise PolicyDenied("cross-tenant action")
    if proposal.resource_id not in envelope.allowed_resources:
        raise PolicyDenied("resource is outside the approved task")
    if permission not in envelope.permissions:
        raise PolicyDenied("principal lacks the current permission")

    amount = require_decimal(proposal.arguments.get("amount"), "amount")
    if amount > envelope.maximum_amount:
        raise PolicyDenied("amount exceeds the approved limit")
    if proposal.tool in HIGH_CONSEQUENCE_TOOLS and not envelope.approval_id:
        raise PolicyDenied("exact high-consequence action needs approval")


def evaluate(label: str, envelope: IntentEnvelope, proposal: ToolProposal) -> None:
    try:
        authorize(envelope, proposal)
    except PolicyDenied as error:
        print(f"DENY  {label}: {error}")
        return
    print(f"ALLOW {label}: {proposal.tool} on {proposal.resource_id}")


intent = IntentEnvelope(
    principal_id="analyst-42",
    tenant_id="tenant-blue",
    permissions=frozenset({"payments:review"}),
    allowed_tools=frozenset({"create_payment_review"}),
    allowed_resources=frozenset({"invoice-1842"}),
    maximum_amount=Decimal("2500.00"),
    approval_id=None,
)

safe_review = ToolProposal(
    tool="create_payment_review",
    tenant_id="tenant-blue",
    resource_id="invoice-1842",
    arguments={"amount": "1840.00", "reason": "bank details changed"},
)

# This proposal is valid JSON with plausible arguments. A poisoned invoice caused
# the planner to select an action that the user's intent never authorized.
injected_transfer = ToolProposal(
    tool="submit_wire_transfer",
    tenant_id="tenant-blue",
    resource_id="invoice-1842",
    arguments={"amount": "1840.00", "destination": "attacker-account"},
)

evaluate("safe review", intent, safe_review)
evaluate("injected transfer", intent, injected_transfer)
