"""Evaluate a deterministic guardrail policy over the lesson scenarios."""

from __future__ import annotations

import json
from pathlib import Path


DATA_FILE = (
    Path(__file__).parents[1] / "data" / "runtime-guardrail-scenarios.json"
)
AUTHORITY_RANK = {"none": 0, "read": 1, "write": 2}


def decide(
    scenario: dict[str, object],
    authority: str,
    *,
    human_approved: bool,
    policy_available: bool,
) -> tuple[str, str]:
    """Return a fail-closed outcome and an auditable reason."""
    required_authority = str(scenario["requiredAuthority"])
    output_class = str(scenario["outputClass"])

    if not policy_available and (
        required_authority != "none" or output_class == "sensitive"
    ):
        return "block", "Required policy evidence is unavailable."

    if scenario["policyDecision"] == "deny":
        return "block", str(scenario["policyReason"])

    if output_class == "sensitive":
        return "block", "The output gate detected cross-boundary sensitive data."

    if AUTHORITY_RANK[authority] < AUTHORITY_RANK[required_authority]:
        return "block", "The runtime lacks the requested capability."

    if scenario["requiresApproval"] and not human_approved:
        return "hold", "A named human must approve this high-impact action."

    if required_authority == "none":
        return "allow", "Return a bounded text response."

    return "allow", "Execute through the policy-enforcing tool gateway."


def main() -> None:
    data = json.loads(DATA_FILE.read_text())
    for scenario in data["scenarios"]:
        outcome, reason = decide(
            scenario,
            "write",
            human_approved=False,
            policy_available=True,
        )
        print(f"{scenario['id']}: {outcome} - {reason}")


if __name__ == "__main__":
    main()
