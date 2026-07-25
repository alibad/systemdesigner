"""Direction-aware candidate-versus-baseline release gates.

The example uses normal intervals for the difference between two independent
bounded rates. Production implementations should predeclare an interval method
appropriate for their metric and sampling design.
"""

from dataclasses import dataclass
from math import sqrt
from typing import Literal


Direction = Literal["higher", "lower"]
Severity = Literal["pass", "warning", "block"]


@dataclass(frozen=True)
class RateEvidence:
    successes: int
    total: int

    @property
    def rate(self) -> float:
        if self.total <= 0:
            raise ValueError("total must be positive")
        if not 0 <= self.successes <= self.total:
            raise ValueError("successes must be between zero and total")
        return self.successes / self.total


@dataclass(frozen=True)
class MetricPolicy:
    name: str
    direction: Direction
    allowed_regression: float
    critical: bool = False


@dataclass(frozen=True)
class GateResult:
    metric: str
    severity: Severity
    point_delta: float
    conservative_delta: float
    explanation: str


def conservative_difference(
    candidate: RateEvidence,
    baseline: RateEvidence,
    direction: Direction,
    z_score: float = 1.96,
) -> tuple[float, float]:
    """Return point and conservative improvement in the preferred direction."""
    candidate_rate = candidate.rate
    baseline_rate = baseline.rate
    standard_error = sqrt(
        candidate_rate * (1 - candidate_rate) / candidate.total
        + baseline_rate * (1 - baseline_rate) / baseline.total
    )
    signed_delta = (
        candidate_rate - baseline_rate
        if direction == "higher"
        else baseline_rate - candidate_rate
    )
    return signed_delta, signed_delta - z_score * standard_error


def evaluate_rate_gate(
    policy: MetricPolicy,
    candidate: RateEvidence,
    baseline: RateEvidence,
) -> GateResult:
    point_delta, conservative_delta = conservative_difference(
        candidate,
        baseline,
        policy.direction,
    )
    passes = conservative_delta >= -policy.allowed_regression

    if passes:
        severity: Severity = "pass"
        explanation = "The conservative difference stays inside the declared tolerance."
    elif policy.critical:
        severity = "block"
        explanation = "A critical metric exceeds its uncertainty-aware regression limit."
    else:
        severity = "warning"
        explanation = "Review this regression before increasing production exposure."

    return GateResult(
        metric=policy.name,
        severity=severity,
        point_delta=point_delta,
        conservative_delta=conservative_delta,
        explanation=explanation,
    )


def decide_release(results: list[GateResult]) -> Literal["hold", "shadow", "canary"]:
    """Offline evidence never grants an unmonitored global release."""
    if any(result.severity == "block" for result in results):
        return "hold"
    if any(result.severity == "warning" for result in results):
        return "shadow"
    return "canary"


if __name__ == "__main__":
    policies = [
        MetricPolicy("answer_quality", "higher", allowed_regression=0.01),
        MetricPolicy("critical_slice_quality", "higher", 0.0, critical=True),
        MetricPolicy("safe_response_rate", "higher", 0.0, critical=True),
    ]
    baseline = [RateEvidence(780, 1_000), RateEvidence(152, 200), RateEvidence(995, 1_000)]
    candidate = [RateEvidence(815, 1_000), RateEvidence(137, 200), RateEvidence(996, 1_000)]

    results = [
        evaluate_rate_gate(policy, candidate_rate, baseline_rate)
        for policy, candidate_rate, baseline_rate in zip(
            policies, candidate, baseline, strict=True
        )
    ]

    for result in results:
        print(
            result.metric,
            result.severity,
            f"point={result.point_delta:+.3f}",
            f"conservative={result.conservative_delta:+.3f}",
        )
    print("maximum rollout:", decide_release(results))
