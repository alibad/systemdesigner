"""Small, dependency-free distribution checks for incident triage.

The distances below are descriptive signals. Production alert thresholds should be
calibrated from representative historical windows, not copied from this example.
"""

from bisect import bisect_right
from math import log


def ks_distance(reference: list[float], current: list[float]) -> float:
    """Return the two-sample Kolmogorov-Smirnov D statistic."""
    if not reference or not current:
        raise ValueError("both samples must contain observations")

    left = sorted(reference)
    right = sorted(current)
    support = sorted(set(left + right))
    return max(
        abs(bisect_right(left, value) / len(left) - bisect_right(right, value) / len(right))
        for value in support
    )


def quantile_edges(values: list[float], bins: int) -> list[float]:
    """Build deterministic reference quantile edges for PSI."""
    if bins < 2 or len(values) < bins:
        raise ValueError("bins must be at least 2 and no greater than sample size")
    ordered = sorted(values)
    return [ordered[min(len(ordered) - 1, index * len(ordered) // bins)] for index in range(1, bins)]


def proportions(values: list[float], edges: list[float], smoothing: float = 1e-6) -> list[float]:
    counts = [smoothing] * (len(edges) + 1)
    for value in values:
        counts[bisect_right(edges, value)] += 1
    total = sum(counts)
    return [count / total for count in counts]


def population_stability_index(
    reference: list[float], current: list[float], bins: int = 5
) -> float:
    """Return PSI using bins fitted only on the reference sample."""
    edges = quantile_edges(reference, bins)
    expected = proportions(reference, edges)
    observed = proportions(current, edges)
    return sum((actual - baseline) * log(actual / baseline) for baseline, actual in zip(expected, observed))


REFERENCE_LATENCY_MS = [82, 90, 95, 101, 104, 110, 113, 118, 124, 131]
CURRENT_LATENCY_MS = [89, 98, 106, 115, 127, 138, 149, 162, 178, 195]

ks = ks_distance(REFERENCE_LATENCY_MS, CURRENT_LATENCY_MS)
psi = population_stability_index(REFERENCE_LATENCY_MS, CURRENT_LATENCY_MS)

print(f"KS distance: {ks:.3f}")
print(f"PSI: {psi:.3f}")
print("Next step: inspect slices, contracts, labels, and outcome impact.")

assert 0.0 <= ks <= 1.0
assert psi >= 0.0
