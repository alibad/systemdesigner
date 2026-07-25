from dataclasses import dataclass
from typing import Mapping, Sequence


Attributions = Mapping[str, float]


def sign_agreement(left: Attributions, right: Attributions) -> float:
    shared = left.keys() & right.keys()
    if not shared:
        return 0.0
    matching = sum((left[name] >= 0) == (right[name] >= 0) for name in shared)
    return matching / len(shared)


def top_k_overlap(left: Attributions, right: Attributions, k: int = 3) -> float:
    left_top = {
        name for name, _ in sorted(left.items(), key=lambda item: abs(item[1]), reverse=True)[:k]
    }
    right_top = {
        name for name, _ in sorted(right.items(), key=lambda item: abs(item[1]), reverse=True)[:k]
    }
    return len(left_top & right_top) / max(1, len(left_top | right_top))


@dataclass(frozen=True)
class ExplanationRun:
    seed: int
    local_fidelity: float
    reconciliation_gap: float
    attributions: Attributions


@dataclass(frozen=True)
class ReleasePolicy:
    minimum_fidelity: float = 0.92
    minimum_sign_agreement: float = 0.90
    minimum_top_k_overlap: float = 0.50
    maximum_reconciliation_gap: float = 0.03


def gate_release(
    runs: Sequence[ExplanationRun], policy: ReleasePolicy = ReleasePolicy()
) -> dict[str, float | bool]:
    if len(runs) < 2:
        raise ValueError("At least two independent runs are required")

    baseline = runs[0]
    sign_scores = [
        sign_agreement(baseline.attributions, run.attributions) for run in runs[1:]
    ]
    rank_scores = [
        top_k_overlap(baseline.attributions, run.attributions) for run in runs[1:]
    ]
    minimum_fidelity = min(run.local_fidelity for run in runs)
    maximum_gap = max(run.reconciliation_gap for run in runs)
    minimum_sign = min(sign_scores)
    minimum_rank = min(rank_scores)

    passed = (
        minimum_fidelity >= policy.minimum_fidelity
        and minimum_sign >= policy.minimum_sign_agreement
        and minimum_rank >= policy.minimum_top_k_overlap
        and maximum_gap <= policy.maximum_reconciliation_gap
    )
    return {
        "passed": passed,
        "minimum_fidelity": minimum_fidelity,
        "minimum_sign_agreement": minimum_sign,
        "minimum_top_k_overlap": minimum_rank,
        "maximum_reconciliation_gap": maximum_gap,
    }


runs = [
    ExplanationRun(7, 0.97, 0.01, {"history": 0.31, "income": 0.25, "debt": -0.17, "age": 0.08}),
    ExplanationRun(19, 0.96, 0.02, {"history": 0.29, "income": 0.27, "debt": -0.16, "age": 0.07}),
    ExplanationRun(41, 0.95, 0.01, {"history": 0.30, "income": 0.24, "debt": -0.18, "age": 0.09}),
]

result = gate_release(runs)
print(result)
assert result["passed"] is True
