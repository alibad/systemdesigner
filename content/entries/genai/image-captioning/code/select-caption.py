#!/usr/bin/env python3
"""Select a caption candidate with explicit language and grounding policies."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DATA_FILE = Path(__file__).parents[1] / "data" / "decoding-grounding-scenarios.json"


def load_data(path: Path = DATA_FILE) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def find_by_id(items: list[dict[str, Any]], item_id: str) -> dict[str, Any]:
    for item in items:
        if item["id"] == item_id:
            return item
    raise KeyError(f"Unknown id: {item_id}")


def grounding_score(candidate: dict[str, Any]) -> int:
    claims = candidate["claims"]
    if not claims:
        return 0
    supported_total = sum(
        claim["confidence"] if claim["supported"] else 0 for claim in claims
    )
    return round(supported_total / len(claims))


def meets_grounding_floor(candidate: dict[str, Any], floor: int) -> bool:
    return all(
        claim["supported"] and claim["confidence"] >= floor
        for claim in candidate["claims"]
    )


def select_caption(
    data: dict[str, Any],
    scene_id: str,
    strategy_id: str,
    beam_width: int,
    grounding_floor: int,
) -> dict[str, Any]:
    scene = find_by_id(data["scenes"], scene_id)
    strategy = find_by_id(data["strategies"], strategy_id)
    effective_beam = 1 if strategy["kind"] == "greedy" else beam_width
    discovered = [
        candidate
        for candidate in scene["candidates"]
        if candidate["discoveryBeam"] <= effective_beam
    ]

    if strategy["enforceGrounding"]:
        eligible = [
            candidate
            for candidate in discovered
            if meets_grounding_floor(candidate, grounding_floor)
        ]
    else:
        eligible = discovered

    selected = None
    if strategy["kind"] == "greedy":
        selected = next(
            candidate for candidate in scene["candidates"] if candidate["greedyChoice"]
        )
    elif eligible:
        def candidate_score(candidate: dict[str, Any]) -> float:
            if not strategy["enforceGrounding"]:
                return candidate["languageScore"]
            grounding_weight = strategy["groundingWeight"]
            return (
                candidate["languageScore"] * (1 - grounding_weight)
                + (grounding_score(candidate) / 100) * grounding_weight
            )

        selected = max(eligible, key=candidate_score)

    unsupported_claims = [] if selected is None else [
        claim["text"] for claim in selected["claims"] if not claim["supported"]
    ]
    weak_claims = [] if selected is None else [
        claim["text"]
        for claim in selected["claims"]
        if claim["supported"] and claim["confidence"] < grounding_floor
    ]
    latency_ms = (
        scene["encoderMs"]
        + strategy["baseDecoderMs"]
        + max(0, effective_beam - 1) * strategy["perBeamMs"]
    )

    return {
        "scene": scene["label"],
        "strategy": strategy["label"],
        "effectiveBeam": effective_beam,
        "discoveredCandidates": len(discovered),
        "caption": None if selected is None else selected["caption"],
        "languageScore": None if selected is None else selected["languageScore"],
        "groundingScore": None if selected is None else grounding_score(selected),
        "unsupportedClaims": unsupported_claims,
        "weakClaims": weak_claims,
        "eligible": selected is not None and not unsupported_claims and not weak_claims,
        "modeledLatencyMs": latency_ms,
    }


def audit_dataset(data: dict[str, Any]) -> None:
    strategy_ids = {strategy["id"] for strategy in data["strategies"]}
    assert {"greedy", "beam", "grounded"}.issubset(strategy_ids)
    language_only_found_hallucination = False

    for scene in data["scenes"]:
        evidence_ids = {evidence["id"] for evidence in scene["evidence"]}
        assert len(scene["candidates"]) >= 3
        assert sum(candidate["greedyChoice"] for candidate in scene["candidates"]) == 1

        for candidate in scene["candidates"]:
            assert 0 <= candidate["languageScore"] <= 1
            assert candidate["claims"]
            for claim in candidate["claims"]:
                assert 0 <= claim["confidence"] <= 100
                assert set(claim["evidenceIds"]).issubset(evidence_ids)

        beam_result = select_caption(data, scene["id"], "beam", 2, 75)
        if beam_result["unsupportedClaims"]:
            language_only_found_hallucination = True

        grounded_result = select_caption(data, scene["id"], "grounded", 4, 75)
        assert grounded_result["caption"] is not None
        assert grounded_result["unsupportedClaims"] == []
        assert grounded_result["weakClaims"] == []

    assert language_only_found_hallucination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scene")
    parser.add_argument("--strategy")
    parser.add_argument("--beam-width", type=int, default=2)
    parser.add_argument("--grounding-floor", type=int, default=75)
    args = parser.parse_args()
    data = load_data()
    audit_dataset(data)

    if args.scene or args.strategy:
        scene_id = args.scene or data["defaults"]["sceneId"]
        strategy_id = args.strategy or data["defaults"]["strategyId"]
        result = select_caption(
            data,
            scene_id,
            strategy_id,
            args.beam_width,
            args.grounding_floor,
        )
        print(json.dumps(result, indent=2))
        return

    for scene in data["scenes"]:
        for strategy in data["strategies"]:
            result = select_caption(data, scene["id"], strategy["id"], 4, 75)
            status = "ELIGIBLE" if result["eligible"] else "HOLD"
            print(
                f"{scene['id']:18} {strategy['id']:10} {status:8} "
                f"{result['modeledLatencyMs']:>3} ms | {result['caption']}"
            )


if __name__ == "__main__":
    main()
