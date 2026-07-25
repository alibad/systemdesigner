from math import ceil


def size_zonal_fleet(peak_rps: int, instance_rps: int, utilization: float, zones: int):
    if not 0 < utilization < 1 or zones < 2:
        raise ValueError("use a fractional utilization target and at least two zones")
    required_after_failure = ceil(peak_rps / (instance_rps * utilization))
    per_zone = ceil(required_after_failure / (zones - 1))
    total = per_zone * zones
    surviving_rps = (total - per_zone) * instance_rps * utilization
    return {"per_zone": per_zone, "total": total, "surviving_rps": surviving_rps}


if __name__ == "__main__":
    plan = size_zonal_fleet(8_000, 420, 0.6, 3)
    assert plan["surviving_rps"] >= 8_000
    print(plan)
