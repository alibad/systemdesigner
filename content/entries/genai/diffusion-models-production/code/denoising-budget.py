"""Small, dependency-free sampling budget model.

The constants are illustrative planning inputs, not benchmark claims. Replace them
with measurements for one pinned model, scheduler, device, and prompt suite.
"""

from dataclasses import dataclass
from math import exp


@dataclass(frozen=True)
class SamplerProfile:
    name: str
    fixed_ms: int
    step_ms: int
    quality_floor: float
    quality_ceiling: float
    saturation_steps: float


SAMPLERS = {
    "ddim": SamplerProfile("DDIM-style", 520, 92, 48, 90, 14),
    "multistep": SamplerProfile("Multistep solver", 570, 98, 48, 94, 9),
    "ancestral": SamplerProfile("Ancestral sampler", 520, 104, 48, 94, 16),
}


def estimate(profile: SamplerProfile, steps: int, guidance: float) -> dict[str, float]:
    if not 4 <= steps <= 60:
        raise ValueError("steps must be between 4 and 60")
    if not 1 <= guidance <= 14:
        raise ValueError("guidance must be between 1 and 14")

    step_quality = profile.quality_floor + (
        profile.quality_ceiling - profile.quality_floor
    ) * (1 - exp(-steps / profile.saturation_steps))

    if guidance < 4.5:
        guidance_delta = -2.2 * (4.5 - guidance)
    elif guidance <= 8:
        guidance_delta = 1.5
    else:
        guidance_delta = 1.5 - 1.25 * (guidance - 8)

    cfg_multiplier = 1.0 if guidance <= 1 else 1.35
    latency_ms = profile.fixed_ms + profile.step_ms * steps * cfg_multiplier

    return {
        "latency_ms": round(latency_ms),
        "modeled_quality": round(max(0, min(100, step_quality + guidance_delta)), 1),
        "diversity_index": round(max(30, 96 - 4.8 * guidance), 1),
    }


if __name__ == "__main__":
    for sampler_id, sampler in SAMPLERS.items():
        result = estimate(sampler, steps=20, guidance=6.5)
        print(f"{sampler_id:10} {result}")
