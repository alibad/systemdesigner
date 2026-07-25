#!/usr/bin/env python3
"""Model surviving capacity for a small cloud-native service."""

from __future__ import annotations

import argparse
import json
import math


def calculate(
    scenario: str,
    replicas: int,
    zones: int,
    timeout_ms: int,
    bounded_queue: bool,
    traffic_rps: int = 9000,
    pod_capacity_rps: int = 3200,
) -> dict[str, float | int | str]:
    duration = {"pod-crash": 45, "zone-loss": 480, "slow-dependency": 180}[scenario]
    lost_replicas = 0
    dependency_factor = 1.0

    if scenario == "pod-crash":
        lost_replicas = 1
    elif scenario == "zone-loss":
        lost_replicas = math.ceil(replicas / zones)
    else:
        dependency_factor = max(0.25, 0.95 - max(0, timeout_ms - 700) / 3200)

    remaining = max(0, replicas - lost_replicas)
    handling_factor = 1.0 if bounded_queue else 0.82
    capacity_rps = round(
        remaining * pod_capacity_rps * dependency_factor * handling_factor
    )
    shortfall_rps = max(0, traffic_rps - capacity_rps)
    risk_factor = 0.72 if bounded_queue else 1.35
    at_risk = min(
        traffic_rps * duration,
        round(shortfall_rps * duration * risk_factor),
    )
    availability = 100 * (1 - at_risk / (traffic_rps * duration))

    return {
        "scenario": scenario,
        "remaining_replicas": remaining,
        "surviving_capacity_rps": capacity_rps,
        "traffic_rps": traffic_rps,
        "requests_at_risk": at_risk,
        "modeled_availability_percent": round(availability, 2),
        "request_handling": "bounded queue" if bounded_queue else "caller retries",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scenario",
        choices=("pod-crash", "zone-loss", "slow-dependency"),
        default="pod-crash",
    )
    parser.add_argument("--replicas", type=int, default=4)
    parser.add_argument("--zones", type=int, choices=(1, 2, 3), default=2)
    parser.add_argument("--timeout-ms", type=int, default=800)
    parser.add_argument("--no-bounded-queue", action="store_true")
    args = parser.parse_args()

    result = calculate(
        args.scenario,
        args.replicas,
        args.zones,
        args.timeout_ms,
        not args.no_bounded_queue,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
