#!/usr/bin/env python3
"""Evaluate image-captioning builds against route-specific release gates."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DATA_FILE = Path(__file__).parents[1] / "data" / "release-gate-scenarios.json"


def load_data(path: Path = DATA_FILE) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def find_by_id(items: list[dict[str, Any]], item_id: str) -> dict[str, Any]:
    for item in items:
        if item["id"] == item_id:
            return item
    raise KeyError(f"Unknown id: {item_id}")


def evaluate_release(
    data: dict[str, Any],
    build_id: str,
    policy_id: str,
    exposure_percent: int,
) -> dict[str, Any]:
    build = find_by_id(data["builds"], build_id)
    policy = find_by_id(data["policies"], policy_id)
    metrics = build["metrics"]
    requirements = policy["requirements"]

    gates = {
        "grounded_claim_precision": metrics["groundedClaimPrecision"]
        >= requirements["minGroundedClaimPrecision"],
        "critical_hallucination": metrics["criticalHallucinationPpm"]
        <= requirements["maxCriticalHallucinationPpm"],
        "human_usefulness": metrics["humanUsefulness"]
        >= requirements["minHumanUsefulness"],
        "p95_latency": metrics["p95LatencyMs"]
        <= requirements["maxP95LatencyMs"],
        "evaluation_slices": metrics["sliceCoveragePercent"]
        >= requirements["minSliceCoveragePercent"],
        "sensitive_inference": metrics["sensitiveInferencePpm"]
        <= requirements["maxSensitiveInferencePpm"],
        "queue_headroom": metrics["queueHeadroomPercent"]
        >= requirements["minQueueHeadroomPercent"],
        "decision_telemetry": metrics["telemetryComplete"],
        "human_review": (
            not requirements["requiresHumanReview"] or metrics["humanReviewReady"]
        ),
        "initial_exposure": exposure_percent <= policy["maxInitialExposurePercent"],
    }
    failed_gates = [name for name, passed in gates.items() if not passed]
    canary_captions_per_hour = round(
        policy["requestRps"] * 3600 * (exposure_percent / 100)
    )
    modeled_critical_outputs_per_hour = (
        canary_captions_per_hour
        * metrics["criticalHallucinationPpm"]
        / 1_000_000
    )

    return {
        "build": build["label"],
        "policy": policy["label"],
        "exposurePercent": exposure_percent,
        "decision": "ELIGIBLE_FOR_CANARY" if not failed_gates else "HOLD_RELEASE",
        "failedGates": failed_gates,
        "canaryCaptionsPerHour": canary_captions_per_hour,
        "modeledCriticalOutputsPerHour": round(modeled_critical_outputs_per_hour, 4),
        "gates": gates,
    }


def audit_dataset(data: dict[str, Any]) -> None:
    assert data["builds"] and data["policies"]
    for build in data["builds"]:
        metrics = build["metrics"]
        assert 0 <= metrics["groundedClaimPrecision"] <= 100
        assert 0 <= metrics["sliceCoveragePercent"] <= 100
        assert 0 <= metrics["queueHeadroomPercent"] <= 100
        assert metrics["criticalHallucinationPpm"] >= 0
        assert metrics["sensitiveInferencePpm"] >= 0

    for policy in data["policies"]:
        exposure = min(2, policy["maxInitialExposurePercent"])
        decisions = [
            evaluate_release(data, build["id"], policy["id"], exposure)
            for build in data["builds"]
        ]
        assert any(decision["decision"] == "ELIGIBLE_FOR_CANARY" for decision in decisions)
        assert any(decision["decision"] == "HOLD_RELEASE" for decision in decisions)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build")
    parser.add_argument("--policy")
    parser.add_argument("--exposure", type=int, default=2)
    args = parser.parse_args()
    data = load_data()
    audit_dataset(data)

    if args.build or args.policy:
        build_id = args.build or data["defaults"]["buildId"]
        policy_id = args.policy or data["defaults"]["policyId"]
        result = evaluate_release(data, build_id, policy_id, args.exposure)
        print(json.dumps(result, indent=2))
        return

    for policy in data["policies"]:
        exposure = min(2, policy["maxInitialExposurePercent"])
        for build in data["builds"]:
            result = evaluate_release(data, build["id"], policy["id"], exposure)
            failures = ",".join(result["failedGates"]) or "none"
            print(
                f"{policy['id']:18} {build['id']:20} "
                f"{result['decision']:19} failures={failures}"
            )


if __name__ == "__main__":
    main()
