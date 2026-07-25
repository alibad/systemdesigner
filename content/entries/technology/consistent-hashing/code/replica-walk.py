from bisect import bisect_left
from dataclasses import dataclass


@dataclass(frozen=True)
class Token:
    value: int
    node: str
    failure_domain: str


def select_replicas(
    key_hash: int,
    ring: list[Token],
    replication_factor: int,
    *,
    spread_failure_domains: bool,
) -> list[Token]:
    """Walk clockwise while counting independent physical owners."""
    if replication_factor < 1:
        raise ValueError("replication_factor must be positive")

    ordered = sorted(ring, key=lambda token: token.value)
    start = bisect_left([token.value for token in ordered], key_hash)
    selected: list[Token] = []
    used_nodes: set[str] = set()
    used_domains: set[str] = set()

    for offset in range(len(ordered)):
        candidate = ordered[(start + offset) % len(ordered)]
        if candidate.node in used_nodes:
            continue
        if spread_failure_domains and candidate.failure_domain in used_domains:
            continue
        selected.append(candidate)
        used_nodes.add(candidate.node)
        used_domains.add(candidate.failure_domain)
        if len(selected) == replication_factor:
            return selected

    raise LookupError("not enough independent owners for the requested replicas")
