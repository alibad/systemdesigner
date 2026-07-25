from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Sequence


@dataclass(frozen=True)
class ReplayCase:
    acceptable_source_ids: frozenset[str]
    required_fact_ids: frozenset[str]
    retrieved_source_ids: tuple[str, ...]
    retrieved_fact_ids: tuple[frozenset[str], ...]
    leaked_source_ids: frozenset[str]


def recall_at_k(case: ReplayCase, k: int) -> float:
    retrieved = set(case.retrieved_source_ids[:k])
    return float(bool(retrieved & case.acceptable_source_ids))


def precision_at_k(case: ReplayCase, k: int) -> float:
    retrieved = case.retrieved_source_ids[:k]
    if not retrieved:
        return 0.0
    relevant = sum(source_id in case.acceptable_source_ids for source_id in retrieved)
    return relevant / len(retrieved)


def fact_coverage(case: ReplayCase, k: int) -> float:
    if not case.required_fact_ids:
        return 1.0
    observed = set().union(*case.retrieved_fact_ids[:k]) if case.retrieved_fact_ids[:k] else set()
    return len(observed & case.required_fact_ids) / len(case.required_fact_ids)


def evaluate(cases: Sequence[ReplayCase], k: int = 5) -> dict[str, float]:
    if not cases:
        raise ValueError("at least one replay case is required")

    return {
        f"recall_at_{k}": mean(recall_at_k(case, k) for case in cases),
        f"precision_at_{k}": mean(precision_at_k(case, k) for case in cases),
        f"fact_coverage_at_{k}": mean(fact_coverage(case, k) for case in cases),
        "policy_leakage_rate": mean(bool(case.leaked_source_ids) for case in cases),
    }
