"""Score a knowledge evaluation without hiding thin critical slices."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from math import sqrt
from typing import Iterable


@dataclass(frozen=True)
class Result:
    domain: str
    operation: str
    correct: bool
    critical: bool


def wilson_interval(correct: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Return a 95% Wilson interval for a binary score."""
    if total <= 0:
        raise ValueError("total must be positive")

    rate = correct / total
    z_squared = z * z
    denominator = 1 + z_squared / total
    center = (rate + z_squared / (2 * total)) / denominator
    spread = (
        z
        * sqrt(rate * (1 - rate) / total + z_squared / (4 * total * total))
        / denominator
    )
    return max(0.0, center - spread), min(1.0, center + spread)


def score_slices(results: Iterable[Result]) -> list[dict[str, object]]:
    """Group attempts by domain and operation and retain criticality."""
    grouped: dict[tuple[str, str], list[Result]] = defaultdict(list)
    for result in results:
        grouped[(result.domain, result.operation)].append(result)

    report: list[dict[str, object]] = []
    for (domain, operation), rows in sorted(grouped.items()):
        correct = sum(row.correct for row in rows)
        lower, upper = wilson_interval(correct, len(rows))
        report.append(
            {
                "domain": domain,
                "operation": operation,
                "items": len(rows),
                "accuracy": round(correct / len(rows), 4),
                "lower_95": round(lower, 4),
                "upper_95": round(upper, 4),
                "critical": any(row.critical for row in rows),
            }
        )
    return report


if __name__ == "__main__":
    demo = [
        Result("security", "apply", True, True),
        Result("security", "apply", False, True),
        Result("product", "recall", True, False),
        Result("product", "recall", True, False),
    ]
    for slice_result in score_slices(demo):
        print(slice_result)
