"""Select a BLIP-3 checkpoint from workload constraints.

Multi-image scores are transcribed from Table 2 of the BLIP-3 paper. The
selection policy is an explicit example policy, not an official Salesforce
recommendation or an inference-performance benchmark.
"""

from dataclasses import dataclass
from statistics import fmean


@dataclass(frozen=True)
class Checkpoint:
    name: str
    parameters_billion: int
    curriculum: str
    multi_image_scores: tuple[float, float, float, float]


CHECKPOINTS = (
    Checkpoint("BLIP-3-4B-SI", 4, "single-image", (42.9, 51.9, 35.0, 49.3)),
    Checkpoint("BLIP-3-4B-MI", 4, "multi-image", (47.1, 69.6, 38.0, 56.2)),
    Checkpoint("BLIP-3-14B-SI", 14, "single-image", (47.1, 55.4, 49.1, 55.3)),
    Checkpoint("BLIP-3-14B-MI", 14, "multi-image", (53.9, 73.4, 56.2, 61.3)),
)


def choose_checkpoint(
    *, requires_multi_image: bool, reasoning_priority: bool, cost_sensitive: bool
) -> Checkpoint:
    """Apply a readable policy that can be replaced by measured release gates."""
    required_curriculum = "multi-image" if requires_multi_image else "single-image"
    eligible = [
        checkpoint
        for checkpoint in CHECKPOINTS
        if checkpoint.curriculum == required_curriculum
    ]
    if cost_sensitive and not reasoning_priority:
        return min(eligible, key=lambda checkpoint: checkpoint.parameters_billion)
    return max(
        eligible,
        key=lambda checkpoint: (
            checkpoint.parameters_billion,
            fmean(checkpoint.multi_image_scores),
        ),
    )


if __name__ == "__main__":
    selected = choose_checkpoint(
        requires_multi_image=True,
        reasoning_priority=False,
        cost_sensitive=True,
    )
    print(selected.name)
    print(f"Table 2 score mean: {fmean(selected.multi_image_scores):.1f}")
