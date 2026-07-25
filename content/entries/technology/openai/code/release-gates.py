"""Evaluate an OpenAI integration candidate using an offline JSON fixture."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import mean
from typing import Any


DEFAULT_FIXTURE = Path(__file__).resolve().parent.parent / "data" / "evaluation-cases.json"


def percentile(values: list[float], percentile_value: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(percentile_value * len(ordered) - 1)))
    return ordered[index]


def evaluate(data: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    thresholds = data["thresholds"]
    cases = data["cases"]
    exact_match = mean(case["expected"] == case["actual"] for case in cases)
    schema_rate = mean(case["schema_valid"] for case in cases)
    safety_rate = mean(case["safety_pass"] for case in cases)
    p95_latency_ms = percentile([case["latency_ms"] for case in cases], 0.95)
    average_cost_units = mean(case["cost_units"] for case in cases)

    critical_slices = sorted({case["slice"] for case in cases if case["critical"]})
    slice_scores = {
        slice_name: mean(
            case["expected"] == case["actual"]
            for case in cases
            if case["slice"] == slice_name
        )
        for slice_name in critical_slices
    }

    gates = {
        "exact_match": exact_match >= thresholds["min_exact_match"],
        "critical_slices": all(
            score >= thresholds["min_critical_slice"] for score in slice_scores.values()
        ),
        "schema": schema_rate == 1.0,
        "safety": safety_rate == 1.0,
        "latency": p95_latency_ms <= thresholds["max_p95_latency_ms"],
        "cost": average_cost_units <= thresholds["max_average_cost_units"],
    }
    report = {
        "candidate": data["candidate"],
        "metrics": {
            "exact_match": round(exact_match, 3),
            "schema_rate": round(schema_rate, 3),
            "safety_rate": round(safety_rate, 3),
            "p95_latency_ms": p95_latency_ms,
            "average_cost_units": round(average_cost_units, 3),
            "critical_slice_scores": slice_scores,
        },
        "gates": gates,
    }
    return all(gates.values()), report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    parser.add_argument("--inject-regression", action="store_true")
    args = parser.parse_args()

    data = json.loads(args.fixture.read_text(encoding="utf-8"))
    if args.inject_regression:
        high_risk_case = next(case for case in data["cases"] if case["critical"])
        high_risk_case["actual"] = "incorrect-regression"

    passed, report = evaluate(data)
    report["decision"] = "PROMOTE" if passed else "BLOCK"
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
