"""Apply the lesson's explicit rollout policy to a fleet scenario."""

import argparse
import json
from pathlib import Path
from typing import Any


POLICY_FILE = Path(__file__).parents[1] / "data" / "fleet-rollout-policy.json"


def load_policy() -> dict[str, Any]:
    return json.loads(POLICY_FILE.read_text(encoding="utf-8"))


def gate_rollout(
    policy: dict[str, Any],
    stage_id: str,
    scenario_id: str,
    fallback_id: str,
    completed_controls: set[str],
) -> dict[str, object]:
    stage = next(item for item in policy["stages"] if item["id"] == stage_id)
    scenario = next(
        item for item in policy["scenarios"] if item["id"] == scenario_id
    )
    fallback = next(
        item for item in policy["fallbacks"] if item["id"] == fallback_id
    )
    required = set(scenario["requiredControls"])
    missing = sorted(required - completed_controls)
    affected_devices = round(policy["fleetSize"] * stage["percentage"] / 100)

    if scenario["mode"] == "healthy":
        action = "advance" if not missing else "hold"
    elif scenario["mode"] == "rollback":
        action = "rollback" if "rollback-artifact" in completed_controls else "contain"
    elif scenario["mode"] == "offline":
        action = "continue-local" if fallback["availableOffline"] else "stop-ml-path"
    else:
        action = "hold-observability-gap"

    return {
        "action": action,
        "affected_devices": affected_devices,
        "missing_required_controls": missing,
        "fallback": fallback["id"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", default="canary")
    parser.add_argument("--scenario", default="thermal-regression")
    parser.add_argument("--fallback", default="previous-model")
    parser.add_argument(
        "--controls",
        nargs="*",
        default=["runtime-telemetry", "rollback-artifact", "release-kill-switch"],
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    result = gate_rollout(
        load_policy(),
        args.stage,
        args.scenario,
        args.fallback,
        set(args.controls),
    )
    print(json.dumps(result, indent=2))
    assert result["affected_devices"] > 0
