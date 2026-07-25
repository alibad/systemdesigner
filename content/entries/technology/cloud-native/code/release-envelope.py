#!/usr/bin/env python3
"""Estimate weekly request exposure from a failed deployment strategy."""

from __future__ import annotations

import argparse
import json


STRATEGIES = {
    "rolling": {"exposure": 1.8, "containment": 1.25, "capacity": 125},
    "canary": {"exposure": 1.0, "containment": 1.0, "capacity": 115},
    "blue-green": {"exposure": 2.6, "containment": 0.45, "capacity": 200},
}


def calculate(
    strategy: str,
    traffic_rps: int,
    deploys_per_day: int,
    failure_rate_percent: float,
    first_wave_percent: float,
    containment_minutes: float,
) -> dict[str, float | int | str]:
    profile = STRATEGIES[strategy]
    deployments_per_week = deploys_per_day * 5
    expected_failures = deployments_per_week * failure_rate_percent / 100
    exposure_fraction = min(1.0, first_wave_percent / 100 * profile["exposure"])
    effective_minutes = containment_minutes * profile["containment"]
    affected_per_failure = traffic_rps * 60 * effective_minutes * exposure_fraction
    affected_per_week = round(expected_failures * affected_per_failure)

    return {
        "strategy": strategy,
        "deployments_per_week": deployments_per_week,
        "expected_failed_deployments": round(expected_failures, 2),
        "effective_exposure_percent": round(exposure_fraction * 100, 1),
        "effective_containment_minutes": round(effective_minutes, 1),
        "affected_requests_per_week": affected_per_week,
        "peak_capacity_percent": profile["capacity"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strategy", choices=STRATEGIES, default="canary")
    parser.add_argument("--traffic-rps", type=int, default=18000)
    parser.add_argument("--deploys-per-day", type=int, default=4)
    parser.add_argument("--failure-rate", type=float, default=8)
    parser.add_argument("--first-wave", type=float, default=5)
    parser.add_argument("--containment-minutes", type=float, default=6)
    args = parser.parse_args()

    result = calculate(
        args.strategy,
        args.traffic_rps,
        args.deploys_per_day,
        args.failure_rate,
        args.first_wave,
        args.containment_minutes,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
