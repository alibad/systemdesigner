"""Compute field extraction metrics overall and by document slice.

Run with: python3 evaluate_parser.py
"""

from dataclasses import dataclass
from typing import Dict, Iterable, List, Mapping, Optional, Tuple


@dataclass(frozen=True)
class Example:
    example_id: str
    slices: Tuple[str, ...]
    truth: Mapping[str, Optional[str]]
    prediction: Mapping[str, Optional[str]]


def normalize(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return " ".join(value.casefold().split())


def field_counts(examples: Iterable[Example]) -> Dict[str, int]:
    expected = 0
    predicted = 0
    correct = 0
    documents_exact = 0
    total_documents = 0

    for example in examples:
        total_documents += 1
        field_ids = set(example.truth) | set(example.prediction)
        document_correct = True
        for field_id in field_ids:
            truth = normalize(example.truth.get(field_id))
            prediction = normalize(example.prediction.get(field_id))
            expected += int(truth is not None)
            predicted += int(prediction is not None)
            correct += int(truth is not None and prediction == truth)
            if prediction != truth:
                document_correct = False
        documents_exact += int(document_correct)

    return {
        "documents": total_documents,
        "expected": expected,
        "predicted": predicted,
        "correct": correct,
        "documents_exact": documents_exact,
    }


def rates(counts: Mapping[str, int]) -> Dict[str, float]:
    precision = counts["correct"] / counts["predicted"] if counts["predicted"] else 0.0
    recall = counts["correct"] / counts["expected"] if counts["expected"] else 0.0
    document_exact = (
        counts["documents_exact"] / counts["documents"] if counts["documents"] else 0.0
    )
    return {
        "field_precision": precision,
        "field_recall": recall,
        "document_exact_match": document_exact,
    }


def evaluate_by_slice(examples: List[Example]) -> Dict[str, Dict[str, float]]:
    slice_names = sorted({name for example in examples for name in example.slices})
    result = {"overall": rates(field_counts(examples))}
    for slice_name in slice_names:
        members = [example for example in examples if slice_name in example.slices]
        result[slice_name] = rates(field_counts(members))
    return result


def demo() -> None:
    examples = [
        Example(
            "digital-1",
            ("source:digital", "layout:single-column"),
            {"invoice_id": "A-100", "total": "109.00"},
            {"invoice_id": "A-100", "total": "109.00"},
        ),
        Example(
            "scan-1",
            ("source:scan", "layout:borderless-table"),
            {"invoice_id": "B-200", "total": "87.40"},
            {"invoice_id": "B-200", "total": "37.40"},
        ),
        Example(
            "scan-2",
            ("source:scan", "quality:skewed"),
            {"invoice_id": "C-300", "total": "42.00"},
            {"invoice_id": "C-300", "total": None},
        ),
    ]

    report = evaluate_by_slice(examples)
    assert report["source:digital"]["document_exact_match"] == 1.0
    assert report["source:scan"]["document_exact_match"] == 0.0
    assert report["overall"]["field_recall"] < report["source:digital"]["field_recall"]

    for slice_name, metrics in report.items():
        formatted = ", ".join(f"{name}={value:.3f}" for name, value in metrics.items())
        print(f"{slice_name}: {formatted}")


if __name__ == "__main__":
    demo()
