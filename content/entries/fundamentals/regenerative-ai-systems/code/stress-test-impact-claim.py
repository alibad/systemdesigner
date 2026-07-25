"""Keep system reductions and external environmental outcomes in separate ledgers."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ClaimInputs:
    baseline_footprint_kgco2e: float
    direct_reduction_percent: float
    demand_growth_percent: float
    reported_additional_outcome: float
    evidence_confidence: float
    counterfactual_defined: bool
    durability_and_leakage_monitored: bool


def stress_test(inputs: ClaimInputs) -> dict[str, float | str]:
    post_footprint = (
        inputs.baseline_footprint_kgco2e
        * (1 - inputs.direct_reduction_percent / 100)
        * (1 + inputs.demand_growth_percent / 100)
    )
    footprint_change = inputs.baseline_footprint_kgco2e - post_footprint
    supported_outcome = inputs.reported_additional_outcome * inputs.evidence_confidence

    evidence_ready = (
        inputs.counterfactual_defined
        and inputs.durability_and_leakage_monitored
        and inputs.evidence_confidence >= 0.8
    )
    if footprint_change <= 0:
        verdict = "efficiency was erased by demand growth"
    elif supported_outcome <= 0:
        verdict = "bounded own-footprint reduction"
    elif evidence_ready:
        verdict = "candidate for a bounded contribution claim"
    else:
        verdict = "external outcome needs stronger evidence"

    return {
        "post_footprint_kgco2e": post_footprint,
        "footprint_reduction_kgco2e": footprint_change,
        "evidence_supported_outcome": supported_outcome,
        "verdict": verdict,
    }


if __name__ == "__main__":
    result = stress_test(
        ClaimInputs(
            baseline_footprint_kgco2e=1_000,
            direct_reduction_percent=40,
            demand_growth_percent=25,
            reported_additional_outcome=80,
            evidence_confidence=0.9,
            counterfactual_defined=True,
            durability_and_leakage_monitored=True,
        )
    )

    assert result["post_footprint_kgco2e"] == 750
    assert result["footprint_reduction_kgco2e"] == 250
    assert result["evidence_supported_outcome"] == 72
    assert result["verdict"] == "candidate for a bounded contribution claim"
    print(result)
