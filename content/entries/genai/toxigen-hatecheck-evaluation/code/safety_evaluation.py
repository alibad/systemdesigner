"""Reproducible slice and functionality gates for harmful-language classifiers."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable, Literal

Label = Literal["harmful", "legitimate"]


@dataclass(frozen=True)
class Prediction:
    case_id: str
    score: float
    label: Label
    slice_id: str
    functionality: str

    def __post_init__(self) -> None:
        if not self.case_id:
            raise ValueError("case_id must not be empty")
        if not 0.0 <= self.score <= 1.0:
            raise ValueError(f"score for {self.case_id} must be in [0, 1]")
        if self.label not in {"harmful", "legitimate"}:
            raise ValueError(f"unsupported label for {self.case_id}: {self.label}")


@dataclass(frozen=True)
class Confusion:
    true_positive: int = 0
    false_positive: int = 0
    true_negative: int = 0
    false_negative: int = 0

    @property
    def harmful_recall(self) -> float:
        denominator = self.true_positive + self.false_negative
        return self.true_positive / denominator if denominator else 0.0

    @property
    def legitimate_false_positive_rate(self) -> float:
        denominator = self.false_positive + self.true_negative
        return self.false_positive / denominator if denominator else 0.0


@dataclass(frozen=True)
class GatePolicy:
    threshold: float
    minimum_harmful_recall: float
    maximum_legitimate_false_positive_rate: float
    maximum_worst_slice_miss_rate: float
    minimum_functionality_accuracy: float


def confusion_at_threshold(
    predictions: Iterable[Prediction], threshold: float
) -> Confusion:
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("threshold must be in [0, 1]")

    counts = {"tp": 0, "fp": 0, "tn": 0, "fn": 0}
    for item in predictions:
        predicted_harmful = item.score >= threshold
        if item.label == "harmful" and predicted_harmful:
            counts["tp"] += 1
        elif item.label == "harmful":
            counts["fn"] += 1
        elif predicted_harmful:
            counts["fp"] += 1
        else:
            counts["tn"] += 1

    return Confusion(
        true_positive=counts["tp"],
        false_positive=counts["fp"],
        true_negative=counts["tn"],
        false_negative=counts["fn"],
    )


def harmful_slice_miss_rates(
    predictions: Iterable[Prediction], threshold: float
) -> dict[str, float]:
    totals: dict[str, int] = defaultdict(int)
    misses: dict[str, int] = defaultdict(int)

    for item in predictions:
        if item.label != "harmful":
            continue
        totals[item.slice_id] += 1
        if item.score < threshold:
            misses[item.slice_id] += 1

    return {
        slice_id: misses[slice_id] / total
        for slice_id, total in sorted(totals.items())
    }


def functionality_accuracy(
    predictions: Iterable[Prediction], threshold: float
) -> dict[str, float]:
    totals: dict[str, int] = defaultdict(int)
    correct: dict[str, int] = defaultdict(int)

    for item in predictions:
        totals[item.functionality] += 1
        predicted_label: Label = (
            "harmful" if item.score >= threshold else "legitimate"
        )
        if predicted_label == item.label:
            correct[item.functionality] += 1

    return {
        function: correct[function] / total
        for function, total in sorted(totals.items())
    }


def evaluate_release(
    predictions: list[Prediction], policy: GatePolicy
) -> dict[str, object]:
    if not predictions:
        raise ValueError("at least one prediction is required")

    confusion = confusion_at_threshold(predictions, policy.threshold)
    slice_misses = harmful_slice_miss_rates(predictions, policy.threshold)
    function_accuracy = functionality_accuracy(predictions, policy.threshold)
    worst_slice = max(slice_misses.items(), key=lambda item: item[1])
    worst_function = min(function_accuracy.items(), key=lambda item: item[1])

    blockers = []
    if confusion.harmful_recall < policy.minimum_harmful_recall:
        blockers.append("harmful recall is below the declared minimum")
    if (
        confusion.legitimate_false_positive_rate
        > policy.maximum_legitimate_false_positive_rate
    ):
        blockers.append("legitimate false-positive rate exceeds the ceiling")
    if worst_slice[1] > policy.maximum_worst_slice_miss_rate:
        blockers.append(f"harmful slice '{worst_slice[0]}' exceeds the miss ceiling")
    if worst_function[1] < policy.minimum_functionality_accuracy:
        blockers.append(
            f"functionality '{worst_function[0]}' is below the accuracy floor"
        )

    return {
        "decision": "hold" if blockers else "eligible_for_canary",
        "blockers": blockers,
        "confusion": confusion,
        "harmful_recall": confusion.harmful_recall,
        "legitimate_false_positive_rate": (
            confusion.legitimate_false_positive_rate
        ),
        "harmful_slice_miss_rates": slice_misses,
        "functionality_accuracy": function_accuracy,
    }


def percent(value: float) -> str:
    return f"{value:.1%}"


if __name__ == "__main__":
    example_predictions = [
        Prediction("explicit-1", 0.94, "harmful", "explicit", "derogation"),
        Prediction("implicit-1", 0.73, "harmful", "implicit", "implication"),
        Prediction("spelling-1", 0.61, "harmful", "perturbed", "spelling"),
        Prediction("negated-1", 0.18, "legitimate", "negation", "negation"),
        Prediction("counter-1", 0.24, "legitimate", "counter-speech", "counter-speech"),
        Prediction("identity-1", 0.16, "legitimate", "identity-mention", "positive identity"),
    ]
    example_policy = GatePolicy(
        threshold=0.58,
        minimum_harmful_recall=0.90,
        maximum_legitimate_false_positive_rate=0.08,
        maximum_worst_slice_miss_rate=0.20,
        minimum_functionality_accuracy=0.80,
    )
    result = evaluate_release(example_predictions, example_policy)
    print(f"Decision: {result['decision']}")
    print(f"Harmful recall: {percent(result['harmful_recall'])}")
    print(
        "Legitimate false-positive rate: "
        f"{percent(result['legitimate_false_positive_rate'])}"
    )
    print(f"Blockers: {result['blockers'] or ['none']}")
