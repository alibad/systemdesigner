"""Expose each scientific loss channel instead of trusting one weighted total."""

from dataclasses import dataclass


@dataclass(frozen=True)
class EvidenceLedger:
    data_error_percent: float
    equation_residual_percent: float
    boundary_error_percent: float
    extrapolation_risk_percent: float
    estimated_training_minutes: int

    @property
    def passes(self) -> bool:
        return (
            self.data_error_percent <= 8
            and self.equation_residual_percent <= 10
            and self.boundary_error_percent <= 8
            and self.extrapolation_risk_percent <= 25
        )


STRATEGIES = {
    "data-only": {
        "fit": 1.00,
        "residual_control": 0.10,
        "boundary_control": 0.12,
        "transfer": 0.18,
        "cost": 1.00,
    },
    "soft-constraints": {
        "fit": 0.90,
        "residual_control": 0.72,
        "boundary_control": 0.76,
        "transfer": 0.58,
        "cost": 1.45,
    },
    "hard-invariant": {
        "fit": 0.82,
        "residual_control": 0.96,
        "boundary_control": 0.98,
        "transfer": 0.76,
        "cost": 1.70,
    },
}


def evaluate_surrogate(
    *,
    strategy: str,
    observation_coverage_percent: float,
    constraint_emphasis_percent: float,
) -> EvidenceLedger:
    """Return an illustrative ledger; thresholds must be replaced per domain."""
    if strategy not in STRATEGIES:
        raise ValueError(f"unknown strategy: {strategy}")
    if not 20 <= observation_coverage_percent <= 100:
        raise ValueError("observation coverage must be between 20 and 100")
    if not 0 <= constraint_emphasis_percent <= 100:
        raise ValueError("constraint emphasis must be between 0 and 100")

    design = STRATEGIES[strategy]
    coverage = observation_coverage_percent / 100
    emphasis = constraint_emphasis_percent / 100

    data_error = 18 * (1.20 - 0.72 * coverage) / design["fit"]
    residual = 30 * (1 - design["residual_control"] * emphasis)
    boundary = 26 * (1 - design["boundary_control"] * emphasis)
    extrapolation = 42 * (1 - design["transfer"] * coverage * (0.55 + 0.45 * emphasis))
    training_minutes = round(120 * design["cost"] * (0.55 + 0.45 * coverage) * (1 + emphasis / 3))

    return EvidenceLedger(
        data_error_percent=round(data_error, 1),
        equation_residual_percent=round(max(0, residual), 1),
        boundary_error_percent=round(max(0, boundary), 1),
        extrapolation_risk_percent=round(max(0, extrapolation), 1),
        estimated_training_minutes=training_minutes,
    )


if __name__ == "__main__":
    ledger = evaluate_surrogate(
        strategy="soft-constraints",
        observation_coverage_percent=78,
        constraint_emphasis_percent=72,
    )
    print(ledger)
    print("release candidate" if ledger.passes else "keep collecting evidence")
