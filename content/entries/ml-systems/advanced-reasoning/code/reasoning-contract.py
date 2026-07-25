from dataclasses import dataclass
from enum import Enum


class ClaimType(Enum):
    DEDUCTION = "deduction"
    INTERVENTION = "intervention"
    ADAPTATION = "adaptation"


@dataclass(frozen=True)
class ReasoningRequest:
    claim_type: ClaimType
    has_versioned_rules: bool = False
    has_causal_assumptions: bool = False
    support_examples: int = 0


def route_reasoning(request: ReasoningRequest) -> str:
    """Return an engine only when its minimum evidence contract is present."""
    if request.claim_type is ClaimType.DEDUCTION:
        return "symbolic" if request.has_versioned_rules else "abstain: missing rules"

    if request.claim_type is ClaimType.INTERVENTION:
        return "causal" if request.has_causal_assumptions else "abstain: unidentified effect"

    if request.support_examples >= 5:
        return "fast-adaptation"
    return "abstain: support set too small"


assert route_reasoning(
    ReasoningRequest(ClaimType.INTERVENTION, has_causal_assumptions=True)
) == "causal"
