"""Estimate a Redis cache's dataset envelope with explicit assumptions."""

from argparse import ArgumentParser

GIB = 1024**3


def estimate(
    primaries: int,
    ram_gib: float,
    keys_millions: float,
    value_kib: float,
    hit_rate_pct: float,
    reads_per_second: float,
) -> dict[str, float]:
    key_and_object_overhead_bytes = 104
    maxmemory_share = 0.75
    item_bytes = value_kib * 1024 + key_and_object_overhead_bytes
    working_set_gib = keys_millions * 1_000_000 * item_bytes / GIB
    maxmemory_gib = primaries * ram_gib * maxmemory_share
    miss_rps = reads_per_second * (1 - hit_rate_pct / 100)
    headroom_pct = max(0.0, (maxmemory_gib - working_set_gib) / maxmemory_gib * 100)
    return {
        "working_set_gib": working_set_gib,
        "maxmemory_gib": maxmemory_gib,
        "headroom_pct": headroom_pct,
        "steady_miss_rps": miss_rps,
        "cold_source_rps": reads_per_second,
    }


def parse_args():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--primaries", type=int, default=3)
    parser.add_argument("--ram-gib", type=float, default=16)
    parser.add_argument("--keys-millions", type=float, default=4)
    parser.add_argument("--value-kib", type=float, default=3)
    parser.add_argument("--hit-rate-pct", type=float, default=94)
    parser.add_argument("--reads-per-second", type=float, default=80_000)
    return parser.parse_args()


def main():
    args = parse_args()
    if args.primaries < 1 or min(
        args.ram_gib,
        args.keys_millions,
        args.value_kib,
        args.reads_per_second,
    ) <= 0:
        raise SystemExit("capacity inputs must be positive")
    if not 0 <= args.hit_rate_pct <= 100:
        raise SystemExit("hit rate must be between 0 and 100")

    result = estimate(
        args.primaries,
        args.ram_gib,
        args.keys_millions,
        args.value_kib,
        args.hit_rate_pct,
        args.reads_per_second,
    )
    for name, value in result.items():
        print(f"{name}: {value:,.2f}")


if __name__ == "__main__":
    main()
