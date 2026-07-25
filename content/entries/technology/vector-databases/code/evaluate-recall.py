"""Evaluate filtered approximate retrieval against exact cosine search."""

from math import sqrt
from typing import Iterable, Sequence


Record = tuple[str, tuple[float, ...], str]


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        raise ValueError("cosine similarity is undefined for a zero vector")
    return dot / (left_norm * right_norm)


def exact_top_k(
    query: Sequence[float],
    records: Iterable[Record],
    allowed_tenant: str,
    k: int,
) -> list[str]:
    eligible = (record for record in records if record[2] == allowed_tenant)
    ranked = sorted(
        eligible,
        key=lambda record: cosine_similarity(query, record[1]),
        reverse=True,
    )
    return [record_id for record_id, _, _ in ranked[:k]]


def recall_at_k(exact_ids: Sequence[str], approximate_ids: Sequence[str]) -> float:
    if not exact_ids:
        return 1.0
    return len(set(exact_ids) & set(approximate_ids)) / len(exact_ids)


def result_completeness(result_ids: Sequence[str], requested_k: int) -> float:
    return min(len(result_ids), requested_k) / requested_k


if __name__ == "__main__":
    corpus: list[Record] = [
        ("a-incident", (0.95, 0.08, 0.02), "tenant-a"),
        ("a-runbook", (0.88, 0.15, 0.04), "tenant-a"),
        ("a-retro", (0.72, 0.24, 0.10), "tenant-a"),
        ("b-private", (0.99, 0.01, 0.00), "tenant-b"),
        ("a-billing", (0.12, 0.86, 0.05), "tenant-a"),
    ]
    query_vector = (1.0, 0.0, 0.0)
    requested_k = 3

    ground_truth = exact_top_k(query_vector, corpus, "tenant-a", requested_k)

    # This list represents one measured ANN response, not an ANN implementation.
    measured_ann_result = ["a-incident", "a-retro"]

    print("exact:", ground_truth)
    print("ann:", measured_ann_result)
    print(f"recall@{requested_k}: {recall_at_k(ground_truth, measured_ann_result):.2f}")
    print(
        "result completeness:",
        f"{result_completeness(measured_ann_result, requested_k):.2f}",
    )
