"""Keep prompt, output, review, and provenance decisions independently auditable."""

from dataclasses import dataclass
from enum import Enum


class Action(str, Enum):
    BLOCK_INPUT = "block-input"
    BLOCK_OUTPUT = "block-output"
    HOLD_REVIEW = "hold-review"
    RELEASE = "release"
    RELEASE_WITH_GAP = "release-with-gap"


@dataclass(frozen=True)
class Policy:
    version: str
    input_block_threshold: int
    output_block_threshold: int
    output_review_threshold: int
    identity_review_threshold: int
    human_review_enabled: bool
    provenance_enabled: bool


@dataclass(frozen=True)
class Evidence:
    prompt_risk: int
    output_risk: int
    identity_risk: int
    provenance_required: bool


@dataclass(frozen=True)
class Decision:
    action: Action
    compute_spent: bool
    reason: str
    policy_version: str


def evaluate(policy: Policy, evidence: Evidence) -> Decision:
    if evidence.prompt_risk >= policy.input_block_threshold:
        return Decision(
            Action.BLOCK_INPUT,
            False,
            "prompt evidence crossed the admission threshold",
            policy.version,
        )

    if evidence.output_risk >= policy.output_block_threshold:
        return Decision(
            Action.BLOCK_OUTPUT,
            True,
            "candidate pixels crossed the output block threshold",
            policy.version,
        )

    needs_review = (
        evidence.output_risk >= policy.output_review_threshold
        or evidence.identity_risk >= policy.identity_review_threshold
    )
    if needs_review and policy.human_review_enabled:
        return Decision(
            Action.HOLD_REVIEW,
            True,
            "policy requires accountable review before release",
            policy.version,
        )

    missing_provenance = evidence.provenance_required and not policy.provenance_enabled
    if needs_review or missing_provenance:
        return Decision(
            Action.RELEASE_WITH_GAP,
            True,
            "the selected policy lacks a required review or provenance control",
            policy.version,
        )

    return Decision(
        Action.RELEASE,
        True,
        "all configured release evidence passed",
        policy.version,
    )


if __name__ == "__main__":
    decision = evaluate(
        Policy("public-creative-v12", 80, 75, 45, 55, True, True),
        Evidence(18, 28, 72, True),
    )
    print(decision)
