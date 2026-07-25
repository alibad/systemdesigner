"""Fail closed when aggregate lift conflicts with segment or guardrail evidence."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SegmentResult:
    name: str
    traffic_share: float
    lower_bound_lift: float


@dataclass(frozen=True)
class GuardrailResult:
    name: str
    observed_delta: float
    maximum_delta: float


def decide_rollout(
    aggregate_lower_bound: float,
    segments: list[SegmentResult],
    guardrails: list[GuardrailResult],
    material_share: float = 0.10,
) -> tuple[str, list[str]]:
    reasons: list[str] = []

    for guardrail in guardrails:
        if guardrail.observed_delta > guardrail.maximum_delta:
            reasons.append(f"{guardrail.name} exceeded its limit")

    for segment in segments:
        if segment.traffic_share >= material_share and segment.lower_bound_lift < 0:
            reasons.append(f"{segment.name} has credible downside")

    if reasons:
        return "hold_or_rollback", reasons
    if aggregate_lower_bound <= 0:
        return "keep_bounded_and_collect_evidence", ["aggregate effect is inconclusive"]
    return "expand_in_stages", ["primary, segment, and guardrail evidence passed"]


decision, evidence = decide_rollout(
    aggregate_lower_bound=0.004,
    segments=[SegmentResult("new users", 0.18, -0.012)],
    guardrails=[GuardrailResult("p95 latency", 0.07, 0.10)],
)

print({"decision": decision, "evidence": evidence})
