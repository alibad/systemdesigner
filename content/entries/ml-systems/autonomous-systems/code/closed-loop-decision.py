"""Compute a bounded command from evidence, state uncertainty, and stopping distance."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Scene:
    speed_mps: float
    obstacle_distance_m: float
    reaction_ms: int
    max_deceleration_mps2: float
    localization_uncertainty_m: float
    minimum_clearance_m: float


@dataclass(frozen=True)
class Evidence:
    reliability: float
    confidence_multiplier: float
    uncertainty_multiplier: float
    pipeline_delay_ms: int


@dataclass(frozen=True)
class Plan:
    speed_multiplier: float
    clearance_multiplier: float


def bounded_command(scene: Scene, evidence: Evidence, plan: Plan) -> dict[str, float | str]:
    """Return a control decision and the quantities that justify it."""
    confidence = min(0.99, evidence.reliability * evidence.confidence_multiplier)
    uncertainty = (
        scene.localization_uncertainty_m * evidence.uncertainty_multiplier
        + (1.0 - confidence) * 1.8
    )
    speed = scene.speed_mps * plan.speed_multiplier
    reaction_s = (scene.reaction_ms + evidence.pipeline_delay_ms) / 1000
    stopping_distance = speed * reaction_s + speed**2 / (2 * scene.max_deceleration_mps2)
    clearance = scene.minimum_clearance_m * plan.clearance_multiplier
    required_distance = stopping_distance + clearance + uncertainty
    margin = scene.obstacle_distance_m - required_distance

    if confidence < 0.75 or margin < 0:
        authority = "withhold"
    elif confidence < 0.85 or margin < 1.2:
        authority = "reduced"
    else:
        authority = "bounded"

    return {
        "authority": authority,
        "confidence": round(confidence, 3),
        "state_uncertainty_m": round(uncertainty, 3),
        "commanded_speed_mps": round(speed, 3),
        "stopping_distance_m": round(stopping_distance, 3),
        "required_distance_m": round(required_distance, 3),
        "distance_margin_m": round(margin, 3),
    }


if __name__ == "__main__":
    warehouse = Scene(
        speed_mps=2.2,
        obstacle_distance_m=8.0,
        reaction_ms=220,
        max_deceleration_mps2=2.4,
        localization_uncertainty_m=0.35,
        minimum_clearance_m=1.0,
    )
    fused_evidence = Evidence(
        reliability=0.86,
        confidence_multiplier=1.04,
        uncertainty_multiplier=0.55,
        pipeline_delay_ms=35,
    )
    balanced_plan = Plan(speed_multiplier=0.82, clearance_multiplier=1.0)
    print(bounded_command(warehouse, fused_evidence, balanced_plan))
