#!/usr/bin/env python3
"""Validate immutable rendition evidence before publishing a manifest."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Rendition:
    name: str
    publication_version: int
    segment_count: int
    validated_segments: int
    aligned_duration_seconds: int


def publication_decision(renditions: list[Rendition], expected_version: int) -> str:
    if not renditions:
        return "hold: no renditions"
    if any(item.publication_version != expected_version for item in renditions):
        return "hold: mixed publication versions"
    if any(item.segment_count != item.validated_segments for item in renditions):
        return "hold: incomplete segment evidence"
    durations = {item.aligned_duration_seconds for item in renditions}
    if len(durations) != 1:
        return "hold: rendition timelines are not aligned"
    return f"publish: version {expected_version}"


if __name__ == "__main__":
    candidates = [
        Rendition("480p", 17, 120, 120, 720),
        Rendition("720p", 17, 120, 120, 720),
        Rendition("1080p", 17, 120, 120, 720),
    ]
    decision = publication_decision(candidates, expected_version=17)
    assert decision == "publish: version 17"
    print(decision)
