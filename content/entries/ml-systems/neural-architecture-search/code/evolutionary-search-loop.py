from dataclasses import dataclass, replace
from random import Random


@dataclass(frozen=True)
class Architecture:
    width: int
    depth: int
    expansion: int


def mutate(parent: Architecture, rng: Random) -> Architecture:
    field = rng.choice(("width", "depth", "expansion"))
    if field == "width":
        return replace(parent, width=max(16, parent.width + rng.choice((-16, 16))))
    if field == "depth":
        return replace(parent, depth=max(2, parent.depth + rng.choice((-1, 1))))
    return replace(parent, expansion=max(1, parent.expansion + rng.choice((-1, 1))))


def objective(architecture: Architecture) -> tuple[float, float]:
    quality = 0.72 + min(0.2, architecture.width / 1024 + architecture.depth / 100)
    latency_ms = architecture.width * architecture.depth * architecture.expansion / 12_000
    return quality, latency_ms


if __name__ == "__main__":
    rng = Random(7)
    parent = Architecture(width=64, depth=8, expansion=4)
    candidates = [mutate(parent, rng) for _ in range(8)]
    feasible = [candidate for candidate in candidates if objective(candidate)[1] <= 0.30]
    winner = max(feasible, key=lambda candidate: objective(candidate)[0])
    assert objective(winner)[1] <= 0.30
    print(winner, objective(winner))
