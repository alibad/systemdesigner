"""Illustrative visual-token packing metadata.

This example teaches an application-level provenance contract. It is not an
implementation of InternVL3 V2PE or its training-time position encoding.
"""

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class VisualRegion:
    media_index: int
    tile_row: int
    tile_column: int
    resize_policy: str
    compression_factor: int


@dataclass(frozen=True)
class PackedRegion:
    region: VisualRegion
    token_start: int
    token_count: int


def pack_regions(
    media_count: int,
    tiles_per_media: int,
    tokens_per_tile: int,
    compression_factor: int,
    visual_token_budget: int,
) -> list[PackedRegion]:
    """Allocate visual tokens while preserving media and tile identity."""
    token_count = ceil(tokens_per_tile / compression_factor)
    packed: list[PackedRegion] = []
    next_token = 0

    for media_index in range(media_count):
        side = ceil(tiles_per_media**0.5)
        for tile_index in range(tiles_per_media):
            if next_token + token_count > visual_token_budget:
                raise ValueError("Visual-token budget exceeded; choose an explicit resize or sampling policy.")

            packed.append(
                PackedRegion(
                    region=VisualRegion(
                        media_index=media_index,
                        tile_row=tile_index // side,
                        tile_column=tile_index % side,
                        resize_policy="dynamic-tile",
                        compression_factor=compression_factor,
                    ),
                    token_start=next_token,
                    token_count=token_count,
                )
            )
            next_token += token_count

    return packed


if __name__ == "__main__":
    regions = pack_regions(
        media_count=2,
        tiles_per_media=4,
        tokens_per_tile=256,
        compression_factor=2,
        visual_token_budget=2_000,
    )
    print(f"Packed {len(regions)} regions into {regions[-1].token_start + regions[-1].token_count} visual tokens.")
