"""Illustrative workload math for a binary screening model.

This example teaches metric relationships. It does not choose a clinical threshold.
"""

from dataclasses import asdict, dataclass
import json


@dataclass(frozen=True)
class Workload:
    cohort_size: int
    true_positive: int
    false_positive: int
    false_negative: int
    true_negative: int
    review_queue: int
    positive_predictive_value: float


def estimate_workload(
    cohort_size: int,
    prevalence: float,
    sensitivity: float,
    specificity: float,
) -> Workload:
    """Translate rates in [0, 1] into expected integer case counts."""
    if cohort_size <= 0:
        raise ValueError("cohort_size must be positive")
    for name, value in {
        "prevalence": prevalence,
        "sensitivity": sensitivity,
        "specificity": specificity,
    }.items():
        if not 0 <= value <= 1:
            raise ValueError(f"{name} must be between 0 and 1")

    positive_cases = round(cohort_size * prevalence)
    negative_cases = cohort_size - positive_cases
    true_positive = round(positive_cases * sensitivity)
    false_negative = positive_cases - true_positive
    true_negative = round(negative_cases * specificity)
    false_positive = negative_cases - true_negative
    review_queue = true_positive + false_positive
    ppv = true_positive / review_queue if review_queue else 0.0

    return Workload(
        cohort_size=cohort_size,
        true_positive=true_positive,
        false_positive=false_positive,
        false_negative=false_negative,
        true_negative=true_negative,
        review_queue=review_queue,
        positive_predictive_value=round(ppv, 4),
    )


if __name__ == "__main__":
    example = estimate_workload(
        cohort_size=1_000,
        prevalence=0.08,
        sensitivity=0.90,
        specificity=0.92,
    )
    print(json.dumps(asdict(example), indent=2))
