from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class PairedResult:
    pair_id: str
    slice_name: str
    original_correct: bool
    counterfactual_correct: bool
    verified_equivalent: bool


def paired_stability(rows: Iterable[PairedResult]) -> dict[str, object]:
    """Score only human-verified pairs that preserve the intended answer logic."""
    verified = [row for row in rows if row.verified_equivalent]
    if not verified:
        raise ValueError("At least one verified counterfactual pair is required")

    original_accuracy = sum(row.original_correct for row in verified) / len(verified)
    counterfactual_accuracy = (
        sum(row.counterfactual_correct for row in verified) / len(verified)
    )
    correct_to_wrong = sum(
        row.original_correct and not row.counterfactual_correct for row in verified
    )

    by_slice: dict[str, list[PairedResult]] = defaultdict(list)
    for row in verified:
        by_slice[row.slice_name].append(row)

    return {
        "verified_pairs": len(verified),
        "original_accuracy": original_accuracy,
        "counterfactual_accuracy": counterfactual_accuracy,
        "robustness_gap": original_accuracy - counterfactual_accuracy,
        "correct_to_wrong_flip_rate": correct_to_wrong / len(verified),
        "by_slice": {
            name: paired_stability_without_slices(slice_rows)
            for name, slice_rows in sorted(by_slice.items())
        },
    }


def paired_stability_without_slices(rows: list[PairedResult]) -> dict[str, float | int]:
    total = len(rows)
    original = sum(row.original_correct for row in rows) / total
    counterfactual = sum(row.counterfactual_correct for row in rows) / total
    return {
        "pairs": total,
        "original_accuracy": original,
        "counterfactual_accuracy": counterfactual,
        "robustness_gap": original - counterfactual,
    }
