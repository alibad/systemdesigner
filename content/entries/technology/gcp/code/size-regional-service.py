#!/usr/bin/env python3
"""Size equal zonal capacity so peak traffic survives one zone loss."""

import argparse
import math


def size_service(peak_rps: int, unit_rps: int, utilization: float, zones: int) -> dict[str, float]:
    if peak_rps <= 0 or unit_rps <= 0 or not 0 < utilization <= 1:
        raise ValueError("demand, capacity, and utilization must be positive")
    if zones < 2:
        raise ValueError("at least two zones are required for zonal failover")

    usable_unit_rps = unit_rps * utilization
    units_per_zone = math.ceil(peak_rps / ((zones - 1) * usable_unit_rps))
    total_units = units_per_zone * zones
    surviving_rps = (zones - 1) * units_per_zone * usable_unit_rps
    return {
        "units_per_zone": units_per_zone,
        "total_units": total_units,
        "surviving_rps": surviving_rps,
        "failover_headroom_pct": (surviving_rps / peak_rps - 1) * 100,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--peak-rps", type=int, default=4500)
    parser.add_argument("--unit-rps", type=int, default=700)
    parser.add_argument("--utilization", type=float, default=0.65)
    parser.add_argument("--zones", type=int, default=3)
    args = parser.parse_args()

    plan = size_service(args.peak_rps, args.unit_rps, args.utilization, args.zones)
    print(f"deploy {plan['units_per_zone']} units in each of {args.zones} zones")
    print(f"total units: {plan['total_units']}")
    print(f"capacity after one zone fails: {plan['surviving_rps']:.0f} rps")
    print(f"failover headroom: {plan['failover_headroom_pct']:.1f}%")


if __name__ == "__main__":
    main()
