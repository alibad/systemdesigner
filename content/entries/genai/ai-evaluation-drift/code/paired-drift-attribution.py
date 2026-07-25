from dataclasses import dataclass


@dataclass(frozen=True)
class PairedEvaluation:
    observed_delta: float
    baseline_outputs_frozen_judge: float
    candidate_outputs_frozen_judge: float
    stable_anchors_frozen_judge: float
    stable_anchors_current_judge: float
    raw_current_population: float
    matched_current_population: float


def attribute_drift(run: PairedEvaluation) -> dict[str, float]:
    """Separate application, judge, and traffic-mix contributions in score points."""
    application_effect = (
        run.candidate_outputs_frozen_judge - run.baseline_outputs_frozen_judge
    )
    judge_effect = run.stable_anchors_current_judge - run.stable_anchors_frozen_judge
    population_effect = run.raw_current_population - run.matched_current_population
    explained = application_effect + judge_effect + population_effect

    return {
        "observed_delta": round(run.observed_delta, 2),
        "application_effect": round(application_effect, 2),
        "judge_effect": round(judge_effect, 2),
        "population_effect": round(population_effect, 2),
        "unexplained_residual": round(run.observed_delta - explained, 2),
    }


incident = PairedEvaluation(
    observed_delta=-8.0,
    baseline_outputs_frozen_judge=88.0,
    candidate_outputs_frozen_judge=87.5,
    stable_anchors_frozen_judge=90.0,
    stable_anchors_current_judge=84.0,
    raw_current_population=79.5,
    matched_current_population=81.0,
)

print(attribute_drift(incident))
