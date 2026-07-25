"""A fail-closed policy gate around model output and tool proposals.

This example deliberately keeps enforcement outside the model. Real deployments should
replace the toy boolean signals with authenticated identity, policy, privacy, evaluation,
and authorization services that produce versioned evidence.
"""

from dataclasses import dataclass
from enum import Enum


class Decision(str, Enum):
    ALLOW = "allow"
    REVIEW = "review"
    BLOCK = "block"


@dataclass(frozen=True)
class SafetyContext:
    authenticated: bool
    purpose_allowed: bool
    contains_sensitive_data: bool
    output_policy_passed: bool
    evidence_supported: bool
    proposed_tool: str | None = None
    authorized_tools: frozenset[str] = frozenset()
    consequential_action: bool = False
    human_approved: bool = False


@dataclass(frozen=True)
class GateResult:
    decision: Decision
    reasons: tuple[str, ...]


def evaluate(context: SafetyContext) -> GateResult:
    """Return the strictest decision required by independent control layers."""
    blockers: list[str] = []
    review_reasons: list[str] = []

    if not context.authenticated:
        blockers.append("request has no authenticated actor")
    if not context.purpose_allowed:
        blockers.append("requested purpose is outside policy")
    if context.contains_sensitive_data:
        blockers.append("sensitive data crossed the output boundary")
    if not context.output_policy_passed:
        blockers.append("output policy evaluation failed")
    if context.proposed_tool and context.proposed_tool not in context.authorized_tools:
        blockers.append("tool call is not authorized for this actor and purpose")

    if context.consequential_action and not context.human_approved:
        review_reasons.append("consequential action needs accountable approval")
    if not context.evidence_supported:
        review_reasons.append("high-impact claim lacks supporting evidence")

    if blockers:
        return GateResult(Decision.BLOCK, tuple(blockers + review_reasons))
    if review_reasons:
        return GateResult(Decision.REVIEW, tuple(review_reasons))
    return GateResult(Decision.ALLOW, ("all required boundaries passed",))


if __name__ == "__main__":
    unauthorized_refund = SafetyContext(
        authenticated=True,
        purpose_allowed=True,
        contains_sensitive_data=False,
        output_policy_passed=True,
        evidence_supported=True,
        proposed_tool="issue_refund",
        authorized_tools=frozenset({"read_order"}),
        consequential_action=True,
        human_approved=False,
    )
    assert evaluate(unauthorized_refund).decision is Decision.BLOCK

    grounded_draft = SafetyContext(
        authenticated=True,
        purpose_allowed=True,
        contains_sensitive_data=False,
        output_policy_passed=True,
        evidence_supported=True,
    )
    assert evaluate(grounded_draft).decision is Decision.ALLOW
