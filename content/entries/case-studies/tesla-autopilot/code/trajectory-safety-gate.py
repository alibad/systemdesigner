from dataclasses import dataclass


@dataclass(frozen=True)
class Plan:
    confidence: float
    observation_age_ms: int
    end_to_end_latency_ms: int
    collision_margin_m: float
    requires_lane_change: bool


def admit_plan(plan: Plan, *, max_age_ms: int, max_latency_ms: int, min_margin_m: float) -> str:
    if plan.observation_age_ms > max_age_ms:
        return "invalidate-and-reacquire"
    if plan.end_to_end_latency_ms > max_latency_ms:
        return "constrain-for-compute-deadline"
    if plan.confidence < 0.80 or plan.collision_margin_m < min_margin_m:
        return "slow-and-hold-lane" if plan.requires_lane_change else "slow-and-reassess"
    return "allow-bounded-command"
