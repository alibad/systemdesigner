"""Join live signals to release identity before creating an incident decision."""

from collections import defaultdict
from dataclasses import dataclass
from math import ceil
from typing import Literal


Action = Literal["continue", "pause", "rollback"]


@dataclass(frozen=True)
class ReleaseIdentity:
    release_id: str
    model_version: str
    prompt_version: str
    retrieval_version: str
    route: str


@dataclass(frozen=True)
class OutcomeEvent:
    request_id: str
    identity: ReleaseIdentity
    task: str
    language: str
    quality_passed: bool
    safety_passed: bool
    latency_ms: int


@dataclass(frozen=True)
class SlicePolicy:
    minimum_samples: int
    minimum_quality: float
    maximum_safety_failures: int
    maximum_p95_latency_ms: int


@dataclass(frozen=True)
class SliceDecision:
    key: str
    samples: int
    quality_rate: float
    safety_failures: int
    p95_latency_ms: int
    action: Action
    reason: str


def percentile_95(values: list[int]) -> int:
    if not values:
        raise ValueError("at least one latency value is required")
    ordered = sorted(values)
    index = max(0, ceil(0.95 * len(ordered)) - 1)
    return ordered[index]


def evaluate_slices(
    events: list[OutcomeEvent],
    policy: SlicePolicy,
) -> list[SliceDecision]:
    """Evaluate release, task, and language cohorts independently."""
    grouped: dict[str, list[OutcomeEvent]] = defaultdict(list)
    for event in events:
        key = ":".join(
            [event.identity.release_id, event.task, event.language, event.identity.route]
        )
        grouped[key].append(event)

    decisions: list[SliceDecision] = []
    for key, cohort in grouped.items():
        quality_rate = sum(event.quality_passed for event in cohort) / len(cohort)
        safety_failures = sum(not event.safety_passed for event in cohort)
        p95_latency_ms = percentile_95([event.latency_ms for event in cohort])

        if safety_failures > policy.maximum_safety_failures:
            action: Action = "rollback"
            reason = "The cohort crossed a hard safety boundary."
        elif len(cohort) < policy.minimum_samples:
            action = "pause"
            reason = "The cohort needs more evidence before exposure expands."
        elif quality_rate < policy.minimum_quality:
            action = "rollback"
            reason = "The cohort crossed its quality abort threshold."
        elif p95_latency_ms > policy.maximum_p95_latency_ms:
            action = "pause"
            reason = "Latency pressure needs route diagnosis before expansion."
        else:
            action = "continue"
            reason = "This cohort remains inside its declared operating bounds."

        decisions.append(
            SliceDecision(
                key=key,
                samples=len(cohort),
                quality_rate=quality_rate,
                safety_failures=safety_failures,
                p95_latency_ms=p95_latency_ms,
                action=action,
                reason=reason,
            )
        )

    return decisions


def overall_action(decisions: list[SliceDecision]) -> Action:
    """A failed critical cohort cannot be averaged away by healthy traffic."""
    if any(decision.action == "rollback" for decision in decisions):
        return "rollback"
    if any(decision.action == "pause" for decision in decisions):
        return "pause"
    return "continue"
