"""Fit one preprocessing graph and estimator without inspecting held-out rows."""

from __future__ import annotations

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


numeric_features = ["account_age_days", "monthly_spend"]
categorical_features = ["plan", "region"]

numeric_steps = Pipeline(
    steps=[
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ]
)

categorical_steps = Pipeline(
    steps=[
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("encode", OneHotEncoder(handle_unknown="ignore")),
    ]
)

preprocess = ColumnTransformer(
    transformers=[
        ("numeric", numeric_steps, numeric_features),
        ("categorical", categorical_steps, categorical_features),
    ]
)

model = Pipeline(
    steps=[
        ("preprocess", preprocess),
        ("classifier", LogisticRegression(max_iter=1_000)),
    ]
)

# X_train and y_train are produced by the deployment-aligned split first.
X_train = pd.DataFrame(
    [
        {"account_age_days": 40, "monthly_spend": 20.0, "plan": "basic", "region": "north"},
        {"account_age_days": 400, "monthly_spend": 85.0, "plan": "pro", "region": "west"},
        {"account_age_days": 120, "monthly_spend": None, "plan": "basic", "region": "west"},
        {"account_age_days": 700, "monthly_spend": 110.0, "plan": "pro", "region": "north"},
    ]
)
y_train = [1, 0, 1, 0]

X_test = pd.DataFrame(
    [
        {"account_age_days": 75, "monthly_spend": None, "plan": "enterprise", "region": "south"}
    ]
)

model.fit(X_train, y_train)
prediction = model.predict_proba(X_test)[:, 1]
print({"positive_class_probability": round(float(prediction[0]), 4)})
