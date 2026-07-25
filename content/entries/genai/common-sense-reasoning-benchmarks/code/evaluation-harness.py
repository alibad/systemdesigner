from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Prediction:
    case_id: str
    benchmark: str
    capability_slice: str
    gold_label: str
    predicted_label: str | None
    raw_response: str

    @property
    def correct(self) -> bool:
        return self.predicted_label == self.gold_label


def extract_label(raw_response: str, valid_labels: set[str]) -> str | None:
    """Accept one explicit answer label; reject ambiguous or malformed output."""
    normalized = raw_response.strip().upper()
    if normalized in valid_labels:
        return normalized

    prefix = "ANSWER:"
    if normalized.startswith(prefix):
        candidate = normalized.removeprefix(prefix).strip()
        if candidate in valid_labels:
            return candidate
    return None


def score_group(predictions: Iterable[Prediction]) -> dict[str, float | int]:
    rows = list(predictions)
    correct = sum(row.correct for row in rows)
    malformed = sum(row.predicted_label is None for row in rows)
    total = len(rows)
    return {
        "accuracy": correct / total if total else 0.0,
        "correct": correct,
        "malformed": malformed,
        "total": total,
    }


def evaluate(records: Iterable[dict[str, object]]) -> dict[str, object]:
    predictions: list[Prediction] = []
    for record in records:
        labels = {str(label).upper() for label in record["valid_labels"]}
        raw_response = str(record["raw_response"])
        predictions.append(
            Prediction(
                case_id=str(record["case_id"]),
                benchmark=str(record["benchmark"]),
                capability_slice=str(record["capability_slice"]),
                gold_label=str(record["gold_label"]).upper(),
                predicted_label=extract_label(raw_response, labels),
                raw_response=raw_response,
            )
        )

    by_benchmark: dict[str, list[Prediction]] = defaultdict(list)
    by_slice: dict[str, list[Prediction]] = defaultdict(list)
    for prediction in predictions:
        by_benchmark[prediction.benchmark].append(prediction)
        by_slice[prediction.capability_slice].append(prediction)

    benchmark_scores = {
        name: score_group(rows) for name, rows in sorted(by_benchmark.items())
    }
    slice_scores = {name: score_group(rows) for name, rows in sorted(by_slice.items())}
    macro_accuracy = (
        sum(float(score["accuracy"]) for score in benchmark_scores.values())
        / len(benchmark_scores)
        if benchmark_scores
        else 0.0
    )

    return {
        "overall": score_group(predictions),
        "macro_benchmark_accuracy": macro_accuracy,
        "by_benchmark": benchmark_scores,
        "by_capability_slice": slice_scores,
    }


def load_jsonl(path: Path) -> list[dict[str, object]]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


if __name__ == "__main__":
    input_path = Path("predictions.jsonl")
    report = evaluate(load_jsonl(input_path))
    print(json.dumps(report, indent=2, sort_keys=True))
