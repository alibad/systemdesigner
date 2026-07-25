"""Compare HBase row-key layouts with a small deterministic model."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Result:
    hottest_share: float
    hottest_writes_per_second: int
    scan_fanout: int
    overloaded: bool


def evaluate(
    strategy: str,
    writes_per_second: int,
    region_capacity_per_second: int,
    hot_entity_share: float,
    query_scope: str,
    regions: int = 8,
) -> Result:
    if strategy == "timestamp-first":
        shares = [0.01, 0.01, 0.01, 0.02, 0.02, 0.03, 0.06, 0.84]
        fanout = 1 if query_scope == "global" else regions
    elif strategy in {"salted-time", "full-hash"}:
        shares = [1 / regions] * regions
        fanout = regions
    elif strategy == "entity-time":
        background = (1 - hot_entity_share) / regions
        shares = [background + hot_entity_share] + [background] * (regions - 1)
        fanout = 1 if query_scope == "entity" else regions
    else:
        raise ValueError(f"unknown strategy: {strategy}")

    hottest_share = max(shares)
    hottest_writes = round(writes_per_second * hottest_share)
    return Result(
        hottest_share=hottest_share,
        hottest_writes_per_second=hottest_writes,
        scan_fanout=fanout,
        overloaded=hottest_writes > region_capacity_per_second,
    )


if __name__ == "__main__":
    sequential = evaluate("timestamp-first", 24_000, 6_000, 0.18, "entity")
    entity_key = evaluate("entity-time", 24_000, 7_000, 0.18, "entity")
    salted = evaluate("salted-time", 24_000, 6_000, 0.18, "entity")

    assert sequential.overloaded
    assert not entity_key.overloaded
    assert entity_key.scan_fanout == 1
    assert salted.scan_fanout == 8

    print("timestamp-first:", sequential)
    print("entity-time:", entity_key)
    print("salted-time:", salted)
