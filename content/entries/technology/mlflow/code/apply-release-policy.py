"""Evaluate release evidence and optionally move an MLflow registry alias.

Policy evaluation uses only the Python standard library. Supplying ``--apply``
imports MLflow, verifies that the expected champion has not changed, records a
validation tag, and then moves the alias.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


DEFAULT_POLICY = Path(__file__).parents[1] / "data" / "release-candidates.json"


def load_policy(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload.get("thresholds"), dict):
        raise ValueError("policy needs a thresholds object")
    if not isinstance(payload.get("candidates"), list) or not payload["candidates"]:
        raise ValueError("policy needs at least one candidate")
    return payload


def release_failures(policy: dict[str, Any], candidate: dict[str, Any]) -> list[str]:
    thresholds = policy["thresholds"]
    failures: list[str] = []
    if candidate["metrics"]["f1"] < thresholds["minimumF1"]:
        failures.append("overall F1 is below the release floor")
    if candidate["metrics"]["worstSliceRecall"] < thresholds["minimumWorstSliceRecall"]:
        failures.append("worst-slice recall is below the release floor")
    if candidate["metrics"]["p95LatencyMs"] > thresholds["maximumP95LatencyMs"]:
        failures.append("p95 latency exceeds the release ceiling")

    missing = [name for name in policy["requiredGates"] if not candidate["gates"].get(name)]
    if missing:
        failures.append(f"missing gates: {', '.join(sorted(missing))}")
    return failures


def apply_alias(model_name: str, candidate: dict[str, Any]) -> None:
    import mlflow
    from mlflow import MlflowClient

    tracking_uri = os.getenv("MLFLOW_TRACKING_URI")
    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)

    client = MlflowClient()
    current = client.get_model_version_by_alias(model_name, "champion")
    expected = str(candidate["expectedChampionVersion"])
    if str(current.version) != expected:
        raise RuntimeError(
            f"champion changed from expected version {expected} to {current.version}; rerun gates"
        )

    version = str(candidate["version"])
    client.set_model_version_tag(
        name=model_name,
        version=version,
        key="validation_status",
        value="passed",
    )
    client.set_registered_model_alias(name=model_name, alias="champion", version=version)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate_id")
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--model-name", default="prod.retention.renewal_classifier")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    policy = load_policy(args.policy)
    candidate = next(
        (item for item in policy["candidates"] if item["id"] == args.candidate_id),
        None,
    )
    if candidate is None:
        parser.error(f"unknown candidate_id: {args.candidate_id}")

    failures = release_failures(policy, candidate)
    decision = {
        "candidate": candidate["id"],
        "version": candidate["version"],
        "decision": "hold" if failures else "promote",
        "failures": failures,
    }
    print(json.dumps(decision, indent=2, sort_keys=True))

    if failures:
        raise SystemExit(2)
    if args.apply:
        apply_alias(args.model_name, candidate)


if __name__ == "__main__":
    main()
