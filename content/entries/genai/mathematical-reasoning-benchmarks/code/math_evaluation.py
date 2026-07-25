"""Small, auditable scoring contract for scalar MATH and GSM8K answers.

Production evaluators should add a sandboxed symbolic checker for supported
expression classes. They should not broaden this numeric parser until every new
syntax has equivalence and non-equivalence fixtures.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from fractions import Fraction
import re
from typing import Iterable, Literal


Dataset = Literal["MATH", "GSM8K"]
Status = Literal["pass", "wrong_answer", "parse_failure"]

FINAL_PATTERNS: dict[Dataset, tuple[re.Pattern[str], ...]] = {
    "GSM8K": (
        re.compile(r"####\s*(?P<answer>[^\n]+)\s*$"),
        re.compile(r"FINAL:\s*(?P<answer>[^\n]+)\s*$", re.IGNORECASE),
    ),
    "MATH": (
        re.compile(r"\\boxed\{(?P<answer>[^{}]+)\}\s*$"),
        re.compile(r"FINAL:\s*(?P<answer>[^\n]+)\s*$", re.IGNORECASE),
    ),
}


@dataclass(frozen=True)
class ScoreResult:
    task_id: str
    status: Status
    extracted: str | None
    normalized: Fraction | None
    expected: Fraction


def extract_final(response: str, dataset: Dataset) -> str | None:
    """Extract only a declared final field, never an arbitrary number in prose."""
    text = response.strip()
    for pattern in FINAL_PATTERNS[dataset]:
        matches = list(pattern.finditer(text))
        if matches:
            return matches[-1].group("answer").strip()
    return None


def parse_scalar(raw: str) -> Fraction:
    """Parse a deliberately small grammar: signed integer, decimal, or fraction."""
    token = raw.strip().replace(",", "")
    token = re.sub(r"^\$", "", token)
    token = re.sub(r"\s*(?:dollars?|usd)\s*$", "", token, flags=re.IGNORECASE)

    if re.fullmatch(r"[+-]?\d+\s*/\s*[+-]?\d+", token):
        numerator, denominator = token.split("/", maxsplit=1)
        return Fraction(int(numerator), int(denominator))

    if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", token):
        raise ValueError(f"unsupported scalar syntax: {raw!r}")

    try:
        return Fraction(Decimal(token))
    except (InvalidOperation, ZeroDivisionError) as error:
        raise ValueError(f"invalid scalar: {raw!r}") from error


def score_response(
    *,
    task_id: str,
    dataset: Dataset,
    response: str,
    expected: str,
) -> ScoreResult:
    expected_value = parse_scalar(expected)
    extracted = extract_final(response, dataset)
    if extracted is None:
        return ScoreResult(task_id, "parse_failure", None, None, expected_value)

    try:
        normalized = parse_scalar(extracted)
    except ValueError:
        return ScoreResult(task_id, "parse_failure", extracted, None, expected_value)

    status: Status = "pass" if normalized == expected_value else "wrong_answer"
    return ScoreResult(task_id, status, extracted, normalized, expected_value)


def summarize(results: Iterable[ScoreResult]) -> dict[str, float | int]:
    rows = list(results)
    if not rows:
        raise ValueError("cannot summarize an empty evaluation")

    passed = sum(result.status == "pass" for result in rows)
    parse_failures = sum(result.status == "parse_failure" for result in rows)
    return {
        "tasks": len(rows),
        "accuracy": passed / len(rows),
        "parse_failure_rate": parse_failures / len(rows),
    }


if __name__ == "__main__":
    sample = [
        score_response(
            task_id="gsm8k-eggs",
            dataset="GSM8K",
            response="Nine eggs remain, so revenue is 9 x 2.\n#### 18",
            expected="18",
        ),
        score_response(
            task_id="math-fraction",
            dataset="MATH",
            response="The reduced result is one half.\nFINAL: 0.5",
            expected="1/2",
        ),
        score_response(
            task_id="math-missing-final",
            dataset="MATH",
            response="Intermediate values are 4, 7, and 11.",
            expected="11",
        ),
    ]
    print(summarize(sample))
