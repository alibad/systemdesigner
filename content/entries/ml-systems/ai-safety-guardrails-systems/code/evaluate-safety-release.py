"""Compute release gates from the lesson's synthetic evaluation fixtures."""

from __future__ import annotations

import json
from pathlib import Path


DATA_FILE = Path(__file__).parents[1] / "data" / "safety-release-gates.json"


def evaluate(
    scenario: dict[str, object],
    point: dict[str, object],
    review_capacity: int,
) -> dict[str, int | str]:
    total = int(scenario["totalCases"])
    unsafe = int(scenario["unsafeCases"])
    safe = total - unsafe
    recall = float(point["recallPercent"])
    false_positive_rate = float(point["falsePositiveRatePercent"])

    true_positive = round(unsafe * recall / 100)
    false_negative = unsafe - true_positive
    false_positive = round(safe * false_positive_rate / 100)
    true_negative = safe - false_positive
    review_load = true_positive + false_positive

    failures: list[str] = []
    if recall < float(scenario["minimumRecallPercent"]):
        failures.append("miss-rate gate")
    if false_positive_rate > float(scenario["maximumFalsePositiveRatePercent"]):
        failures.append("safe-interruption gate")
    if review_load > review_capacity:
        failures.append("review-capacity gate")

    return {
        "verdict": "hold" if failures else "bounded canary",
        "reason": ", ".join(failures) if failures else "all declared gates pass",
        "truePositive": true_positive,
        "falseNegative": false_negative,
        "falsePositive": false_positive,
        "trueNegative": true_negative,
        "reviewLoad": review_load,
    }


def main() -> None:
    data = json.loads(DATA_FILE.read_text())
    for scenario in data["scenarios"]:
        print(f"\n{scenario['label']}")
        for point in scenario["operatingPoints"]:
            result = evaluate(scenario, point, int(scenario["defaultReviewCapacity"]))
            print(f"  {point['label']}: {result['verdict']} ({result['reason']})")


if __name__ == "__main__":
    main()
