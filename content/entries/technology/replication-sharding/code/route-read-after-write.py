from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Replica:
    name: str
    region: str
    shard_id: str
    applied_position: int
    lag_ms: int
    healthy: bool
    is_primary: bool = False


@dataclass(frozen=True)
class ReadRoute:
    replica: str
    reason: str


def choose_read_replica(
    replicas: Iterable[Replica],
    *,
    shard_id: str,
    client_region: str,
    required_position: int | None,
    max_staleness_ms: int,
) -> ReadRoute:
    """Choose a replica only when it satisfies this operation's contract."""
    eligible = [
        replica
        for replica in replicas
        if replica.shard_id == shard_id and replica.healthy
    ]
    if not eligible:
        raise RuntimeError(f"no healthy replica for shard {shard_id}")

    local = [replica for replica in eligible if replica.region == client_region]
    local.sort(key=lambda replica: (replica.lag_ms, replica.name))

    if required_position is not None:
        for replica in local:
            if replica.applied_position >= required_position:
                return ReadRoute(replica.name, "local replica reached session position")
    else:
        for replica in local:
            if replica.lag_ms <= max_staleness_ms:
                return ReadRoute(replica.name, "local replica is inside staleness budget")

    primary = next((replica for replica in eligible if replica.is_primary), None)
    if primary is None:
        raise RuntimeError("freshness contract cannot be met until replay or promotion")

    return ReadRoute(primary.name, "fallback to primary for required freshness")
