"""Apply aggregate and required-slice gates to a prompt candidate."""

import json
from pathlib import Path
from typing import Any


DATA_FILE = Path(__file__).parents[1] / "data" / "prompt-release-evaluations.json"


def evaluate_candidate(
    candidate: dict[str, Any],
    slices: list[dict[str, Any]],
    quality_floor: float,
    required_slice_floor: float,
) -> dict[str, Any]:
    weighted_score = sum(
        candidate["scores"][slice_["id"]] * slice_["weight"] for slice_ in slices
    )
    failed_required_slices = [
        slice_["label"]
        for slice_ in slices
        if slice_["critical"]
        and candidate["scores"][slice_["id"]] < required_slice_floor
    ]
    return {
        "weighted_score": round(weighted_score, 1),
        "average_passed": weighted_score >= quality_floor,
        "failed_required_slices": failed_required_slices,
        "release": weighted_score >= quality_floor and not failed_required_slices,
    }


if __name__ == "__main__":
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    candidate = next(item for item in data["candidates"] if item["id"] == "few-shot-v2")

    average_only = evaluate_candidate(candidate, data["slices"], 85, 0)
    slice_gated = evaluate_candidate(candidate, data["slices"], 85, 85)

    assert average_only["release"] is True
    assert slice_gated["release"] is False
    assert "Injection attempts" in slice_gated["failed_required_slices"]

    print("Average-only policy:", average_only)
    print("Required-slice policy:", slice_gated)
