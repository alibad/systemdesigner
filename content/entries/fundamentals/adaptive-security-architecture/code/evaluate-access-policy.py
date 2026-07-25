"""Evaluate access with ordered, explainable rules.

This example uses an illustrative enterprise policy. It returns a decision and
reason trace instead of collapsing unrelated evidence into a risk score.
Run with: python3 evaluate-access-policy.py
"""

from dataclasses import dataclass
from enum import Enum


class Decision(str, Enum):
    ALLOW = "allow"
    CHALLENGE = "challenge"
    DENY = "deny"


class Assurance(int, Enum):
    CURRENT_SESSION = 1
    PHISHING_RESISTANT = 2


@dataclass(frozen=True)
class Evidence:
    subject: str
    assurance: Assurance
    managed_device: bool
    device_compliant: bool
    context_is_new: bool
    confirmed_compromise: bool


@dataclass(frozen=True)
class ResourcePolicy:
    resource: str
    required_assurance: Assurance
    requires_managed_device: bool


@dataclass(frozen=True)
class PolicyResult:
    decision: Decision
    reason: str
    obligations: tuple[str, ...]


def evaluate(evidence: Evidence, policy: ResourcePolicy) -> PolicyResult:
    """Evaluate fail-closed rules in priority order."""

    if evidence.confirmed_compromise:
        return PolicyResult(
            Decision.DENY,
            "credential compromise is confirmed",
            ("revoke active sessions", "open an incident"),
        )

    if policy.requires_managed_device and (
        not evidence.managed_device or not evidence.device_compliant
    ):
        return PolicyResult(
            Decision.DENY,
            "resource policy requires a compliant managed device",
            ("use a compliant managed device",),
        )

    if evidence.assurance < policy.required_assurance:
        return PolicyResult(
            Decision.CHALLENGE,
            "authentication assurance is below the resource requirement",
            ("complete fresh phishing-resistant verification",),
        )

    if evidence.context_is_new and evidence.assurance < Assurance.PHISHING_RESISTANT:
        return PolicyResult(
            Decision.CHALLENGE,
            "new context requires fresh phishing-resistant verification",
            ("verify again before issuing scoped access",),
        )

    return PolicyResult(
        Decision.ALLOW,
        "all resource requirements are satisfied by current evidence",
        ("issue short-lived resource-scoped access", "record the policy version"),
    )


EXPORT_POLICY = ResourcePolicy(
    resource="customer-export",
    required_assurance=Assurance.PHISHING_RESISTANT,
    requires_managed_device=True,
)

CASES = {
    "routine managed request": Evidence(
        subject="analyst-42",
        assurance=Assurance.PHISHING_RESISTANT,
        managed_device=True,
        device_compliant=True,
        context_is_new=False,
        confirmed_compromise=False,
    ),
    "stolen session": Evidence(
        subject="analyst-42",
        assurance=Assurance.CURRENT_SESSION,
        managed_device=True,
        device_compliant=True,
        context_is_new=True,
        confirmed_compromise=True,
    ),
}


for label, case in CASES.items():
    result = evaluate(case, EXPORT_POLICY)
    print(
        f"{label}: {result.decision.value.upper()} - {result.reason}; "
        f"next={', '.join(result.obligations)}"
    )
