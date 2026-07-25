from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class PredictionContract:
    model_version: str
    feature_version: str
    max_feature_age_seconds: int
    deadline_ms: int
    fallback: str


@dataclass(frozen=True)
class FeatureVector:
    entity_id: str
    version: str
    computed_at: datetime
    values: dict[str, float]


def validate_features(
    features: FeatureVector,
    contract: PredictionContract,
    now: datetime,
) -> None:
    if features.version != contract.feature_version:
        raise ValueError(
            f"feature version {features.version!r} is incompatible with "
            f"model {contract.model_version!r}"
        )

    age_seconds = (now - features.computed_at).total_seconds()
    if age_seconds < 0:
        raise ValueError("feature timestamp is in the future")
    if age_seconds > contract.max_feature_age_seconds:
        raise TimeoutError(
            f"features are {age_seconds:.0f}s old; "
            f"contract allows {contract.max_feature_age_seconds}s"
        )


def predict_with_contract(
    model,
    features: FeatureVector,
    contract: PredictionContract,
) -> dict[str, object]:
    now = datetime.now(timezone.utc)

    try:
        validate_features(features, contract, now)
        score = model.predict(features.values, deadline_ms=contract.deadline_ms)
        outcome = {"score": score, "used_fallback": False}
    except (TimeoutError, ValueError):
        outcome = {"score": contract.fallback, "used_fallback": True}

    return {
        **outcome,
        "entity_id": features.entity_id,
        "model_version": contract.model_version,
        "feature_version": features.version,
        "feature_time": features.computed_at.isoformat(),
    }
