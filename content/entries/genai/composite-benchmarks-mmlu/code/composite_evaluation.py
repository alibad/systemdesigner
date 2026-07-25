"""Denominator-aware reporting for an MMLU-shaped evaluation.

The model runner should write immutable item records. This module turns those
records into auditable subject/category summaries and applies a separate release
policy. It intentionally uses only the Python standard library.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass
from math import sqrt
from typing import Iterable, Mapping


@dataclass(frozen=True)
class ItemResult:
    item_id: str
    subject: str
    category: str
    correct: bool
    parsed_choice: str | None


@dataclass(frozen=True)
class SliceResult:
    correct: int
    total: int
    accuracy: float
    lower_95: float
    upper_95: float


@dataclass(frozen=True)
class ReleasePolicy:
    category_weights: Mapping[str, float]
    critical_category: str
    critical_floor: float
    minimum_critical_items: int


def wilson_interval(correct: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Return a Wilson score interval for a binomial accuracy."""
    if total <= 0:
        raise ValueError("total must be positive")
    if not 0 <= correct <= total:
        raise ValueError("correct must be between zero and total")

    rate = correct / total
    denominator = 1 + z * z / total
    center = (rate + z * z / (2 * total)) / denominator
    margin = z * sqrt(rate * (1 - rate) / total + z * z / (4 * total * total))
    margin /= denominator
    return max(0.0, center - margin), min(1.0, center + margin)


def summarize(items: Iterable[ItemResult], key: str) -> dict[str, SliceResult]:
    """Group records by `subject` or `category` and retain denominators."""
    if key not in {"subject", "category"}:
        raise ValueError("key must be 'subject' or 'category'")

    counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for item in items:
        label = getattr(item, key)
        counts[label][1] += 1
        counts[label][0] += int(item.correct)

    output: dict[str, SliceResult] = {}
    for label, (correct, total) in sorted(counts.items()):
        lower, upper = wilson_interval(correct, total)
        output[label] = SliceResult(
            correct=correct,
            total=total,
            accuracy=correct / total,
            lower_95=lower,
            upper_95=upper,
        )
    return output


def weighted_accuracy(
    categories: Mapping[str, SliceResult],
    weights: Mapping[str, float],
) -> float:
    """Apply explicit, normalized category weights."""
    missing = set(weights) - set(categories)
    if missing:
        raise ValueError(f"missing category results: {sorted(missing)}")
    if any(weight < 0 for weight in weights.values()):
        raise ValueError("weights cannot be negative")

    total_weight = sum(weights.values())
    if total_weight <= 0:
        raise ValueError("at least one category weight must be positive")

    return sum(
        categories[name].accuracy * weight
        for name, weight in weights.items()
    ) / total_weight


def release_decision(
    categories: Mapping[str, SliceResult],
    policy: ReleasePolicy,
) -> tuple[str, str]:
    """Gate on a critical slice without letting the aggregate cancel it."""
    critical = categories[policy.critical_category]

    if critical.accuracy < policy.critical_floor:
        return (
            "block",
            f"{policy.critical_category} accuracy is below its hard floor",
        )
    if critical.total < policy.minimum_critical_items:
        return (
            "hold",
            f"{policy.critical_category} has only {critical.total} independent items",
        )
    if critical.lower_95 < policy.critical_floor:
        return (
            "hold",
            f"{policy.critical_category} uncertainty still crosses its floor",
        )
    return "pass", "critical slice supports a bounded canary"


def build_report(
    items: list[ItemResult],
    policy: ReleasePolicy,
    manifest_id: str,
) -> dict[str, object]:
    if not items:
        raise ValueError("evaluation contains no item records")

    categories = summarize(items, "category")
    subjects = summarize(items, "subject")
    decision, reason = release_decision(categories, policy)
    invalid_outputs = sum(item.parsed_choice is None for item in items)

    return {
        "manifest_id": manifest_id,
        "item_count": len(items),
        "invalid_output_count": invalid_outputs,
        "weighted_accuracy": weighted_accuracy(categories, policy.category_weights),
        "categories": {name: asdict(result) for name, result in categories.items()},
        "subjects": {name: asdict(result) for name, result in subjects.items()},
        "release": {"decision": decision, "reason": reason},
    }


POLICY = ReleasePolicy(
    category_weights={
        "stem": 0.25,
        "humanities": 0.15,
        "social_sciences": 0.20,
        "professional": 0.40,
    },
    critical_category="professional",
    critical_floor=0.70,
    minimum_critical_items=200,
)
