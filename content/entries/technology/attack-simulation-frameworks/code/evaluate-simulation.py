#!/usr/bin/env python3
"""Evaluate a bounded attack-simulation result without external packages."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_INPUT = (
    Path(__file__).resolve().parent.parent / "data" / "simulation-results.json"
)
BOOLEAN_FIELDS = (
    "executed",
    "telemetryObserved",
    "detected",
    "responseAcknowledged",
)


def load_results(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    results = payload.get("results")
    if not isinstance(results, list) or not results:
        raise ValueError("results must be a non-empty list")

    for index, result in enumerate(results, start=1):
        if not isinstance(result, dict):
            raise ValueError(f"result {index} must be an object")
        for field in ("id", "technique", "target", "note"):
            if not isinstance(result.get(field), str) or not result[field]:
                raise ValueError(f"result {index} needs a non-empty {field}")
        for field in BOOLEAN_FIELDS:
            if not isinstance(result.get(field), bool):
                raise ValueError(f"result {index} needs boolean {field}")
        if result["detected"] and not result["telemetryObserved"]:
            raise ValueError(f"result {index} cannot be detected without telemetry")
        if result["responseAcknowledged"] and not result["detected"]:
            raise ValueError(f"result {index} cannot be acknowledged without detection")

    return payload


def percentage(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 1) if denominator else 0.0


def evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    results = payload["results"]
    attempted = len(results)
    executed = sum(result["executed"] for result in results)
    visible = sum(
        result["executed"] and result["telemetryObserved"] for result in results
    )
    detected = sum(
        result["telemetryObserved"] and result["detected"] for result in results
    )
    acknowledged = sum(
        result["detected"] and result["responseAcknowledged"] for result in results
    )

    gaps = []
    for result in results:
        if not result["executed"]:
            stage = "execution"
        elif not result["telemetryObserved"]:
            stage = "visibility"
        elif not result["detected"]:
            stage = "detection"
        elif not result["responseAcknowledged"]:
            stage = "response"
        else:
            continue
        gaps.append(
            {
                "id": result["id"],
                "technique": result["technique"],
                "stage": stage,
                "note": result["note"],
            }
        )

    return {
        "operationId": payload.get("operationId", "unknown"),
        "decision": "ready" if not gaps else "hold",
        "rates": {
            "executionPct": percentage(executed, attempted),
            "visibilityPctOfExecuted": percentage(visible, executed),
            "detectionPctOfVisible": percentage(detected, visible),
            "responsePctOfDetected": percentage(acknowledged, detected),
        },
        "gaps": gaps,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    args = parser.parse_args()
    print(json.dumps(evaluate(load_results(args.input)), indent=2))


if __name__ == "__main__":
    main()
