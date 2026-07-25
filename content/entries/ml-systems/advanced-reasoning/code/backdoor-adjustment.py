from dataclasses import dataclass


@dataclass(frozen=True)
class Study:
    true_effect: float
    confounding_bias: float
    confounder_capture: float


def estimate_total_effect(study: Study, adjustment: str) -> float:
    """Illustrate how the adjustment set changes the estimand and bias."""
    if adjustment == "account_maturity":
        residual = study.confounding_bias * (1 - study.confounder_capture)
        return study.true_effect + residual
    if adjustment == "product_engagement":
        return study.true_effect - 6.0  # blocks part of the mechanism
    if adjustment == "support_contact":
        return study.true_effect + 7.0  # opens a collider path
    return study.true_effect + study.confounding_bias


study = Study(true_effect=8.0, confounding_bias=9.0, confounder_capture=1.0)
assert estimate_total_effect(study, "account_maturity") == 8.0
