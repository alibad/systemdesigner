from dataclasses import dataclass


@dataclass(frozen=True)
class ProductContract:
    needs_generation: bool
    needs_missing_evidence: bool
    prediction_only: bool
    labeled_percent: int
    latency_budget_ms: int


def clamp(value: float) -> int:
    return round(max(0, min(100, value)))


def objective_fit(contract: ProductContract) -> dict[str, int]:
    """Return transparent fit heuristics, not accuracy predictions."""
    label_signal = contract.labeled_percent * 0.32
    latency_pressure = max(0, (120 - contract.latency_budget_ms) * 0.22)

    discriminative = clamp(
        42
        + label_signal
        + (24 if contract.prediction_only else -8)
        - (70 if contract.needs_generation else 0)
        - (9 if contract.needs_missing_evidence else 0)
        + latency_pressure
    )
    generative = clamp(
        40
        + (100 - contract.labeled_percent) * 0.2
        + (48 if contract.needs_generation else 0)
        + (20 if contract.needs_missing_evidence else 0)
        - (8 if contract.prediction_only else 0)
        - latency_pressure * 0.8
    )
    return {"discriminative": discriminative, "generative": generative}


contracts = {
    "fraud_triage": ProductContract(False, False, True, 80, 75),
    "defect_synthesis": ProductContract(True, False, False, 35, 300),
}

for name, contract in contracts.items():
    scores = objective_fit(contract)
    recommendation = max(scores, key=scores.get)
    print(f"{name}: {scores} -> start {recommendation}")

assert max(objective_fit(contracts["fraud_triage"]), key=objective_fit(contracts["fraud_triage"]).get) == "discriminative"
assert max(objective_fit(contracts["defect_synthesis"]), key=objective_fit(contracts["defect_synthesis"]).get) == "generative"
