"""Small, dependency-free model for competing image-conditioning signals."""

from dataclasses import dataclass


def clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


@dataclass(frozen=True)
class ConditioningRequest:
    base_alignment: float
    base_composition: float
    recommended_guidance: float
    layout_required: bool


@dataclass(frozen=True)
class ConditioningPolicy:
    guidance: float
    structure_strength: float
    structure_gain: float
    freedom_cost: float
    control_matches_task: bool


def evaluate(
    request: ConditioningRequest,
    policy: ConditioningPolicy,
) -> dict[str, float | str]:
    guidance_distance = abs(policy.guidance - request.recommended_guidance)
    text_alignment = clamp(request.base_alignment + 12.0 - guidance_distance * 3.0)

    structure_fraction = policy.structure_strength / 100.0
    match_multiplier = 1.0 if policy.control_matches_task else 0.35
    composition = clamp(
        request.base_composition
        + policy.structure_gain * structure_fraction * match_multiplier
    )
    variation = clamp(
        100.0 - policy.guidance * 4.5 - policy.freedom_cost * structure_fraction
    )

    conflict = max(0.0, policy.guidance - 9.0) * 7.0
    if policy.structure_strength > 0 and not policy.control_matches_task:
        conflict += policy.structure_strength * 0.55
    conflict = clamp(conflict)

    if request.layout_required and policy.structure_strength == 0:
        verdict = "missing spatial evidence"
    elif conflict >= 45:
        verdict = "conditioning conflict"
    elif text_alignment >= 78 and composition >= 78 and variation >= 42:
        verdict = "balanced candidate envelope"
    else:
        verdict = "measure and revise"

    return {
        "text_alignment": round(text_alignment, 1),
        "composition": round(composition, 1),
        "variation": round(variation, 1),
        "conflict": round(conflict, 1),
        "verdict": verdict,
    }


if __name__ == "__main__":
    poster = ConditioningRequest(
        base_alignment=68,
        base_composition=52,
        recommended_guidance=6.5,
        layout_required=True,
    )
    balanced = ConditioningPolicy(
        guidance=6.5,
        structure_strength=65,
        structure_gain=42,
        freedom_cost=25,
        control_matches_task=True,
    )
    conflicting = ConditioningPolicy(
        guidance=11.5,
        structure_strength=90,
        structure_gain=18,
        freedom_cost=34,
        control_matches_task=False,
    )

    balanced_result = evaluate(poster, balanced)
    conflict_result = evaluate(poster, conflicting)

    assert balanced_result["composition"] > conflict_result["composition"]
    assert conflict_result["conflict"] >= 45
    print(balanced_result)
    print(conflict_result)
