"""Aggregate order-swapped pairwise judgments without inventing a winner."""

from dataclasses import dataclass
from typing import Literal

Preference = Literal["candidate_a", "candidate_b", "tie", "abstain"]


@dataclass(frozen=True)
class RawJudgment:
    first_candidate: str
    second_candidate: str
    preferred_position: Literal["first", "second", "tie", "abstain"]
    rubric_version: str
    judge_version: str
    rationale: str

    def preference_by_identity(self) -> Preference:
        if self.preferred_position in {"tie", "abstain"}:
            return self.preferred_position
        winner = (
            self.first_candidate
            if self.preferred_position == "first"
            else self.second_candidate
        )
        if winner == "candidate_a":
            return "candidate_a"
        if winner == "candidate_b":
            return "candidate_b"
        raise ValueError(f"Unexpected candidate identity: {winner}")


@dataclass(frozen=True)
class PairwiseEvidence:
    decision: Preference
    order_consistent: bool
    first_order: Preference
    reversed_order: Preference
    requires_human_review: bool


def aggregate_orders(
    first_order: RawJudgment,
    reversed_order: RawJudgment,
) -> PairwiseEvidence:
    """Return a preference only when both candidate orders agree by identity."""
    expected_orders = (
        (first_order.first_candidate, first_order.second_candidate),
        (reversed_order.second_candidate, reversed_order.first_candidate),
    )
    if expected_orders[0] != expected_orders[1]:
        raise ValueError("The second judgment must reverse the same candidate pair")
    if first_order.rubric_version != reversed_order.rubric_version:
        raise ValueError("Both judgments must use the same rubric version")
    if first_order.judge_version != reversed_order.judge_version:
        raise ValueError("Both judgments must use the same judge version")

    original = first_order.preference_by_identity()
    reversed_result = reversed_order.preference_by_identity()
    stable = original == reversed_result

    if stable and original in {"candidate_a", "candidate_b", "tie"}:
        decision: Preference = original
    else:
        decision = "abstain"

    return PairwiseEvidence(
        decision=decision,
        order_consistent=stable,
        first_order=original,
        reversed_order=reversed_result,
        requires_human_review=decision == "abstain",
    )
