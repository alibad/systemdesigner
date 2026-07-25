from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class Case:
    case_id: str
    slice_name: str
    text: str | None
    image_uri: str | None
    expected_action: str


def degraded_variants(case: Case) -> list[Case]:
    return [
        case,
        Case(
            case_id=f"{case.case_id}:text-missing",
            slice_name="text-missing",
            text=None,
            image_uri=case.image_uri,
            expected_action="abstain",
        ),
        Case(
            case_id=f"{case.case_id}:image-missing",
            slice_name="image-missing",
            text=case.text,
            image_uri=None,
            expected_action="text-only-fallback",
        ),
    ]


def evaluate(
    cases: list[Case],
    predict: Callable[[Case], str],
) -> dict[str, dict[str, int]]:
    results: dict[str, dict[str, int]] = {}

    for source in cases:
        for case in degraded_variants(source):
            bucket = results.setdefault(case.slice_name, {"correct": 0, "total": 0})
            bucket["total"] += 1
            bucket["correct"] += int(predict(case) == case.expected_action)

    return results
