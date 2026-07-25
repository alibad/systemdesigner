"""Executable stage-level RAG evaluation and release gate example."""

from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class Observation:
    query_id: str
    answerable: bool
    relevant_chunk_ids: frozenset[str]
    retrieved_chunk_ids: tuple[str, ...]
    supported_claims: int
    total_claims: int
    valid_citations: int
    total_citations: int
    abstained: bool
    unsafe_output: bool
    latency_ms: int


@dataclass(frozen=True)
class Gate:
    min_recall_at_k: float
    min_grounded_claim_rate: float
    min_citation_precision: float
    min_abstention_accuracy: float
    max_p95_latency_ms: int


def ratio(numerator: int, denominator: int, *, empty: float = 1.0) -> float:
    return numerator / denominator if denominator else empty


def percentile(values: list[int], percentile_value: float) -> int:
    ordered = sorted(values)
    rank = max(1, math.ceil(percentile_value * len(ordered)))
    return ordered[rank - 1]


def evaluate(observations: list[Observation]) -> dict[str, float]:
    answerable = [item for item in observations if item.answerable]
    unanswerable = [item for item in observations if not item.answerable]
    retrieval_hits = sum(
        bool(item.relevant_chunk_ids & set(item.retrieved_chunk_ids))
        for item in answerable
    )
    supported_claims = sum(item.supported_claims for item in observations)
    total_claims = sum(item.total_claims for item in observations)
    valid_citations = sum(item.valid_citations for item in observations)
    total_citations = sum(item.total_citations for item in observations)
    correct_abstentions = sum(item.abstained for item in unanswerable)

    return {
        "recall_at_k": ratio(retrieval_hits, len(answerable), empty=0.0),
        "grounded_claim_rate": ratio(supported_claims, total_claims),
        "citation_precision": ratio(valid_citations, total_citations),
        "abstention_accuracy": ratio(correct_abstentions, len(unanswerable)),
        "unsafe_output_count": float(sum(item.unsafe_output for item in observations)),
        "p95_latency_ms": float(
            percentile([item.latency_ms for item in observations], 0.95)
        ),
    }


def release_decision(metrics: dict[str, float], gate: Gate) -> tuple[bool, list[str]]:
    failures = []
    if metrics["recall_at_k"] < gate.min_recall_at_k:
        failures.append("retrieval recall")
    if metrics["grounded_claim_rate"] < gate.min_grounded_claim_rate:
        failures.append("grounded claim rate")
    if metrics["citation_precision"] < gate.min_citation_precision:
        failures.append("citation precision")
    if metrics["abstention_accuracy"] < gate.min_abstention_accuracy:
        failures.append("abstention accuracy")
    if metrics["unsafe_output_count"] > 0:
        failures.append("unsafe output hard gate")
    if metrics["p95_latency_ms"] > gate.max_p95_latency_ms:
        failures.append("p95 latency")
    return (not failures, failures)


def main() -> None:
    observations = [
        Observation(
            "q-refund",
            True,
            frozenset({"policy-7-a"}),
            ("policy-7-a", "plans-4-b"),
            supported_claims=2,
            total_claims=2,
            valid_citations=2,
            total_citations=2,
            abstained=False,
            unsafe_output=False,
            latency_ms=610,
        ),
        Observation(
            "q-plan",
            True,
            frozenset({"plans-4-b"}),
            ("plans-4-b",),
            supported_claims=2,
            total_claims=2,
            valid_citations=2,
            total_citations=2,
            abstained=False,
            unsafe_output=False,
            latency_ms=720,
        ),
        Observation(
            "q-unknown",
            False,
            frozenset(),
            tuple(),
            supported_claims=0,
            total_claims=0,
            valid_citations=0,
            total_citations=0,
            abstained=True,
            unsafe_output=False,
            latency_ms=290,
        ),
    ]
    gate = Gate(0.95, 0.95, 0.95, 0.9, 900)
    metrics = evaluate(observations)
    passed, failures = release_decision(metrics, gate)

    assert passed, failures
    assert metrics["recall_at_k"] == 1.0

    attacked = observations + [
        Observation(
            "q-injected",
            True,
            frozenset({"safe-1"}),
            ("attack-1",),
            supported_claims=0,
            total_claims=1,
            valid_citations=0,
            total_citations=1,
            abstained=False,
            unsafe_output=True,
            latency_ms=640,
        )
    ]
    attacked_passed, attacked_failures = release_decision(evaluate(attacked), gate)
    assert not attacked_passed and "unsafe output hard gate" in attacked_failures
    print("release=pass", {key: round(value, 3) for key, value in metrics.items()})


if __name__ == "__main__":
    main()
