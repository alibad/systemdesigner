"""Fit an AutoGluon tabular search inside an explicit wall-clock budget."""

from pathlib import Path

import pandas as pd
from autogluon.tabular import TabularPredictor

LABEL = "will_renew"
SEARCH_SECONDS = 3_600
MODEL_PATH = Path("artifacts/renewal-candidate")

# The input is already divided by an upstream, versioned split policy.
# final_test.parquet stays outside fit() and all search decisions.
train = pd.read_parquet("data/train.parquet")
final_test = pd.read_parquet("data/final_test.parquet")

predictor = TabularPredictor(
    label=LABEL,
    eval_metric="log_loss",
    path=MODEL_PATH,
).fit(
    train_data=train,
    time_limit=SEARCH_SECONDS,
    presets="good_quality",
)

# Run this once after the search space and selection policy are frozen.
test_metrics = predictor.evaluate(final_test, silent=True)
print(
    {
        "model_path": str(MODEL_PATH),
        "search_seconds": SEARCH_SECONDS,
        "final_test_metrics": test_metrics,
    }
)
