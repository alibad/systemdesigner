"""Evaluate region classes and reading order without hiding slice failures."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class PageResult:
    slice_name: str
    expected_regions: set[str]
    predicted_regions: set[str]
    expected_order: list[str]
    predicted_order: list[str]


def pairwise_order_accuracy(expected: list[str], predicted: list[str]) -> float:
    """Score whether every shared pair appears in the same relative order."""
    shared = [region_id for region_id in expected if region_id in predicted]
    if len(shared) < 2:
        return 1.0

    predicted_position = {
        region_id: index for index, region_id in enumerate(predicted)
    }
    correct_pairs = 0
    total_pairs = 0
    for left_index, left_id in enumerate(shared):
        for right_id in shared[left_index + 1 :]:
            total_pairs += 1
            if predicted_position[left_id] < predicted_position[right_id]:
                correct_pairs += 1
    return correct_pairs / total_pairs


def evaluate(results: list[PageResult]) -> dict[str, dict[str, float]]:
    """Report coverage, false discoveries, and order quality per slice."""
    totals: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "true_positive": 0.0,
            "false_positive": 0.0,
            "false_negative": 0.0,
            "order_score_sum": 0.0,
            "pages": 0.0,
        }
    )

    for result in results:
        bucket = totals[result.slice_name]
        bucket["true_positive"] += len(
            result.expected_regions & result.predicted_regions
        )
        bucket["false_positive"] += len(
            result.predicted_regions - result.expected_regions
        )
        bucket["false_negative"] += len(
            result.expected_regions - result.predicted_regions
        )
        bucket["order_score_sum"] += pairwise_order_accuracy(
            result.expected_order, result.predicted_order
        )
        bucket["pages"] += 1

    report: dict[str, dict[str, float]] = {}
    for slice_name, values in totals.items():
        precision_denominator = values["true_positive"] + values["false_positive"]
        recall_denominator = values["true_positive"] + values["false_negative"]
        report[slice_name] = {
            "region_precision": (
                values["true_positive"] / precision_denominator
                if precision_denominator
                else 0.0
            ),
            "region_recall": (
                values["true_positive"] / recall_denominator
                if recall_denominator
                else 0.0
            ),
            "pairwise_order_accuracy": (
                values["order_score_sum"] / values["pages"]
            ),
        }
    return report
