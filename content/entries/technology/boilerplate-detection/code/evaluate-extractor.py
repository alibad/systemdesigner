"""Compute block-level extraction metrics from labeled fixtures."""

from dataclasses import dataclass


@dataclass(frozen=True)
class LabeledBlock:
    name: str
    score: int
    is_main_content: bool


def divide(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def evaluate(samples: list[LabeledBlock], threshold: int) -> dict[str, float | int]:
    true_positive = sum(item.score >= threshold and item.is_main_content for item in samples)
    false_positive = sum(item.score >= threshold and not item.is_main_content for item in samples)
    false_negative = sum(item.score < threshold and item.is_main_content for item in samples)
    true_negative = sum(item.score < threshold and not item.is_main_content for item in samples)

    precision = divide(true_positive, true_positive + false_positive)
    recall = divide(true_positive, true_positive + false_negative)
    f1 = divide(2 * precision * recall, precision + recall)

    return {
        "true_positive": true_positive,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "true_negative": true_negative,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


if __name__ == "__main__":
    fixtures = [
        LabeledBlock("article body", 94, True),
        LabeledBlock("documentation guide", 89, True),
        LabeledBlock("opening question", 84, True),
        LabeledBlock("headline and byline", 78, True),
        LabeledBlock("long comments", 81, False),
        LabeledBlock("sponsored offer", 70, False),
        LabeledBlock("related links", 42, False),
        LabeledBlock("code reference table", 62, True),
        LabeledBlock("specification table", 55, True),
        LabeledBlock("verbose signature", 64, False),
        LabeledBlock("recommendation copy", 58, False),
    ]

    for cutoff in (50, 65, 80):
        metrics = evaluate(fixtures, cutoff)
        print(
            f"threshold={cutoff} "
            f"precision={metrics['precision']:.1%} "
            f"recall={metrics['recall']:.1%} "
            f"f1={metrics['f1']:.1%}"
        )

    assert evaluate(fixtures, 80)["recall"] < evaluate(fixtures, 50)["recall"]
