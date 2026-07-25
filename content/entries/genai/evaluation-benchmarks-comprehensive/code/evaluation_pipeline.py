"""Minimal evaluation record that makes a result reproducible and gateable."""

from dataclasses import asdict, dataclass
from math import sqrt


@dataclass(frozen=True)
class EvaluationRun:
    candidate_version: str
    dataset_version: str
    prompt_version: str
    judge_version: str
    slice_name: str
    passed: int
    total: int

    @property
    def score(self) -> float:
        return self.passed / self.total

    def normal_95_margin(self) -> float:
        """Approximation for planning; validate the interval method for the metric."""
        return 1.96 * sqrt(self.score * (1 - self.score) / self.total)


def release_gate(run: EvaluationRun, baseline_score: float, max_regression: float, slice_floor: float) -> dict:
    conservative_score = run.score - run.normal_95_margin()
    conservative_regression = baseline_score - conservative_score
    failures = []
    if conservative_regression > max_regression:
        failures.append("conservative regression exceeds the declared threshold")
    if conservative_score < slice_floor:
        failures.append("critical slice lower bound misses its floor")

    return {
        "approved_for_canary": not failures,
        "score": run.score,
        "margin": run.normal_95_margin(),
        "failures": failures,
        "reproducibility_record": asdict(run),
    }


if __name__ == "__main__":
    run = EvaluationRun("candidate-42", "holdout-2026-07", "prompt-8", "rubric-3", "Arabic support", 510, 600)
    print(release_gate(run, baseline_score=0.86, max_regression=0.03, slice_floor=0.80))
