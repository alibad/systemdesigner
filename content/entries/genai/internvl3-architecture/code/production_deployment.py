"""Illustrative multimodal admission and fallback policy.

This is application policy, not InternVL3 source code. Calibrate its limits with the
real checkpoint, processor, hardware, and product SLOs before deploying it.
"""

from dataclasses import dataclass
from enum import Enum


class Route(str, Enum):
    MULTIMODAL = "multimodal"
    TEXT_ONLY = "text_only"
    DEFER = "defer"
    REJECT = "reject"


@dataclass(frozen=True)
class Request:
    media_count: int
    estimated_visual_tokens: int
    text_tokens: int
    output_reserve_tokens: int
    task_requires_visual_evidence: bool
    media_is_valid: bool


@dataclass(frozen=True)
class Limits:
    context_tokens: int = 8_192
    max_media_count: int = 8
    max_visual_tokens: int = 4_000


@dataclass(frozen=True)
class Admission:
    route: Route
    reason: str
    context_used: int


def admit(request: Request, limits: Limits, vision_healthy: bool) -> Admission:
    """Choose an honest route before allocating accelerator work."""
    context_used = (
        request.estimated_visual_tokens
        + request.text_tokens
        + request.output_reserve_tokens
    )

    if not request.media_is_valid or request.media_count > limits.max_media_count:
        return Admission(Route.REJECT, "Media failed validation or request quota.", context_used)

    if request.estimated_visual_tokens > limits.max_visual_tokens:
        return Admission(Route.REJECT, "Visual-token policy exceeded; ask for fewer inputs or an approved resize.", context_used)

    if context_used > limits.context_tokens:
        return Admission(Route.REJECT, "Context budget exceeded; do not silently drop visual evidence.", context_used)

    if vision_healthy:
        return Admission(Route.MULTIMODAL, "Visual evidence is within the declared budget.", context_used)

    if request.task_requires_visual_evidence:
        return Admission(Route.DEFER, "Visual verification is required, so text-only output would be unsupported.", context_used)

    return Admission(Route.TEXT_ONLY, "Visual path is unavailable; label the response as text-only.", context_used)


if __name__ == "__main__":
    example = Request(
        media_count=2,
        estimated_visual_tokens=1_024,
        text_tokens=1_400,
        output_reserve_tokens=900,
        task_requires_visual_evidence=True,
        media_is_valid=True,
    )
    print(admit(example, Limits(), vision_healthy=True))
