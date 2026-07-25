"""Train and log a small classifier with an explicit MLflow lineage contract.

Run ``python track-training-lineage.py --dry-run`` to verify the local dataset
contract without installing MLflow or scikit-learn.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path


DEFAULT_DATA = Path(__file__).parents[1] / "data" / "renewal-training-sample.csv"
REQUIRED_COLUMNS = ("account_age_days", "weekly_sessions", "support_tickets", "renewed")


def dataset_manifest(path: Path) -> dict[str, object]:
    raw = path.read_bytes()
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        columns = tuple(reader.fieldnames or ())

    missing = sorted(set(REQUIRED_COLUMNS) - set(columns))
    if missing:
        raise ValueError(f"dataset is missing required columns: {', '.join(missing)}")
    if not rows:
        raise ValueError("dataset must contain at least one row")

    return {
        "source": str(path.resolve()),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "rows": len(rows),
        "columns": list(columns),
        "target": "renewed",
        "contract_version": "renewal-features-v1",
    }


def train_and_log(path: Path, tracking_uri: str | None) -> dict[str, str]:
    import mlflow
    import mlflow.sklearn
    import pandas as pd
    from mlflow.models import infer_signature
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, f1_score
    from sklearn.model_selection import train_test_split

    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment("customer-renewal")

    frame = pd.read_csv(path)
    features = frame.drop(columns=["renewed"])
    target = frame["renewed"]
    train_x, test_x, train_y, test_y = train_test_split(
        features,
        target,
        test_size=0.30,
        random_state=17,
        stratify=target,
    )
    model = LogisticRegression(max_iter=500, random_state=17)
    manifest = dataset_manifest(path)

    with mlflow.start_run(run_name="renewal-logistic-regression") as run:
        training_input = mlflow.data.from_pandas(
            pd.concat([train_x, train_y], axis=1),
            source=str(path.resolve()),
            name="renewal-training-v1",
            targets="renewed",
        )
        mlflow.log_input(training_input, context="training")
        mlflow.set_tags(
            {
                "code.commit": os.getenv("GIT_COMMIT", "unknown"),
                "data.contract": str(manifest["contract_version"]),
                "pipeline.owner": "retention-ml",
            }
        )
        mlflow.log_params({"max_iter": 500, "random_state": 17})

        model.fit(train_x, train_y)
        predictions = model.predict(test_x)
        mlflow.log_metrics(
            {
                "test_accuracy": accuracy_score(test_y, predictions),
                "test_f1": f1_score(test_y, predictions),
            }
        )

        signature = infer_signature(test_x, predictions)
        model_info = mlflow.sklearn.log_model(
            sk_model=model,
            name="renewal_classifier",
            signature=signature,
            input_example=train_x.head(3),
        )

    return {"run_id": run.info.run_id, "model_uri": model_info.model_uri}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--tracking-uri", default=os.getenv("MLFLOW_TRACKING_URI"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    manifest = dataset_manifest(args.data)
    if args.dry_run:
        print(json.dumps(manifest, indent=2, sort_keys=True))
        return

    print(json.dumps(train_and_log(args.data, args.tracking_uri), indent=2))


if __name__ == "__main__":
    main()
