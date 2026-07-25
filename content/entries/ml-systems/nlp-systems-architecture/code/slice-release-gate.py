"""Evaluate an NLP release by slice instead of accepting one global average."""

from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
    slice_name: str
    correct: bool
    abstained: bool = False


def evaluate_release(
    decisions: list[Decision],
    minimum_accuracy: float,
    maximum_abstention: float,
) -> tuple[bool, dict[str, dict[str, float]]]:
    grouped: dict[str, list[Decision]] = defaultdict(list)
    for decision in decisions:
        grouped[decision.slice_name].append(decision)

    metrics: dict[str, dict[str, float]] = {}
    release_allowed = True

    for slice_name, rows in sorted(grouped.items()):
        answered = [row for row in rows if not row.abstained]
        accuracy = sum(row.correct for row in answered) / len(answered) if answered else 0.0
        abstention = sum(row.abstained for row in rows) / len(rows)
        passed = accuracy >= minimum_accuracy and abstention <= maximum_abstention
        metrics[slice_name] = {
            "accuracy": accuracy,
            "abstention": abstention,
            "passed": float(passed),
        }
        release_allowed = release_allowed and passed

    return release_allowed, metrics


def main() -> None:
    candidate = [
        Decision("english-short", True),
        Decision("english-short", True),
        Decision("english-short", True),
        Decision("arabic-short", True),
        Decision("arabic-short", False),
        Decision("arabic-short", False),
        Decision("long-document", True),
        Decision("long-document", False, abstained=True),
        Decision("long-document", False, abstained=True),
    ]

    allowed, metrics = evaluate_release(candidate, minimum_accuracy=0.75, maximum_abstention=0.25)
    assert not allowed
    assert metrics["arabic-short"]["accuracy"] < 0.75
    assert metrics["long-document"]["abstention"] > 0.25

    for slice_name, values in metrics.items():
        state = "PASS" if values["passed"] else "BLOCK"
        print(
            f"{slice_name:16} {state:5} "
            f"accuracy={values['accuracy']:.0%} abstention={values['abstention']:.0%}"
        )


if __name__ == "__main__":
    main()
