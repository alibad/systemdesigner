"""Assign every retrieval-QA record to one auditable outcome bucket."""

from collections import Counter
from dataclasses import dataclass
from typing import Literal


Outcome = Literal[
    "supported_correct",
    "retrieval_miss",
    "reader_error",
    "correct_abstention",
    "unsupported_answer",
]


@dataclass(frozen=True)
class PipelineRecord:
    question_id: str
    answerable: bool
    accepted_answer_retrieved: bool
    reader_correct: bool
    abstained: bool


def classify(record: PipelineRecord) -> Outcome:
    if not record.answerable:
        return "correct_abstention" if record.abstained else "unsupported_answer"
    if not record.accepted_answer_retrieved:
        return "retrieval_miss"
    if record.reader_correct and not record.abstained:
        return "supported_correct"
    return "reader_error"


def summarize(records: list[PipelineRecord]) -> dict[str, int]:
    outcomes = Counter(classify(record) for record in records)
    return {
        outcome: outcomes[outcome]
        for outcome in (
            "supported_correct",
            "retrieval_miss",
            "reader_error",
            "correct_abstention",
            "unsupported_answer",
        )
    }


if __name__ == "__main__":
    sample = [
        PipelineRecord("q1", True, True, True, False),
        PipelineRecord("q2", True, False, False, True),
        PipelineRecord("q3", True, True, False, False),
        PipelineRecord("q4", False, False, False, True),
        PipelineRecord("q5", False, False, False, False),
    ]
    print(summarize(sample))
