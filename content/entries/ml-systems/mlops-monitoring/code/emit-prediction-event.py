from dataclasses import asdict, dataclass
import json


@dataclass(frozen=True)
class PredictionEvent:
    prediction_id: str
    occurred_at: str
    model_version: str
    feature_view_version: str
    policy_version: str
    cohort: str
    score: float
    decision: str
    outcome_join_key: str


def validate(event: PredictionEvent) -> None:
    version_fields = (
        event.model_version,
        event.feature_view_version,
        event.policy_version,
    )
    if not event.prediction_id or not all(version_fields):
        raise ValueError("prediction and version identifiers are required")
    if not 0.0 <= event.score <= 1.0:
        raise ValueError("score must be between 0 and 1")


event = PredictionEvent(
    prediction_id="pred-0187",
    occurred_at="2026-07-21T09:30:00Z",
    model_version="fraud-model-42",
    feature_view_version="transaction-features-9",
    policy_version="review-threshold-6",
    cohort="new-account",
    score=0.91,
    decision="manual-review",
    outcome_join_key="case-8842",
)

validate(event)
print(json.dumps(asdict(event), indent=2, sort_keys=True))
