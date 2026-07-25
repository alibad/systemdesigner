from dataclasses import dataclass


@dataclass(frozen=True)
class EvaluationCase:
    question_id: str
    oracle_passage_ids: set[str]
    answer_supported: bool


@dataclass(frozen=True)
class ModelResult:
    answer_correct: bool
    cited_passage_ids: set[str]
    abstained: bool


def grade_case(case: EvaluationCase, result: ModelResult) -> dict[str, bool]:
    cited_oracle = bool(case.oracle_passage_ids & result.cited_passage_ids)
    unsupported_answer = not case.answer_supported and not result.abstained

    return {
        "answer_correct": result.answer_correct,
        "citation_correct": cited_oracle if case.answer_supported else result.abstained,
        "unsupported_answer": unsupported_answer,
    }


def summarize(rows: list[dict[str, bool]]) -> dict[str, float]:
    if not rows:
        raise ValueError("evaluation requires at least one graded case")

    count = len(rows)
    return {
        "answer_accuracy": sum(row["answer_correct"] for row in rows) / count,
        "citation_correctness": sum(row["citation_correct"] for row in rows) / count,
        "unsupported_answer_rate": (
            sum(row["unsupported_answer"] for row in rows) / count
        ),
    }
