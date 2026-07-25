"""Evaluate approximate retrieval against an exact-search reference set."""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from statistics import mean


Vector = tuple[float, ...]


@dataclass(frozen=True)
class Document:
    point_id: str
    vector: Vector
    tenant: str


def cosine_similarity(left: Vector, right: Vector) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        raise ValueError("cosine similarity requires non-zero vectors")
    return dot / (left_norm * right_norm)


def exact_top_k(
    query: Vector,
    corpus: list[Document],
    *,
    tenant: str,
    top_k: int,
) -> list[str]:
    eligible = [document for document in corpus if document.tenant == tenant]
    ranked = sorted(
        eligible,
        key=lambda document: cosine_similarity(query, document.vector),
        reverse=True,
    )
    return [document.point_id for document in ranked[:top_k]]


def recall_at_k(expected: list[str], observed: list[str]) -> float:
    if not expected:
        return 1.0
    return len(set(expected) & set(observed)) / len(expected)


def evaluate_queries(
    ground_truth: list[list[str]],
    approximate_results: list[list[str]],
) -> float:
    if len(ground_truth) != len(approximate_results):
        raise ValueError("each query needs one exact and one approximate result")
    return mean(
        recall_at_k(expected, observed)
        for expected, observed in zip(ground_truth, approximate_results)
    )


if __name__ == "__main__":
    documents = [
        Document("a", (1.0, 0.0), "blue"),
        Document("b", (0.9, 0.1), "blue"),
        Document("c", (0.8, 0.2), "blue"),
        Document("d", (0.7, 0.3), "blue"),
        Document("blocked", (1.0, 0.0), "red"),
    ]
    truth = exact_top_k((1.0, 0.0), documents, tenant="blue", top_k=3)
    ann_result = ["a", "c", "d"]
    score = evaluate_queries([truth], [ann_result])
    assert truth == ["a", "b", "c"]
    assert round(score, 3) == 0.667
    print({"exact": truth, "approximate": ann_result, "recall_at_3": round(score, 3)})
