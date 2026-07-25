"""Evaluate an MLflow classifier and enforce absolute release thresholds.

The dry run validates the evaluation dataset without importing MLflow. A real
evaluation requires ``--model-uri`` plus MLflow, pandas, and scikit-learn.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


DEFAULT_DATA = Path(__file__).parents[1] / "data" / "renewal-evaluation-sample.csv"
FEATURE_COLUMNS = ("account_age_days", "weekly_sessions", "support_tickets")


def inspect_evaluation_data(path: Path) -> dict[str, object]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        columns = set(reader.fieldnames or ())

    required = set(FEATURE_COLUMNS) | {"renewed", "account_segment"}
    missing = sorted(required - columns)
    if missing:
        raise ValueError(f"evaluation data is missing: {', '.join(missing)}")
    segments = sorted({row["account_segment"] for row in rows})
    if len(segments) < 2:
        raise ValueError("evaluation data must cover at least two account segments")

    return {"rows": len(rows), "segments": segments, "target": "renewed"}


def evaluate(model_uri: str, path: Path) -> dict[str, float]:
    import mlflow
    import pandas as pd
    from mlflow.models import MetricThreshold

    frame = pd.read_csv(path)
    evaluation_frame = frame[[*FEATURE_COLUMNS, "renewed"]]

    with mlflow.start_run(run_name="renewal-release-evaluation"):
        result = mlflow.models.evaluate(
            model_uri,
            evaluation_frame,
            targets="renewed",
            model_type="classifier",
        )
        mlflow.validate_evaluation_results(
            candidate_result=result,
            validation_thresholds={
                "accuracy_score": MetricThreshold(
                    threshold=0.80,
                    greater_is_better=True,
                ),
                "f1_score": MetricThreshold(
                    threshold=0.75,
                    greater_is_better=True,
                ),
            },
        )

    return {
        key: float(value)
        for key, value in result.metrics.items()
        if key in {"accuracy_score", "f1_score"}
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--model-uri")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    data_summary = inspect_evaluation_data(args.data)
    if args.dry_run:
        print(json.dumps(data_summary, indent=2, sort_keys=True))
        return
    if not args.model_uri:
        parser.error("--model-uri is required unless --dry-run is used")

    print(json.dumps(evaluate(args.model_uri, args.data), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
