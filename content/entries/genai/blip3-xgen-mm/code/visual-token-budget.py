"""Small BLIP-3 visual-token planning model.

This reproduces the lesson arithmetic, not Salesforce preprocessing or latency.
It uses the paper's 384-pixel detail patches, a maximum of 12 detail patches,
one downsized global view, and 128 Perceiver queries per encoded view.
"""

from dataclasses import asdict, dataclass
from math import ceil
import json


PATCH_PIXELS = 384
MAX_DETAIL_PATCHES = 12
QUERY_TOKENS_PER_VIEW = 128


@dataclass(frozen=True)
class VisualBudgetRequest:
    width_px: int
    height_px: int
    image_count: int
    detail_patch_cap: int
    input_budget_tokens: int
    prompt_tokens: int = 512
    answer_reserve_tokens: int = 512


def estimate_visual_budget(request: VisualBudgetRequest) -> dict[str, int | bool]:
    """Return a deterministic upper-bound planning estimate."""
    if min(asdict(request).values()) < 0 or request.image_count == 0:
        raise ValueError("Dimensions, counts, caps, and budgets must be positive")

    patch_columns = ceil(request.width_px / PATCH_PIXELS)
    patch_rows = ceil(request.height_px / PATCH_PIXELS)
    requested_detail_patches = min(
        patch_columns * patch_rows,
        MAX_DETAIL_PATCHES,
    )
    applied_detail_patches = min(
        requested_detail_patches,
        request.detail_patch_cap,
    )
    views_per_image = 1 + applied_detail_patches  # global view plus details
    visual_tokens = (
        request.image_count * views_per_image * QUERY_TOKENS_PER_VIEW
    )
    modeled_total = (
        request.prompt_tokens + visual_tokens + request.answer_reserve_tokens
    )

    return {
        "requested_detail_patches_per_image": requested_detail_patches,
        "applied_detail_patches_per_image": applied_detail_patches,
        "views_per_image": views_per_image,
        "visual_tokens": visual_tokens,
        "modeled_total_tokens": modeled_total,
        "fits_input_budget": modeled_total <= request.input_budget_tokens,
    }


if __name__ == "__main__":
    example = VisualBudgetRequest(
        width_px=1152,
        height_px=1536,
        image_count=2,
        detail_patch_cap=6,
        input_budget_tokens=4096,
    )
    print(json.dumps(estimate_visual_budget(example), indent=2))
