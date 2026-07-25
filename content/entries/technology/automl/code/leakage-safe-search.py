"""Keep grouped validation and learned preprocessing inside the search."""

from scipy.stats import loguniform
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def build_search(
    numeric_columns: list[str],
    categorical_columns: list[str],
) -> RandomizedSearchCV:
    numeric = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        [
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    pipeline = Pipeline(
        [
            (
                "prepare",
                ColumnTransformer(
                    [
                        ("numeric", numeric, numeric_columns),
                        ("categorical", categorical, categorical_columns),
                    ]
                ),
            ),
            ("model", LogisticRegression(max_iter=2_000)),
        ]
    )

    return RandomizedSearchCV(
        estimator=pipeline,
        param_distributions={"model__C": loguniform(1e-3, 1e2)},
        n_iter=24,
        scoring="neg_log_loss",
        cv=GroupKFold(n_splits=5),
        refit=True,
        random_state=17,
        n_jobs=-1,
    )


# `customer_id` is supplied only to the splitter. It is not a model feature.
# The final test set is evaluated once after the search definition is frozen.
# search = build_search(NUMERIC_COLUMNS, CATEGORICAL_COLUMNS)
# search.fit(X_development, y_development, groups=customer_id)
# final_probability = search.predict_proba(X_final_test)[:, 1]
