"""Auditable pairwise preference aggregation for an arena-style evaluation."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from math import log10, sqrt
from typing import Iterable, Literal

Outcome = Literal["a", "b", "tie"]
Position = Literal["left", "right"]


@dataclass(frozen=True)
class Vote:
    model_a: str
    model_b: str
    outcome: Outcome
    a_position: Position
    prompt_slice: str


@dataclass(frozen=True)
class PairwiseReport:
    votes: int
    wins: int
    losses: int
    ties: int
    score: float
    interval_95: tuple[float, float]
    elo_like_gap: float


def aggregate_pair(
    votes: Iterable[Vote],
    *,
    target: str,
    opponent: str,
    split_ties: bool = True,
) -> PairwiseReport:
    outcomes: list[float] = []
    wins = losses = ties = 0

    for vote in votes:
        if {vote.model_a, vote.model_b} != {target, opponent}:
            continue

        target_is_a = vote.model_a == target
        if vote.outcome == "tie":
            ties += 1
            if split_ties:
                outcomes.append(0.5)
        elif (vote.outcome == "a") == target_is_a:
            wins += 1
            outcomes.append(1.0)
        else:
            losses += 1
            outcomes.append(0.0)

    if not outcomes:
        raise ValueError("No effective votes for the requested pair")

    score = sum(outcomes) / len(outcomes)
    lower, upper = normal_interval(score, len(outcomes))
    bounded_score = min(0.999, max(0.001, score))
    elo_like_gap = 400 * log10(bounded_score / (1 - bounded_score))

    return PairwiseReport(
        votes=len(outcomes),
        wins=wins,
        losses=losses,
        ties=ties,
        score=score,
        interval_95=(lower, upper),
        elo_like_gap=elo_like_gap,
    )


def normal_interval(score: float, sample_size: int) -> tuple[float, float]:
    """Return a teaching approximation; use clustered bootstrap in production."""
    margin = 1.96 * sqrt(score * (1 - score) / sample_size)
    return max(0.0, score - margin), min(1.0, score + margin)


def position_scores(votes: Iterable[Vote], *, target: str) -> dict[Position, float]:
    grouped: dict[Position, list[float]] = defaultdict(list)

    for vote in votes:
        if target not in {vote.model_a, vote.model_b}:
            continue
        target_is_a = vote.model_a == target
        if vote.outcome == "tie":
            score = 0.5
        else:
            score = float((vote.outcome == "a") == target_is_a)
        target_position = vote.a_position if target_is_a else opposite(vote.a_position)
        grouped[target_position].append(score)

    return {
        position: sum(scores) / len(scores)
        for position, scores in grouped.items()
        if scores
    }


def slice_scores(votes: Iterable[Vote], *, target: str) -> dict[str, float]:
    grouped: dict[str, list[float]] = defaultdict(list)

    for vote in votes:
        if target not in {vote.model_a, vote.model_b}:
            continue
        target_is_a = vote.model_a == target
        if vote.outcome == "tie":
            score = 0.5
        else:
            score = float((vote.outcome == "a") == target_is_a)
        grouped[vote.prompt_slice].append(score)

    return {
        prompt_slice: sum(scores) / len(scores)
        for prompt_slice, scores in grouped.items()
    }


def opposite(position: Position) -> Position:
    return "right" if position == "left" else "left"


if __name__ == "__main__":
    sample = [
        Vote("candidate", "control", "a", "left", "coding"),
        Vote("candidate", "control", "a", "right", "coding"),
        Vote("candidate", "control", "b", "left", "support"),
        Vote("candidate", "control", "tie", "right", "support"),
        Vote("control", "candidate", "b", "left", "coding"),
        Vote("control", "candidate", "a", "right", "support"),
    ]

    report = aggregate_pair(sample, target="candidate", opponent="control")
    print(report)
    print("position sensitivity:", position_scores(sample, target="candidate"))
    print("slice sensitivity:", slice_scores(sample, target="candidate"))
