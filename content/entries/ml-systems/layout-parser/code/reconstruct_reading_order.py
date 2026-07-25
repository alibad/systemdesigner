"""Build an explicit reading sequence from typed page regions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


Lane = Literal["span-top", "left", "right", "sidebar", "span-bottom"]
LANE_ORDER: dict[Lane, int] = {
    "span-top": 0,
    "left": 1,
    "right": 2,
    "sidebar": 3,
    "span-bottom": 4,
}


@dataclass(frozen=True)
class Region:
    region_id: str
    label: str
    lane: Lane
    x: float
    y: float


def row_major(regions: list[Region]) -> list[Region]:
    """A baseline that can interleave neighboring columns."""
    return sorted(regions, key=lambda region: (region.y, region.x))


def lane_aware(regions: list[Region]) -> list[Region]:
    """Honor an upstream lane assignment before vertical position."""
    return sorted(
        regions,
        key=lambda region: (LANE_ORDER[region.lane], region.y, region.x),
    )


def validate_permutation(source: list[Region], ordered: list[Region]) -> None:
    """Reject missing or duplicated regions before publishing text."""
    source_ids = [region.region_id for region in source]
    ordered_ids = [region.region_id for region in ordered]
    if len(ordered_ids) != len(set(ordered_ids)):
        raise ValueError("reading order contains a duplicate region")
    if set(source_ids) != set(ordered_ids):
        raise ValueError("reading order must contain every source region exactly once")


if __name__ == "__main__":
    page_regions = [
        Region("title", "Title", "span-top", 0.08, 0.06),
        Region("left-intro", "Introduction", "left", 0.08, 0.22),
        Region("right-method", "Method", "right", 0.54, 0.25),
        Region("left-results", "Results", "left", 0.08, 0.48),
        Region("figure", "Figure", "right", 0.54, 0.48),
        Region("caption", "Caption", "right", 0.54, 0.72),
        Region("footer", "Footer", "span-bottom", 0.08, 0.91),
    ]
    sequence = lane_aware(page_regions)
    validate_permutation(page_regions, sequence)
    print([region.region_id for region in sequence])
