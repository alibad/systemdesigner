from dataclasses import dataclass
from math import sqrt


@dataclass(frozen=True)
class SliceResult:
    name: str
    passed: int
    total: int
    baseline_rate: float
    minimum_rate: float
    max_allowed_drop: float
    minimum_cases: int
    critical: bool = False


def wilson_interval(passed: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Return a 95% Wilson interval for a binomial pass rate."""
    if total <= 0:
        return 0.0, 1.0

    rate = passed / total
    denominator = 1 + z * z / total
    center = rate + z * z / (2 * total)
    spread = z * sqrt(rate * (1 - rate) / total + z * z / (4 * total * total))
    return (center - spread) / denominator, (center + spread) / denominator


def inspect_slice(result: SliceResult) -> dict[str, object]:
    lower, upper = wilson_interval(result.passed, result.total)
    observed_rate = result.passed / result.total if result.total else 0.0
    drop = result.baseline_rate - observed_rate

    failures: list[str] = []
    if result.total < result.minimum_cases:
        failures.append("insufficient evidence")
    if lower < result.minimum_rate:
        failures.append("quality floor is not supported by the lower confidence bound")
    if drop > result.max_allowed_drop:
        failures.append("observed regression exceeds the allowed drop")

    return {
        "slice": result.name,
        "critical": result.critical,
        "cases": result.total,
        "observed_rate": round(observed_rate, 4),
        "confidence_interval": [round(lower, 4), round(upper, 4)],
        "failures": failures,
    }


def release_decision(results: list[SliceResult]) -> dict[str, object]:
    findings = [inspect_slice(result) for result in results]
    critical_failures = [
        finding for finding in findings
        if finding["critical"] and finding["failures"]
    ]
    review_failures = [finding for finding in findings if finding["failures"]]

    if critical_failures:
        action = "block"
    elif review_failures:
        action = "hold-for-review"
    else:
        action = "bounded-canary"

    return {"action": action, "findings": findings}


candidate = [
    SliceResult("english_support", 900, 1_000, 0.91, 0.86, 0.04, 300),
    SliceResult("billing_edge_cases", 79, 100, 0.88, 0.82, 0.03, 100, critical=True),
    SliceResult("arabic_support", 32, 40, 0.84, 0.78, 0.03, 120, critical=True),
]

print(release_decision(candidate))
