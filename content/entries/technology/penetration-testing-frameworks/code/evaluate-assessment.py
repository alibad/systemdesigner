#!/usr/bin/env python3
"""Evaluate a fictional penetration-test result without touching a network."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RESULTS_FILE = ROOT / "data" / "assessment-results.json"


def load_results(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload.get("inScopeAssets"), list):
        raise ValueError("inScopeAssets must be a list")
    if not isinstance(payload.get("observations"), list):
        raise ValueError("observations must be a list")
    return payload


def evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    scope = set(payload["inScopeAssets"])
    observations = payload["observations"]
    confirmed = []
    needs_validation = []
    stop_reasons = []

    for observation in observations:
        observation_id = observation.get("id", "unknown")
        asset = observation.get("asset")
        status = observation.get("status")

        if asset not in scope:
            stop_reasons.append(f"{observation_id}: {asset} is outside the authorized target list")
            continue

        if status == "confirmed":
            required = (
                observation.get("evidenceComplete") is True,
                observation.get("cleanupVerified") is True,
                bool(observation.get("owner")),
            )
            if all(required):
                confirmed.append(observation_id)
            else:
                needs_validation.append(f"{observation_id}: confirmed claim lacks evidence, cleanup, or owner")
        elif status == "suspected":
            needs_validation.append(f"{observation_id}: retain as a hypothesis until evidence is complete")
        else:
            needs_validation.append(f"{observation_id}: unsupported status {status!r}")

    decision = "halt-and-review" if stop_reasons else "review-findings"
    return {
        "decision": decision,
        "confirmed": confirmed,
        "needsValidation": needs_validation,
        "stopReasons": stop_reasons,
    }


def main() -> None:
    result = evaluate(load_results(RESULTS_FILE))
    print(json.dumps(result, indent=2))

    assert result["decision"] == "halt-and-review"
    assert result["confirmed"] == ["OBS-001"]
    assert len(result["needsValidation"]) == 1
    assert len(result["stopReasons"]) == 1


if __name__ == "__main__":
    main()
