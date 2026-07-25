"""Fail-closed scoring for short-answer and no-answer QA records."""

from collections import Counter
from dataclasses import dataclass
import re
import string


def normalize_answer(value: str) -> str:
    """Normalize documented surface differences, not answer meaning."""
    lowered = value.lower()
    without_punctuation = "".join(
        character for character in lowered if character not in string.punctuation
    )
    without_articles = re.sub(r"\b(a|an|the)\b", " ", without_punctuation)
    return " ".join(without_articles.split())


def token_f1(prediction: str, answer: str) -> float:
    predicted_tokens = normalize_answer(prediction).split()
    answer_tokens = normalize_answer(answer).split()
    if not predicted_tokens or not answer_tokens:
        return float(predicted_tokens == answer_tokens)

    shared = sum((Counter(predicted_tokens) & Counter(answer_tokens)).values())
    if shared == 0:
        return 0.0

    precision = shared / len(predicted_tokens)
    recall = shared / len(answer_tokens)
    return 2 * precision * recall / (precision + recall)


@dataclass(frozen=True)
class QAExample:
    question_id: str
    prediction: str
    accepted_answers: tuple[str, ...]
    answerable: bool


def score(example: QAExample) -> dict[str, float | str]:
    normalized_prediction = normalize_answer(example.prediction)

    if not example.answerable:
        correct_abstention = float(normalized_prediction == "")
        return {
            "status": "correct_abstention" if correct_abstention else "unsupported_answer",
            "exact_match": correct_abstention,
            "token_f1": correct_abstention,
        }

    if not example.accepted_answers:
        raise ValueError(f"{example.question_id}: answerable item has no accepted answers")

    exact_match = float(
        any(
            normalized_prediction == normalize_answer(answer)
            for answer in example.accepted_answers
        )
    )
    best_f1 = max(
        token_f1(example.prediction, answer) for answer in example.accepted_answers
    )
    return {
        "status": "correct" if exact_match else "answer_mismatch",
        "exact_match": exact_match,
        "token_f1": best_f1,
    }


if __name__ == "__main__":
    records = [
        QAExample("t1", "Austin, Texas", ("Austin", "Austin, Texas"), True),
        QAExample("n1", "", (), False),
        QAExample("s1", "Denver Broncos", ("the Denver Broncos",), True),
    ]
    for record in records:
        print(record.question_id, score(record))
