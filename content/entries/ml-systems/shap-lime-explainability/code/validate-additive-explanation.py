from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class AdditiveExplanation:
    model_version: str
    output_name: str
    reference_id: str
    base_value: float
    prediction: float
    contributions: Mapping[str, float]

    def reconstructed_prediction(self) -> float:
        return self.base_value + sum(self.contributions.values())

    def reconciliation_gap(self) -> float:
        return abs(self.prediction - self.reconstructed_prediction())


def validate(explanation: AdditiveExplanation, tolerance: float = 1e-9) -> None:
    if not explanation.model_version or not explanation.reference_id:
        raise ValueError("Model and reference versions are required")
    if not explanation.contributions:
        raise ValueError("At least one feature contribution is required")
    if explanation.reconciliation_gap() > tolerance:
        raise ValueError(
            f"Explanation does not reconcile: gap={explanation.reconciliation_gap():.6f}"
        )


population_reference = AdditiveExplanation(
    model_version="credit-score-2026-07",
    output_name="approval_points",
    reference_id="full-training-population-v4",
    base_value=49.0,
    prediction=72.0,
    contributions={
        "payment_history": 13.0,
        "verified_income": 11.0,
        "debt_ratio": -7.0,
        "account_age": 4.0,
        "recent_inquiries": 2.0,
    },
)

matched_peer_reference = AdditiveExplanation(
    model_version="credit-score-2026-07",
    output_name="approval_points",
    reference_id="matched-product-peers-v2",
    base_value=61.0,
    prediction=72.0,
    contributions={
        "payment_history": 7.0,
        "verified_income": 6.0,
        "debt_ratio": -5.0,
        "account_age": 1.0,
        "recent_inquiries": 2.0,
    },
)

for payload in (population_reference, matched_peer_reference):
    validate(payload)
    print(
        payload.reference_id,
        f"base={payload.base_value:.1f}",
        f"prediction={payload.reconstructed_prediction():.1f}",
        f"gap={payload.reconciliation_gap():.1f}",
    )

assert population_reference.prediction == matched_peer_reference.prediction
assert population_reference.base_value != matched_peer_reference.base_value
assert population_reference.contributions != matched_peer_reference.contributions
