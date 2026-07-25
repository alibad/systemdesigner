"""A small, dependency-free model of one federated averaging round."""

from dataclasses import dataclass
from math import sqrt


@dataclass(frozen=True)
class ClientUpdate:
    client_id: str
    sample_count: int
    delta: tuple[float, ...]
    completed: bool = True


def l2_norm(vector: tuple[float, ...]) -> float:
    return sqrt(sum(value * value for value in vector))


def clip_by_l2_norm(
    vector: tuple[float, ...],
    clip_norm: float,
) -> tuple[float, ...]:
    """Bound one client's influence before aggregation."""
    norm = l2_norm(vector)
    if norm <= clip_norm:
        return vector
    scale = clip_norm / norm
    return tuple(value * scale for value in vector)


def aggregate_round(
    updates: list[ClientUpdate],
    minimum_survivors: int,
    clip_norm: float,
    maximum_weight_samples: int,
) -> tuple[float, ...]:
    """Clip completed updates, bound weights, and compute weighted FedAvg."""
    survivors = [update for update in updates if update.completed]
    if len(survivors) < minimum_survivors:
        raise RuntimeError("round aborted: secure-aggregation quorum was not met")

    dimensions = {len(update.delta) for update in survivors}
    if len(dimensions) != 1:
        raise ValueError("every update must use the same model schema")

    bounded_weights = [
        max(1, min(update.sample_count, maximum_weight_samples))
        for update in survivors
    ]
    weight_total = sum(bounded_weights)
    aggregate = [0.0] * len(survivors[0].delta)

    for update, weight in zip(survivors, bounded_weights):
        clipped = clip_by_l2_norm(update.delta, clip_norm)
        for index, value in enumerate(clipped):
            aggregate[index] += value * weight / weight_total

    return tuple(aggregate)


if __name__ == "__main__":
    cohort = [
        ClientUpdate("phone-a", 420, (0.18, -0.08, 0.05)),
        ClientUpdate("phone-b", 510, (0.12, -0.04, 0.07)),
        ClientUpdate("phone-c", 380, (9.00, -7.00, 5.00)),  # clipped outlier
        ClientUpdate("phone-d", 460, (0.16, -0.06, 0.06)),
        ClientUpdate("phone-e", 300, (0.10, -0.03, 0.02), completed=False),
    ]

    global_delta = aggregate_round(
        cohort,
        minimum_survivors=4,
        clip_norm=0.35,
        maximum_weight_samples=500,
    )

    assert len(global_delta) == 3
    assert l2_norm(global_delta) <= 0.35 + 1e-9
    print("survivors: 4")
    print("bounded aggregate:", tuple(round(value, 4) for value in global_delta))
