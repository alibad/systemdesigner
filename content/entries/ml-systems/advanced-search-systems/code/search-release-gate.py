"""Fail-closed release gate for a search candidate.

Run with: python3 search-release-gate.py
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SearchRun:
    recall_at_100: float
    ndcg_at_10: float
    p95_ms: float
    timeout_rate: float
    freshness_lag_minutes: float
    forbidden_results: int


def evaluate(baseline, candidate):
    checks = {
        "candidate recall preserved": candidate.recall_at_100 >= baseline.recall_at_100 - 0.01,
        "ranking quality improved": candidate.ndcg_at_10 >= baseline.ndcg_at_10 + 0.01,
        "p95 inside absolute SLO": candidate.p95_ms <= 120,
        "p95 regression bounded": candidate.p95_ms <= baseline.p95_ms * 1.15,
        "timeout rate bounded": candidate.timeout_rate <= 0.01,
        "freshness lag bounded": candidate.freshness_lag_minutes <= 5,
        "authorization fail-closed": candidate.forbidden_results == 0,
    }
    return checks, all(checks.values())


def main():
    baseline = SearchRun(0.94, 0.71, 82, 0.003, 2.0, 0)
    candidate = SearchRun(0.935, 0.735, 91, 0.005, 2.5, 0)
    checks, approved = evaluate(baseline, candidate)

    for name, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'}  {name}")
    print("decision:", "promote to canary" if approved else "reject")
    assert approved


if __name__ == "__main__":
    main()
